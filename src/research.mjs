export async function fetchResearchSources(urls, { fetchImpl = fetch, timeoutMs = 15000, maxChars = 12000 } = {}) {
  const sources = [];
  for (const url of [...new Set(urls)].slice(0, 10)) {
    try {
      const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs);
      const response = await fetchImpl(url, { signal: controller.signal, headers: { accept: 'text/html,text/plain' } }); clearTimeout(timer);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const raw = await response.text(); const text = raw.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxChars);
      sources.push({ url, retrieved_at: new Date().toISOString(), text });
    } catch (error) { sources.push({ url, status: 'unavailable', error: error instanceof Error ? error.message : String(error) }); }
  }
  return sources;
}
export function sourceUrlsFromTask(task) { return [...task.matchAll(/https?:\/\/[^\s)]+/g)].map(([url]) => url.replace(/[.,;]+$/, '')); }

export async function synthesizeResearchReport(task, sources, { providerUrl = process.env.LOCAL_AI_URL ?? 'http://127.0.0.1:11434/api/generate', model = process.env.LOCAL_AI_MODEL ?? 'llama3.2:3b', fetchImpl = fetch } = {}) {
  if (!sources.length) return { answer: 'I could not produce a verified report because no readable sources were retrieved.', competitors: [], citations: [], confidence: 'low' };
  const evidence = sources.map((source, index) => `[${index + 1}] ${source.url}\n${source.text}`).join('\n\n');
  const prompt = `Create a concise research report for this request: ${task}\n\nUse only the evidence below. Do not invent competitors, prices, features, or performance. Return JSON with exactly these fields: answer (string), competitors (array of objects with name, comparison, evidence_ids), citations (array of objects with id, url, claim), confidence (high|medium|low). Every factual claim must cite an evidence id.\n\nEvidence:\n${evidence}`;
  const response = await fetchImpl(providerUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model, stream: false, format: 'json', options: { temperature: 0, num_predict: 900 }, prompt }) });
  if (!response.ok) throw new Error(`Research synthesis provider failed: ${response.status}`);
  const payload = await response.json(); let report;
  try { report = JSON.parse(payload.response); } catch { throw new Error('Research synthesis provider did not return valid JSON'); }
  if (typeof report.answer !== 'string' || !Array.isArray(report.competitors) || !Array.isArray(report.citations)) throw new Error('Research synthesis returned an invalid report');
  return report;
}
