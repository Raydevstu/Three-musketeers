import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const actions = new Set(['observe', 'navigate', 'click', 'fill', 'screenshot']);

export function createBrowserConnector({ exec = execFileAsync, command = 'bsk', sessionId = null } = {}) {
  let session = sessionId;
  return {
    async start() {
      if (session) return session;
      const result = await exec(command, ['session', 'start', '--json'], { maxBuffer: 2_000_000 });
      const payload = JSON.parse(result.stdout);
      session = payload.session_id ?? payload.id;
      if (!session) throw new Error('browser bridge did not return a session id');
      return session;
    },
    async execute(input) {
      if (!actions.has(input.action)) throw new Error(`browser action denied: ${input.action}`);
      if (input.action === 'navigate' && typeof input.url !== 'string') throw new Error('browser navigate requires url');
      if ((input.action === 'click' || input.action === 'fill') && typeof input.ref !== 'string') throw new Error(`browser ${input.action} requires ref`);
      if (input.action === 'fill' && typeof input.value !== 'string') throw new Error('browser fill requires value');
      const active = await this.start();
      const args = [input.action];
      if (input.action === 'navigate') args.push(input.url);
      if (input.action === 'click' || input.action === 'fill') args.push('--ref', input.ref);
      if (input.action === 'fill') args.push('--value', input.value);
      if (input.action === 'screenshot') {
        if (input.ref) args.push('--ref', input.ref);
        if (input.full_page === true) args.push('--full-page');
        if (typeof input.out === 'string' && input.out) args.push('--out', input.out);
      }
      args.push('--session', active, '--json');
      const result = await exec(command, args, { maxBuffer: 2_000_000 });
      let payload;
      try { payload = JSON.parse(result.stdout); } catch { payload = { stdout: result.stdout.trim() }; }
      return { action: input.action, session_id: active, result: payload };
    }
  };
}

export function createConnectorBridgeServer({ connector, authToken = null, port = 18100 } = {}) {
  return createServer(async (request, response) => {
    if (request.method !== 'POST' || request.url !== '/execute') { response.writeHead(404); response.end(); return; }
    if (authToken && request.headers.authorization !== `Bearer ${authToken}`) { response.writeHead(401); response.end(JSON.stringify({ error: 'Unauthorized' })); return; }
    try { const chunks = []; for await (const chunk of request) chunks.push(chunk); const input = JSON.parse(Buffer.concat(chunks).toString('utf8')); if (input.approved !== true) throw new Error('approval required for connector action'); const result = await connector.execute(input); response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify(result)); }
    catch (error) { response.writeHead(422, { 'content-type': 'application/json' }); response.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) })); }
  }).listen(port);
}

if (process.argv[1]?.endsWith('connector-bridge.mjs')) {
  const connector = createBrowserConnector();
  createConnectorBridgeServer({ connector, authToken: process.env.CONNECTOR_BRIDGE_TOKEN ?? null, port: Number(process.env.CONNECTOR_BRIDGE_PORT ?? 18100) });
}
