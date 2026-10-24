import pg from 'pg';
import { createLedger } from './ledger.mjs';
import { createWorkerMesh } from './orchestration.mjs';

const { Pool } = pg;

export async function claimAndRun(pool, mesh) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const claimed = await client.query("SELECT name, request FROM jobs WHERE state = 'queued' ORDER BY updated_at FOR UPDATE SKIP LOCKED LIMIT 1");
    if (!claimed.rows.length) { await client.query('ROLLBACK'); return null; }
    const job = claimed.rows[0];
    const execution = (await client.query('INSERT INTO executions (job_name, state) VALUES ($1, $2) RETURNING id', [job.name, 'running'])).rows[0];
    await client.query("UPDATE jobs SET state = 'running', updated_at = now() WHERE name = $1", [job.name]);
    await client.query('COMMIT');
    let result;
    try { result = await mesh.delegate(job.request); }
    catch (error) { result = { status: 'failed', error: error.message }; }
    const state = result?.status === 'failed' || result?.result?.status === 'failed' ? 'failed' : 'succeeded';
    await pool.query('UPDATE executions SET state = $1, result = $2, error = $3, finished_at = now() WHERE id = $4; UPDATE jobs SET state = $1, updated_at = now() WHERE name = $5', [state, result, result.error ?? null, execution.id, job.name]);
    if (state === 'failed') await pool.query('INSERT INTO dead_letter_jobs (execution_id, job_name, error, attempts) VALUES ($1, $2, $3, $4)', [execution.id, job.name, result.error ?? 'worker failed', 1]);
    return { job: job.name, state, result };
  } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; } finally { client.release(); }
}

export async function startWorker({ databaseUrl = process.env.DATABASE_URL, pollMs = 1000 } = {}) {
  if (!databaseUrl) throw new Error('DATABASE_URL is required for the worker');
  const pool = new Pool({ connectionString: databaseUrl });
  const ledger = await createLedger(null, databaseUrl);
  const mesh = createWorkerMesh({ ledger });
  const timer = setInterval(() => claimAndRun(pool, mesh).catch((error) => console.error('worker cycle failed', error)), pollMs);
  return { pool, stop: async () => { clearInterval(timer); await pool.end(); } };
}

if (import.meta.url === `file://${process.argv[1]}`) startWorker().catch((error) => { console.error(error); process.exitCode = 1; });
