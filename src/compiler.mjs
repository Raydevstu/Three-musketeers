const requiredFields = ['intent_vector', 'context_payload', 'constraints', 'step_by_step_plan', 'expected_output_format', 'token_budget'];
const outputSchema = {
  type: 'object', required: requiredFields,
  properties: {
    intent_vector: { type: 'string' }, context_payload: { type: 'object' }, constraints: { type: 'array', items: { type: 'string' } },
    step_by_step_plan: { type: 'array', items: { type: 'string' } }, expected_output_format: { type: 'string' }, token_budget: { type: 'integer', minimum: 1 }
  }
};

function validateCompiledPrompt(value) {
  return Boolean(value && typeof value.intent_vector === 'string' && value.context_payload && Array.isArray(value.constraints) && Array.isArray(value.step_by_step_plan) && typeof value.expected_output_format === 'string' && Number.isInteger(value.token_budget) && value.token_budget > 0 && value.token_budget <= 100_000 && requiredFields.every((field) => field in value));
}

export async function compilePrompt(rawPrompt, { providerUrl = process.env.LOCAL_AI_URL ?? 'http://127.0.0.1:11434/api/generate', model = process.env.LOCAL_AI_MODEL ?? 'llama3.2:3b', numPredict = 512, fetchImpl = fetch } = {}) {
  if (typeof rawPrompt !== 'string' || !rawPrompt.trim()) throw new TypeError('raw prompt is required');
  const response = await fetchImpl(providerUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model, stream: false, format: outputSchema, options: { temperature: 0, num_predict: numPredict }, prompt: `Return only JSON that matches the supplied schema. Compile this raw prompt without inventing unavailable facts:\n\n${rawPrompt}` }) });
  if (!response.ok) throw new Error(`Compiler provider request failed: ${response.status}`);
  let payload;
  let providerPayload;
  try { providerPayload = await response.json(); payload = JSON.parse(providerPayload.response); } catch { throw new Error('Compiler provider did not return valid structured prompt JSON'); }
  if (!validateCompiledPrompt(payload)) throw new Error('Compiler provider did not return a valid structured prompt');
  const usage = Number.isFinite(providerPayload?.prompt_eval_count) || Number.isFinite(providerPayload?.eval_count)
    ? { prompt_tokens: providerPayload.prompt_eval_count ?? 0, completion_tokens: providerPayload.eval_count ?? 0, total_tokens: (providerPayload.prompt_eval_count ?? 0) + (providerPayload.eval_count ?? 0) }
    : null;
  return { ...payload, context_payload: { raw_prompt: rawPrompt }, ...(usage ? { usage } : {}) };
}
