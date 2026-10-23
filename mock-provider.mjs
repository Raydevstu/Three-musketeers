import { createServer } from 'node:http';

createServer(async (request, response) => {
  const url = new URL(request.url, 'http://mock');
  if (request.method !== 'POST' || url.pathname !== '/v1/chat') {
    response.writeHead(404).end();
    return;
  }
  if (url.searchParams.get('mode') === 'fail') {
    response.writeHead(503).end(JSON.stringify({ error: 'mock upstream failure' }));
    return;
  }
  if (url.searchParams.get('mode') === 'timeout') {
    await new Promise((resolve) => setTimeout(resolve, 30000));
  }
  response.writeHead(200, { 'content-type': 'text/event-stream' });
  response.write('data: {"choices":[{"delta":{"content":"mock"}}]}\n\n');
  response.end('data: {"usage":{"prompt_tokens":3,"completion_tokens":1}}\n\n');
}).listen(9000, '0.0.0.0');
