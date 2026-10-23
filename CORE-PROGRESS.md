# Core Progress

_Measured 2026-10-23. Phase 0 and the Phase 1 contract/ledger/streaming-gateway slice are implemented locally._

This is the only project progress record. Keep status, evidence, risks, decisions affecting delivery, completed work, and next work here. Do not create a separate status, big-picture, or progress file.

| Area | Stage | Evidence | Next boundary |
|---|---|---|---|
| Source requirements | implemented | Four project data files read and synthesized | Lock contracts |
| Runtime bootstrap | implemented (23 Oct 2026) | Node 24.20.0, npm 12.2.0, Git repository initialized | Add gateway boundary |
| Gateway telemetry | HTTP streaming adapter implemented (23 Oct 2026) | `src/gateway.mjs` sends provider requests, forwards chunks, and records trailing usage; tests pass | Add runtime command/server boundary |
| Task capsules | durable contract implemented (23 Oct 2026) | Versioned validator, JSON round-trip, Markdown rendering, and CLI read command pass | Integrate handoff trigger |
| Log distillation | not started | No source/runtime code in project | Deterministic extraction tests |
| Context ledger | durable local ledger implemented (23 Oct 2026) | JSONL file-backed `src/ledger.mjs` with explicit empty/available status; tests pass | Integrate into gateway runtime |
| MCP enforcement | implemented (24 Oct 2026) | `src/enforcement.mjs` and `/mcp` server boundary; path traversal, profile denial, budget rejection, bounded output, and HTTP profile listing tests pass | Add symbol-level retrieval only if needed |
| Context optimization | implemented locally (24 Oct 2026) | `src/optimization.mjs` adds route profiles, compatibility checks, durable decision records, category diffs, telemetry freshness, small/medium/large benchmarks, and off/observe/enforce mode handling; 30 tests pass | Run observe mode with broader telemetry and real MCP/client verification |
| Docker staging harness | implemented locally (24 Oct 2026) | App, PostgreSQL, and mock-provider Compose services build and run; `/ready` executes `SELECT 1` when PostgreSQL is configured and returns 503 on failure; 34 tests pass | Deploy this readiness change and verify hosted database behavior |
| Staging verification | local Docker verified (24 Oct 2026) | Backup restore completed, unauthorized readiness returned 401, authenticated MCP profile listing returned 200, 50/50 health probes returned 200, mock timeout aborted as expected | Run an actual staging deployment and production change-control checks |
| Ray Sandbox OARC | project-scoped local runtime verified | Configured audit identity is exposed as the server-approved `configured` scope; onboarding returns `tenant-local / oarc-bank / project-1`; retain 201, recall 200, other-project recall 403; migration 0012 applied | Preserve configuration in deployment and separately verify production |
| Ray Memory app | local project sharing verified | Authenticated onboarding and project-memory routes use the configured scope; Ray full suite 365 passed, 6 skipped; typecheck and build passed | Browser and production verification remain separate evidence gates |

## Evidence limits

- `npm test` passes 32 tests. `npm run status` returns explicit empty state; provider HTTP behavior is mock-provider verified only; local Docker health/readiness and MCP checks are HTTP verified; no hosted deployment, external provider, or production verification exists yet.
- `http://127.0.0.1:3028/` is evidence of a reachable Ray Sandbox OARC page only.
- Ray Memory health is not the same as project sharing readiness.
- The local Phase 0 -> Phase 1 Big Slice is implemented and committed as `c077e65 feat: bootstrap phase 1 context governor`.
- Phase 2 safe surgical retrieval and enforcement is locally implemented; `npm test` passes 15 tests. This is local code/test evidence only, not browser, benchmark, deployment, or production evidence.
- Phase 3 optimization foundation is locally implemented; `npm test` passes 20 tests. Automatic live routing remains disabled pending broader authoritative telemetry.
- Ray project-scoped sharing is verified in the local current checkout; the Ray worktree remains dirty with user changes, including the uncommitted integration edits used for this verification.
