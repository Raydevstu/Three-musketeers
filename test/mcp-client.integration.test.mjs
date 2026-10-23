import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createGatewayServer } from '../src/server.mjs';
import { createLedger } from '../src/ledger.mjs';

async function startServer(root) {
  const server = createGatewayServer({
    providerUrl: '', provider: 'local', model: 'test-model', ledger: await createLedger(),
    retrievalRoot: root, authToken: 'mcp-test-token'
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return server;
}

async function mcpCall(baseUrl, body) {
  return fetch(`${baseUrl}/mcp`, {
    method: 'POST',
    headers: { authorization: 'Bearer mcp-test-token', 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
}

test('real MCP client flow authenticates, lists profiles, retrieves safely, and denies traversal', async () => {
  const root = await mkdtemp(join(tmpdir(), 'governor-mcp-'));
  await writeFile(join(root, 'readme.txt'), 'safe retrieval content');
  const server = await startServer(root);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await fetch(`${baseUrl}/mcp`, { method: 'POST' })).status, 401);

    const profiles = await mcpCall(baseUrl, { method: 'profiles/list' });
    assert.equal(profiles.status, 200);
    assert.deepEqual((await profiles.json()).profiles.review, { max_output_chars: 4000 });

    const retrieval = await mcpCall(baseUrl, { method: 'retrieval/read', profile: 'review', path: 'readme.txt', max_output_chars: 4000 });
    assert.equal(retrieval.status, 200);
    assert.equal((await retrieval.json()).content, 'safe retrieval content');

    const traversal = await mcpCall(baseUrl, { method: 'retrieval/read', profile: 'review', path: '../readme.txt', max_output_chars: 4000 });
    assert.equal(traversal.status, 403);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await rm(root, { recursive: true, force: true });
  }
});
