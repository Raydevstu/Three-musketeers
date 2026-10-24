import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { sendGatewayRequest } from './gateway.mjs';
import { checkLedgerReady, createLedger } from './ledger.mjs';
import { createGovernor, defaultProfiles, retrieveFile } from './enforcement.mjs';
import { diffContext, decideRoute, applyRoutingMode, persistRouteDecision } from './optimization.mjs';
import { compilePrompt } from './compiler.mjs';
import { createSkillRegistry, defaultSkills } from './skills.mjs';
import { createWorkerMesh, defaultWorkers } from './orchestration.mjs';
import { createPromptWorkflow, verifyHookSignature } from './hooks.mjs';
import { createAutomationRunner } from './automation.mjs';
import { synthesizeResearchReport } from './research.mjs';
import { createToolRunner, executeTask } from './task-runtime.mjs';
import { planTask, planTaskWithProvider, planSubtasks, validateSubtaskPlan } from './planner.mjs';

const emptyBreakdown = { system_instructions: 0, memory_skills: 0, tool_schemas: 0, files_code: 0, tool_output_logs: 0, history: 0 };

export function createGatewayServer({ providerUrl, provider, model, ledger, fetchImpl = fetch, planner = planTaskWithProvider, browserExecutor = null, desktopExecutor = null, connectorBridgeUrl = process.env.CONNECTOR_BRIDGE_URL ?? null, connectorBridgeToken = process.env.CONNECTOR_BRIDGE_TOKEN ?? null, retrievalRoot = process.cwd(), profiles = defaultProfiles, authToken = null, hookSigningSecret = null, callbackAllowlist = [], maxBodyBytes = 1_048_576, logger = console, enforceEnabled = false, uiRoot = path.join(process.cwd(), 'ui', 'dist'), compiler = { compile: (prompt) => compilePrompt(prompt) }, skills = defaultSkills, workers = defaultWorkers, automationRunner = null, researchSources = [], researchSynthesize = synthesizeResearchReport }) {
  const governor = createGovernor({ profiles });
  const skillRegistry = createSkillRegistry(skills);
  const mesh = createWorkerMesh({ workers, ledger, cwd: retrievalRoot, researchSources, researchSynthesize });
  const bridgeExecutor = connectorBridgeUrl ? async (input) => { const response = await fetch(`${connectorBridgeUrl}/execute`, { method: 'POST', headers: { 'content-type': 'application/json', ...(connectorBridgeToken ? { authorization: `Bearer ${connectorBridgeToken}` } : {}) }, body: JSON.stringify(input) }); const result = await response.json(); if (!response.ok) throw new Error(result.error ?? `connector bridge failed: ${response.status}`); return result; } : null;
  const toolRunner = createToolRunner({ root: retrievalRoot, ledger, browserExecutor: browserExecutor ?? bridgeExecutor, desktopExecutor });
  const promptWorkflow = createPromptWorkflow({ compiler, mesh, ledger, workspaceRoot: retrievalRoot, callbackAllowlist });
  const activeAutomationRunner = automationRunner ?? createAutomationRunner({ pool: ledger.pool, mesh, jobs: [{ name: 'local-smoke', request: { task: 'Run the project tests and summarize any failures.', capabilities: ['testing'], budget_tokens: 4000 } }] });
  const readJsonBody = async (request) => {
    const chunks = []; let size = 0;
    for await (const chunk of request) { size += chunk.length; if (size > maxBodyBytes) throw new Error('request body too large'); chunks.push(chunk); }
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  };
  const metrics = { requests: 0, authDenied: 0, http5xx: 0, providerFailures: 0, readinessFailures: 0, durationMsSum: 0 };
  return createServer(async (request, response) => {
    const startedAt = performance.now();
    response.on('finish', () => {
      metrics.durationMsSum += performance.now() - startedAt;
      if (response.statusCode >= 500) metrics.http5xx += 1;
    });
    metrics.requests += 1;
    logger.info?.({ event: 'http_request', method: request.method, path: request.url });
    if (request.method === 'GET' && request.url === '/health') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ status: 'ok' }));
      return;
    }
    if (request.method === 'GET' && (request.url === '/' || request.url.startsWith('/assets/'))) {
      try {
        const relativePath = request.url === '/' ? 'index.html' : decodeURIComponent(request.url.slice(1));
        const root = path.resolve(uiRoot); const candidate = path.resolve(root, relativePath);
        if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) throw new Error('UI path denied');
        const file = await readFile(candidate);
        const contentType = relativePath.endsWith('.js') ? 'text/javascript' : relativePath.endsWith('.css') ? 'text/css' : 'text/html';
        response.writeHead(200, { 'content-type': contentType });
        response.end(file);
      } catch {
        response.writeHead(404, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ error: 'UI not built' }));
      }
      return;
    }
    if (authToken && request.headers.authorization !== `Bearer ${authToken}`) {
      metrics.authDenied += 1;
      response.writeHead(401, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }
    if (request.method === 'GET' && request.url === '/metrics') {
      if (!authToken) {
        response.writeHead(503, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ error: 'metrics authentication not configured' }));
        return;
      }
      response.writeHead(200, { 'content-type': 'text/plain; version=0.0.4' });
      response.end(`# HELP governor_requests_total Total HTTP requests received\n# TYPE governor_requests_total counter\ngovernor_requests_total ${metrics.requests}\n# HELP governor_auth_denied_total Requests denied by authentication\n# TYPE governor_auth_denied_total counter\ngovernor_auth_denied_total ${metrics.authDenied}\n# HELP governor_http_5xx_total HTTP 5xx responses\n# TYPE governor_http_5xx_total counter\ngovernor_http_5xx_total ${metrics.http5xx}\n# HELP governor_provider_failures_total Provider request failures\n# TYPE governor_provider_failures_total counter\ngovernor_provider_failures_total ${metrics.providerFailures}\n# HELP governor_readiness_failures_total Readiness checks that failed\n# TYPE governor_readiness_failures_total counter\ngovernor_readiness_failures_total ${metrics.readinessFailures}\n# HELP governor_request_duration_ms_sum Sum of request durations in milliseconds\n# TYPE governor_request_duration_ms_sum counter\ngovernor_request_duration_ms_sum ${metrics.durationMsSum}\n`);
      return;
    }
    if (request.method === 'GET' && request.url === '/ready') {
      const readiness = await checkLedgerReady(ledger);
      if (readiness.status !== 'ready') metrics.readinessFailures += 1;
      response.writeHead(readiness.status === 'ready' ? 200 : 503, { 'content-type': 'application/json' });
      response.end(JSON.stringify(readiness));
      return;
    }
    if (request.method === 'POST' && request.url === '/prompt/compile') {
      try {
        const body = await readJsonBody(request);
        const compiled = await compiler.compile(body.prompt);
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify(compiled));
      } catch (error) {
        response.writeHead(400, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Prompt compilation failed' }));
      }
      return;
    }
    if (request.method === 'GET' && request.url === '/orchestration/workers') {
      response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify({ workers: mesh.list() })); return;
    }
    if (request.method === 'POST' && (request.url === '/hooks/prompt' || request.url?.match(/^\/hooks\/(codex|hermes|opencode|generic)$/))) {
      try { const chunks = []; let size = 0; for await (const chunk of request) { size += chunk.length; if (size > maxBodyBytes) throw new Error('request body too large'); chunks.push(chunk); } const rawBody = Buffer.concat(chunks); if (!verifyHookSignature(rawBody, request.headers['x-governor-signature'], hookSigningSecret)) { response.writeHead(401, { 'content-type': 'application/json' }); response.end(JSON.stringify({ error: 'invalid hook signature' })); return; } const result = await promptWorkflow.run(JSON.parse(rawBody.toString('utf8') || '{}')); response.writeHead(result.status === 'failed' ? 422 : 200, { 'content-type': 'application/json' }); response.end(JSON.stringify(result)); }
      catch (error) { response.writeHead(400, { 'content-type': 'application/json' }); response.end(JSON.stringify({ error: error.message })); }
      return;
    }
    if (request.method === 'POST' && request.url === '/workflow/run') {
      try { const body = await readJsonBody(request); const result = await promptWorkflow.run({ ...body, event_id: body.event_id ?? `ui-${Date.now()}-${Math.random().toString(16).slice(2)}` }); response.writeHead(result.status === 'failed' ? 422 : 200, { 'content-type': 'application/json' }); response.end(JSON.stringify(result)); }
      catch (error) { response.writeHead(400, { 'content-type': 'application/json' }); response.end(JSON.stringify({ error: error.message })); }
      return;
    }
    if (request.method === 'POST' && request.url === '/tasks/run') {
      try { const body = await readJsonBody(request); const result = await executeTask({ ...body, runner: toolRunner, ledger }); response.writeHead(result.state === 'failed' ? 422 : 200, { 'content-type': 'application/json' }); response.end(JSON.stringify(result)); }
      catch (error) { response.writeHead(400, { 'content-type': 'application/json' }); response.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Task execution failed' })); }
      return;
    }
    if (request.method === 'POST' && request.url === '/tasks/auto') {
      try {
        const body = await readJsonBody(request); const compiled = await compiler.compile(body.prompt); const skills = skillRegistry.match(compiled.intent_vector); let plan; try { plan = await planner(body.prompt, compiled); } catch (error) { plan = { ...planTask(body.prompt), reason: `provider plan rejected: ${error instanceof Error ? error.message : String(error)}` }; }
        if (plan.status === 'blocked') { response.writeHead(422, { 'content-type': 'application/json' }); response.end(JSON.stringify({ status: 'blocked', compiled, skills, plan })); return; }
        let execution;
        if (plan.status === 'delegate' && Array.isArray(plan.subtasks)) {
          const subtaskPlan = validateSubtaskPlan(plan);
          const results = [];
          for (const subtask of subtaskPlan.subtasks) {
            const dependencies = results.filter((result) => subtask.depends_on.includes(result.id));
            if (dependencies.some((result) => result.status === 'failed')) { results.push({ id: subtask.id, status: 'blocked', reason: 'dependency failed' }); continue; }
            let result; let attempts = 0;
            while (attempts <= subtask.retries) { attempts += 1; try { result = await mesh.delegate({ task: `${body.prompt}\nSubtask: ${subtask.id}`, capabilities: subtask.capabilities, budget_tokens: Math.max(compiled.token_budget ?? 20_000, 1_000) }); if (result.result?.status !== 'failed') break; } catch (error) { result = { status: 'failed', error: error.message }; } }
            results.push({ id: subtask.id, status: result?.result?.status === 'failed' || result?.status === 'failed' ? 'failed' : 'succeeded', attempts, result });
          }
          execution = { status: results.some((result) => result.status === 'failed') ? 'failed' : 'succeeded', subtasks: results };
        } else execution = plan.status === 'delegate' ? await mesh.delegate({ task: body.prompt, capabilities: plan.capabilities, budget_tokens: Math.max(compiled.token_budget ?? 20_000, 1_000) }) : await executeTask({ ...body, task: body.prompt, steps: plan.steps, runner: toolRunner, ledger });
        response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify({ status: 'completed', compiled, skills, plan, execution }));
      } catch (error) { response.writeHead(400, { 'content-type': 'application/json' }); response.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Automatic task execution failed' })); }
      return;
    }
    if (request.method === 'POST' && request.url === '/orchestration/delegate') {
      try { const body = await readJsonBody(request); const result = await mesh.delegate(body); response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify(result)); }
      catch (error) { response.writeHead(400, { 'content-type': 'application/json' }); response.end(JSON.stringify({ error: error.message })); }
      return;
    }
    if (request.method === 'POST' && request.url === '/orchestration/delegate-many') {
      try { const body = await readJsonBody(request); const result = await mesh.delegateMany(body.requests ?? []); response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify({ results: result })); }
      catch (error) { response.writeHead(400, { 'content-type': 'application/json' }); response.end(JSON.stringify({ error: error.message })); }
      return;
    }
    if (request.method === 'GET' && request.url === '/automation/jobs') {
      response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify({ jobs: await activeAutomationRunner.list() })); return;
    }
    if (request.method === 'POST' && request.url.startsWith('/automation/')) {
      try { const name = decodeURIComponent(request.url.slice('/automation/'.length)); const result = await activeAutomationRunner.run(name); response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify(result)); }
      catch (error) { response.writeHead(400, { 'content-type': 'application/json' }); response.end(JSON.stringify({ error: error.message })); }
      return;
    }
    if (request.method === 'POST' && request.url === '/prompt/prepare') {
      try {
        const body = await readJsonBody(request);
        const compiled = await compiler.compile(body.prompt);
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ compiled, skills: skillRegistry.match(compiled.intent_vector) }));
      } catch (error) {
        response.writeHead(400, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Prompt preparation failed' }));
      }
      return;
    }
    if (request.method === 'POST' && request.url === '/mcp') {
      try {
        const body = await readJsonBody(request);
        if (body.method === 'profiles/list') {
          response.writeHead(200, { 'content-type': 'application/json' });
          response.end(JSON.stringify({ profiles }));
          return;
        }
        if (body.method === 'retrieval/read') {
          const profile = governor.checkBudget(body.profile, body.max_output_chars);
          const result = await retrieveFile(retrievalRoot, body.path, profile.max_output_chars);
          response.writeHead(200, { 'content-type': 'application/json' });
          response.end(JSON.stringify(result));
          return;
        }
        throw new Error('method denied');
      } catch (error) {
        response.writeHead(403, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ error: error instanceof Error ? error.message : 'MCP request denied' }));
      }
      return;
    }
    if (request.method === 'POST' && request.url === '/optimization/inspect') {
      try {
        const chunks = [];
        for await (const chunk of request) chunks.push(chunk);
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
        const decision = applyRoutingMode(decideRoute(body), body.routing_mode ?? 'off', { enforceEnabled });
        await persistRouteDecision(ledger, decision, body.turn_id ?? 'inspection');
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ diff: diffContext(body.previous, body.current), decision }));
      } catch (error) {
        response.writeHead(400, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Optimization inspection failed' }));
      }
      return;
    }
    if (request.method !== 'POST' || request.url !== '/v1/chat') {
      response.writeHead(404, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: 'Not found' }));
      return;
    }
    try {
      const chunks = [];
      for await (const chunk of request) { if (Buffer.concat([...chunks, chunk]).length > maxBodyBytes) throw new Error('request body too large'); chunks.push(chunk); }
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
      response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
      await sendGatewayRequest(fetchImpl, providerUrl, body, {
        provider, model, latency_ms: 0,
        context_breakdown: body.context_breakdown ?? emptyBreakdown
      }, ledger, (chunk) => response.write(chunk));
      response.end();
    } catch (error) {
      metrics.providerFailures += 1;
      if (!response.headersSent) response.writeHead(error instanceof Error && error.message === 'request body too large' ? 413 : 502, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Gateway failure' }));
    }
  });
}

if (process.argv[1]?.endsWith('server.mjs')) {
  const ledger = await createLedger(process.env.EVIDENCE_LEDGER_PATH ?? '.data/evidence.jsonl', process.env.DATABASE_URL ?? null);
  const server = createGatewayServer({
    providerUrl: process.env.PROVIDER_URL ?? '',
    provider: process.env.PROVIDER ?? 'local',
    model: process.env.MODEL ?? 'unconfigured',
    ledger,
    authToken: process.env.GATEWAY_AUTH_TOKEN ?? null,
    hookSigningSecret: process.env.HOOK_SIGNING_SECRET ?? null,
    callbackAllowlist: (process.env.HOOK_CALLBACK_ALLOWLIST ?? '').split(',').map((value) => value.trim()).filter(Boolean),
    researchSources: (process.env.RESEARCH_SOURCE_URLS ?? '').split(',').map((value) => value.trim()).filter(Boolean),
    enforceEnabled: process.env.ROUTING_ENFORCE_ENABLED === 'true'
  });
  server.listen(Number(process.env.PORT ?? 8080), process.env.HOST ?? '0.0.0.0');
}
