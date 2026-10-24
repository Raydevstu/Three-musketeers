export async function measureDelegation({ baseline, delegated }) {
  const startedAt = performance.now();
  const baselineResult = await baseline();
  const baselineMs = performance.now() - startedAt;
  const delegatedStartedAt = performance.now();
  const delegatedResult = await delegated();
  const delegatedMs = performance.now() - delegatedStartedAt;
  const baselineTokens = Number(baselineResult?.usage?.total_tokens ?? baselineResult?.total_tokens);
  const delegatedTokens = Number(delegatedResult?.usage?.total_tokens ?? delegatedResult?.total_tokens);
  return {
    baseline_tokens: Number.isFinite(baselineTokens) ? baselineTokens : null,
    delegated_tokens: Number.isFinite(delegatedTokens) ? delegatedTokens : null,
    tokens_saved: Number.isFinite(baselineTokens) && Number.isFinite(delegatedTokens) ? baselineTokens - delegatedTokens : null,
    baseline_duration_ms: baselineMs,
    delegated_duration_ms: delegatedMs,
    delegated_status: delegatedResult?.result?.status ?? delegatedResult?.status ?? 'unknown'
  };
}
