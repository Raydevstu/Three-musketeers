# Ray Sandbox OARC Integration Readiness

**Checked:** 2026-10-23 (scope and round-trip audit)

## Direct checks

- `GET http://127.0.0.1:3028/` returned HTTP 200.
- Returned HTML included `Ray Sandbox OARC`, `Hindsight`, and `Agent Memory`.
- `GET /health`, `/healthz`, `/ready`, `/api/health`, and `/api/project-memory` returned 404.
- `GET /api/project-dashboard` returned HTTP 400, indicating a route exists but requires missing request context/parameters.
- The authenticated operator workspace reports project scope `staging-project`.
- The Ray scope registry is `lib/runtime/local-operator.ts`; it currently exposes only the seeded `staging -> staging-project` scope.
- No Three AI Musketeers tenant, bank, or project identifier is configured in the Ray local environment.
- The new `/api/project-memory/onboarding` flow successfully returns an authenticated scope when one exists and returns explicit `unconfigured` when it does not; it does not provision an external Ray project.
- Current-checkout verification on isolated port `3031` succeeded for the onboarding flow, but the authenticated result still returned `staging-tenant / staging-bank / staging-project`; the local operator registry is hard-coded to that scope and does not consume the non-staging audit values present in `.env.local`.
- The operator registry now consumes a complete configured audit scope as a server-approved `configured` scope, while retaining staging fallback when the values are absent.
- The retain and recall routes now validate `projectId` through the existing `readProjectScope` boundary.
- Migration `0012_fact_project_scope.sql` was applied to the configured PostgreSQL store.
- Live scoped verification succeeded: retain returned HTTP 201; recall returned HTTP 200 with `projectId=project-1`; a request for `other-project` returned HTTP 403.
- Ray validation passed: 365 tests passed, 6 skipped; typecheck passed; production build passed with three existing unused-ESLint-disable warnings.

## Result

**Ray Sandbox OARC is reachable, authenticated, and project-scoped for this local runtime.** The configured scope is `tenant-local / oarc-bank / project-1`; onboarding and the authenticated project-memory boundary now use it. A local development-principal write/read round trip and cross-project denial were verified. This is local/runtime evidence, not production deployment evidence.

The Memory UI itself is green for local development: it reports `Memory healthy` and healthy durable memory. The operator workspace is authenticated and healthy for `staging-project`; that is not evidence for the Three AI Musketeers scope. The Integrations page reports `Runtime metadata unavailable`, and the share/MCP surface remains unverified for this project.

## Required wiring proof

1. Preserve the configured scope values in the deployment environment without exposing secrets.
2. Send one scoped, non-sensitive test event.
3. Read it back through the intended project route.
4. Verify provenance, scope, and failure behavior.
5. Record the exact request/response evidence without secrets.
