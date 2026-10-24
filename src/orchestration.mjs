import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { recordEvidenceEvent } from './ledger.mjs';
import { readEvidenceEvents } from './ledger.mjs';
import { retrieveFile } from './enforcement.mjs';
import { fetchResearchSources, sourceUrlsFromTask, synthesizeResearchReport } from './research.mjs';

const execFileAsync = promisify(execFile);

function runCodex(command, cwd, task, timeout_ms) {
  return new Promise((resolve, reject) => {
    const args = ['exec', '--ephemeral', '--sandbox', 'read-only', '--json', '-C', cwd];
    const child = process.platform === 'win32' ? spawn('codex.cmd', args, { cwd, shell: true }) : spawn(command, args, { cwd });
    let stdout = ''; let stderr = ''; let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, timeout_ms);
    child.stdout.on('data', (chunk) => { stdout += chunk; if (stdout.length > 2_000_000) child.kill(); });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => { clearTimeout(timer); if (code === 0) resolve({ stdout, stderr }); else { const error = new Error(stderr || `Codex exited with ${code}`); error.code = timedOut ? 'ETIMEDOUT' : code; error.stderr = stderr; reject(error); } });
    child.stdin.end(task);
  });
}

export function createCodexWorker({ cwd = process.cwd(), timeout_ms = 120_000, command = process.platform === 'win32' ? 'codex.cmd' : 'codex', exec = null } = {}) {
  return {
    name: 'codex', capabilities: ['codex', 'terminal', 'research', 'documents'],
    estimate: ({ context_tokens = 0 }) => 1200 + context_tokens,
    async run({ task, input = {} }) {
      if (input.mode === 'dry-run') return { worker: 'codex', status: 'dry-run', command: 'codex exec', task };
      if (task.length > 12_000) return { worker: 'codex', status: 'failed', error: 'task exceeds 12000 characters' };
      if (process.platform === 'win32' && /[%&|<>]/.test(task)) return { worker: 'codex', status: 'failed', error: 'task contains unsupported shell metacharacters' };
      try {
        const result = exec ? await exec(command, ['exec', '--ephemeral', '--sandbox', 'read-only', '--json', '-C', cwd, task], { cwd, timeout: timeout_ms, maxBuffer: 2_000_000 }) : await runCodex(command, cwd, task, timeout_ms);
        return { worker: 'codex', status: 'succeeded', command: 'codex exec', output: result.stdout.slice(-8000) };
      } catch (error) {
        return { worker: 'codex', status: 'failed', command: 'codex exec', exit_code: error.code ?? null, error: String(error.stderr ?? error.message).slice(-4000) };
      }
    }
  };
}

export function createTestingWorker({ cwd = process.cwd(), timeout_ms = 120_000 } = {}) {
  return {
    name: 'testing', capabilities: ['testing', 'audit'],
    estimate: ({ context_tokens = 0 }) => 700 + context_tokens,
    async run() {
      const startedAt = Date.now();
      try {
        const command = process.platform === 'win32' ? process.env.ComSpec : 'npm';
        const args = process.platform === 'win32' ? ['/d', '/s', '/c', 'npm test'] : ['test'];
        const result = await execFileAsync(command, args, { cwd, timeout: timeout_ms, maxBuffer: 2_000_000 });
        return { worker: 'testing', status: 'succeeded', command: 'npm test', duration_ms: Date.now() - startedAt, output: result.stdout.slice(-4000) };
      } catch (error) {
        return { worker: 'testing', status: 'failed', command: 'npm test', duration_ms: Date.now() - startedAt, exit_code: error.code ?? null, output: String(error.stdout ?? error.stderr ?? '').slice(-4000) };
      }
    }
  };
}

export function createMemoryWorker({ ledger }) {
  return { name: 'memory', capabilities: ['memory'], estimate: ({ context_tokens = 0 }) => 400 + context_tokens, async run({ task }) {
    const events = ledger ? await readEvidenceEvents(ledger) : [];
    return { worker: 'memory', status: 'succeeded', task, matches: events.filter((event) => JSON.stringify(event.payload).toLowerCase().includes(task.toLowerCase())).slice(-10) };
  } };
}

export function createToolsWorker({ root = process.cwd() } = {}) {
  return { name: 'tools', capabilities: ['tools'], estimate: ({ context_tokens = 0 }) => 600 + context_tokens, async run({ input = {} }) {
    if (input.action !== 'read_file') return { worker: 'tools', status: 'failed', error: 'only read_file is allowed' };
    const result = await retrieveFile(root, input.path, input.max_output_chars ?? 4000);
    return { worker: 'tools', status: 'succeeded', result };
  } };
}

