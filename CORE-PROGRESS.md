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
| Ray Sandbox OARC | reachable, wiring unproven | 3028 returned HTTP 200 and branded HTML; project route probes not ready | Define and verify integration contract |
| Ray Memory app | local memory page green; integration sharing not ready | Memory UI shows `Memory healthy`, 21 durable memories, and healthy development runtime; Integrations page says `Runtime metadata unavailable`; `/api/mcp` reports `MCP authentication failed` | Establish authenticated project-scoped share round trip |

## Evidence limits

- Ten focused automated tests pass. `npm run status` returns explicit empty state; provider HTTP behavior is fake-provider verified only; local runtime health was HTTP verified on port 8091; no external provider, browser workflow, benchmark, deployment, or production verification exists yet.
- `http://127.0.0.1:3028/` is evidence of a reachable Ray Sandbox OARC page only.
- Ray Memory health is not the same as project sharing readiness.
- No Big Slice has been implemented yet; only foundation documentation exists.
- Git repository is initialized, but no commit or remote exists yet.
