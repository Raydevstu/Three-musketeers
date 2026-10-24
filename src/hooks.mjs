import { randomUUID } from 'node:crypto';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { recordEvidenceEvent, readEvidenceEvents } from './ledger.mjs';

export function verifyHookSignature(rawBody, signature, secret) {
  if (!secret) return true;
  const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
  return Boolean(signature && signature.length === expected.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected)));
}

export function normalizePromptEvent(input) {
  if (!input || typeof input.prompt !== 'string' || !input.prompt.trim()) throw new TypeError('prompt is required');
  return {
    event_id: input.event_id ?? randomUUID(),
    platform: typeof input.platform === 'string' && input.platform.trim() ? input.platform : 'generic',
    session_id: input.session_id ?? null,
    prompt: input.prompt.trim(),
    files: Array.isArray(input.files) ? input.files.slice(0, 50) : [],
    workspace: typeof input.workspace === 'string' ? input.workspace : null,
    callback_url: typeof input.callback_url === 'string' ? input.callback_url : null,
    metadata: input.metadata && typeof input.metadata === 'object' ? input.metadata : {}
  };
}

export function createPromptWorkflow({ compiler, mesh, ledger, workspaceRoot = null, callbackAllowlist = [] }) {
  return {
    async run(input) {
      const event = normalizePromptEvent(input);
      if (ledger && (await readEvidenceEvents(ledger, 'prompt_workflow')).some((entry) => entry.payload?.event?.event_id === event.event_id)) throw new Error('duplicate event_id');
      if (workspaceRoot && event.workspace && !event.workspace.startsWith(workspaceRoot)) throw new Error('workspace is outside the configured root');
      if (event.callback_url && !callbackAllowlist.some((prefix) => event.callback_url.startsWith(prefix))) throw new Error('callback URL is not allowed');
      const run_id = randomUUID();
      if (ledger) await recordEvidenceEvent(ledger, 'prompt_workflow', { run_id, status: 'received', event }, { source: 'prompt-hook', platform: event.platform });
      try {
        const compiled = await compiler.compile(event.prompt);
        if (ledger) await recordEvidenceEvent(ledger, 'prompt_workflow', { run_id, status: 'compiled', event_id: event.event_id, intent_vector: compiled.intent_vector }, { source: 'prompt-hook', platform: event.platform });
        const capabilities = /\b(research|investigate|find out)\b/i.test(event.prompt) ? ['research'] : /\b(test|tests|audit)\b/i.test(event.prompt) ? ['testing'] : [];
        const workerFloor = capabilities.includes('testing') ? 4_000 : 1_000;
        const result = capabilities.length ? await mesh.delegate({ task: event.prompt, capabilities, context_tokens: 0, budget_tokens: Math.max(compiled.token_budget ?? 20_000, workerFloor) }) : { status: 'prepared', worker: null };
        const response = { run_id, event, compiled, result };
        if (event.callback_url) {
          try {
            const callback = await fetch(event.callback_url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(response) });
            if (!callback.ok) throw new Error(`callback delivery failed: ${callback.status}`);
            if (ledger) await recordEvidenceEvent(ledger, 'prompt_delivery', { run_id, status: 'delivered', callback_url: event.callback_url }, { source: 'prompt-hook', platform: event.platform });
          } catch (error) {
            if (ledger) await recordEvidenceEvent(ledger, 'prompt_delivery', { run_id, status: 'dead-letter', callback_url: event.callback_url, error: error instanceof Error ? error.message : String(error) }, { source: 'prompt-hook', platform: event.platform });
            throw error;
          }
        }
        if (ledger) await recordEvidenceEvent(ledger, 'prompt_workflow', { run_id, status: 'completed', event_id: event.event_id, result_status: result.status ?? result.result?.status ?? 'prepared' }, { source: 'prompt-hook', platform: event.platform });
        return response;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (ledger) await recordEvidenceEvent(ledger, 'prompt_workflow', { run_id, status: 'failed', event_id: event.event_id, error: message }, { source: 'prompt-hook', platform: event.platform });
        return { run_id, event, status: 'failed', error: message };
      }
    }
  };
}
