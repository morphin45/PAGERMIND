# Handoff — Pagermind (AW-2201)

> Canonical, up-to-date handoff: **`docs/HANDOFF.md`** (repo root docs).
> This file exists because the `.ai` framework expects `docs/agents/*`.

## Objective
A market-credible hackathon submission: a working incident-triage console
whose deterministic agent beats a fair regex baseline on a fixed evaluation,
resists poisoned alerts, and reproduces from a clean machine.

## Current state (final)
- Console: feed + traces, storm correlation, live external adapter
  (GitHub Status API, read-only), gates with real authz, postmortem studio,
  ops (health/logs/audit/chaos), service-health strip, MTTD, ⌘K palette,
  first-run briefing, degraded-mode banner.
- Report: problem → bench → eval → evidence (attribution, live audit,
  trajectory + evidence-snapshot exports) → red team → changelog →
  architecture → repro + trust panel → hot take.
- Narrated tour: 13 beats, voice + spotlight + auto mode (~5 min).
- Adapter boundary (`src/engine/adapters.ts` + `stubAdapters.ts`) is
  contract-tested; `src/engine/live.ts` is the first real adapter.
- Tests: determinism, gold ×12, aggregates (23→100, 5→0, 9→0, 1→0),
  ablation [23,89,100,100], red team 6/6 vs 0/6, storm, postmortem,
  gate 401/403/409/422, adapter divergence.

## Commands
```
npm install && npm run dev      # console
npm run build                   # dist/
npx vitest run                  # the evaluation
```

## Remaining (human tasks)
1. Run `npx vitest run` on a real machine (build-only environment here).
2. Record the video — `VIDEO_SCRIPT.md` matches the tour 1:1.
3. One cold rehearsal.
4. Production phases per `ROADMAP.md` (real adapters, IdP, Postgres, hardening).
