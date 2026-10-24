# Three AI Musketeers — Canonical Core Roadmap Blueprint

This is the only planning and blueprint document. Add all future phases, implementation plans, architecture decisions, acceptance gates, and sequencing here. Do not create a second plan file.

## Phase 0 — Foundation (current)

Create repository/runtime conventions, contracts, evidence labels, and Ray integration boundary. Exit only when the contracts and verification commands are written.

## Phase 1 — Core Triad

Implement the gateway adapter, authoritative normalized usage records, deterministic log distiller with raw retention, versioned task capsules, and a small context ledger/status surface. Test success, missing usage, streaming completion, oversized logs, and capsule round-trip.

## Phase 2 — Surgical enforcement (implemented locally, 24 Oct 2026)

Add safe budget gates, path-safe bounded retrieval, MCP inventory profiles, and a Governor MCP server. The local slice is implemented and tested; symbol-graph retrieval remains a later extension if file-level retrieval is insufficient. Tests cover path safety, profile denial, budget rejection, bounded output, and HTTP profile listing.

## Phase 3 — Optimization (foundation implemented locally, 24 Oct 2026)

The local foundation adds turn-by-turn category diffs, ledger-linked provenance, stale telemetry checks, conservative telemetry-backed decision checks, routing safety/no-downgrade behavior, explainable decisions, a read-only inspection endpoint, and a small benchmark. Automatic live routing remains disabled until broader measured data supports it.

## Phase 4 — Production hardening

Only after local evidence: Tree-sitter WASM where needed, authenticated tenant-scoped storage, IDE integration, feedback capture, migration/restore tests, deployment, and operational controls.

## Operating contract

One slice, one evidence note, one rollback/recovery story where data changes. Preserve source and raw telemetry. No external deployment, credential use, or connector activation without explicit authorization.

## Big Slice rule

Each implementation phase is executed as one coherent Big Slice: contracts, implementation, callers, tests, fixtures, and direct verification move together. Do not create a chain of small disconnected implementation tasks or duplicate planning files.

## Phase 5 — React spatial control-plane UI (approved design, implementation pending)

### Goal

Add an operator-facing React dashboard over the existing authenticated API. The dashboard makes hosted telemetry, evidence freshness, usage provenance, and observe-mode routing decisions visible without enabling automatic route enforcement.

### Scope

- React and TypeScript frontend with Vite.
- Tailwind visual system with restrained obsidian/aurora styling.
- TanStack Query for server state and Zustand for UI state.
- Overview, operations, evidence ledger, and routing observatory views.
- Three.js/React Three Fiber Context Sphere with a 2D fallback when WebGL is unavailable.
- Command palette, accessible keyboard navigation, and Sentry error boundaries.
- In-memory operator authentication; no gateway token in bundles or persistent browser storage.

### Explicit non-goals

- No `ROUTING_ENFORCE_ENABLED=true` control in the first release.
- No full production rollout.
- No provider credential management in the browser.
- No browser chat product.
- No production-readiness claim from synthetic or local data.

### Required data contract

The UI consumes authenticated `/ready`, `/metrics`, `/optimization/inspect`, and evidence/usage data exposed by the gateway. It must distinguish empty, unavailable, unauthorized, failed, and stale states, preserve provider-reported usage and provenance, redact secrets and prompt content, and show why an observe-mode route was or was not selected.

### Ordered implementation plan

1. Add the frontend shell, build entrypoint, authenticated in-memory API client, and a failing smoke test for `/` plus unauthorized handling.
2. Add Overview and Operations views backed by real API responses; test loading, unavailable, unauthorized, and stale states.
3. Add Evidence Ledger and Usage views; test provider/model/time/latency/usage provenance and raw-evidence links without exposing secrets.
4. Add Routing Observatory; test candidate routes, applied-route null in observe mode, and stale telemetry, missing usage, budget overflow, incompatible route, and no-downgrade explanations.
5. Add Context Sphere and 2D fallback; test the fallback when WebGL is unavailable and preserve accessible text summaries.
6. Add command palette, keyboard/accessibility checks, Sentry boundaries, and performance safeguards.
7. Run local tests and browser verification, then validate the dashboard against hosted observe telemetry with a real provider.

### Evidence gates

The UI milestone is not complete until authenticated hosted requests succeed, usage is recorded, the evidence ledger updates, observe telemetry is visible, and routing decisions are auditable. Rollback verification and hosted alert verification remain mandatory before any controlled canary. Enforcement stays disabled by design.

## Phase 6 — Local orchestration, measurement, and automation boundary (implemented locally, 24 Oct 2026)

The local runtime now exposes a deterministic worker mesh with real testing, memory, bounded-tools, and Ollama-backed research adapters; capability matching; cheapest-fitting token estimates; fail-closed delegation budgets; durable running/terminal lifecycle and delegation evidence; parallel local execution; and baseline-vs-delegated usage measurement. A reusable automation module provides interval jobs and authenticated webhook dispatch. This proves local/provider-backed execution, but the first live token comparison was negative; it does not prove distributed orchestration, hosted cron, webhook delivery, or production operation.

Acceptance gates for the next slice are a positive token-savings benchmark after structured-schema redesign, sustained concurrent-load checks, and direct hosted scheduler/production verification; local retry/signature and parallel delegation checks now pass.
