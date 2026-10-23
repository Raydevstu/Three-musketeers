import test from 'node:test';
import assert from 'node:assert/strict';
import { createGatewayServer } from '../src/server.mjs';
import { createLedger, readLedger } from '../src/ledger.mjs';

test('serves a local streaming gateway endpoint', async () => {
  const ledger = await createLedger();
  const upstream = async () => new Response('data: {"usage":{"prompt_tokens":3,"completion_tokens":1}}\n\n', { status: 200 });
  const server = createGatewayServer({ providerUrl: 'https://provider.test/chat', provider: 'openai', model: 'test-model', ledger, fetchImpl: upstream });
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const health = await fetch(`http://127.0.0.1:${port}/health`);
  assert.equal(health.status, 200);
  const response = await fetch(`http://127.0.0.1:${port}/v1/chat`, { method: 'POST', body: JSON.stringify({ messages: [] }) });
  assert.equal(response.status, 200);
  assert.match(await response.text(), /usage/);
  assert.equal((await readLedger(ledger)).length, 1);
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test('keeps liveness public while protecting readiness', async () => {
  const ledger = await createLedger();
  const server = createGatewayServer({ providerUrl: '', provider: 'local', model: 'test', ledger, authToken: 'test-token' });
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  assert.equal((await fetch(`http://127.0.0.1:${port}/health`)).status, 200);
  assert.equal((await fetch(`http://127.0.0.1:${port}/ready`)).status, 401);
  const ready = await fetch(`http://127.0.0.1:${port}/ready`, { headers: { authorization: 'Bearer test-token' } });
  assert.equal(ready.status, 200);
  assert.equal((await ready.json()).status, 'ready');
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test('checks the configured database before reporting readiness', async () => {
  let query;
  const ledger = { pool: { query: async (sql) => { query = sql; return { rows: [{ '?column?': 1 }] }; } } };
  const server = createGatewayServer({ providerUrl: '', provider: 'local', model: 'test', ledger });
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const ready = await fetch(`http://127.0.0.1:${port}/ready`);
  assert.equal(ready.status, 200);
  assert.equal((await ready.json()).database, 'ready');
  assert.equal(query, 'SELECT 1');
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test('returns 503 when the configured database readiness check fails', async () => {
  const ledger = { pool: { query: async () => { throw new Error('database unavailable'); } } };
  const server = createGatewayServer({ providerUrl: '', provider: 'local', model: 'test', ledger });
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const ready = await fetch(`http://127.0.0.1:${port}/ready`);
  assert.equal(ready.status, 503);
  assert.deepEqual(await ready.json(), { status: 'unavailable', ledger: 'configured', database: 'unavailable' });
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test('serves a bounded MCP retrieval method', async () => {
  const ledger = await createLedger();
  const server = createGatewayServer({ providerUrl: 'https://provider.test/chat', provider: 'openai', model: 'test-model', ledger });
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/mcp`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ method: 'profiles/list' })
  });
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).profiles.review, { max_output_chars: 4000 });
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test('serves a read-only optimization inspection method', async () => {
  const ledger = await createLedger();
  const server = createGatewayServer({ providerUrl: '', provider: 'local', model: 'test', ledger });
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/optimization/inspect`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ previous: { files_code: ['a'] }, current: { files_code: ['b'] }, requested_tokens: 2, telemetry: { prompt_tokens: 1, timestamp: new Date().toISOString() }, budget: 3, routes: ['fast'] })
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(body.decision, { route: 'fast', reason: 'within_budget', evidence: 'authoritative', applied_route: null, mode: 'off' });
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});
