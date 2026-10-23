const contextKeys = ['system_instructions', 'memory_skills', 'tool_schemas', 'files_code', 'tool_output_logs', 'history'];

export function validateNormalizedUsage(value) {
  if (!value || value.schema_version !== '1.0.0' || typeof value.provider !== 'string' || typeof value.model_id !== 'string' || typeof value.timestamp !== 'string') return false;
  if (![value.latency_ms, value.prompt_tokens, value.completion_tokens, value.cached_tokens, value.estimated_cost_usd].every(Number.isFinite)) return false;
  return value.context_breakdown && contextKeys.every((key) => Number.isFinite(value.context_breakdown[key]));
}

export function validateTaskCapsule(value) {
  return Boolean(value && value.schema_version === '1.0.0' && typeof value.capsule_id === 'string' && typeof value.created_at === 'string' && typeof value.intent === 'string' && typeof value.exact_next_boundary === 'string' && value.current_state && Array.isArray(value.current_state.files_touched) && value.test_status && Array.isArray(value.test_status.passed) && Array.isArray(value.test_status.failed) && Array.isArray(value.test_status.skipped));
}
