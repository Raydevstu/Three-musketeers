import test from 'node:test';
import assert from 'node:assert/strict';
import { createTaskRun, transitionTask, executeTask } from '../src/task-runtime.mjs';
import { createLedger, readEvidenceEvents } from '../src/ledger.mjs';

test('task runtime enforces lifecycle transitions', () => {
  const run = createTaskRun({ task: 'inspect repository' });
  assert.equal(transitionTask(run, 'planning').state, 'planning');
  assert.throws(() => transitionTask(run, 'completed'), /invalid task transition/);
});

test('task runtime executes tools and persists each state', async () => {
  const ledger = await createLedger();
  const result = await executeTask({ task: 'inspect repository', steps: [{ tool: 'repo_status' }], runner: { run: async () => ({ output: 'clean' }) }, ledger });
  assert.equal(result.state, 'completed');
  assert.equal(result.steps[0].status, 'succeeded');
  assert.deepEqual((await readEvidenceEvents(ledger, 'task_run')).map((event) => event.payload.state), ['planning', 'running', 'running', 'completed']);
});

test('task runtime records failures and does not continue after a denied tool', async () => {
  const result = await executeTask({ task: 'unsafe action', steps: [{ tool: 'shell' }, { tool: 'run_tests' }], runner: { run: async (tool) => { throw new Error(`tool denied: ${tool}`); } } });
  assert.equal(result.state, 'failed');
  assert.match(result.error, /tool denied/);
  assert.equal(result.steps.length, 0);
});
