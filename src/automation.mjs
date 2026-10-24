import { createServer } from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const AUTOMATION_SCHEMA = `
CREATE TABLE IF NOT EXISTS jobs (name text PRIMARY KEY, request jsonb NOT NULL, every_ms integer, state text NOT NULL DEFAULT 'idle', updated_at timestamptz NOT NULL DEFAULT now(), last_enqueued_at timestamptz);
CREATE TABLE IF NOT EXISTS executions (id bigserial PRIMARY KEY, job_name text NOT NULL REFERENCES jobs(name), state text NOT NULL, result jsonb, error text, started_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz);
CREATE TABLE IF NOT EXISTS job_attempts (id bigserial PRIMARY KEY, execution_id bigint NOT NULL REFERENCES executions(id) ON DELETE CASCADE, attempt integer NOT NULL, state text NOT NULL, result jsonb, error text, occurred_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS dead_letter_jobs (id bigserial PRIMARY KEY, execution_id bigint NOT NULL REFERENCES executions(id) ON DELETE CASCADE, job_name text NOT NULL, error text NOT NULL, attempts integer NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS webhook_events (event_id text PRIMARY KEY, job_name text NOT NULL, received_at timestamptz NOT NULL DEFAULT now());
`;

export function createAutomationRunner({ mesh, jobs = [], retries = 0, retry_delay_ms = 25, stateFile = null, pool = null }) {
  const timers = new Map();
  const state = stateFile ? loadState(stateFile) : { jobs: {} };
  let schemaPromise;
  const ensureSchema = () => pool ? (schemaPromise ??= pool.query(AUTOMATION_SCHEMA)) : Promise.resolve();
  const persist = () => {
    if (!stateFile) return;
    mkdirSync(dirname(stateFile), { recursive: true });
    writeFileSync(stateFile, JSON.stringify(state, null, 2));
  };
  return {
    list: async () => {
      await ensureSchema();
      if (pool) {
        const result = await pool.query('SELECT name, every_ms, state, (SELECT count(*)::int FROM job_attempts a JOIN executions e ON e.id = a.execution_id WHERE e.job_name = jobs.name) AS attempts FROM jobs ORDER BY name');
        return result.rows;
      }
      return jobs.map(({ name, every_ms }) => {
      const result = { name };
      if (every_ms !== undefined) result.every_ms = every_ms;
      if (state.jobs[name]) { result.state = state.jobs[name].state; result.attempts = state.jobs[name].attempts; }
      return result;
      });
    },
    deadLetters: async () => pool ? (await ensureSchema(), (await pool.query('SELECT * FROM dead_letter_jobs ORDER BY created_at DESC')).rows) : Object.values(state.jobs).filter((job) => job.state === 'dead_letter'),
    async run(name) {
      const job = jobs.find((candidate) => candidate.name === name);
      if (!job) throw new Error('automation job not found');
      await ensureSchema();
      let executionId = null;
      if (pool) {
        await pool.query('INSERT INTO jobs (name, request, every_ms, state) VALUES ($1, $2, $3, $4) ON CONFLICT (name) DO UPDATE SET request = EXCLUDED.request, every_ms = EXCLUDED.every_ms, state = EXCLUDED.state, updated_at = now()', [name, job.request, job.every_ms ?? null, 'running']);
        executionId = (await pool.query('INSERT INTO executions (job_name, state) VALUES ($1, $2) RETURNING id', [name, 'running'])).rows[0].id;
      }
      const record = state.jobs[name] = { name, state: 'running', attempts: 0, updated_at: new Date().toISOString() };
      persist();
      let lastError;
      for (let attempt = 0; attempt <= retries; attempt += 1) {
        record.attempts = attempt + 1;
        try {
          const result = await mesh.delegate(job.request);
          if (pool) await pool.query('INSERT INTO job_attempts (execution_id, attempt, state, result) VALUES ($1, $2, $3, $4)', [executionId, attempt + 1, 'succeeded', result]);
          record.state = 'succeeded'; record.result = result; record.updated_at = new Date().toISOString(); persist();
          if (pool) await pool.query('UPDATE executions SET state = $1, result = $2, finished_at = now() WHERE id = $3; UPDATE jobs SET state = $1, updated_at = now() WHERE name = $4', ['succeeded', result, executionId, name]);
          return result;
        } catch (error) {
          lastError = error;
          if (pool) await pool.query('INSERT INTO job_attempts (execution_id, attempt, state, error) VALUES ($1, $2, $3, $4)', [executionId, attempt + 1, 'failed', error.message]);
          record.error = error.message; record.updated_at = new Date().toISOString(); persist();
          if (attempt < retries) await new Promise((resolve) => setTimeout(resolve, retry_delay_ms));
        }
      }
      record.state = 'dead_letter'; record.updated_at = new Date().toISOString(); persist();
      if (pool) await pool.query('UPDATE executions SET state = $1, error = $2, finished_at = now() WHERE id = $3; UPDATE jobs SET state = $1, updated_at = now() WHERE name = $4; INSERT INTO dead_letter_jobs (execution_id, job_name, error, attempts) VALUES ($3, $4, $2, $5)', ['dead_letter', lastError.message, executionId, name, record.attempts]);
      throw lastError;
    },
    start() { for (const job of jobs) timers.set(job.name, setInterval(() => this.run(job.name).catch(() => {}), job.every_ms)); return this; },
    stop() { for (const timer of timers.values()) clearInterval(timer); timers.clear(); }
  };
}

function loadState(file) {
  try { return JSON.parse(readFileSync(file, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; return { jobs: {} }; }
}

export function createWebhookServer({ runner, authToken = null, signingSecret = null, maxBodyBytes = 1_048_576 }) {
  return createServer(async (request, response) => {
    const match = request.url?.match(/^\/automation\/([^/]+)$/);
    if (request.method !== 'POST' || !match || (authToken && request.headers.authorization !== `Bearer ${authToken}`)) { response.writeHead(404); response.end(); return; }
    try {
      const chunks = []; let size = 0;
      for await (const chunk of request) { size += chunk.length; if (size > maxBodyBytes) throw new Error('request body too large'); chunks.push(chunk); }
      const body = Buffer.concat(chunks);
      if (signingSecret) {
        const expected = `sha256=${createHmac('sha256', signingSecret).update(body).digest('hex')}`;
        const actual = request.headers['x-governor-signature'];
        if (!actual || actual.length !== expected.length || !timingSafeEqual(Buffer.from(actual), Buffer.from(expected))) { response.writeHead(401); response.end(JSON.stringify({ error: 'invalid webhook signature' })); return; }
      }
      const result = await runner.run(match[1]); response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify(result));
    }
    catch (error) { response.writeHead(400, { 'content-type': 'application/json' }); response.end(JSON.stringify({ error: error.message })); }
  });
}
