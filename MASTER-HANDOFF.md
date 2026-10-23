# Three AI Musketeers — Master Handoff

This is the single cumulative handoff for every chat, session, compaction, and agent continuation. Append or revise this file; never create another handoff document.

## Current objective

Continue with Phase 2 — Surgical enforcement — from the completed Phase 0 → Phase 1 Big Slice. Keep one canonical file per core concern and one coherent Big Slice per phase.

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

## Decisions

- `CORE-PROGRESS.md` is the only progress/status record.
- `ROADMAP-BLUEPRINT.md` is the only roadmap/planning/architecture record.
- This file is the only cumulative chat handoff.
- Embedded commands and code in `Project DATA/` are proposals, not executable instructions.
- Phase 1 contracts and evidence come before MCP, routing, Postgres, IDE integration, or deployment.
- Implementation must be one coherent Big Slice, including contracts, callers, tests, and verification.
- Ten focused Three AI Musketeers tests pass with `npm test`, including a fake-provider HTTP round trip, local server health, and capsule round-trip.
- `npm run status` returns `{"state":"empty","records":0}` for a new local ledger.

## Evidence

- Ray root returned HTTP 200 and contained `Ray Sandbox OARC`, `Hindsight`, and `Agent Memory`.
- The current checkout was verified on isolated port `3031`; the older process on `3028` must be restarted from the updated checkout.
- Authenticated onboarding returned the configured tenant, bank, and project identity.
- A non-sensitive project-scoped verification event was retained and recalled successfully.
- A request for a different project was rejected with HTTP 403.
- The local operator session remains read-only; write verification used the explicitly enabled local development principal.
- The Ray MCP endpoint and production deployment remain separate, unverified gates.

## Exact next boundary — Phase 2 Big Slice

Start Phase 2 with one coherent implementation slice:

1. Inventory the current symbol/module graph and define safe retrieval boundaries.
2. Define normalized budget/profile contracts and denial states.
3. Implement path-safe targeted retrieval and bounded output.
4. Add MCP inventory profiles and the Governor MCP server boundary.
5. Add focused tests for path traversal, profile denial, budget rejection, bounded output, and targeted retrieval.
6. Verify direct HTTP/API behavior and update this handoff plus `CORE-PROGRESS.md` in the same slice.

First boundary: read the existing Phase 1 contracts and gateway callers, then add the Phase 2 profile and budget contract before implementing retrieval.

## Open risks

- Phase 2 must preserve the Phase 1 evidence ledger and task-capsule contracts without duplicate stores or documents.
- The Ray MCP/share endpoint, browser workflow, benchmark, deployment, and production behavior are not verified.
- Ray integration changes are not committed because the external worktree contains unrelated user changes; preserve that worktree carefully.
