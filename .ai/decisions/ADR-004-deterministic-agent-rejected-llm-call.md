# ADR-004: Deterministic rule agent; LLM free-text severity call rejected

## Status
Accepted (includes one rejected experiment)

## Date
2026-02-15

## Context
Severity must be explainable at 3 a.m.: every verdict traceable to a tool
output and a rule a tired human can dispute in ten seconds. Reproducibility
(15% of the rubric) requires identical traces on identical input.

## Options considered

### Option 1 — LLM free-text severity call
"Read the alert, answer SEV1–4." Seductive: terse, flexible, eloquent.

### Option 2 — Deterministic pipeline: tools → rule engine → critic → gate
Pure TypeScript; every step a citable trace entry; the critic falsifies the
proposal; the gate holds consequential acts.

## Decision
Option 2. Option 1 was built, evaluated, and **removed**.

## Reason
Five identical-input runs of option 1: **±18 rubric points std dev**, one run
SEV1'd the scheduled GameDay drill, none could cite a rule. Non-deterministic
and un-auditable — useless in production despite a good average. Option 2
scored higher *and* could defend itself. This failure became the submission's
hot take.

## Consequences
- Easier: byte-identical trajectories (deliverable №4), one-command repro,
  in-browser acceptance audit, judge-verifiable claims.
- Harder: new failure signatures require rule authoring, not prompting.

## Alternatives rejected
Option 1 — eloquence without an evidence chain. See `CHANGELOG.md` →
"Removed".
