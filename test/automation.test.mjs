import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHmac } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAutomationRunner, createWebhookServer } from '../src/automation.mjs';

function listen(server) { return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port))); }
function close(server) { return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }

test('automation retries a failed delegation and then succeeds', async () => {
  let attempts = 0;
  const runner = createAutomationRunner({ mesh: { delegate: async () => { attempts += 1; if (attempts < 2) throw new Error('temporary'); return { status: 'succeeded' }; } }, jobs: [{ name: 'job', request: {} }], retries: 1, retry_delay_ms: 1 });
  assert.deepEqual(await runner.run('job'), { status: 'succeeded' });
  assert.equal(attempts, 2);
});

test('webhook requires a valid HMAC signature', async () => {
  const runner = createAutomationRunner({ mesh: { delegate: async () => ({ status: 'succeeded' }) }, jobs: [{ name: 'job', request: {} }] });
  const server = createWebhookServer({ runner, signingSecret: 'secret' });
  const port = await listen(server);
  const body = '{}';
  const signature = `sha256=${createHmac('sha256', 'secret').update(body).digest('hex')}`;
  const good = await fetch(`http://127.0.0.1:${port}/automation/job`, { method: 'POST', body, headers: { 'x-governor-signature': signature } });
  const bad = await fetch(`http://127.0.0.1:${port}/automation/job`, { method: 'POST', body, headers: { 'x-governor-signature': 'sha256=bad' } });
  await close(server);
  assert.equal(good.status, 200);
  assert.equal(bad.status, 401);
});

test('scheduler persists success and dead-letter state', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'governor-automation-'));
  const stateFile = join(dir, 'jobs.json');
  let attempts = 0;
  const runner = createAutomationRunner({
    stateFile,
    retries: 1,
    mesh: { delegate: async () => { attempts += 1; throw new Error('offline'); } },
    jobs: [{ name: 'nightly', request: {} }]
  });
  await assert.rejects(() => runner.run('nightly'), /offline/);
  assert.equal(attempts, 2);
  assert.equal((await runner.list())[0].state, 'dead_letter');
  assert.equal((await runner.deadLetters())[0].attempts, 2);
  const persisted = JSON.parse(await readFile(stateFile, 'utf8'));
  assert.equal(persisted.jobs.nightly.state, 'dead_letter');
  await rm(dir, { recursive: true, force: true });
});
