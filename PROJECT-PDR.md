# Three AI Musketeers — Product / Project Definition Record

**Status:** groundwork only; no implementation repository or runtime code was found on 2026-10-23.

## Problem

AI coding sessions consume context in ways developers cannot reliably observe or control. Large logs, broad file reads, stale history, and hidden provider behavior make cost, quality, and handoff failures difficult to explain.

## Product

A provider-neutral Context Governor that measures authoritative usage, tags context blocks, applies safe budget gates, distills logs without losing raw evidence, stores durable task capsules, and exposes explainable context state.

## Initial users

Developers and platform/engineering leads who need reproducible AI-assisted work, bounded context, and auditable handoffs.

## MVP boundary

1. Normalized usage contract and gateway recording.
2. Deterministic log extraction with raw-log retention.
3. Versioned task capsules with human-readable rendering.
4. Read-only context ledger/status view.

Deferred until MVP evidence exists: symbol graphs, MCP profiles, model routing, Postgres multi-tenancy, IDE extension, feedback training, hosted deployment, and production connectors.

## Non-goals

- Replacing an IDE or chat client.
- Guessing hidden desktop-session tokens.
- Destructive compaction or file conversion.
- Claiming cost savings, model quality, or production readiness from synthetic fixtures.

## Acceptance gates

- Usage records preserve provider/model/time/latency and reported token fields.
- Context categories are tagged before aggregation.
- Raw logs remain recoverable from every distilled record.
- Capsules are schema-versioned and include intent, files, decisions, evidence, risks, and exact next boundary.
- Empty, unavailable, failed, unauthorized, and stale states are explicit.
- Ray integration is not marked ready until a project-scoped request and response are directly verified.
