# Three AI Musketeers — Master Handoff

This is the single cumulative handoff for every chat, session, compaction, and agent continuation. Append or revise this file; never create another handoff document.

## Current objective

Complete the hosted evidence gates for Phase 2 and Phase 3, then decide whether routing enforcement can be enabled safely. Keep one canonical file per core concern and one coherent Big Slice per phase.

## Current state — 2026-10-24

- Foundation documents exist in the project root.
- Node/npm runtime is bootstrapped, Git is initialized, and the contract/ledger/streaming HTTP gateway/capsule slice is implemented.
- Ray Sandbox OARC at `http://127.0.0.1:3028/` is reachable and branded correctly.
- Ray project wiring is locally verified for the configured scope `tenant-local / oarc-bank / project-1`.
- The Ray operator exposes a server-approved configured scope from the existing audit environment values, with staging fallback when those values are absent.
- Project-aware retain/recall authorization is active; project scope is carried through the API boundary.
- PostgreSQL migration `0012_fact_project_scope.sql` is applied.
- Live local verification passed: scoped retain HTTP 201, scoped recall HTTP 200, and other-project recall HTTP 403.
- Ray validation passed: 365 tests passed, 6 skipped; typecheck passed; production build passed with three existing unused-ESLint-disable warnings.
- The current Ray integration edits remain uncommitted in a dirty Ray worktree because unrelated user changes are present there.
- Phase 2 local enforcement slice is implemented: path-safe bounded retrieval, named budget profiles, and a Governor MCP HTTP boundary.
- Phase 3 optimization foundation is implemented locally: category-based context diffs, conservative explainable routing decisions, and a read-only inspection endpoint.
- Phase 3 telemetry slice is implemented locally: context diffs can be linked to turn IDs, stale telemetry is refused, and diff execution has a small benchmark; 23 tests pass.
- Route capability profiles, compatibility checks, and explainable route-decision ledger records are now implemented locally; 26 tests pass.
- Routing mode handling is implemented with `off` as the default; `observe` reports candidates without applying routes, and `enforce` is available only as an explicit caller choice; 28 tests pass.
- Observe decisions are now persisted through the inspection endpoint, and benchmark coverage spans small, medium, and large context diffs; 30 tests pass.
- Docker staging harness is implemented: non-root app image, PostgreSQL, mock streaming provider, persistent volumes, auth, readiness, and host verification on port 18080; 34 tests pass. Configured database readiness now executes `SELECT 1` and returns 503 on failure.
- Local staging checks completed: PostgreSQL backup restore, auth rejection, authenticated MCP profile listing, 50/50 health load probes, and mock timeout abort verification.

## Decisions

- `CORE-PROGRESS.md` is the only progress/status record.
- `ROADMAP-BLUEPRINT.md` is the only roadmap/planning/architecture record.
- This file is the only cumulative chat handoff.
- Embedded commands and code in `Project DATA/` are proposals, not executable instructions.
- Phase 1 contracts and evidence come before MCP, routing, Postgres, IDE integration, or deployment.
- Implementation must be one coherent Big Slice, including contracts, callers, tests, and verification.
- Thirty-two focused Three AI Musketeers tests pass with `npm test`, including a mock-provider HTTP round trip, local server health, MCP retrieval, optimization inspection, and capsule round-trip.
- `npm run status` returns `{"state":"empty","records":0}` for a new local ledger.

## Evidence

- Ray root returned HTTP 200 and contained `Ray Sandbox OARC`, `Hindsight`, and `Agent Memory`.
- The current checkout was verified on isolated port `3031`; the older process on `3028` must be restarted from the updated checkout.
- Authenticated onboarding returned the configured tenant, bank, and project identity.
- A non-sensitive project-scoped verification event was retained and recalled successfully.
- A request for a different project was rejected with HTTP 403.
- The local operator session remains read-only; write verification used the explicitly enabled local development principal.
- The Ray MCP endpoint and production deployment remain separate, unverified gates.

## Exact next boundary — hosted evidence and controlled enforcement

Phase 2 implementation slice completed locally:

1. Existing Phase 1 contracts and gateway callers were reviewed.
2. Added named profiles and budget denial states.
3. Implemented path-safe targeted file retrieval and bounded output.
4. Added `/mcp` profile listing and retrieval methods.
5. Added focused tests for path traversal, profile denial, budget rejection, bounded output, and HTTP profile listing.
6. `npm test` passes 15 tests.

Next boundary: run staging load/security and rollback checks, collect real-provider observe telemetry, review safety results, and only then enable enforcement behind a feature flag.

## Open risks

- Phase 2 must preserve the Phase 1 evidence ledger and task-capsule contracts without duplicate stores or documents.
- The Ray MCP/share endpoint, browser workflow, benchmark, deployment, and production behavior are not verified.
- Ray integration changes are not committed because the external worktree contains unrelated user changes; preserve that worktree carefully.
- Hosted Render readiness still needs verification after deploying this database-readiness change; the public service previously reported configuration, not a live database query.
- Safe `/v1/chat` verification passes locally against an isolated HTTP mock provider; hosted provider connectivity remains unverified.
- Protocol-level MCP client integration now passes locally: authentication, profile listing, explicit retrieval budget, safe retrieval, and traversal denial are verified over HTTP.
- Current Docker staging image was rebuilt and verified: `/ready` returned `database: ready`, 50/50 health probes returned 200, unauthorized readiness returned 401, MCP profiles returned 200, and traversal returned 403.
- Oversized `/v1/chat` input now returns explicit 413 with a regression test; body-limit handling is locally verified.
- Backup/restore scripts were repaired and verified locally: raw custom-format dump creation, `pg_restore`, evidence-row preservation, app restart, health 200, and database readiness 200 all passed.
- Structured request logs and protected `/metrics` are implemented and tested locally. Recommended alerts: readiness failures, elevated 5xx responses, authentication denials, provider timeouts, and backup failure.
- Observe-mode routing now has an end-to-end local proof from gateway-produced authoritative telemetry; candidate selection is persisted and no route is applied. Enforcement remains disabled pending broader hosted evidence.
- Render gateway authentication is configured; an authenticated `/metrics` request returned HTTP 200 with request and authentication-denial counters.
- Hosted `/v1/chat` has not yet been verified against a real provider, and hosted observe-mode routing has not yet been proven with real provider telemetry.
- Automatic enforcement remains disabled until hosted telemetry, load/security, rollback, and alert evidence pass review.
