CREATE TABLE IF NOT EXISTS jobs (
  name text PRIMARY KEY,
  request jsonb NOT NULL,
  every_ms integer,
  state text NOT NULL DEFAULT 'idle',
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_enqueued_at timestamptz
);
CREATE TABLE IF NOT EXISTS executions (
  id bigserial PRIMARY KEY,
  job_name text NOT NULL REFERENCES jobs(name),
  state text NOT NULL,
  result jsonb,
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE TABLE IF NOT EXISTS job_attempts (
  id bigserial PRIMARY KEY,
  execution_id bigint NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
  attempt integer NOT NULL,
  state text NOT NULL,
  result jsonb,
  error text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS dead_letter_jobs (
  id bigserial PRIMARY KEY,
  execution_id bigint NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
  job_name text NOT NULL,
  error text NOT NULL,
  attempts integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS webhook_events (
  event_id text PRIMARY KEY,
  job_name text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);
