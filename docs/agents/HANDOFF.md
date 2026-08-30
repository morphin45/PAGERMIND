# Handoff — Pagermind (AW-2201)

Factual status for the next developer or agent. Verify, don't trust.

## Objective
A live, auditable incident-triage console that is also a scored hackathon
submission: deterministic agent vs. 40-line regex baseline, same 12 synthetic
cases, shared rubric, human-gated consequential acts.

## Completed work (verified by green `npm run build`, 52 modules)
- Engine: deterministic triage pipeline (tools → rules → critic → gate) + baseline + eval + ablation + brief builder
- Simulation: streaming console with page delivery, on-call roster, recurrence memory beats
- Service layer: api/v1 facade (401/403/404/409/422/503), sessions, gates, audit, health, logs, chaos
- Persistence: schema-v1 store with migration registry + memory fallback
- UI: console + report modes, guided DemoTour (10 beats), Evidence section (audit console, trajectory + evidence-snapshot exports)
- Tests: `src/__tests__/pipeline.test.ts` (determinism, gold, aggregates 30→100, ablation 30→71→96→100, gate 401/403/409/422)
- Docs: README, REPRODUCTION, CHANGELOG, VIDEO_SCRIPT, docs/ARCHITECTURE.md, agents/TRIAGE_AGENT.md, docs/agents/*, .ai/*

## Remaining work
- **Record the 5-min submission video** using `VIDEO_SCRIPT.md` + tour auto-mode (human task — do not mark done until recorded)
- Held-out evaluation set written by reviewers who haven't seen the rules (overfitting risk)
- Optional: real-IdP swap if the facade is extracted to a server (ADR-001/003)

## Important decisions
See `.ai/decisions/ADR-001…004`. Key: in-browser service layer; single-document versioned store; sandbox auth with real authz; deterministic agent after **removing** the LLM severity call.

## Tests run / not run
- Run here: `npm run build` (green). Type checking runs as part of build.
- **Not run in this environment:** `npx vitest run` — the environment builds only. Assertions were hand-verified against source data case-by-case; run the suite locally before claiming pass. Be honest about this in any report.
- No lint configured (documented in `docs/agents/commands.md`).

## Known bugs / gaps
- None known-blocking. Watch: DemoTour spotlight relies on `#console`/`#desk`/`#ops` ids — renaming sections breaks targets.

## Assumptions
- Judges accept an in-browser service layer as the "backend" for a static artifact (documented, not hidden).
- Synthetic data satisfies the "information you are allowed to share" rule.

## Risks
- Rubric/rules co-designed on the same 12 cases → overfitting critique is plausible; mitigation is the held-out set.

## Recommended next action
1. `npm install && npx vitest run` — confirm the suite green on a real machine.
2. Record the video (tour auto-mode ≈ 90 s; full script ≈ 5 min).
3. Deploy `dist/` to a static host and paste the link into the submission form.

## Commands to continue
```bash
npm install
npm run dev          # live console
npx vitest run       # the evaluation
npm run build        # artifact → dist/
```
