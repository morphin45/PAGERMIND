# Reproduction Guide

Written for someone starting from a **clean environment**. No API keys, no
database, no network access and no credentials are required — the engine is
deterministic TypeScript and the evaluation runs in-process.

## 1 · Prerequisites

| Requirement | Version verified |
| --- | --- |
| Node.js | ≥ 20 (v20.x / v22.x) |
| npm | ≥ 10 |
| Browser (for the live console) | any evergreen |

## 2 · Setup

```bash
git clone <this repository> && cd pagermind
npm install        # only dev + runtime deps from package.json, nothing else
```

## 3 · Run the solution (the live product)

```bash
npm run dev
# → http://localhost:5173 — the triage console starts streaming incidents.
#   Triage a few, approve/reject a gate, watch the audit ledger in Ops.
```

For the static artifact the judges receive:

```bash
npm run build && npm run preview
```

### Showing it to judges (the demo)

1. **Guided tour** — in the console, click the amber **▶ demo** button (top bar).
   A spotlight walks the live product end-to-end with optional voice-over
   (browser speech synthesis; toggle "voice off" for silent): the streaming
   feed, the GameDay drill auto-resolving under rule D-1, a memory/recurrence
   beat (INC-2201 recalls a prior fix), the silent-corruption page, the
   **Red Team** suppression attack, the **4-alert storm collapsing to one
   incident**, the **evidence-written postmortem**, and the
   human gate, approval → page lands on a named on-call engineer, chaos mode,
   then the scored report and the evidence section. Keyboard: ← → / Esc. An
   *auto* mode advances every 9 s — ideal for a hands-free walkthrough.
2. **Host the static build** — `npm run build`, then serve `dist/` from any
   static host (Netlify Drop, Vercel, `npx serve dist`, GitHub Pages). No
   server, no env vars; the whole product is in the artifact.
3. **Record the submission video** — follow `VIDEO_SCRIPT.md` beat-by-beat
   with the guided tour driving the screen. The engine is deterministic, so
   retakes are free. (~5 min, one take.)

## 4 · Run the baseline

The baseline is `src/engine/baseline.ts` — the 40-line regex script. It is not
a separate binary: the evaluation harness runs **both arms on the same 12
cases** in one pass:

```bash
npx vitest run
```

Expected output (asserted, not printed-and-hoped):

```
✓ triage engine — deterministic, gold-conformant, evidence ≥ 3 on every case
✓ shared evaluation rubric — baseline 30% / agent 100%, false pages 5 → 0,
  wrong-team 9 → 0, missed criticals 1 → 0
✓ attribution ablation — 30 → 71 → 96 → 100
✓ approval gates — 401 / 403 / 409 / 422 paths, denial auditing, idempotency
```

## 5 · Run the evaluation (interactive)

```bash
npm run dev        # open the app → switch to REPORT mode
```

- **§02 Bench** — run both arms case by case; the verdict table scores each
  against the gold answer fixed before the agent rules existed.
- **§03 Eval** — the aggregate table (same numbers as vitest, computed live).
- **§04 Evidence** — attribution ablation + one-click acceptance audit that
  re-executes the vitest assertions in the browser.

## 6 · Data required

Only `src/data/incidents.ts`: 12 **synthetic** incidents with gold answers
(severity, team, action, trap label). Nothing is fetched; nothing leaves the
machine. Storage (gates, sessions, audit) lives in `localStorage` under a
versioned schema (`pagermind.db`, schema v1).

## 7 · Reproduce the agent trajectories

Open **REPORT → §04 Evidence** and press **download trajectory set** — one
JSON with all 24 runs (12 cases × 2 arms): raw input, agent instructions
reference, every tool call and rule fire, verifier feedback, gate state and
rubric score. Because the engine is a pure function, the file is
byte-identical on every machine (timestamps aside).

## 8 · Runtime & cost

| Step | Approx. runtime | Cost |
| --- | --- | --- |
| `npm install` | ~20 s | $0.00 |
| full evaluation (`npx vitest run`) | **< 1 s** | $0.00 |
| trajectory export | < 100 ms | $0.00 |
| `npm run build` | ~3 s | $0.00 |

## 9 · If numbers differ

They won't — that's the point. If they do: (1) check Node ≥ 20,
(2) `rm -rf node_modules && npm install`, (3) clear `localStorage`
(the audit ledger persists by design; it never affects scores).
