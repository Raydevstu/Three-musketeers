import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkerMesh, createTestingWorker, createCodexWorker } from '../src/orchestration.mjs';
import { createLedger, readEvidenceEvents } from '../src/ledger.mjs';
import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { measureDelegation } from '../src/measurement.mjs';

test('delegation selects the cheapest capable worker and records a run id', async () => {
  const result = await createWorkerMesh().delegate({ task: 'check the API', capabilities: ['testing'], context_tokens: 10, budget_tokens: 1000 });
  assert.equal(result.selected_worker, 'testing');
  assert.equal(result.estimated_tokens, 710);
  assert.match(result.run_id, /^[0-9a-f-]{36}$/);
});

test('delegation fails closed when no worker fits the token budget', async () => {
  await assert.rejects(() => createWorkerMesh().delegate({ task: 'research', capabilities: ['research'], budget_tokens: 10 }), /budget exceeded/);
});

test('real testing worker runs the configured test command and persists delegation evidence', async () => {
  const root = await mkdtemp(join(tmpdir(), 'governor-worker-'));
  const ledger = await createLedger(join(root, 'evidence.jsonl'));
  const mesh = createWorkerMesh({ workers: [createTestingWorker({ cwd: process.cwd() })], ledger });
  const result = await mesh.delegate({ task: 'verify repository', capabilities: ['testing'], budget_tokens: 1000 });
  assert.equal(result.result.status, 'succeeded');
  assert.equal((await readEvidenceEvents(ledger, 'delegation')).length, 1);
  assert.deepEqual((await readEvidenceEvents(ledger, 'delegation_lifecycle')).map((event) => event.payload.status), ['running', 'succeeded']);
});

test('delegated measurement reports authoritative token savings when both sides provide usage', async () => {
  const measurement = await measureDelegation({ baseline: async () => ({ usage: { total_tokens: 100 } }), delegated: async () => ({ usage: { total_tokens: 60 }, result: { status: 'succeeded' } }) });
  assert.equal(measurement.tokens_saved, 40);
  assert.equal(measurement.delegated_status, 'succeeded');
});

test('delegateMany executes independent workers concurrently', async () => {
  const mesh = createWorkerMesh({ workers: [{ name: 'fast', capabilities: ['work'], estimate: () => 1, async run() { await new Promise((resolve) => setTimeout(resolve, 40)); return { status: 'succeeded' }; } }] });
  const started = performance.now();
  const results = await mesh.delegateMany([{ task: 'one', capabilities: ['work'] }, { task: 'two', capabilities: ['work'] }]);
  assert.equal(results.length, 2);
  assert.ok(performance.now() - started < 75);
});

test('Codex worker supports dry-run without invoking the CLI', async () => {
  let invoked = false;
  const worker = createCodexWorker({ exec: async () => { invoked = true; } });
  const result = await worker.run({ task: 'summarize tests', input: { mode: 'dry-run' } });
  assert.equal(result.status, 'dry-run');
  assert.equal(invoked, false);
});

test('Codex worker captures a successful CLI response', async () => {
  const worker = createCodexWorker({ exec: async () => ({ stdout: '{"type":"message"}\nDone', stderr: '' }) });
  const result = await worker.run({ task: 'summarize tests' });
  assert.equal(result.status, 'succeeded');
  assert.match(result.output, /Done/);
});

test('research worker returns a synthesized report with durable evidence', async () => {
  const root = await mkdtemp(join(tmpdir(), 'governor-research-'));
  const ledger = await createLedger(join(root, 'evidence.jsonl'));
  const mesh = createWorkerMesh({ ledger, researchSources: ['data:text/plain,verified-source'], researchSynthesize: async (task, sources) => ({ answer: `Audit: ${task}`, competitors: [{ name: 'Competitor', comparison: 'Evidence-backed comparison', evidence_ids: [1] }], citations: [{ id: 1, url: sources[0].url, claim: 'Verified source text' }], confidence: 'medium' }), workers: [{ name: 'research', capabilities: ['research'], placeholder: true, estimate: () => 1 }] });
  const result = await mesh.delegate({ task: 'research audit', capabilities: ['research'], budget_tokens: 1000 });
  assert.equal(result.result.report.answer, 'Audit: research audit');
  assert.equal(result.result.report.citations[0].url, 'data:text/plain,verified-source');
  assert.equal((await readEvidenceEvents(ledger, 'delegation')).length, 1);
});
