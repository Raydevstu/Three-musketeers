import test from 'node:test';
import assert from 'node:assert/strict';
import { createBrowserConnector, createConnectorBridgeServer } from '../src/connector-bridge.mjs';

test('connector bridge requires approval and forwards browser actions', async () => {
  const calls = [];
  const connector = createBrowserConnector({ exec: async (_command, args) => { calls.push(args); return { stdout: JSON.stringify({ session_id: 's1', ok: true }) }; } });
  const server = createConnectorBridgeServer({ connector, authToken: 'bridge-token', port: 0 });
  try {
    const port = server.address().port;
    const base = `http://127.0.0.1:${port}/execute`;
    const denied = await fetch(base, { method: 'POST', headers: { authorization: 'Bearer bridge-token', 'content-type': 'application/json' }, body: JSON.stringify({ action: 'observe' }) });
    assert.equal(denied.status, 422);
    const response = await fetch(base, { method: 'POST', headers: { authorization: 'Bearer bridge-token', 'content-type': 'application/json' }, body: JSON.stringify({ action: 'observe', approved: true }) });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).session_id, 's1');
    assert.ok(calls.length > 0);
  } finally { await new Promise((resolve) => server.close(resolve)); }
});

test('browser connector maps approved action arguments to bsk contracts', async () => {
  const calls = [];
  const connector = createBrowserConnector({ exec: async (_command, args) => {
    calls.push(args);
    return { stdout: JSON.stringify(calls.length === 1 ? { session_id: 's2' } : { ok: true }) };
  } });
  await connector.execute({ action: 'navigate', url: 'https://example.com' });
  await connector.execute({ action: 'click', ref: '@e1' });
  await connector.execute({ action: 'fill', ref: '@e2', value: 'hello' });
  await connector.execute({ action: 'screenshot', full_page: true, out: 'capture.png' });
  assert.deepEqual(calls[1], ['navigate', 'https://example.com', '--session', 's2', '--json']);
  assert.deepEqual(calls[2], ['click', '--ref', '@e1', '--session', 's2', '--json']);
  assert.deepEqual(calls[3], ['fill', '--ref', '@e2', '--value', 'hello', '--session', 's2', '--json']);
  assert.deepEqual(calls[4], ['screenshot', '--full-page', '--out', 'capture.png', '--session', 's2', '--json']);
});
