import test from 'node:test';
import assert from 'node:assert/strict';
import { diffContext, decideRoute, validateTelemetry, recordContextDiff, benchmarkDiff, benchmarkDiffSizes, defaultRouteProfiles, recordRouteDecision, persistRouteDecision, applyRoutingMode } from '../src/optimization.mjs';
import { createLedger } from '../src/ledger.mjs';

test('diffs context by category with added, removed, and unchanged items', () => {
  const diff = diffContext({ files_code: ['a', 'b'], history: ['h1'] }, { files_code: ['b', 'c'], history: ['h1'] });
  assert.deepEqual(diff.files_code, { added: ['c'], removed: ['a'], unchanged: ['b'] });
  assert.deepEqual(diff.history, { added: [], removed: [], unchanged: ['h1'] });
});

test('routes only with authoritative telemetry and within budget', () => {
  assert.deepEqual(decideRoute({ requested_tokens: 20, telemetry: { prompt_tokens: 10, timestamp: new Date().toISOString() }, budget: 30, routes: ['fast', 'safe'] }), {
    route: 'fast', reason: 'within_budget', evidence: 'authoritative'
  });
});

test('refuses downgrade when required context would be lost', () => {
  const result = decideRoute({ requested_tokens: 20, telemetry: { prompt_tokens: 10 }, budget: 30, required_context_lost: true, routes: ['fast', 'safe'] });
  assert.equal(result.route, null);
  assert.equal(result.reason, 'required_context_lost');
});

test('refuses routing without authoritative telemetry', () => {
  assert.equal(decideRoute({ requested_tokens: 2, budget: 30, routes: ['fast'] }).reason, 'telemetry_unavailable');
});

test('rejects stale telemetry', () => {
  assert.equal(validateTelemetry({ prompt_tokens: 1, timestamp: '2020-01-01T00:00:00.000Z' }, Date.parse('2020-01-01T00:10:00.000Z')), 'stale');
});

test('records a provenance-linked context diff', async () => {
  const ledger = await createLedger();
  const record = recordContextDiff(ledger, { files_code: ['a'] }, { files_code: ['b'] }, 'turn-2', '2026-10-24T00:00:00.000Z');
  assert.equal(record.turn_id, 'turn-2');
  assert.equal(ledger.contextDiffs.length, 1);
});

test('benchmarks diff execution without changing routing', () => {
  const result = benchmarkDiff({ files_code: ['a'] }, { files_code: ['b'] }, 10);
  assert.equal(result.iterations, 10);
  assert.ok(result.elapsed_ms >= 0);
});

test('rejects a route that cannot carry changed context', () => {
  const result = decideRoute({ requested_tokens: 2, telemetry: { prompt_tokens: 1, timestamp: new Date().toISOString() }, budget: 3, routes: ['fast'], context_categories: ['files_code'], route_profiles: { fast: { context_categories: ['history'], max_prompt_tokens: 10 } } });
  assert.equal(result.reason, 'incompatible_route');
});

test('records an explainable route decision', async () => {
  const ledger = await createLedger();
  const record = recordRouteDecision(ledger, { route: 'fast', reason: 'within_budget', evidence: 'authoritative' }, 'turn-2');
  assert.equal(record.type, 'route_decision');
  assert.equal(ledger.routeDecisions.length, 1);
});

test('provides conservative route profiles', () => {
  assert.ok(defaultRouteProfiles.fast.max_prompt_tokens > 0);
});

test('observe mode reports a candidate without applying it', () => {
  const decision = { route: 'fast', reason: 'within_budget', evidence: 'authoritative' };
  assert.deepEqual(applyRoutingMode(decision, 'observe'), { ...decision, applied_route: null, mode: 'observe' });
});

test('unknown routing mode is refused', () => {
  assert.throws(() => applyRoutingMode({ route: 'fast' }, 'unknown'), /routing mode/);
});

test('benchmarks small, medium, and large context diffs', () => {
  assert.deepEqual(benchmarkDiffSizes(2).map((item) => item.size), [10, 100, 1000]);
});

test('persists observe decisions in the evidence ledger', async () => {
  const ledger = await createLedger();
  const record = await persistRouteDecision(ledger, applyRoutingMode({ route: 'fast', reason: 'within_budget', evidence: 'authoritative' }, 'observe'), 'turn-1');
  assert.equal(record.decision.applied_route, null);
});
