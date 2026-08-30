# ADR-001: In-browser service layer behind a REST-shaped facade

## Status
Accepted

## Date
2026-02-15

## Context
The hackathon artifact must be reproducible from a clean environment by a
judge with one command. A separate Node server would break the single-static-
artifact model, but the submission needs real validation, authorization,
idempotency, audit and observability semantics to be credible.

## Options considered

### Option 1 — Real server process (Fastify/Express)
Authentic transport; but deployment becomes two artifacts, needs a runtime
port, and complicates the "serve `dist/`" reproduction path.

### Option 2 — No service layer (UI calls engine directly)
Simplest; but authorization/audit/idempotency semantics would live in
components — untestable and unconvincing for the engineering rubric.

### Option 3 — In-browser service layer behind a transport-agnostic facade
`call(method, path, body, session)` maps 1:1 onto a documented REST table;
domain logic, authz and audit live in `src/backend/services.ts`; extraction
to a server later is mechanical.

## Decision
Option 3.

## Reason
Keeps the demo one-command reproducible while the security/audit semantics
are real, service-side and unit-testable. The API contract is documented in
`docs/ARCHITECTURE.md`.

## Consequences
- Easier: single artifact, zero-infra demo, deterministic tests.
- Harder: no true multi-client concurrency; must keep pretending latency
  honestly (documented as simulation).

## Alternatives rejected
Option 1 broke reproducibility; option 2 broke the engineering story.
