import { recordUsage } from './ledger.mjs';

export async function recordGatewayUsage(ledger, response, context_breakdown) {
  const usage = response?.usage;
  if (!usage || !Number.isFinite(usage.prompt_tokens) || !Number.isFinite(usage.completion_tokens)) return false;
  await recordUsage(ledger, {
    schema_version: '1.0.0',
    provider: response.provider,
    model_id: response.model,
    timestamp: new Date().toISOString(),
    latency_ms: response.latency_ms,
    prompt_tokens: usage.prompt_tokens,
    completion_tokens: usage.completion_tokens,
    cached_tokens: usage.prompt_tokens_details?.cached_tokens ?? 0,
    context_breakdown,
    estimated_cost_usd: 0
  });
  return true;
}

export async function streamGatewayResponse(response, metadata, ledger, writeChunk) {
  if (!response?.body?.getReader) throw new TypeError('Provider response body must be readable');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let usage;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const text = decoder.decode(value, { stream: true });
    buffer += text;
    writeChunk(text);
    for (const match of buffer.matchAll(/data:\s*(\{[^\n]+\})/g)) {
      try {
        const event = JSON.parse(match[1]);
        if (event.usage) usage = event.usage;
      } catch {
        // Forward provider chunks unchanged; malformed events are not accounting evidence.
      }
    }
  }
  if (!usage) return false;
  return recordGatewayUsage(ledger, { ...metadata, usage }, metadata.context_breakdown);
}

export async function sendGatewayRequest(fetchImpl, url, requestBody, metadata, ledger, writeChunk) {
  const headers = {
    'content-type': 'application/json',
    accept: 'text/event-stream'
  };
  // OpenRouter support
  if (process.env.OPENROUTER_API_KEY) {
    headers.Authorization = `Bearer ${process.env.OPENROUTER_API_KEY}`;
  }
  const response = await fetchImpl(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody)
  });
  if (!response.ok) throw new Error(`Provider request failed: ${response.status}`);
  await streamGatewayResponse(response, metadata, ledger, writeChunk);
  return { status: response.status };
}
