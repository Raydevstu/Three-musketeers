import test from 'node:test';
import assert from 'node:assert/strict';
import { createToolRunner } from '../src/task-runtime.mjs';

test('terminal tool requires approval and allowlisted command', async () => {
  const runner = createToolRunner();
  await assert.rejects(() => runner.run('terminal', { command: 'node --version' }), /approval required/);
  const result = await runner.run('terminal', { command: 'node --version', approved: true });
  assert.match(result.output, /v\d+/);
  await assert.rejects(() => runner.run('terminal', { command: 'node -e evil', approved: true }), /command denied/);
});

test('browser and desktop tools require approval before adapter connection', async () => {
  const runner = createToolRunner();
  await assert.rejects(() => runner.run('browser', { action: 'open' }), /approval required/);
  await assert.rejects(() => runner.run('desktop', { action: 'click' }), /approval required/);
  await assert.rejects(() => runner.run('browser', { action: 'open', approved: true }), /not connected/);
});

test('connected browser and desktop executors run only after approval and record evidence', async () => {
  const actions = [];
  const ledger = { events: [] };
  const runner = createToolRunner({ ledger, browserExecutor: async (input) => { actions.push(`browser:${input.action}`); return { ok: true }; }, desktopExecutor: async (input) => { actions.push(`desktop:${input.action}`); return { ok: true }; } });
  assert.deepEqual(await runner.run('browser', { action: 'open', approved: true }), { ok: true });
  assert.deepEqual(await runner.run('desktop', { action: 'click', approved: true }), { ok: true });
  assert.deepEqual(actions, ['browser:open', 'desktop:click']);
  assert.equal(ledger.events.filter((event) => event.type === 'tool_action').length, 2);
});

test('file writes require approval, stay in workspace, preview, and rollback with evidence', async () => {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const root = await fs.mkdtemp(path.join(process.env.TEMP ?? process.cwd(), 'task-runtime-'));
  const target = path.join(root, 'note.txt');
  await fs.writeFile(target, 'before', 'utf8');
  const ledger = { events: [] };
  const runner = createToolRunner({ root, ledger });
  await assert.rejects(() => runner.run('write_file', { path: 'note.txt', content: 'after' }), /approval required/);
  const preview = await runner.run('write_file', { path: 'note.txt', content: 'after', approved: true, preview: true });
  assert.equal(preview.preview, true);
  await runner.run('write_file', { path: 'note.txt', content: 'after', approved: true });
  assert.equal(await fs.readFile(target, 'utf8'), 'after');
  await runner.run('rollback_file', { path: 'note.txt', approved: true });
  assert.equal(await fs.readFile(target, 'utf8'), 'before');
  await assert.rejects(() => runner.run('write_file', { path: '../outside.txt', content: 'x', approved: true }), /outside workspace/);
  assert.equal(ledger.events.filter((event) => event.type.startsWith('file_')).length, 2);
});
