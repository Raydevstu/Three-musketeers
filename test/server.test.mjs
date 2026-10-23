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
