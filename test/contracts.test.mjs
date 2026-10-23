import test from 'node:test';
import assert from 'node:assert/strict';
import { validateNormalizedUsage, validateTaskCapsule } from '../src/contracts.mjs';

test('accepts a complete normalized usage record', () => {
  assert.equal(validateNormalizedUsage({
    schema_version: '1.0.0', provider: 'local', model_id: 'test-model',
    timestamp: '2026-10-23T00:00:00.000Z', latency_ms: 12,
    prompt_tokens: 10, completion_tokens: 5, cached_tokens: 0,
    context_breakdown: { system_instructions: 1, memory_skills: 1, tool_schemas: 1, files_code: 2, tool_output_logs: 3, history: 2 },
    estimated_cost_usd: 0
  }), true);
});

test('rejects usage without authoritative token fields', () => {
  assert.equal(validateNormalizedUsage({ schema_version: '1.0.0' }), false);
});

test('accepts a versioned task capsule', () => {
  assert.equal(validateTaskCapsule({
    schema_version: '1.0.0', capsule_id: 'cap-1', created_at: '2026-10-23T00:00:00.000Z',
    trigger_reason: 'manual', intent: 'test', current_state: { files_touched: [], active_branch: 'main', uncommitted_changes: false },
    decisions_made: [], resolved_issues: [], open_risks_and_blockers: [],
    test_status: { passed: [], failed: [], skipped: [] }, exact_next_boundary: 'next'
  }), true);
});
