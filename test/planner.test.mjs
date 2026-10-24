import test from 'node:test';
import assert from 'node:assert/strict';
import { planTask, planSubtasks, validateSubtaskPlan } from '../src/planner.mjs';

test('planner creates safe repository and test steps', () => {
  assert.deepEqual(planTask('Review the repository and run tests').steps.map((step) => step.tool), ['repo_status', 'run_tests']);
});

test('planner routes research to the research worker', () => {
  assert.deepEqual(planTask('Research similar competitors').capabilities, ['research']);
});

test('planner blocks browser and desktop work until adapters are enabled', () => {
  assert.equal(planTask('Open the browser and click the login button').status, 'blocked');
});

test('planner builds a dependency-ordered multi-agent plan', () => {
  const plan = validateSubtaskPlan(planSubtasks('Research, implement, test, and audit this feature'));
  assert.deepEqual(plan.subtasks.map((subtask) => subtask.id), ['research', 'implementation', 'testing', 'audit']);
  assert.deepEqual(plan.subtasks.map((subtask) => subtask.depends_on), [[], ['research'], ['implementation'], ['testing']]);
  assert.ok(plan.subtasks.every((subtask) => subtask.retries <= 3));
  assert.throws(() => validateSubtaskPlan({ status: 'delegate', subtasks: [{ id: 'a', worker: 'tools', depends_on: ['missing'], retries: 0 }] }), /dependency/);
});
