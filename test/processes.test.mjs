import test from 'node:test';
import assert from 'node:assert/strict';
import { enqueueDueJobs } from '../src/scheduler.mjs';

test('scheduler enqueues due jobs and leaves recent jobs alone', async () => {
  const queries = [];
  const pool = { query: async (sql, params) => { queries.push({ sql, params }); return { rows: [{ name: 'nightly' }] }; } };
  assert.deepEqual(await enqueueDueJobs(pool, new Date('2026-10-24T00:00:00Z')), ['nightly']);
  assert.match(queries[0].sql, /UPDATE jobs SET state = 'queued'/);
});