export function createResearchWorker({ synthesize = synthesizeResearchReport, researchSources = [] } = {}) {
  return { name: 'research', capabilities: ['research'], estimate: ({ context_tokens = 0 }) => 800 + context_tokens, async run({ task }) {
    try { const sources = await fetchResearchSources([...researchSources, ...sourceUrlsFromTask(task)]); const usable = sources.filter((source) => source.text); const report = await synthesize(task, usable); return { worker: 'research', status: 'succeeded', report: { ...report, sources, verification: usable.length ? 'source_backed' : 'not_verified', note: usable.length ? 'Answer generated from retrieved sources.' : 'No usable sources were retrieved.' } }; }
    catch (error) { return { worker: 'research', status: 'failed', error: error instanceof Error ? error.message : String(error) }; }
  } };
}

export const defaultWorkers = [
  { name: 'codex', capabilities: ['codex', 'terminal', 'research', 'documents'], placeholder: true, estimate: ({ context_tokens = 0 }) => 1200 + context_tokens, run: async ({ task }) => ({ worker: 'codex', result: `Codex requested: ${task}` }) },
  { name: 'research', capabilities: ['research'], placeholder: true, estimate: ({ context_tokens = 0 }) => 800 + context_tokens, run: async ({ task }) => ({ worker: 'research', result: `Research requested: ${task}` }) },
  { name: 'memory', capabilities: ['memory'], placeholder: true, estimate: ({ context_tokens = 0 }) => 400 + context_tokens, run: async ({ task }) => ({ worker: 'memory', result: `Memory lookup requested: ${task}` }) },
  { name: 'tools', capabilities: ['tools'], placeholder: true, estimate: ({ context_tokens = 0 }) => 600 + context_tokens, run: async ({ task }) => ({ worker: 'tools', result: `Tool execution requested: ${task}` }) },
  { name: 'testing', capabilities: ['testing', 'audit'], placeholder: true, estimate: ({ context_tokens = 0 }) => 700 + context_tokens, run: async ({ task }) => ({ worker: 'testing', result: `Testing requested: ${task}` }) }
];

export function createWorkerMesh({ workers = defaultWorkers, ledger = null, cwd = process.cwd(), researchSynthesize = synthesizeResearchReport, researchSources = [] } = {}) {
  const configuredWorkers = workers.map((worker) => worker.placeholder ? worker.name === 'testing' ? createTestingWorker({ cwd }) : worker.name === 'memory' ? createMemoryWorker({ ledger }) : worker.name === 'tools' ? createToolsWorker({ root: cwd }) : worker.name === 'codex' ? createCodexWorker({ cwd }) : createResearchWorker({ synthesize: researchSynthesize, researchSources }) : worker);
  return {
    list: () => configuredWorkers.map(({ name, capabilities }) => ({ name, capabilities })),
    async delegate({ task, input = {}, capabilities = [], context_tokens = 0, budget_tokens = Infinity }) {
      if (typeof task !== 'string' || !task.trim()) throw new TypeError('task is required');
      const candidates = configuredWorkers.filter((worker) => capabilities.every((capability) => worker.capabilities.includes(capability)));
      if (!candidates.length) throw new Error('no worker satisfies requested capabilities');
      const ranked = candidates.map((worker) => ({ worker, estimated_tokens: worker.estimate({ context_tokens }) })).sort((a, b) => a.estimated_tokens - b.estimated_tokens);
      const selected = ranked.find((candidate) => candidate.estimated_tokens <= budget_tokens);
      if (!selected) throw new Error('delegation budget exceeded');
      const run_id = randomUUID();
      let result;
      if (ledger) await recordEvidenceEvent(ledger, 'delegation_lifecycle', { run_id, status: 'running', task, selected_worker: selected.worker.name }, { source: 'worker-mesh' });
      try { result = await selected.worker.run({ task, input, context_tokens }); }
      catch (error) { result = { worker: selected.worker.name, status: 'failed', error: error instanceof Error ? error.message : String(error) }; }
      const delegation = { run_id, task, selected_worker: selected.worker.name, estimated_tokens: selected.estimated_tokens, budget_tokens, result };
      if (ledger) await recordEvidenceEvent(ledger, 'delegation_lifecycle', { run_id, status: result.status ?? 'succeeded', task, selected_worker: selected.worker.name }, { source: 'worker-mesh' });
      if (ledger) await recordEvidenceEvent(ledger, 'delegation', delegation, { source: 'worker-mesh', worker: selected.worker.name });
      return delegation;
    },
    async delegateMany(requests) {
      return Promise.all(requests.map((request) => this.delegate(request)));
    }
  };
}
