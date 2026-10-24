import pg from 'pg';

const { Pool } = pg;

export async function enqueueDueJobs(pool, now = new Date()) {
  const result = await pool.query("UPDATE jobs SET state = 'queued', last_enqueued_at = $1, updated_at = $1 WHERE every_ms IS NOT NULL AND (last_enqueued_at IS NULL OR last_enqueued_at <= $1 - (every_ms * interval '1 millisecond')) AND state IN ('idle', 'succeeded', 'failed') RETURNING name", [now]);
  return result.rows.map((row) => row.name);
}

export async function startScheduler({ databaseUrl = process.env.DATABASE_URL, pollMs = 1000 } = {}) {
  if (!databaseUrl) throw new Error('DATABASE_URL is required for the scheduler');
  const pool = new Pool({ connectionString: databaseUrl });
  const timer = setInterval(() => enqueueDueJobs(pool).catch((error) => console.error('scheduler cycle failed', error)), pollMs);
  return { pool, stop: async () => { clearInterval(timer); await pool.end(); } };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv.includes('--once')) {
    if (!process.env.DATABASE_URL) { console.error('DATABASE_URL is required for the scheduler'); process.exitCode = 1; }
    else { const pool = new Pool({ connectionString: process.env.DATABASE_URL }); enqueueDueJobs(pool).finally(() => pool.end()); }
  } else startScheduler().catch((error) => { console.error(error); process.exitCode = 1; });
}
