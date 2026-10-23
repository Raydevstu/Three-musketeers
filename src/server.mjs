import { createServer } from 'node:http';
import { sendGatewayRequest } from './gateway.mjs';
import { createLedger } from './ledger.mjs';

const emptyBreakdown = { system_instructions: 0, memory_skills: 0, tool_schemas: 0, files_code: 0, tool_output_logs: 0, history: 0 };

export function createGatewayServer({ providerUrl, provider, model, ledger, fetchImpl = fetch }) {
  return createServer(async (request, response) => {
    if (request.method === 'GET' && request.url === '/health') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ status: 'ok' }));
      return;
    }
    if (request.method !== 'POST' || request.url !== '/v1/chat') {
      response.writeHead(404, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: 'Not found' }));
      return;
    }
    try {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
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
  const ledger = await createLedger(process.env.EVIDENCE_LEDGER_PATH ?? '.data/evidence.jsonl');
  const server = createGatewayServer({
    providerUrl: process.env.PROVIDER_URL ?? '',
    provider: process.env.PROVIDER ?? 'local',
    model: process.env.MODEL ?? 'unconfigured',
    ledger
  });
  server.listen(Number(process.env.PORT ?? 8080), '127.0.0.1');
}
