import { createServer } from 'node:http';
import { sendGatewayRequest } from './gateway.mjs';
import { checkLedgerReady, createLedger } from './ledger.mjs';
import { createGovernor, defaultProfiles, retrieveFile } from './enforcement.mjs';
import { diffContext, decideRoute, applyRoutingMode, persistRouteDecision } from './optimization.mjs';

const emptyBreakdown = { system_instructions: 0, memory_skills: 0, tool_schemas: 0, files_code: 0, tool_output_logs: 0, history: 0 };

export function createGatewayServer({ providerUrl, provider, model, ledger, fetchImpl = fetch, retrievalRoot = process.cwd(), profiles = defaultProfiles, authToken = null, maxBodyBytes = 1_048_576 }) {
  const governor = createGovernor({ profiles });
  return createServer(async (request, response) => {
    if (request.method === 'GET' && request.url === '/health') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ status: 'ok' }));
      return;
    }
    if (authToken && request.headers.authorization !== `Bearer ${authToken}`) {
      response.writeHead(401, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }
    if (request.method === 'GET' && request.url === '/ready') {
      const readiness = await checkLedgerReady(ledger);
      response.writeHead(readiness.status === 'ready' ? 200 : 503, { 'content-type': 'application/json' });
      response.end(JSON.stringify(readiness));
      return;
    }
    if (request.method === 'POST' && request.url === '/mcp') {
      try {
        const chunks = [];
        for await (const chunk of request) { if (Buffer.concat([...chunks, chunk]).length > maxBodyBytes) throw new Error('request body too large'); chunks.push(chunk); }
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
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
        const decision = applyRoutingMode(decideRoute(body), body.routing_mode ?? 'off');
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
      if (!response.headersSent) response.writeHead(502, { 'content-type': 'application/json' });
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
    authToken: process.env.GATEWAY_AUTH_TOKEN ?? null
  });
  server.listen(Number(process.env.PORT ?? 8080), process.env.HOST ?? '0.0.0.0');
}
