import test from 'node:test';
import assert from 'node:assert/strict';
import { createLedger, readLedger } from '../src/ledger.mjs';
import { recordGatewayUsage, streamGatewayResponse, sendGatewayRequest } from '../src/gateway.mjs';

test('normalizes provider usage at the gateway boundary', async () => {
  const ledger = await createLedger();
  await recordGatewayUsage(ledger, {
    provider: 'openai', model: 'test-model', latency_ms: 9,
    usage: { prompt_tokens: 7, completion_tokens: 3, prompt_tokens_details: { cached_tokens: 2 } }
  }, { system_instructions: 1, memory_skills: 0, tool_schemas: 1, files_code: 2, tool_output_logs: 1, history: 0 });
  const [turn] = await readLedger(ledger);
  assert.deepEqual(turn, {
    schema_version: '1.0.0', provider: 'openai', model_id: 'test-model', latency_ms: 9,
    prompt_tokens: 7, completion_tokens: 3, cached_tokens: 2,
    context_breakdown: { system_instructions: 1, memory_skills: 0, tool_schemas: 1, files_code: 2, tool_output_logs: 1, history: 0 },
    timestamp: turn.timestamp, estimated_cost_usd: 0
  });
});

test('forwards streaming chunks and records trailing provider usage', async () => {
  const ledger = await createLedger();
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"hi"}}]}\n\n'));
      controller.enqueue(new TextEncoder().encode('data: {"usage":{"prompt_tokens":4,"completion_tokens":2}}\n\n'));
      controller.close();
    }
  });
  const forwarded = [];
  const recorded = await streamGatewayResponse({ body }, {
    provider: 'openai', model: 'test-model', latency_ms: 11,
    context_breakdown: { system_instructions: 1, memory_skills: 0, tool_schemas: 1, files_code: 1, tool_output_logs: 1, history: 0 }
  }, ledger, (chunk) => forwarded.push(chunk));
  assert.equal(recorded, true);
  assert.equal(forwarded.length, 2);
  assert.equal((await readLedger(ledger)).length, 1);
});

test('sends an HTTP provider request through the streaming gateway', async () => {
  const ledger = await createLedger();
  const forwarded = [];
  const fetchImpl = async (url, options) => {
    assert.equal(url, 'https://provider.test/v1/chat');
    assert.equal(options.method, 'POST');
    return new Response('data: {"usage":{"prompt_tokens":2,"completion_tokens":1}}\n\n', {
      status: 200,
      headers: { 'content-type': 'text/event-stream' }
    });
  };
  const result = await sendGatewayRequest(fetchImpl, 'https://provider.test/v1/chat', { messages: [] }, {
    provider: 'openai', model: 'test-model', latency_ms: 1,
    context_breakdown: { system_instructions: 0, memory_skills: 0, tool_schemas: 0, files_code: 0, tool_output_logs: 0, history: 0 }
  }, ledger, (chunk) => forwarded.push(chunk));
  assert.equal(result.status, 200);
  assert.equal(forwarded.length, 1);
  assert.equal((await readLedger(ledger)).length, 1);
});
