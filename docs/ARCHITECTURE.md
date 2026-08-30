# Architecture — Pagermind

## System shape

```
Browser (React UI — console & report modes)
   │  call(method, path, body, session)          ← transport-agnostic facade
   ▼
src/backend/backend.ts  api/v1: request ids · validation · latency · chaos · route table
   │                    authz · gates · audit · triage · sessions · observability
   ▼
src/engine/engine.ts    deterministic pipeline: parse(+sanitize) → tools → rules → critic → gate
   │
   ▼
src/engine/adapters.ts  THE SEAM: catalog · metrics · calendar · memory · runbook · identity · transport
   │                    (sandbox implementations today; real integrations per ROADMAP.md)
   ▼
src/data/cases.ts       12 scored incidents · 6 red-team poisons · correlated storm · roster
   ▼
localStorage            versioned single document · migration registry · memory fallback (vitest)
```

The engine is a pure function of (case, adapters). Only network latency and
request ids are nondeterministic.

## API contract (api/v1)

| Method | Endpoint | Auth | Purpose | Errors |
| --- | --- | --- | --- | --- |
| GET | `/v1/health` | public | status, storage mode, schema, uptime, counters | — |
| GET | `/v1/logs` | public | structured log tail with request ids | — |
| GET | `/v1/gates` | public | approval-gate queue (seeded from agent on first read) | 503 chaos |
| POST | `/v1/gates/:id/decisions` | session | approve/reject; `{decision, reason}` | 401 403 404 409 422 503 |
| GET | `/v1/audit` | public | append-only ledger, newest first | 503 chaos |
| POST | `/v1/sessions` | public | start session; `{reviewerId}` | 404 422 |
| GET | `/v1/sessions/:id` | session id | rehydrate after refresh | 401 |
| DELETE | `/v1/sessions/:id` | session id | end session | 404 |
| GET | `/v1/triage/:caseId` | public | run the deterministic agent for one incident | 404 |

Responses: `{ requestId, latencyMs, data }`. Failures: `ApiError { status,
code, message, requestId, issues? }` — no stack traces cross the boundary.

## Data model (schema v1, single JSON document)

```
{
  v: 1,
  sessions: [{ id, reviewerId, name, role, createdAt }]       // capped 25
  gates:    [{ id, caseId, uid?, severity, team, runbookId, confidence, evidence[],
               status: pending|approved|rejected, decision, decidedBy, decidedAt, reason }]
  audit:    [{ seq, id, at, actor, action, target, outcome: ok|denied|error, detail, requestId }]
  meta:     { currentSessionId?, gateSeq?, migratedFrom? }
}
```

- Single-document writes ⇒ every mutation atomic for readers.
- `audit.seq` monotonic; entries never mutated or deleted.
- Migration registry keyed by source version; unknown versions fail closed and reseed.

## Decision log

**D1 — In-browser service layer.** The artifact is a static build; a real
server would break one-command reproducibility. The facade keeps the REST
contract, validation, authz and audit semantics real and testable; extraction
to Node/Fastify is mechanical. Trade-off: no multi-client concurrency (documented).

**D2 — Single-document versioned store.** Atomic reads, a genuine migration
pattern, zero infra, vitest-friendly via memory fallback. Trade-off: not for
concurrent writers — fine at sandbox scale.

**D3 — Sandbox auth, real authorization.** No fake passwords (that would be
theater and a rules violation). Asserted identity + sessions + service-side
role checks; denials audited. The IdP swap point is `sandboxIdentity` in
`adapters.ts`.

**D4 — Deterministic agent; LLM severity call rejected.** Five identical
runs of the LLM call: ±18 rubric points, one false mass-page, no citable
rule. The deterministic pipeline scores higher and can defend itself. The
architecture keeps LLM-shaped seams (tools, traces, checkpoints) so a model
can be added for eloquence without losing auditability for verdicts.

**D5 — Adapter boundary.** The engine never reads a case field on the
decision path; everything flows through `adapters.ts`. This makes the
ROADMAP claim true in code: production is an adapter swap, not an engine
rewrite. It also hardens the injection story — adapters return data, never
instructions.

## Security review checklist (performed)

- [x] Input validated at the boundary (`validateDecision`, `reviewerId`) — client validation is UX only
- [x] Authorization on every mutating operation; denials audited
- [x] Idempotency: decided gates immutable (409)
- [x] No secrets, tokens or stack traces in repo, logs or error responses
- [x] XSS: React escaping; user reasons render as text, never HTML
- [x] Object URLs revoked after export
- [x] Corrupted storage fails closed (reseed)
- [x] Prompt injection: no prose-to-action channel exists (demonstrated: red team 6/6 vs 0/6)

## Observability contract

`/v1/health` answers "is it up and is it honest": status (ok/degraded),
storage mode, schema version, uptime, request/error/decision counters,
average latency, last error. Logs carry request ids end-to-end so a UI
failure toast correlates with service lines. Chaos mode degrades mutating
calls to 503 while health/logs stay up — failure is a designed state.

## Deployment

Static build: `npm run build`, serve `dist/`. No deploy-time migrations
(storage migrates lazily on first read). Rollback = serve previous `dist/`.
Backup/recovery at sandbox scale = the audit export.
