import test from 'node:test';
import assert from 'node:assert/strict';
import { createPromptWorkflow, normalizePromptEvent, verifyHookSignature } from '../src/hooks.mjs';
import { createHmac } from 'node:crypto';
import { createLedger, readEvidenceEvents } from '../src/ledger.mjs';
import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

test('normalizes a platform prompt event', () => {
  const event = normalizePromptEvent({ platform: 'codex', prompt: '  run tests  ', files: ['a.js'] });
  assert.equal(event.platform, 'codex');
  assert.equal(event.prompt, 'run tests');
  assert.deepEqual(event.files, ['a.js']);
});

test('prompt workflow compiles, delegates, and records durable lifecycle evidence', async () => {
  const root = await mkdtemp(join(tmpdir(), 'governor-hooks-'));
  const ledger = await createLedger(join(root, 'evidence.jsonl'));
  const workflow = createPromptWorkflow({
    ledger,
    compiler: { compile: async () => ({ intent_vector: 'run tests', token_budget: 2000 }) },
    mesh: { delegate: async (request) => ({ status: 'succeeded', request }) }
  });
  const result = await workflow.run({ platform: 'codex', prompt: 'run tests' });
  assert.equal(result.result.status, 'succeeded');
  assert.deepEqual((await readEvidenceEvents(ledger, 'prompt_workflow')).map((event) => event.payload.status), ['received', 'compiled', 'completed']);
});

test('prompt workflow returns a durable failure result', async () => {
  const workflow = createPromptWorkflow({ compiler: { compile: async () => { throw new Error('provider unavailable'); } }, mesh: {} });
  const result = await workflow.run({ prompt: 'research this' });
  assert.equal(result.status, 'failed');
  assert.match(result.error, /provider unavailable/);
});

test('hook signatures verify and callback delivery is allowlisted', async () => {
  const raw = Buffer.from('{"prompt":"x"}');
  const signature = `sha256=${createHmac('sha256', 'secret').update(raw).digest('hex')}`;
  assert.equal(verifyHookSignature(raw, signature, 'secret'), true);
  assert.equal(verifyHookSignature(raw, 'sha256=bad', 'secret'), false);
  const workflow = createPromptWorkflow({ compiler: { compile: async () => ({ intent_vector: 'x', token_budget: 1 }) }, mesh: { delegate: async () => ({ status: 'ok' }) }, callbackAllowlist: ['http://127.0.0.1:1/'] });
  await assert.rejects(() => workflow.run({ prompt: 'x', callback_url: 'http://evil.test/callback' }), /not allowed/);
});

test('prompt workflow rejects a replayed event id', async () => {
  const root = await mkdtemp(join(tmpdir(), 'governor-replay-'));
  const ledger = await createLedger(join(root, 'evidence.jsonl'));
  const workflow = createPromptWorkflow({ ledger, compiler: { compile: async () => ({ intent_vector: 'x', token_budget: 1 }) }, mesh: {} });
  await workflow.run({ event_id: 'fixed-event', prompt: 'x' });
  await assert.rejects(() => workflow.run({ event_id: 'fixed-event', prompt: 'x' }), /duplicate event_id/);
});

test('callback failures create a dead-letter evidence event', async () => {
  const root = await mkdtemp(join(tmpdir(), 'governor-dead-letter-'));
  const ledger = await createLedger(join(root, 'evidence.jsonl'));
  const workflow = createPromptWorkflow({ ledger, callbackAllowlist: ['http://127.0.0.1:1/'], compiler: { compile: async () => ({ intent_vector: 'x', token_budget: 1 }) }, mesh: { delegate: async () => ({ status: 'ok' }) } });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('', { status: 503 });
  let result; try { result = await workflow.run({ event_id: 'delivery-fail', prompt: 'x', callback_url: 'http://127.0.0.1:1/callback' }); } finally { globalThis.fetch = originalFetch; }
  assert.equal(result.status, 'failed');
  assert.equal((await readEvidenceEvents(ledger, 'prompt_delivery'))[0].payload.status, 'dead-letter');
});
