import test from 'node:test';
import assert from 'node:assert/strict';
import { planTaskWithProvider } from '../src/planner.mjs';

const compiled = { intent_vector: 'review repository' };
const provider = (payload) => new Response(JSON.stringify({ response: JSON.stringify(payload) }), { status: 200 });

test('provider planner returns a validated safe plan', async () => {
  const plan = await planTaskWithProvider('review repository', compiled, { fetchImpl: async () => provider({ status: 'execute', capabilities: ['tools'], steps: [{ tool: 'repo_status', input: {} }], reason: '' }) });
  assert.equal(plan.steps[0].tool, 'repo_status');
});

test('provider planner rejects unavailable tools', async () => {
  await assert.rejects(() => planTaskWithProvider('delete files', compiled, { fetchImpl: async () => provider({ status: 'execute', capabilities: [], steps: [{ tool: 'shell', input: {} }] }) }), /unavailable tool/);
});
