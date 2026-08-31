# Reproduction Guide

Written for someone starting from a **clean environment**. Everything below
was verified on Node v20, npm 10, macOS/Linux. No API keys, no cloud account,
no paid service is required at any step.

## 0 · What you need

- Node.js ≥ 20 (`node --version`)
- npm ≥ 9 (`npm --version`)
- A modern browser (Chrome/Edge recommended for the narrated tour — they ship speech synthesis voices)

## 1 · Set up from a clean environment

```bash
git clone <repo-url> pagermind
cd pagermind
npm install
```

That's it. There is no `.env` to configure and no database to start.

## 2 · Run the SOLUTION (live product)

```bash
npm run dev
```

Open `http://localhost:5173`. Incidents begin streaming immediately.

To see the whole product narrated, click the amber **▶ demo** button (top
bar). It walks 13 beats: live feed → GameDay drill auto-resolve → the
injection attack that fails → the 4-alert storm collapsing to one incident →
real signals from the live adapter → the human gate (sign in as *Priya
Natarajan*, approve a page, watch it land on the on-call engineer) → the
postmortem → chaos mode → the scored bench, evidence and red-team matrix.
**auto** mode advances on its own (~5:00 total) — record this for the video
(beat timings in `VIDEO_SCRIPT.md`).

## 3 · Run the BASELINE and the EVALUATION

The baseline (the 40-line regex script) and the agent run **the same 12
cases under the same rubric**, both computed by `src/engine/engine.ts`.

```bash
npx vitest run
```

**Expected output** (these are exact, asserted values):

```
baseline rubric        23%      agent rubric        100%
false pages            5   →    0
wrong-team routes      9   →    0
missed criticals       1   →    0
ablation ladder        [23, 89, 100, 100]
red team resistance    agent 6/6 · baseline 0/6
gate state machine     401 · 403-audited · 409 · 422   all pass
```

**Runtime:** < 1 second. **Cost:** $0.00. The engine is deterministic, so
these numbers are identical on every machine and every run.

## 4 · Interact with the evaluation in the browser

- **Report mode** (top-bar switch) → *Bench*: pick any of the 12 cases and
  watch baseline vs. agent side by side, then the verdict table against the
  human-fixed gold answer.
- **Report mode** → *Evidence*: click **run audit** to re-execute the same
  assertions as the test suite, in your browser. Download the **trajectory
  set** (38 runs) or the **evidence snapshot** (every number in one JSON).
- **Report mode** → *Red Team*: expand any of the 6 poisoned alerts to see
  how the baseline obeys and the agent resists.

## 5 · Build the static artifact (what judges can host)

```bash
npm run build
npm run preview     # or: npx serve dist
```

The entire product — console, gates, ledger, evaluation — is in `dist/` and
runs from any static host.

## 6 · Data, versions, and honest caveats

- **Data:** all incidents, services, rosters and alerts are **synthetic**
  (`src/data/cases.ts`). Gold answers were fixed before the agent rules.
- **Versions:** Node 20 · npm 10 · Vite 6 · React 18 · TypeScript 5 · Tailwind 4 · Vitest.
- **Caveat:** the rubric and rules were co-designed on these 12 cases — a
  held-out, reviewer-written set is the stated next step. The sandbox roster
  asserts identity (no passwords); role enforcement is real and tested.
