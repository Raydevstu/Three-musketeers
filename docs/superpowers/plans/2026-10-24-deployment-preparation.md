# Deployment Preparation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Prepare the existing application for GitHub Actions and Render + Neon without deploying or changing application behavior.

**Architecture:** GitHub Actions runs Node tests and validates the Docker image. Render builds the existing Dockerfile and supplies runtime environment variables. Neon receives the existing SQL migration separately.

**Tech Stack:** Node.js 20+, npm, Docker, GitHub Actions, Render Blueprint YAML, PostgreSQL.

**Spec:** `docs/superpowers/specs/2026-10-24-deployment-preparation-design.md`

## Global Constraints

- Do not add provider credentials or secret values.
- Preserve the existing Dockerfile, Compose workflow, and application behavior.
- Do not push, deploy, install packages, or commit.
- Keep deployment claims limited to local configuration readiness.

## Review Focus

- Workflow must fail when tests fail.
- Docker build must use the repository Dockerfile.
- Render must bind to its assigned `PORT` and expose no fixed public database port.
- Neon instructions must not print or commit a connection string.
- Existing dirty-worktree files must remain untouched.

### Task 1: CI validation

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] Run `npm ci` and `npm test` on Node 20 and 22.
- [ ] Build the existing `Dockerfile` without pushing an image.
- [ ] Verify YAML paths and commands by inspecting the workflow; no workflow execution is possible before a GitHub push.

### Task 2: Render service definition

**Files:**
- Create: `render.yaml`

- [ ] Define one Docker web service using the repository `Dockerfile`.
- [ ] Set health check path `/health`.
- [ ] Declare non-secret variables and mark database/token values as dashboard-managed secrets.
- [ ] Avoid a Render-managed PostgreSQL service; Neon is the database target.

### Task 3: Neon and deployment guide

**Files:**
- Create: `docs/deployment-free-staging.md`

- [ ] Explain how to create a Neon database and apply `db/migrations/001_context_governor.sql`.
- [ ] Explain which Render environment variables are required without including values.
- [ ] Explain authenticated health/readiness checks and the current `401` behavior without auth.
- [ ] Clearly label local verification versus hosted deployment evidence.

### Task 4: Verification

- [ ] Run `npm test`.
- [ ] Run `docker compose config` if Docker is available.
- [ ] Inspect `git diff --check` and `git status --short`.
- [ ] Confirm only the three planned files are newly added.
