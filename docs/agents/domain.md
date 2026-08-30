# Domain Context

Reuse this terminology everywhere — code, UI copy, docs, traces.

## Core concepts

### Incident (IncidentCase)
- **Definition:** one synthetic alert event from the 12-case evaluation set (`src/data/incidents.ts`), replayed by the simulator as a live stream.
- **Lifecycle:** authored once (synthetic) → streamed by the sim → triaged → disposed (auto-resolved | staged at gate | paged | rejected).
- **States:** `queued → triaging → { auto | gate → (paged | rejected) }`
- **Invariants:** gold answers (`severity`, `team`, `action`) were fixed *before* the agent rules existed; never edit gold to make a run pass.
- **Permissions:** read-only for everyone; only the sim creates instances.

### Verdict
- **Definition:** the agent's proposal for one incident: severity, team, runbook, action, confidence, evidence chain, page-or-not.
- **Invariants:** every claim cites a tool output; `evidence.length ≥ 3`; deterministic — same incident, byte-identical verdict everywhere.
- **Do not confuse with:** *Decision* (the human's act on a gate).

### Severity
- **Definition:** blast-radius class, not a keyword. Scale: `SEV1 > SEV2 > SEV3 > SEV4 > DRILL`.
- **Business rule:** `DRILL` is *not* "low severity" — it is "not an incident": pre-approved automation (rule D-1) resolves it with an audit note and zero pages.

### Gate / GateProposal
- **Definition:** a staged consequential act (a page) awaiting human decision.
- **Lifecycle:** `pending → approved | rejected` — terminal and **immutable**; retry yields `409 ALREADY_DECIDED`.
- **Invariants:** exactly one decision per gate; the decider's name, time and reason are persisted; decisions dispatch `pm:gates-changed`.
- **Permissions:** only `reviewer` role may decide; `viewer` attempts → `403`, audited.

### Page
- **Definition:** the consequential act itself — waking the on-call engineer for a team.
- **Business rule:** a page can only originate from an approved gate (or, for non-consequential acts, from pre-approved automation that still writes an audit note).
- **Do not confuse with:** *Gate* (the checkpoint) vs *Page* (the act that fires after approval).

### Session
- **Definition:** an authenticated sandbox identity (reviewer id → token). No passwords by design (ADR-003).
- **Lifecycle:** start → rehydrate after refresh → end. Capped at 25, oldest evicted.
- **Invariants:** role is copied from the roster at start and enforced server-side on every mutating call.

### AuditEntry
- **Definition:** one append-only ledger row: `seq, at, actor, action, target, outcome, detail, requestId`.
- **Invariants:** `seq` monotonic; entries never mutated or deleted; agent acts (`actor: pagermind/triage`), human acts and *denials* are all recorded.

### Reviewer
- **Definition:** a roster identity with a role: `reviewer` (may decide gates) or `viewer` (read-only). Sandbox roster in `services.ts`.

### Runbook
- **Definition:** the cited remediation (`id`, `title`, `rev`) matched per incident; part of the rubric (15 pts).

### Memory
- **Definition:** incident history — fingerprints of past incidents surfaced into the trace and recommendation.
- **Business rule:** memory changes *decision quality*, not just the score (e.g., a 3rd recurrence becomes a capacity ticket).

### Critic (verifier)
- **Definition:** the falsification pass after the rule engine: calendar contradictions (GameDay), rollback evidence (downgrade), silent-corruption signals (escalate).
- **Evidence:** biggest single contributor in the ablation (71% → 96%).

## Important business rules

1. Consequential acts require a qualified human decision; non-consequential acts run under pre-approved automation with an audit note.
2. `authenticated ≠ authorized` — role checks live in `services.ts`, denials are audited.
3. Severity comes from tier × blast radius × schedule, never from alert keywords.
4. Determinism is a product requirement: identical input ⇒ identical trace.
5. Every UI number is computed from the engine at runtime; the audit console can re-prove it.

## Terminology

| Term | Meaning | Do not confuse with |
|---|---|---|
| Verdict | Agent's proposal (sev, team, runbook, evidence) | Decision |
| Decision | Human approve/reject on a gate | Verdict |
| Gate | Checkpoint where a page waits | Page |
| Page | The act of waking the on-call engineer | Gate |
| DRILL | "Not an incident" (rule D-1) | SEV4 (a real, quiet incident) |
| Reviewer | Roster identity with a role | Session (the token) |
| Baseline | The 40-line regex script (`baseline.ts`) | The agent |
| Chaos | Injected storage failure (`503`) | Real outage |

## Open decisions

- Held-out evaluation set authorship (reviewers who haven't seen the rules)
- Real-IdP swap point when/if the facade is extracted to a server (ADR-001)
