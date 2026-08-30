# Roadmap — from sandbox to production

> Honest status: Pagermind today is a **complete product on a synthetic
> sandbox**. This file is the engineering path to a buyer-grade deployment.
> The triage engine, rubric and rules ship unchanged; only the seams below
> get real adapters.

## Phase 0 — Ship as-is (hackathon / evaluation)
- Static artifact, deterministic engine, in-browser service layer.
- Human gate enforced; all data synthetic; audit exportable.
- **Adapter boundary implemented & contract-tested** (`src/engine/adapters.ts`
  + `src/engine/stubAdapters.ts`): the engine is proven to run against an
  alternate adapter implementation, so phase 1 is a swap, not a rewrite.

## Phase 1 — Real signals (integration adapters)
| Sandbox seam | Production adapter | Effort |
| --- | --- | --- |
| `metrics.query` (static signals) | Prometheus / OpenTelemetry queries per service | M |
| `catalog.lookup` (in-repo catalog) | CMDB / service registry sync | S |
| `calendar.check` | Change-management / maintenance-window API | S |
| alert ingress (sim clock) | Webhook receivers: Alertmanager, Datadog monitors | M |
| gate transport (simulated page) | PagerDuty / Opsgenie / Twilio voice + Slack ack buttons | M |

## Phase 2 — Real identity & storage
- Replace asserted identity with an IdP (OIDC): `sessions.ts` is the single swap point; role model unchanged.
- Replace the localStorage document with Postgres (`db.ts` keeps its `tx()` contract; schema v1 maps 1:1 to tables: sessions, gates, audit, meta).
- Multi-tenancy: tenant-scoped catalogs + audit partitions.

## Phase 3 — Hardening
- mTLS between adapters, network rate limiting (the facade already has the seam), secret vault, signed audit export.
- SLOs on the triage path itself (p95 verdict latency, verdict-diff drift alerts on engine changes).
- Load + chaos testing against real infra; the in-browser chaos toggle is the prototype of this.

## Phase 4 — Learning loop (carefully)
- Reviewer override telemetry: track *disagreement rate* per rule; rules with sustained overrides get re-examined.
- Optional LLM layer **for eloquence only** (drafting the postmortem narrative, summarizing for a channel) — never for the verdict. The removed experiment (CHANGELOG) is why this boundary exists.

## Explicit non-goals
- Replacing observability stacks (we consume their signals, not their job).
- Autonomous remediation without a human checkpoint (ground rule 04 is a product decision, not a sandbox limitation).
- Black-box scoring: if a verdict can't cite a tool output and a rule, it doesn't ship.
