CREATE TABLE IF NOT EXISTS evidence_events (
  event_id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  turn_id TEXT,
  tenant_id TEXT,
  project_id TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload JSONB NOT NULL,
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS evidence_events_scope_time_idx
  ON evidence_events (tenant_id, project_id, occurred_at DESC);
