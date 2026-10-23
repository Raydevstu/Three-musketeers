import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLedger, recordUsage, readLedger, ledgerStatus } from '../src/ledger.mjs';

test('records and reads an authoritative usage turn durably', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'three-musketeers-'));
  const filePath = join(directory, 'evidence.jsonl');
  const ledger = await createLedger(filePath);
  await recordUsage(ledger, {
    schema_version: '1.0.0', provider: 'local', model_id: 'test-model', timestamp: '2026-10-23T00:00:00.000Z',
    latency_ms: 12, prompt_tokens: 10, completion_tokens: 5, cached_tokens: 0,
    context_breakdown: { system_instructions: 1, memory_skills: 1, tool_schemas: 1, files_code: 2, tool_output_logs: 3, history: 2 }, estimated_cost_usd: 0
  });
  assert.equal((await readLedger(ledger)).length, 1);
  assert.match(await readFile(filePath, 'utf8'), /"model_id":"test-model"/);
});

test('reports explicit ledger status', async () => {
  const ledger = await createLedger();
  assert.deepEqual(ledgerStatus(ledger), { state: 'empty', records: 0 });
});
