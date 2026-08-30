# ADR-002: Single-document, schema-versioned persistence

## Status
Accepted

## Date
2026-02-15

## Context
Gates, sessions and the audit ledger must survive refresh and be testable
without infra. The store must also demonstrate an honest migration story
(the framework's `/migration` skill) at sandbox scale.

## Options considered

### Option 1 — IndexedDB / per-entity keys
More "real", but granular writes are not atomic across entities and the
migration story gets diffuse.

### Option 2 — One JSON document under a versioned key (`db.ts`)
Every mutation is a read-modify-write in one critical section → atomic for
readers; one migration registry keyed by source version; memory fallback
under vitest/private browsing.

### Option 3 — No persistence
Gates would reset on refresh — breaks the human-approval UX and the audit
story.

## Decision
Option 2, schema v1, lazy migration on first read, `db.reset()` for tests only.

## Reason
Atomicity, a genuine migration pattern, and zero infrastructure — the right
size for a sandbox. Corrupted payloads fail closed (reseed) instead of
crashing.

## Consequences
- Easier: atomic reads, trivially inspectable state, testable.
- Harder: not suitable for concurrent writers (documented limitation).

## Alternatives rejected
Option 1 added complexity without a matching requirement; option 3 broke the
approval/audit UX.
