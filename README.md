# Pagermind — live incident-triage console

**micro1 Agentic Workflows Hackathon · entry AW-2201.**

Pagermind is a working triage workstation: synthetic incidents stream in, a
deterministic agent triages each one with a visible tool-grounded trace,
page-worthy calls stop at a **human approval gate**, and every act — agent or
human — lands in an append-only audit ledger. The same engine powers the
scored baseline-vs-agent evaluation.

## Who has the problem

On-call engineers. The bottleneck is not alerting — it's that **severity
lives outside the alert text**: in service tier, blast radius, revenue
impact, deploy state and the change calendar. Keyword triage therefore
over-pages (wakes people for drills) and under-pages (misses silent
corruption). Solving it buys back sleep and makes every page defensible.

## Quick start

```bash
npm install
npm run dev        # live console at localhost:5173 — incidents start streaming
npm run build      # static artifact (dist/)
npx vitest run     # the evaluation: engine + rubric + ablation + gate state machine
```

**Demoing it:** click the amber **▶ demo** button in the top bar — a guided,
spotlight-driven tour runs the real product end-to-end (hard cases injected
on cue, human gate, audit ledger, chaos mode, scored report, evidence &
trajectories). Full hosting/recording instructions: `REPRODUCTION.md` §3.

No API keys, no environment variables, no network. See `.env.example` for the
two optional developer flags.

## What's in the box

| Surface | What it does |
| --- | --- |
| **Console** (`CONSOLE` mode) | live incident feed → agent trace replay → approve/reject pages inline |
| **Storm** (§02) | 4-alert checkout storm collapses to one incident with visible grouping evidence; baseline's 4 noisy dispositions shown side by side |
| **Postmortem studio** (§04) | deterministic postmortem assembled from the triage artifacts — trace, rules, memory recall, ledger decision; markdown export |
| **Gates** (§) | full approval desk: sandbox sign-in, role enforcement (403 audited), immutable decisions (409) |
| **Ops** (§) | `/v1/health`, structured logs with request ids, audit export, chaos injection (503) |
| **Red Team** (§) | 6 poisoned alerts scored as an adversarial axis — agent resists 6/6 via `parse.sanitize`, baseline 0/6 |
| **Report** (`REPORT` mode) | the scored submission: problem, bench, eval, evidence, red team, changelog, repro, hot take |

## Submission deliverables → where they live

| Deliverable | Location |
| --- | --- |
| **1 · Solution code + improvement changelog** | this repo; `CHANGELOG.md`; agent instructions in `agents/TRIAGE_AGENT.md` |
| **2 · Reproduction guide** | `REPRODUCTION.md` (clean-env commands, expected output, versions, runtime, cost) |
| **3 · Solution video** | `VIDEO_SCRIPT.md` — timed storyboard; recorded by the team in one take (the demo is deterministic). Status: script complete, recording is a human task |
| **4 · Agent trajectories** | REPORT → §04 Evidence → *download trajectory set* (24 runs: input, tool calls, rule fires, verifier feedback, gate states, scores) |

## Ground rules → evidence

| Rule | How we comply |
| --- | --- |
| Clear what existed vs added | Starter: Vite/React/TS/Tailwind template only. Everything else is this submission (`agents/TRIAGE_AGENT.md` §Provenance) |
| Licences & terms | MIT intent; React/Vite/Tailwind/Vitest used per their OSS licences; Google Fonts via their embed terms |
| Consequential acts sandboxed | All incidents synthetic; pages never fire without reviewer approval; chaos mode is a simulation |
| Qualified human reviewer | Gates require the `reviewer` role; viewer attempts are denied **and audited** |
| Legal/ethical, responsible data | Synthetic data only; no PII, no credentials anywhere |
| Shareable information | Everything in-repo is synthetic or original |
| No credentials | Verified — grep the repo; `.env.example` holds only non-secret flags |
| Claims tied to evidence | Every headline number is computed at runtime and asserted in `src/__tests__/pipeline.test.ts` |
| Judges can reproduce | `REPRODUCTION.md`: clean env → `npm install` → `npx vitest run` → same numbers in <1s |

## Architecture in one breath

UI (React) → `src/backend/api.ts` (request ids, validation, latency, chaos) →
`src/backend/services.ts` (authz, gates, audit, triage, observability) →
`src/backend/db.ts` (versioned schema, migrations) → localStorage. The agent
(`src/engine/agent.ts`) is a pure deterministic function; the baseline
(`src/engine/baseline.ts`) is the honest 40-line regex "before". Full design,
API table and decision log: `docs/ARCHITECTURE.md`.

## Security

Authorization enforced service-side (authenticated ≠ authorized); denials
audited; decided gates immutable; boundary validation with machine-readable
422s; no stack traces across the API boundary; corrupted storage fails
closed; zero secrets.

## Known limitations & next steps

- Sandbox auth asserts identity (no passwords/IdP) — swap point documented in `docs/ARCHITECTURE.md`.
- Rubric and rules were co-designed on these 12 cases → hold out a reviewer-written set next.
- Single-document store suits this scale, not concurrent writers.
