const categories = ['system_instructions', 'memory_skills', 'tool_schemas', 'files_code', 'tool_output_logs', 'history'];
import { appendFile } from 'node:fs/promises';
export const defaultRouteProfiles = {
  fast: { context_categories: categories, max_prompt_tokens: 16000 },
  safe: { context_categories: categories, max_prompt_tokens: 32000 }
};

export function diffContext(previous = {}, current = {}) {
  return Object.fromEntries(categories.map((category) => {
    const before = new Set(previous[category] ?? []);
    const after = new Set(current[category] ?? []);
    return [category, {
      added: [...after].filter((item) => !before.has(item)),
      removed: [...before].filter((item) => !after.has(item)),
      unchanged: [...after].filter((item) => before.has(item))
    }];
  }));
}

export function decideRoute({ requested_tokens, telemetry, budget, required_context_lost = false, routes = [], context_categories = [], route_profiles = defaultRouteProfiles }) {
  if (required_context_lost) return { route: null, reason: 'required_context_lost', evidence: 'authoritative' };
  const telemetryState = validateTelemetry(telemetry);
  if (telemetryState !== 'authoritative') return { route: null, reason: telemetryState === 'stale' ? 'telemetry_stale' : 'telemetry_unavailable', evidence: telemetryState };
  if (!Number.isFinite(budget) || !Number.isFinite(requested_tokens) || requested_tokens > budget) return { route: null, reason: 'budget_exceeded', evidence: 'authoritative' };
  if (!routes.length) return { route: null, reason: 'no_compatible_route', evidence: 'authoritative' };
  const route = routes.find((name) => {
    const profile = route_profiles[name];
    return profile && requested_tokens <= profile.max_prompt_tokens && context_categories.every((category) => profile.context_categories.includes(category));
  });
  if (!route) return { route: null, reason: 'incompatible_route', evidence: 'authoritative' };
  return { route, reason: 'within_budget', evidence: 'authoritative' };
}

export function benchmarkDiff(previous, current, iterations = 100) {
  const start = performance.now();
  for (let index = 0; index < iterations; index += 1) diffContext(previous, current);
  return { iterations, elapsed_ms: performance.now() - start };
}

export function benchmarkDiffSizes(iterations = 100) {
  return [10, 100, 1000].map((size) => {
    const previous = { files_code: Array.from({ length: size }, (_, index) => `old-${index}`) };
    const current = { files_code: Array.from({ length: size }, (_, index) => `new-${index}`) };
    return { size, ...benchmarkDiff(previous, current, iterations) };
  });
}

export function validateTelemetry(telemetry, now = Date.now(), maxAgeMs = 300000) {
  if (!Number.isFinite(telemetry?.prompt_tokens) || !telemetry.timestamp) return 'unavailable';
  const age = now - Date.parse(telemetry.timestamp);
  return Number.isFinite(age) && age >= 0 && age <= maxAgeMs ? 'authoritative' : 'stale';
}

export function recordContextDiff(ledger, previous, current, turn_id, timestamp = new Date().toISOString()) {
  const record = { type: 'context_diff', turn_id, timestamp, diff: diffContext(previous, current) };
  ledger.contextDiffs ??= [];
  ledger.contextDiffs.push(structuredClone(record));
  return record;
}

export function recordRouteDecision(ledger, decision, turn_id, timestamp = new Date().toISOString()) {
  const record = { type: 'route_decision', turn_id, timestamp, decision: structuredClone(decision) };
  ledger.routeDecisions ??= [];
  ledger.routeDecisions.push(record);
  return record;
}

export async function persistRouteDecision(ledger, decision, turn_id, timestamp = new Date().toISOString()) {
  const record = recordRouteDecision(ledger, decision, turn_id, timestamp);
  if (ledger.filePath) await appendFile(ledger.filePath, `${JSON.stringify(record)}\n`, 'utf8');
  return record;
}

export function applyRoutingMode(decision, mode = 'off', { enforceEnabled = false } = {}) {
  if (!['off', 'observe', 'enforce'].includes(mode)) throw new Error('invalid routing mode');
  if (mode === 'enforce' && !enforceEnabled) throw new Error('routing enforcement disabled');
  return { ...decision, applied_route: mode === 'enforce' ? decision.route : null, mode };
}
