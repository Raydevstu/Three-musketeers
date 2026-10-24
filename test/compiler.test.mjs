import test from 'node:test';
import assert from 'node:assert/strict';
import { compilePrompt } from '../src/compiler.mjs';

const structured = { intent_vector: 'debug api', context_payload: { files: ['src/server.mjs'] }, constraints: ['preserve auth'], step_by_step_plan: ['inspect route'], expected_output_format: 'markdown', token_budget: 800 };

test('compiles a raw prompt through an Ollama-compatible provider', async () => {
  const calls = [];
  const result = await compilePrompt('Fix the API auth bug', {
    providerUrl: 'http://ollama.test/api/generate', model: 'llama3.2',
    fetchImpl: async (url, options) => { calls.push({ url, body: JSON.parse(options.body) }); return new Response(JSON.stringify({ response: JSON.stringify(structured) }), { status: 200 }); }
  });
  assert.deepEqual(result, { ...structured, context_payload: { raw_prompt: 'Fix the API auth bug' } });
  assert.equal(calls[0].body.model, 'llama3.2');
  assert.equal(calls[0].body.stream, false);
  assert.equal(calls[0].body.format.properties.constraints.type, 'array');
  assert.equal(calls[0].body.format.properties.token_budget.type, 'integer');
  assert.deepEqual(calls[0].body.options, { temperature: 0, num_predict: 512 });
  assert.match(calls[0].body.prompt, /Fix the API auth bug/);
});

test('rejects malformed compiler output instead of inventing fields', async () => {
  await assert.rejects(() => compilePrompt('ambiguous', { fetchImpl: async () => new Response(JSON.stringify({ response: 'not json' }), { status: 200 }) }), /valid structured prompt/);
});

test('rejects a token budget outside the safe compiler limit', async () => {
  const invalid = { ...structured, token_budget: 100_001 };
  await assert.rejects(() => compilePrompt('safe request', { fetchImpl: async () => new Response(JSON.stringify({ response: JSON.stringify(invalid) }), { status: 200 }) }), /valid structured prompt/);
});
