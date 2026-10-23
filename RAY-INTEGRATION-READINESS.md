# Ray Sandbox OARC Integration Readiness

**Checked:** 2026-10-23 (scope audit)

## Direct checks

- `GET http://127.0.0.1:3028/` returned HTTP 200.
- Returned HTML included `Ray Sandbox OARC`, `Hindsight`, and `Agent Memory`.
- `GET /health`, `/healthz`, `/ready`, `/api/health`, and `/api/project-memory` returned 404.
- `GET /api/project-dashboard` returned HTTP 400, indicating a route exists but requires missing request context/parameters.
- The authenticated operator workspace reports project scope `staging-project`.
- The Ray scope registry is `lib/runtime/local-operator.ts`; it currently exposes only the seeded `staging -> staging-project` scope.
- No Three AI Musketeers tenant, bank, or project identifier is configured in the Ray local environment.
- The new `/api/project-memory/onboarding` flow successfully returns an authenticated scope when one exists and returns explicit `unconfigured` when it does not; it does not provision an external Ray project.

## Result

**Ray Sandbox OARC is reachable and authentication works, but it is not wired for Three AI Musketeers.** The authenticated session is scoped to `staging-project`; onboarding can bind that existing scope but cannot provision the missing project. No project-specific ingestion/read-back round trip has been verified.

The Memory UI itself is green for local development: it reports `Memory healthy` and healthy durable memory. The operator workspace is authenticated and healthy for `staging-project`; that is not evidence for the Three AI Musketeers scope. The Integrations page reports `Runtime metadata unavailable`, and the share/MCP surface remains unverified for this project.

## Required wiring proof

1. Define the project identity and Ray API contract.
2. Send one scoped, non-sensitive test event.
3. Read it back through the intended project route.
4. Verify provenance, scope, and failure behavior.
5. Record the exact request/response evidence without secrets.
