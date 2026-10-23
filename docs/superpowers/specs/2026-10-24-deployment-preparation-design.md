# Deployment Preparation Design

## Intent

Prepare the existing Node/Docker/PostgreSQL application for a later GitHub Actions → container registry → Render + Neon deployment, without connecting accounts or deploying.

## Goals

- Verify tests and Docker build in GitHub Actions.
- Define Render’s service settings without embedding secrets.
- Document the manual Neon schema step and required environment variables.
- Preserve the current Docker Compose workflow and existing working-tree changes.

## Non-goals

- No GitHub remote creation, push, login, deployment, or hosted database creation.
- No application behavior changes.
- No real provider credentials.

## Approach

Use the existing `npm test`, `Dockerfile`, `docker-compose.yml`, and `db/migrations/001_context_governor.sql`. Add only provider-neutral workflow/configuration/documentation files. Render should build the repository Dockerfile directly; Neon should receive the existing SQL migration manually before the service starts.

## Safety

Secrets remain platform settings, `.env.example` remains placeholder-only, and the workflow must not print secret values.
