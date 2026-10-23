import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { saveCapsule, readCapsule, renderCapsule } from '../src/capsule.mjs';

test('saves, reads, and renders a task capsule', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'three-musketeers-capsule-'));
  const capsule = {
    schema_version: '1.0.0', capsule_id: 'cap-1', created_at: '2026-10-23T00:00:00.000Z', trigger_reason: 'manual',
    intent: 'Build the foundation', current_state: { files_touched: ['src/capsule.mjs'], active_branch: 'main', uncommitted_changes: true },
    decisions_made: ['Use JSON'], resolved_issues: [], open_risks_and_blockers: ['Ray auth'],
    test_status: { passed: ['npm test'], failed: [], skipped: [] }, exact_next_boundary: 'Verify Ray'
  };
  const filePath = join(directory, 'capsule.json');
  await saveCapsule(filePath, capsule);
  assert.deepEqual(await readCapsule(filePath), capsule);
  assert.match(renderCapsule(capsule), /Build the foundation/);
});
