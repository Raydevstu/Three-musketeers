# Ray Sandbox OARC Integration Readiness

**Checked:** 2026-10-23

## Direct checks

- `GET http://127.0.0.1:3028/` returned HTTP 200.
- Returned HTML included `Ray Sandbox OARC`, `Hindsight`, and `Agent Memory`.
- `GET /health`, `/healthz`, `/ready`, `/api/health`, and `/api/project-memory` returned 404.
- `GET /api/project-dashboard` returned HTTP 400, indicating a route exists but requires missing request context/parameters.

## Result

**Ray Sandbox OARC is reachable, but not verified ready or wired for Three AI Musketeers.** The current evidence proves page identity and a partial API surface only. There is no verified project identifier, authentication contract, ingestion route, read-back route, or end-to-end event round trip for this project.

The Memory UI itself is green for local development: it reports `Memory healthy`, 21 durable memories, and a healthy development runtime. The Integrations page reports `Runtime metadata unavailable`, and the share/MCP surface is not green: `/api/mcp` returns `MCP authentication failed`.

## Required wiring proof

1. Define the project identity and Ray API contract.
2. Send one scoped, non-sensitive test event.
3. Read it back through the intended project route.
4. Verify provenance, scope, and failure behavior.
5. Record the exact request/response evidence without secrets.
