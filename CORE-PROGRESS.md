# Core Progress

_Measured 2026-10-23. Phase 0 and the Phase 1 contract/ledger/streaming-gateway slice are implemented locally._

This is the only project progress record. Keep status, evidence, risks, decisions affecting delivery, completed work, and next work here. Do not create a separate status, big-picture, or progress file.

| Area | Stage | Evidence | Next boundary |
|---|---|---|---|
| Source requirements | implemented | Four project data files read and synthesized | Lock contracts |
| Runtime bootstrap | implemented (23 Oct 2026) | Node 24.20.0, npm 12.2.0, Git repository initialized | Add gateway boundary |
| Gateway telemetry | HTTP streaming adapter implemented (23 Oct 2026) | `src/gateway.mjs` sends provider requests, forwards chunks, and records trailing usage; real local HTTP mock-provider `/v1/chat` verification passes; 35 tests pass | Verify hosted provider configuration separately |
| Task capsules | durable contract implemented (23 Oct 2026) | Versioned validator, JSON round-trip, Markdown rendering, and CLI read command pass | Integrate handoff trigger |
| Log distillation | not started | No source/runtime code in project | Deterministic extraction tests |
| Context ledger | durable local ledger implemented (23 Oct 2026) | JSONL file-backed `src/ledger.mjs` with explicit empty/available status; tests pass | Integrate into gateway runtime |
| MCP enforcement | implemented (24 Oct 2026) | `src/enforcement.mjs` and `/mcp` server boundary; authenticated client flow verifies profiles, bounded retrieval, and traversal denial; 36 tests pass | Run broader staging load/security checks |
| Context optimization | observe mode locally verified (24 Oct 2026) | Gateway-produced authoritative usage was reused by `/optimization/inspect`; route candidate was explained and `applied_route` remained null; 38 tests pass | Collect broader hosted telemetry before any enforcement |
| Docker staging harness | implemented locally (24 Oct 2026) | App, PostgreSQL, and mock-provider Compose services build and run; `/ready` executes `SELECT 1` when PostgreSQL is configured and returns 503 on failure; 34 tests pass | Deploy this readiness change and verify hosted database behavior |
| Staging verification | local Docker verified (24 Oct 2026) | Rebuilt current image; PostgreSQL-backed readiness returned 200 with `database: ready`, unauthorized readiness returned 401, MCP profile listing returned 200, traversal returned 403, 50/50 health probes returned 200, and fresh custom-format backup/restore plus app restart passed | Add sustained load/security tooling and hosted staging checks |
| Operations | local implementation verified (24 Oct 2026) | Structured JSON request logs and protected Prometheus-style `/metrics` endpoint added; auth-denial and request counters tested; 37 tests pass | Configure deployment alerts and hosted dashboards |
| Ray Sandbox OARC | project-scoped local runtime verified | Configured audit identity is exposed as the server-approved `configured` scope; onboarding returns `tenant-local / oarc-bank / project-1`; retain 201, recall 200, other-project recall 403; migration 0012 applied | Preserve configuration in deployment and separately verify production |
| Ray Memory app | local project sharing verified | Authenticated onboarding and project-memory routes use the configured scope; Ray full suite 365 passed, 6 skipped; typecheck and build passed | Browser and production verification remain separate evidence gates |

## Evidence limits

- Oversized `/v1/chat` requests now return explicit HTTP 413; full suite passes 39 tests.

- `npm test` passes 32 tests. `npm run status` returns explicit empty state; provider HTTP behavior is mock-provider verified only; local Docker health/readiness and MCP checks are HTTP verified; no hosted deployment, external provider, or production verification exists yet.
- `http://127.0.0.1:3028/` is evidence of a reachable Ray Sandbox OARC page only.
- Ray Memory health is not the same as project sharing readiness.
- The local Phase 0 -> Phase 1 Big Slice is implemented and committed as `c077e65 feat: bootstrap phase 1 context governor`.
- Phase 2 safe surgical retrieval and enforcement is locally implemented; `npm test` passes 15 tests. This is local code/test evidence only, not browser, benchmark, deployment, or production evidence.
- Phase 3 optimization foundation is locally implemented; `npm test` passes 20 tests. Automatic live routing remains disabled pending broader authoritative telemetry.
- Ray project-scoped sharing is verified in the local current checkout; the Ray worktree remains dirty with user changes, including the uncommitted integration edits used for this verification.
