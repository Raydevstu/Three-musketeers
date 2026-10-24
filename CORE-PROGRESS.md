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
| Context optimization | observe mode locally verified (24 Oct 2026) | Gateway-produced authoritative usage was reused by `/optimization/inspect`; route candidate was explained and `applied_route` remained null; `enforce` is disabled by design behind `ROUTING_ENFORCE_ENABLED`; 41 tests pass | Validate hosted observe telemetry with a real provider |
| Docker staging harness | implemented locally (24 Oct 2026) | App, PostgreSQL, and mock-provider Compose services build and run; `/ready` executes `SELECT 1` when PostgreSQL is configured and returns 503 on failure; 34 tests pass | Deploy this readiness change and verify hosted database behavior |
| Staging verification | local Docker verified (24 Oct 2026) | Rebuilt current image; PostgreSQL-backed readiness returned 200 with `database: ready`, unauthorized readiness returned 401, authenticated `/v1/chat` returned 200 through the mock provider, traversal returned 403, 50/50 health probes returned 200, and backup/restore plus app restart passed | Add sustained load/security, hosted two-version rollback, and hosted staging checks |
| Operations | local implementation verified (24 Oct 2026) | Structured JSON request logs, protected `/metrics`, and checked-in Prometheus rules cover readiness, 5xx, provider failure, auth denial, and latency; repeatable staging smoke passed; 41 tests pass | Install hosted alerts and backup integration |
| Ray Sandbox OARC | project-scoped local runtime verified | Configured audit identity is exposed as the server-approved `configured` scope; onboarding returns `tenant-local / oarc-bank / project-1`; retain 201, recall 200, other-project recall 403; migration 0012 applied | Preserve configuration in deployment and separately verify production |
| Ray Memory app | local project sharing verified | Authenticated onboarding and project-memory routes use the configured scope; Ray full suite 365 passed, 6 skipped; typecheck and build passed | Browser and production verification remain separate evidence gates |
| React spatial control-plane UI | implemented locally (24 Oct 2026) | Vite production build passes; authenticated API client, public UI shell, protected telemetry boundary, overview cards, observe-only routing panel, command palette, and WebGL/2D context visualization are present; full suite passes 44 tests | Hosted browser verification against real observe telemetry; add evidence-ledger and routing decision payload views as hosted data becomes available |
| Prompt reengineering/compiler | manual verified locally (24 Oct 2026) | User ran the authenticated UI flow; Ollama `llama3.2:3b` compilation succeeded with structured output and provider token counts; authenticated `/prompt/compile` and mock-provider tests pass | Verify hosted provider configuration separately |
| Dynamic skill/tool injection | manual verified locally (24 Oct 2026) | User ran Prepare + skills in the UI; deterministic keyword registry, auditable injection reasons, authenticated `/prompt/prepare`, and mock end-to-end route tests pass | Dynamic versioned metadata and arbitrary tool execution remain future scope |
| Worker mesh and token-optimized delegation | manual verified locally (24 Oct 2026) | User ran worker and parallel controls in the UI; testing, memory, bounded-tools, and Ollama-backed research adapters; durable lifecycle/delegation evidence; authoritative measurement; 75 tests pass | Positive savings are not proven: first live comparison measured 150 baseline vs 261 delegated tokens (-111 savings) |
| Automation daemon/webhook boundary | locally tested (24 Oct 2026) | Interval runner now retries transient delegation failures; webhook server enforces bounded bodies and HMAC signatures; retry/signature tests pass | Wire authorized jobs to deployment scheduler and verify hosted delivery |
| CLI operation | manually verified locally (24 Oct 2026) | `status`, `read-capsule`, `workers`, authenticated `delegate`, `automation-list`, and `automation-run` commands are implemented; existing commands remain local | Run the new commands against the live app and add provider-specific operational flags if needed |
| Universal task runtime and safe tools | implemented and manually smoke-tested locally (24 Oct 2026) | `src/task-runtime.mjs` provides queued/planning/running/paused/completed/failed transitions, bounded `read_file`, `repo_status`, and `run_tests` tools, durable `task_run` evidence, and authenticated `/tasks/run`; live repository inspection completed successfully; 78 tests pass | Connect prompt planning and worker selection to task steps; browser/desktop tools remain separate adapters |
| Browser connector bridge | live locally verified (24 Oct 2026) | `src/connector-bridge.mjs` owns a bsk session, requires bridge authentication and per-action approval, maps navigate/click/fill/observe/screenshot to the real CLI, and the running app completed an approved navigate → observe → screenshot task through `CONNECTOR_BRIDGE_URL`; task and tool-action evidence are recorded; 88 tests pass | Add desktop bridge and browser action replay/approval UI; hosted connector remains unverified |

