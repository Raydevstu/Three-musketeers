import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile as readFileAsync, writeFile as writeFileAsync } from 'node:fs/promises';
import path from 'node:path';
import { recordEvidenceEvent } from './ledger.mjs';
import { retrieveFile } from './enforcement.mjs';

const execFileAsync = promisify(execFile);
const transitions = { queued: ['planning', 'failed'], planning: ['running', 'failed'], running: ['paused', 'completed', 'failed'], paused: ['running', 'failed'], completed: [], failed: [] };
const terminalCommands = new Set(['npm test', 'git status --short', 'git diff --check', 'node --version']);

export function createTaskRun({ task, platform = 'generic', session_id = null, workspace = null } = {}) {
  if (typeof task !== 'string' || !task.trim()) throw new TypeError('task is required');
  return { run_id: randomUUID(), task: task.trim(), platform, session_id, workspace, state: 'queued', created_at: new Date().toISOString(), steps: [], result: null, error: null };
}

export function transitionTask(run, state, details = {}) {
  if (!transitions[run.state]?.includes(state)) throw new Error(`invalid task transition: ${run.state} -> ${state}`);
  return { ...run, state, ...details, updated_at: new Date().toISOString() };
}

export function createToolRunner({ root = process.cwd(), ledger = null, timeout_ms = 120_000, browserExecutor = null, desktopExecutor = null } = {}) {
  const backups = new Map();
  return {
    async run(tool, input = {}) {
      if (tool === 'read_file') return retrieveFile(root, input.path, input.max_output_chars ?? 4000);
      if (tool === 'repo_status') { const result = await execFileAsync('git', ['status', '--short'], { cwd: root, timeout: timeout_ms }); return { command: 'git status --short', output: result.stdout }; }
      if (tool === 'run_tests') { const command = process.platform === 'win32' ? process.env.ComSpec : 'npm'; const args = process.platform === 'win32' ? ['/d', '/s', '/c', 'npm test'] : ['test']; const result = await execFileAsync(command, args, { cwd: root, timeout: timeout_ms, maxBuffer: 2_000_000 }); return { command: 'npm test', output: result.stdout.slice(-8000) }; }
      if (tool === 'write_file') {
        if (input.approved !== true) throw new Error('approval required for file write');
        if (typeof input.path !== 'string' || typeof input.content !== 'string') throw new Error('file write requires path and content');
        const target = path.resolve(root, input.path);
        const relative = path.relative(root, target);
        if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('file write outside workspace denied');
        let previous = null;
        try { previous = await readFileAsync(target, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
        backups.set(target, previous);
        if (input.preview === true) return { path: relative, preview: true, existed: previous !== null, previous, content: input.content };
        await writeFileAsync(target, input.content, 'utf8');
        if (ledger) await recordEvidenceEvent(ledger, 'file_write', { path: relative, bytes: Buffer.byteLength(input.content), replaced: previous !== null }, { source: 'task-runtime', approved: true });
        return { path: relative, written: true, bytes: Buffer.byteLength(input.content), rollback_available: true };
      }
      if (tool === 'rollback_file') {
        if (input.approved !== true) throw new Error('approval required for file rollback');
        if (typeof input.path !== 'string') throw new Error('file rollback requires path');
        const target = path.resolve(root, input.path);
        const relative = path.relative(root, target);
        if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('file rollback outside workspace denied');
        if (!backups.has(target)) throw new Error('no rollback available for file');
        const previous = backups.get(target);
        if (previous === null) { const { unlink } = await import('node:fs/promises'); await unlink(target); } else await writeFileAsync(target, previous, 'utf8');
        if (ledger) await recordEvidenceEvent(ledger, 'file_rollback', { path: relative, restored: previous !== null }, { source: 'task-runtime', approved: true });
        return { path: relative, rolled_back: true };
      }
      if (tool === 'terminal') {
        if (input.approved !== true) throw new Error('approval required for terminal tool');
        if (typeof input.command !== 'string' || !terminalCommands.has(input.command)) throw new Error('terminal command denied');
        const [command, ...args] = input.command.split(' '); const result = await execFileAsync(command, args, { cwd: root, timeout: timeout_ms, maxBuffer: 2_000_000 }); return { command: input.command, output: result.stdout.slice(-8000) };
      }
      if (tool === 'browser' || tool === 'desktop') {
        if (input.approved !== true) throw new Error(`approval required for ${tool} tool`);
        const executor = tool === 'browser' ? browserExecutor : desktopExecutor;
        if (typeof executor !== 'function') throw new Error(`${tool} adapter is not connected`);
        const result = await executor(input);
        if (ledger) await recordEvidenceEvent(ledger, 'tool_action', { tool, action: input.action ?? null, result: structuredClone(result) }, { source: 'task-runtime', approved: true });
        return result;
      }
      throw new Error(`tool denied: ${tool}`);
    }
  };
}

export async function executeTask({ task, platform, session_id, workspace, steps = [], runner, ledger = null }) {
  let run = createTaskRun({ task, platform, session_id, workspace });
  const evidence = async () => ledger && recordEvidenceEvent(ledger, 'task_run', { run_id: run.run_id, state: run.state, task: run.task, steps: run.steps, error: run.error }, { source: 'task-runtime', platform: run.platform });
  run = transitionTask(run, 'planning'); await evidence();
  try {
    run = transitionTask(run, 'running'); await evidence();
    for (const step of steps) { const started = Date.now(); const output = await runner.run(step.tool, step.input); run = { ...run, steps: [...run.steps, { tool: step.tool, status: 'succeeded', duration_ms: Date.now() - started, output }] }; await evidence(); }
    run = transitionTask(run, 'completed', { result: { message: 'Task completed', steps: run.steps } }); await evidence();
  } catch (error) { run = transitionTask(run, 'failed', { error: error instanceof Error ? error.message : String(error) }); await evidence(); }
  return run;
}
