# Project Context

## Application

Pagermind — a live incident-triage console and the scored deliverable for the
micro1 Agentic Workflows Hackathon (entry AW-2201). Synthetic incidents stream
in; a deterministic agent triages each with a visible tool-grounded trace;
page-worthy calls stop at a human approval gate; every act (agent or human) is
written to an append-only audit ledger. Two views share one engine: **console**
(the product) and **report** (the scored baseline-vs-agent story).

## Users

- **Primary:** on-call engineers / SRE reviewers who must decide, at 3 a.m.,
  whether an alert is real, how bad it is, and who owns it — with evidence.
- **Secondary:** hackathon judges verifying reproducibility of the evaluation.

## Main features

- Live triage console: streaming sim → agent trace replay → disposition
- Human approval gates with role enforcement, immutable decisions, audit
- On-call roster + simulated page delivery for fired pages
- Ops console: health, request-ID'd logs, audit export, chaos injection
- Report mode: bench, eval board, attribution ablation, acceptance audit,
  changelog, trajectory + evidence-snapshot exports

## Technology stack

- Frontend: React 18 + Vite 6 + Tailwind CSS v4 (Chakra Petch / IBM Plex Sans / JetBrains Mono)
- Backend: in-browser service layer (`src/backend/`) behind a REST-shaped facade
- Database: localStorage single-document store, schema v1, migration registry (memory fallback under vitest)
- Authentication: sandbox sessions by reviewer id (no passwords by design — documented decision D3)
- Hosting: static build (`dist/`), any static host
- Testing: vitest (engine determinism, rubric aggregates, ablation, gate state machine)
- Package manager: npm

## Important rules

- Engine purity: no randomness/clock in `agent.ts`, `baseline.ts`, `eval.ts`, `brief.ts` (see `.ai/instructions.md`)
- Authorization enforced in `services.ts`, never UI; denials audited
- Consequential acts require `reviewer` role + human decision; pages never auto-fire
- No secrets, no PII, synthetic data only
- All headline numbers computed at runtime, asserted in tests

## Important directories

- `src/engine/` — deterministic triage engine + eval + sim + brief builder
- `src/backend/` — types, db (schema+migrations), services (authz/gates/audit), api facade
- `src/components/` — Workstation, TriageDesk, OpsConsole, report sections, DemoTour, ui, icons
- `src/data/` — 12 synthetic incidents with gold answers (fixed before agent rules)
- `src/__tests__/` — vitest suite
- `agents/` — `TRIAGE_AGENT.md`, the instructions that shape the agent
- `docs/` — architecture, decision log, this folder
- `.ai/` — AI-assistance instructions + ADRs

## Known limitations

- Sandbox auth asserts identity (no IdP/passwords) — swap point documented
- Rubric and rules co-designed on 12 cases → overfitting risk; held-out set is next
- Single-document store is not for concurrent writers
- Vitest cannot run in every environment; build (`vite build`) is the universal gate
