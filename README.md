# Pagermind — live incident-triage console

**micro1 Agentic Workflows Hackathon · entry AW-2201.**

Pagermind is a working triage workstation: synthetic incidents stream in, a
deterministic agent triages each one with a visible tool-grounded trace,
page-worthy calls stop at a **human approval gate**, and every act — agent or
human — lands in an append-only audit ledger. The same engine powers the
scored baseline-vs-agent evaluation, the red-team suite, and the postmortem
generator.

**Market status (honest):** a complete product on a synthetic sandbox —
ready to evaluate, demo and learn from; not yet a production deployment.
What's enforced for real today vs. sandbox-honest vs. the path to production
is stated in the app (Report → Repro → trust panel) and in `ROADMAP.md`.

## What existed before vs. what this submission adds

- **Pre-existing:** the Vite + React + TypeScript + Tailwind starter template only.
- **Added by this submission:** everything else — the evaluation set, the
  baseline and agent engines, the service layer, the console, the report,
  tests and docs. Licensed under MIT (`LICENSE`).

## Who has the problem

On-call engineers. The bottleneck is not alerting — it's that **severity
lives outside the alert text**: in service tier, blast radius, revenue
impact, deploy state and the change calendar. Keyword triage therefore
over-pages (wakes people for drills), under-pages (misses silent corruption)
and mis-routes (9 of 12 cases in our set). Solving it buys back sleep and
makes every page defensible.

## Quick start

```bash
npm install
npm run dev        # live console at localhost:5173 — incidents start streaming
npm run build      # static artifact (dist/) — the whole product, serve anywhere
npx vitest run     # the evaluation: aggregates + ablation + red team + gate state machine
```

No API keys, no environment variables, no network. Runtime <1s, cost $0.00.
Click the amber **▶ demo** button for a narrated, spotlight-driven tour
(under 5 minutes, auto mode is hands-free — that's your submission video in
one take).

## What's in the box

| Surface | What it does |
| --- | --- |
| **Console · Feed** (§01) | live incident stream → agent trace replay → approve/reject inline; page lands on a named on-call engineer |
| **Console · Storm** (§02) | 4-alert checkout storm collapses to one incident with visible grouping evidence; baseline's 4 noisy dispositions shown alongside |
| **Console · Gates** (§03) | sandbox sign-in, role enforcement (403 audited), immutable decisions (409), boundary validation (422) |
| **Console · Postmortem** (§04) | deterministic postmortem assembled from the triage artifacts; markdown export |
| **Console · Ops** (§05) | `/v1/health`, structured logs with request ids, audit export, chaos injection (503) |
| **Report** (mode switch) | problem, live bench, eval, evidence, red team, changelog, architecture, repro, hot take |

## The numbers (all computed by `src/engine/engine.ts`, asserted in tests)

| Metric | Baseline (regex script) | Agent |
| --- | --- | --- |
| Rubric score | **23%** | **100%** |
| False pages | 5 | 0 |
| Wrong-team routes | 9 | 0 |
| Missed criticals | 1 | 0 |
| Poisoned alerts resisted | 0/6 | 6/6 |

Attribution ablation: `[23, 89, 100, 100]` — grounding tools carry the
weight, the critic closes the traps, memory holds the score while improving
decision quality.

## Submission deliverables → where they live

| Deliverable | Location |
| --- | --- |
| 1 · Solution code + improvement changelog | this repo · `CHANGELOG.md` |
| 2 · Reproduction guide | `REPRODUCTION.md` |
| 3 · Solution video | `VIDEO_SCRIPT.md` — timed storyboard; record one take with the demo button's narrated tour (deterministic engine ⇒ free retakes) |
| 4 · Agent trajectories | Report → Evidence → *trajectories* (38 runs: input → tool calls → feedback → checkpoints → scores) |

## Ground rules → evidence

| Rule | How we comply |
| --- | --- |
| Clear what existed vs added | Starter: Vite/React/TS/Tailwind template only. Everything else is this submission (footer states it) |
| Consequential acts sandboxed | All incidents synthetic; pages never fire without reviewer approval; chaos mode is a simulation |
| Qualified human reviewer | Gates require the `reviewer` role; viewer attempts are denied **and audited** |
| Legal/ethical, shareable data | Synthetic data only; no PII, no credentials anywhere |
| Claims tied to evidence | Every headline number is computed at runtime and asserted in `src/__tests__/pipeline.test.ts`; the in-app acceptance audit re-proves it live |
| Judges can reproduce | `REPRODUCTION.md`: clean env → `npm install` → `npx vitest run` → same numbers in <1s |

## Architecture in one breath

UI (React) → `src/backend/backend.ts` (request ids, validation, latency,
chaos, routes) → domain services (authz, gates, audit, triage, observability)
→ versioned, migration-ready store (localStorage, memory fallback under
tests). The agent (`src/engine/engine.ts`) is a pure deterministic function;
the baseline is the honest 40-line regex "before".

## Security

Authorization enforced service-side (authenticated ≠ authorized); denials
audited; decided gates immutable; boundary validation with machine-readable
422s; no stack traces across the API boundary; corrupted storage fails
closed; zero secrets. The deeper property: **no prose-to-action channel
exists**, so prompt injection has nothing to hijack — demonstrated by the
6-case red-team suite.

## Known limitations & next steps

- Sandbox auth asserts identity (no passwords/IdP) — the swap point is one function.
- Rubric and rules were co-designed on these 12 cases → hold out a reviewer-written set next.
- Single-document store suits this scale, not concurrent writers.
- The submission video must be recorded by the team (script + narrated tour are ready).
