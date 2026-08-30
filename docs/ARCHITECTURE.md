# Architecture — Pagermind service layer

## System shape

```
Browser (React UI)
   │  call(method, path, body, session)      ← transport-agnostic facade
   ▼
src/backend/api.ts        request ids · latency · chaos injection · route table
   ▼
src/backend/services.ts   authz · gates · audit · triage · observability   (domain logic)
   ▼
src/backend/db.ts         versioned schema · migrations · tx() critical section
   ▼
localStorage (memory fallback under vitest / private browsing)
```

The agent itself (`src/engine/agent.ts`) is a pure, deterministic function invoked by the
`triage.propose` service — the transport never mutates it.

## API contract (api/v1)

| Method | Endpoint | Auth | Purpose | Errors |
| --- | --- | --- | --- | --- |
| GET | `/v1/health` | public | status, storage mode, schema version, uptime, counters | — |
| GET | `/v1/logs` | public | structured log tail with request ids | — |
| GET | `/v1/gates` | public | list approval-gate proposals (seeds from agent on first read) | 503 under chaos |
| POST | `/v1/gates/:id/decisions` | session | approve/reject a page; body `{decision, reason}` | 401, 403, 404, 409, 422, 503 |
| GET | `/v1/audit` | public | append-only ledger, newest first | 503 under chaos |
| POST | `/v1/sessions` | public | start session; body `{reviewerId}` | 404, 422 |
| GET | `/v1/sessions/:id` | session id | rehydrate after refresh | 401 |
| DELETE | `/v1/sessions/:id` | session id | end session | 404 |
| GET | `/v1/triage/:caseId` | public | run the deterministic agent for one incident | 404 |

Every response is enveloped as `{ requestId, latencyMs, data }`; every failure as
`ApiError { status, code, message, requestId, issues? }` — no stack traces cross the boundary.

## Data model (schema v1, single JSON document)

```
{
  v: 1,
  createdAt, migratedFrom?,
  sessions: [{ id, reviewerId, name, role, createdAt }]   // capped at 25, oldest evicted
  gates:    [{ id, caseId, severity, team, runbookId, confidence, evidence[],
               status: pending|approved|rejected, decision, decidedBy, decidedAt, reason }]
  audit:    [{ seq, id, at, actor, action, target, outcome: ok|denied|error, detail, requestId }]
  meta:     {}
}
```

- Single-document writes make every mutation atomic for readers.
- `audit.seq` is monotonic; entries are never mutated or deleted (append-only by construction).
- Migration registry keyed by source version; unknown/future versions fail closed and reseed.

## Decision log

**D1 — In-browser service layer instead of a Node process.**
Context: the hackathon artifact is a static build (`vite build → dist/index.html`).
Options: (a) real server (breaks the single-artifact reproducibility rule), (b) no backend
(loses the whole authz/audit story), (c) service layer behind a transport-agnostic facade.
Chosen: (c). Reason: keeps the demo one-command reproducible while the contract, validation,
authorization and audit semantics are real and testable; extraction to Fastify is mechanical.
Trade-off: no real multi-client concurrency — documented limitation.

**D2 — Single-document versioned store.** Context: persistence needed for gates/audit across
refresh, with zero infra. Chosen: one JSON blob under a schema-versioned key with a migration
registry. Reason: atomic reads, honest migration pattern, works in vitest via memory fallback.
Trade-off: not for concurrent writers; fine at sandbox scale.

**D3 — Sandbox auth, real authorization.** Context: no password infrastructure is appropriate
for a public demo. Chosen: asserted reviewer identity, session tokens, role checks enforced in
the service (never in the UI), denials audited. Reason: demonstrates `authenticated ≠ authorized`
without pretending to be an IdP. Trade-off: identity assertion is trust-based — the swap point
for a real IdP is explicitly documented.

**D4 — Deterministic agent, non-deterministic transport.** The engine is a pure function
(identical traces everywhere — the reproducibility requirement); only network latency and
request ids vary. The removed LLM free-text experiment (changelog) is the counter-evidence
that motivated this.

## Security review checklist (performed)

- [x] Input validated at the boundary (`validateDecision`, `reviewerId`) — client validation is UX only
- [x] Authorization on every mutating operation; denials audited
- [x] Idempotency: decided gates are immutable (409)
- [x] No secrets, tokens or stack traces in repo, logs or error responses
- [x] XSS: React default escaping; user reasons render as text, never HTML
- [x] Audit export uses `URL.createObjectURL` with prompt revocation
- [x] Corrupted storage payload fails closed (reseed) instead of crashing

## Observability contract

`/v1/health` answers "is it up and is it honest": status, storage mode (`localStorage` vs
`memory` fallback — degraded environments must be visible), schema version, uptime, request /
error / decision counters, average latency, last error. Logs carry request ids end-to-end so a
UI failure toast can be correlated with service lines.

## Deployment

Static build only: `npm run build`, serve `dist/`. No migrations to run at deploy (storage
migrations run lazily on first read). Rollback = serve the previous `dist/`. Backup/recovery:
the audit export is the backup story at sandbox scale.
