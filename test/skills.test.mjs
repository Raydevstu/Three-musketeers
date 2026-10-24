import test from 'node:test';
import assert from 'node:assert/strict';
import { createSkillRegistry, defaultSkills } from '../src/skills.mjs';

test('injects matching skills deterministically and preserves audit reasons', () => {
  const registry = createSkillRegistry([
    { name: 'api-debugger', description: 'Debug API authentication and routes', keywords: ['api', 'auth'] },
    { name: 'database-reader', description: 'Inspect database state', keywords: ['database'] }
  ]);
  assert.deepEqual(registry.match('Fix the API auth bug'), [{ name: 'api-debugger', reason: 'keyword:api' }]);
});

test('does not inject skills when no registry keyword matches', () => {
  assert.deepEqual(createSkillRegistry([{ name: 'web', description: 'web research', keywords: ['research'] }]).match('write a unit test'), []);
});

test('provides a safe default API debugger skill for authenticated route work', () => {
  assert.deepEqual(createSkillRegistry(defaultSkills).match('Investigate an API authentication failure'), [{ name: 'api-debugger', reason: 'keyword:api' }]);
});
