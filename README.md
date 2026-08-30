# Pagermind — auditable incident triage, baseline vs agent (hackathon entry AW-2201)

Submitted to the **micro1 Agentic Workflows Hackathon**. All incident data is synthetic; every
evaluation number is computed by the code in this repo at runtime — nothing is hardcoded in the UI.

## Who has the problem

On-call engineers paging each other with half the context. The bottleneck is not the alerting
system; it is that **severity lives outside the alert text** — in service tier, blast radius,
revenue impact, deploy state and the change calendar. Keyword triage therefore both over-pages
(wakes people for drills) and under-pages (misses silent corruption).

## What this repo contains

| Area | Path | Notes |
| --- | --- | --- |
| Evaluation set | `src/data/incidents.ts` | 12 synthetic incidents, gold answers fixed before the agent rules existed |
| **Baseline** | `src/engine/baseline.ts` | the "script people use today": regex severity + substring team table |
| **Agent** | `src/engine/agent.ts` | tools (catalog/metrics/history/runbook/calendar) → rule reasoner → verifier → human gate; fully deterministic, evidence-chained |
| Shared rubric | `src/engine/eval.ts` | identical scoring applied to both arms, plus `ablation()` for design-choice attribution |
| Evidence | `src/components/Evidence.tsx` | attribution ladder (baseline → tools → critic → memory) + in-browser acceptance audit |
| **Service layer** | `src/backend/` | api/v1 facade: validation, authz, idempotency, audit ledger, observability, chaos injection |
| Persistence | `src/backend/db.ts` | versioned schema + migration registry (localStorage, memory fallback in tests) |
| UI | `src/components/` | war room, live bench, eval board, approval desk, ops console, changelog |
| Tests | `src/__tests__/pipeline.test.ts` | engine determinism, rubric aggregates, gate state machine |

## Quick start

```bash
npm install
npm run dev        # local dev server
npm run build      # production static build (dist/)
npx vitest run     # test suite: engine + evaluation + attribution ablation + gate state machine
```

No API keys, no network calls, no environment variables required (see `.env.example` for the
two optional flags). Runtime for the full evaluation: **< 1s**, cost **$0.00**.

## Reproducing the headline numbers

`npm run build` serves the site; the eval board computes them live. Or from Node via vitest —
`src/__tests__/pipeline.test.ts` asserts the exact aggregates:

| Metric | Baseline | Agent |
| --- | --- | --- |
| Rubric score | 30% | 100% |
| False pages (SEV1 where gold ≠ SEV1) | 5 | 0 |
| Wrong-team routes | 9 | 0 |
| Missed criticals (2+ levels under-rated) | 1 | 0 |

## The service layer ("backend")

The deployment artifact of this hackathon is a static site, so the service layer runs
**in-browser** behind a transport-agnostic `call(method, path, body, session)` facade
(`src/backend/api.ts`). The contract is designed to map 1:1 onto a Node/Fastify process later —
see `docs/ARCHITECTURE.md` for the REST table, data model, decision log and security review.

What the layer actually enforces (and tests prove):

- **Validation** at the boundary (`422 VALIDATION_FAILED` with machine-readable issues)
- **Authentication** (`401` for anonymous actors, session rehydration after refresh)
- **Authorization** (`403` for the viewer role — denials are audited, because `authenticated ≠ authorized`)
- **Idempotency** (`409 ALREADY_DECIDED` — gate decisions are immutable)
- **Audit** (append-only ledger with sequence numbers, request ids, exportable as JSON)
- **Observability** (`/v1/health`, structured logs with request ids, latency metrics)
- **Failure injection** (chaos toggle → `503 STORAGE_OFFLINE`; health/logs stay up)

## Security notes

- Sandbox auth by design: reviewer identity is asserted, roles enforced service-side. A real IdP
  is a transport swap, not an architecture change (documented in the decision log).
- Errors never carry stack traces across the API boundary.
- No secrets exist in this repo; nothing sensitive is logged.
- Consequential acts (pages) require human approval — ground rule 04.

## Known limitations & next steps

- The rubric and rule engine were co-designed on these 12 cases → overfitting risk. Next: a
  held-out set written by reviewers who have not seen the rules.
- Single-document store is fine at this scale; concurrent writers would need a real DB.
- Chaos mode simulates storage failure only; network partition semantics are out of scope.
