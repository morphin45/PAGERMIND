# Project-Wide Instructions — Pagermind

> Read this file before touching anything. It is the contract between the
> project and any AI assistant (Codex, Claude, Cursor, Windsurf, Copilot).

## What this project is

Pagermind (hackathon entry AW-2201) is a **live incident-triage console**:
synthetic incidents stream in, a deterministic agent triages each with a
visible tool-grounded trace, page-worthy calls stop at a human approval
gate, and every act lands in an append-only audit ledger. The same engine
powers the scored baseline-vs-agent evaluation (rubric 30% → 100%).

## Non-negotiables

1. **The engine is deterministic.** `agent.ts`, `baseline.ts`, `eval.ts` and
   `brief.ts` in `src/engine/` are pure functions. Never introduce
   `Math.random()`, wall-clock reads or nondeterminism there —
   reproducibility is a graded requirement. Randomness belongs only in
   `src/engine/sim.ts` (arrival jitter) and `src/backend/api.ts` (latency).
2. **Authorization is enforced in `src/backend/services.ts`, never in UI.**
   `authenticated ≠ authorized`. Denials are audited.
3. **Consequential acts require human approval.** Pages never fire without a
   `reviewer`-role decision; decisions are immutable (`409 ALREADY_DECIDED`).
4. **No secrets, ever.** Synthetic data only; no PII; no credentials in code,
   logs, docs or commits.
5. **Errors never carry stack traces across the API boundary** — structured
   `ApiError { status, code, message, requestId, issues? }` only.
6. **Claims must be computed or asserted.** Headline numbers come from
   `src/engine/eval.ts` at runtime and are asserted in
   `src/__tests__/pipeline.test.ts`. Never hardcode a metric into UI text.

## Conventions

- TypeScript strict; React 18; Tailwind v4 (custom theme in `src/index.css`).
- Services are called through `call(method, path, body, session)` in
  `src/backend/api.ts` — do not bypass the facade.
- Storage goes through `db.tx()` in `src/backend/db.ts` (schema-versioned,
  migrated). Never touch `localStorage` from components except the session id.
- Custom SVG icons live in `src/components/icons.tsx`; no icon libraries.
- Sections are numbered 01–10; keep numbering coherent when adding one.

## Standard workflow

1. Inspect relevant code → 2. summarize findings → 3. state assumptions →
4. plan + list files → 5. implement the smallest coherent change →
6. `npm run build` (must stay green) → 7. run targeted vitest where possible →
8. review the diff → 9. update docs if behavior changed.

## Definition of done (this project)

- [ ] Requested behavior implemented; edge cases handled
- [ ] Input validated at the boundary (422 with machine-readable issues)
- [ ] AuthN/AuthZ boundaries checked for any mutating path
- [ ] Loading / empty / error states present in UI
- [ ] Engine changes stay deterministic (determinism test still passes)
- [ ] `npm run build` green; `npx vitest run` green (or absence explained)
- [ ] Docs updated: README, REPRODUCTION, CHANGELOG where behavior changed
- [ ] No secrets, no generated files, no unrelated changes in the diff

## Do not

- Invent APIs, dependencies or store shapes without checking `docs/ARCHITECTURE.md`
- Add tests just to raise coverage — test behavior that matters
- Claim tests/deployments passed unless actually run
- Remove or weaken the human gate "for convenience"
