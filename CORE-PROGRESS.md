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
| MCP enforcement | not started | Proposal only in Second Data | After Phase 1 evidence |
| Ray Sandbox OARC | authenticated, wrong scope | Operator workspace is healthy but scoped to `staging-project`; `lib/runtime/local-operator.ts` exposes only that seeded scope | Obtain/configure the real Three AI Musketeers tenant/bank/project identity |
| Ray Memory app | local memory page green; project sharing not ready | Memory UI is healthy; authenticated operator session is healthy for `staging-project`; no Three AI Musketeers scope round trip exists | Establish authenticated project-scoped share round trip |

## Evidence limits

- Ten focused automated tests pass. `npm run status` returns explicit empty state; provider HTTP behavior is fake-provider verified only; local runtime health was HTTP verified on port 8091; no external provider, browser workflow, benchmark, deployment, or production verification exists yet.
- `http://127.0.0.1:3028/` is evidence of a reachable Ray Sandbox OARC page only.
- Ray Memory health is not the same as project sharing readiness.
- The local Phase 0 -> Phase 1 Big Slice is implemented and committed as `c077e65 feat: bootstrap phase 1 context governor`.
- Ray project-scoped sharing remains the only unresolved Phase 1 gate; the Ray worktree is dirty with unrelated changes and was not modified.
