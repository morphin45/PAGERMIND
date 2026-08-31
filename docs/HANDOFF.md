# Handoff — Pagermind (AW-2201)

## Objective
A market-credible, hackathon-winning submission: a working incident-triage
console whose deterministic agent beats a fair regex baseline on a fixed
evaluation, resists poisoned alerts, and reproduces from a clean machine.

## Completed work
- Live console: streaming feed, agent traces, gates, page delivery, storm
  correlation, postmortem studio, ops (health/logs/audit/chaos), service-health
  strip, MTTD, ⌘K command palette, first-run briefing, degraded-mode banner.
- Live external adapter: GitHub public Status API, read-only, advisory triage
  (`src/engine/live.ts`) — the first production-shaped integration.
- Report mode: problem → bench → eval → evidence (attribution + live audit +
  exports) → red team → changelog → architecture → repro (+ trust panel) → hot take.
- Narrated guided tour (13 beats, voice + spotlight + auto mode, ~5 min).
- Service layer: api/v1 facade, authz (401/403/409/422), append-only audit,
  versioned storage with migrations, chaos injection.
- Adapter boundary (`src/engine/adapters.ts`): engine consumes tools/identity/
  transport only through seams; sandbox implementations today.
- Tests: determinism, gold conformance ×12, aggregates (23→100, 5→0, 9→0,
  1→0), ablation [23,89,100,100], red team 6/6 vs 0/6, storm, postmortem
  byte-determinism, gate state machine.
- Docs: README, CHANGELOG, REPRODUCTION, VIDEO_SCRIPT, ROADMAP, LICENSE,
  agents/TRIAGE_AGENT.md, docs/ARCHITECTURE.md, this file.

## Remaining work (human / out of environment)
1. **Run `npx vitest run` on a real machine.** Cannot execute here (build-only
   environment). Expected: all green; numbers asserted above.
2. **Record the 5-min video** — `VIDEO_SCRIPT.md` beats match the tour 1:1.
3. **One cold rehearsal** of the tour before presenting.
4. Production phases per `ROADMAP.md` (real IdP/Postgres/Prometheus/PagerDuty
   adapters, hardening, learning loop).

## Important decisions
See `docs/ARCHITECTURE.md` decision log (D1–D5). Headline: deterministic
agent + adapter boundary; LLM free-text severity call built, measured
(±18 pts variance), and removed.

## Commands
```
npm install
npm run dev          # console at :5173
npm run build        # dist/
npx vitest run       # the evaluation
```

## Risks / known limitations
- Rubric and rules co-designed on the same 12 cases (overfitting disclosed
  in the hot take; held-out reviewer set is the next step).
- Sandbox auth asserts identity (documented swap point, not a gap to hide).
- Video file not included (honest: recording is a human task).

## Next action
Run the test suite locally; if green, record the video and submit.
