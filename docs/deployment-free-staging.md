# Free staging deployment guide

This repository is locally prepared for a later GitHub Actions → Render + Neon staging deployment. This guide does not create accounts, store credentials, or deploy anything.

## Current local evidence

- `npm test`: 32 tests passed.
- Docker Compose starts the app, PostgreSQL, and mock provider locally.
- Public `GET /health` returns HTTP 200 for platform liveness probes.
- Authenticated `GET /ready` returns HTTP 200; unauthenticated readiness returns HTTP 401.
- Protected application requests return HTTP 401 when `GATEWAY_AUTH_TOKEN` is configured.

These checks are local evidence only. They do not prove a hosted deployment.

## GitHub Actions

`.github/workflows/ci.yml` runs `npm ci`, `npm test`, and a Docker build for pushes and pull requests. It does not publish an image or deploy.

## Neon setup

1. Create a Neon PostgreSQL project.
2. Copy the Neon connection string into a password manager; do not commit it or place it in `.env.example`.
3. Apply [`db/migrations/001_context_governor.sql`](../db/migrations/001_context_governor.sql) to the Neon database using the Neon SQL Editor or a local PostgreSQL client.
4. Confirm that the `evidence_events` table exists.

The current migration is designed for first initialization. Existing databases should be inspected before applying it.

## Render setup

1. Connect the GitHub repository to Render.
2. Select the repository blueprint, or create a Docker web service using the repository `Dockerfile`.
3. Render supplies the runtime `PORT`; the application listens on that port by default.
4. Add these environment variables in Render’s dashboard:

   - `DATABASE_URL`: the Neon connection string.
   - `GATEWAY_AUTH_TOKEN`: a newly generated staging token.
   - `PROVIDER_URL`: a reachable provider endpoint, if using an external provider.
   - `PROVIDER` and `MODEL`: the selected provider and model identifiers.
   - `EVIDENCE_LEDGER_PATH`: `/app/.data/evidence.jsonl` if the file fallback is needed.

5. Use `/health` as the Render health-check path.
6. After deployment, test `/health` without a token, then test `/ready` with the `Authorization: Bearer <token>` header.

The checked-in `render.yaml` intentionally marks connection strings and tokens as dashboard-managed secrets. Never paste their values into Git, workflow logs, screenshots, or chat.

## Not yet proven

- GitHub Actions execution on the remote repository.
- Render build and HTTPS behavior.
- Neon connectivity from Render.
- Hosted migration success.
- External provider connectivity.
- Backups, rollback, production availability, or production readiness.
