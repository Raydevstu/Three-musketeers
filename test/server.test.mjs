import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer as createHttpServer } from 'node:http';
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

test('verifies /v1/chat against a safe streaming mock provider', async () => {
  const provider = createHttpServer((request, response) => {
    if (request.method !== 'POST' || request.url !== '/v1/chat') {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { 'content-type': 'text/event-stream' });
    response.end('data: {"choices":[{"delta":{"content":"mock"}}]}\n\ndata: {"usage":{"prompt_tokens":3,"completion_tokens":1}}\n\n');
  });
  await new Promise((resolve) => provider.listen(0, '127.0.0.1', resolve));
  const providerPort = provider.address().port;
  const ledger = await createLedger();
  const server = createGatewayServer({ providerUrl: `http://127.0.0.1:${providerPort}/v1/chat`, provider: 'mock', model: 'mock-model', ledger });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const response = await fetch(`http://127.0.0.1:${port}/v1/chat`, { method: 'POST', body: JSON.stringify({ messages: [{ role: 'user', content: 'safe test' }] }) });
  assert.equal(response.status, 200);
  assert.match(await response.text(), /mock/);
  assert.deepEqual((await readLedger(ledger))[0], {
    schema_version: '1.0.0', provider: 'mock', model_id: 'mock-model', latency_ms: 0,
    prompt_tokens: 3, completion_tokens: 1, cached_tokens: 0,
    context_breakdown: { system_instructions: 0, memory_skills: 0, tool_schemas: 0, files_code: 0, tool_output_logs: 0, history: 0 },
    timestamp: (await readLedger(ledger))[0].timestamp, estimated_cost_usd: 0
  });
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await new Promise((resolve, reject) => provider.close((error) => error ? reject(error) : resolve()));
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

test('exposes protected request metrics and structured request logs', async () => {
  const ledger = await createLedger();
  const logs = [];
  const server = createGatewayServer({ providerUrl: '', provider: 'local', model: 'test', ledger, authToken: 'metrics-token', logger: { info: (entry) => logs.push(entry) } });
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  assert.equal((await fetch(`http://127.0.0.1:${port}/metrics`)).status, 401);
  const metrics = await fetch(`http://127.0.0.1:${port}/metrics`, { headers: { authorization: 'Bearer metrics-token' } });
  assert.equal(metrics.status, 200);
  assert.match(await metrics.text(), /governor_requests_total/);
  assert.ok(logs.some((entry) => entry.event === 'http_request' && entry.path === '/metrics'));
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test('does not expose metrics when authentication is not configured', async () => {
  const server = createGatewayServer({ providerUrl: '', provider: 'local', model: 'test', ledger: await createLedger() });
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  try {
    const response = await fetch(`http://127.0.0.1:${port}/metrics`);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: 'metrics authentication not configured' });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test('runs observe routing from authoritative gateway telemetry without applying a route', async () => {
  const ledger = await createLedger();
  const upstream = async () => new Response('data: {"usage":{"prompt_tokens":8,"completion_tokens":2}}\n\n', { status: 200 });
  const server = createGatewayServer({ providerUrl: 'http://mock-provider/v1/chat', provider: 'mock', model: 'mock-model', ledger, fetchImpl: upstream });
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  try {
    const chat = await fetch(`http://127.0.0.1:${port}/v1/chat`, { method: 'POST', body: JSON.stringify({ messages: [] }) });
    assert.equal(chat.status, 200);
    const [telemetry] = await readLedger(ledger);
    const inspection = await fetch(`http://127.0.0.1:${port}/optimization/inspect`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        previous: { files_code: ['old.js'] }, current: { files_code: ['new.js'] },
        requested_tokens: telemetry.prompt_tokens, telemetry, budget: 20,
        routes: ['fast'], context_categories: ['files_code'], routing_mode: 'observe', turn_id: 'observe-test'
      })
    });
    assert.equal(inspection.status, 200);
    const body = await inspection.json();
    assert.equal(body.decision.route, 'fast');
    assert.equal(body.decision.mode, 'observe');
    assert.equal(body.decision.applied_route, null);
    assert.equal(ledger.routeDecisions.at(-1).decision.mode, 'observe');
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test('rejects oversized chat requests with 413', async () => {
  const ledger = await createLedger();
  const server = createGatewayServer({ providerUrl: '', provider: 'local', model: 'test', ledger, maxBodyBytes: 32 });
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  try {
    const response = await fetch(`http://127.0.0.1:${port}/v1/chat`, { method: 'POST', body: JSON.stringify({ content: 'this request is larger than thirty-two bytes' }) });
    assert.equal(response.status, 413);
    assert.deepEqual(await response.json(), { error: 'request body too large' });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