## Delivery status

- Deployment Status: COMPLETE
- Staging Status: COMPLETE
- Core Governor Implementation: COMPLETE
- Routing Enforcement: DISABLED BY DESIGN
- Production Readiness: NOT YET VERIFIED
- Next Milestone: Connect the task runtime to automatic planning and worker selection

## Evidence limits

Hosted Observe Telemetry Validation success criteria: real provider configured, authenticated requests accepted, usage data recorded, evidence ledger updated, observe telemetry visible, and routing decisions auditable. Automatic enforcement remains disabled by design. Rollback verification, observe telemetry review, and alert verification remain mandatory before any controlled canary or production rollout.

Hosted base URL verified: `https://three-musketeers-qdel.onrender.com/health` returned HTTP 200 after cold-start retry; unauthenticated `/ready` and `/metrics` returned HTTP 401. Authenticated observe telemetry is still unverified because no hosted token/provider credential is available in this workspace.

- Oversized `/v1/chat` requests now return explicit HTTP 413; full suite passes 40 tests.
- Hosted Render verification: `/ready` returned 200 with database ready, `/health` returned 200, and unauthenticated `/metrics` was refused by authentication.
- Hosted authentication is now configured and verified: authenticated `/metrics` returned HTTP 200 with Prometheus counters, while prior denied attempts were reflected in `governor_auth_denied_total`.

- `npm test` passes 41 tests. `npm run status` returns explicit empty state; provider HTTP behavior is mock-provider verified only; local Docker health/readiness and MCP checks are HTTP verified; hosted health/readiness/authenticated metrics are verified; real provider and production enforcement remain unverified.
- `http://127.0.0.1:3028/` is evidence of a reachable Ray Sandbox OARC page only.
- Ray Memory health is not the same as project sharing readiness.
- Local rollback-style image check found both prior and candidate images start; the prior image requires authenticated `/health`, while the candidate exposes public liveness. This is local image evidence, not proof of a deployed rollback.
- Alert configuration is documented against protected metrics and structured logs; hosted notification delivery remains unverified.
- Repeatable `scripts/staging-smoke.ps1` passed against rebuilt Docker staging: 50/50 health, readiness auth checks, traversal denial, and all operational metric names present.
- `ops/prometheus-alerts.yml` defines application alert expressions; backup alert delivery remains an external job/platform responsibility.
- Routing safety matrix is covered by focused tests for stale telemetry, missing usage, budget overflow, incompatible routes, and required-context/no-downgrade refusal; no route is applied in observe mode.
- React spatial control-plane UI is locally built and served at `/`; the UI keeps the operator token in memory, never enables enforcement, and does not claim hosted telemetry until that evidence exists.
- Prompt compiler and dynamic skill injection now have provider-backed local evidence. Ollama `llama3.2:3b` compilation and research succeeded with provider token counts.
- Orchestration is locally implemented and tested: testing runs `npm test`, memory searches ledger evidence, tools allow only bounded file reads, and research calls the structured compiler adapter. This is not yet distributed or hosted multi-agent execution.
- Token measurement reports baseline tokens, delegated tokens, savings, duration, and delegated status when both sides provide authoritative usage. The first real Ollama comparison was negative (150 baseline, 261 delegated), so optimization is measured but not yet effective.
- Automation is local interval/webhook code with retry and HMAC tests; hosted cron and delivery remain unverified.
- Four audit fixes plus the local Big Slice are implemented: real worker mesh, lifecycle/delegation evidence, measurement, UI path containment, bounded JSON bodies, and concurrent delegation; 61 tests pass. Local Docker health/readiness and hosted liveness were checked; hosted production and positive token-savings evidence remain pending.
- The local Phase 0 -> Phase 1 Big Slice is implemented and committed as `c077e65 feat: bootstrap phase 1 context governor`.
- Phase 2 safe surgical retrieval and enforcement is locally implemented; `npm test` passes 15 tests. This is local code/test evidence only, not browser, benchmark, deployment, or production evidence.
- Phase 3 optimization foundation is locally implemented; `npm test` passes 20 tests. Automatic live routing remains disabled pending broader authoritative telemetry.
- Ray project-scoped sharing is verified in the local current checkout; the Ray worktree remains dirty with user changes, including the uncommitted integration edits used for this verification.
