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
