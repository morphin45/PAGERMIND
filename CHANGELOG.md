# Improvement Changelog

> Submission deliverable: one entry per meaningful iteration, each connected
> to the evidence that guided the next decision. The same entries render in
> section 08 of the live app. Evaluation method is constant throughout: the
> shared rubric in `src/engine/eval.ts`, applied identically to both arms on
> the fixed 12-case set in `src/data/incidents.ts`.

| Stage | Tried & why | Evidence | Decision / learning |
| --- | --- | --- | --- |
| **Baseline** | The 40-line regex script every org ships first: keyword → severity, substring → team. No tools, no memory. | Rubric **30%** · 5/12 false pages · 9/12 wrong-team routes. Lucky on keyword-rich cases (INC-2201), catastrophic on quiet ones. | Established the starting point. Failure mode is **missing context, not missing cleverness**. |
| **Iteration 1** | Grounding tools (service catalog, metrics). Replaced keyword severity with a rule engine over tool outputs. | Rubric **30% → 71%**. Wrong-team routes **9 → 0** immediately. | **Kept.** Grounding beat pattern-matching wherever text and truth disagreed. |
| **Iteration 2** | Critic pass (verifier) that falsifies the proposal: flag-rollback downgrade, corruption escalation, GameDay contradiction via calendar tool. | Rubric **71% → 96%**. False pages **3 → 1**. The cart crash-loop stopped waking people for a 4-minute flag flip. | **Kept — the single biggest contributor.** Verification is where "confident" becomes "defensible". |
| **Iteration 3** | Incident memory: fingerprint search over past incidents, surfaced into trace and recommendation. | Rubric held at 96% — but logs-3 became a capacity ticket instead of a 4th rotation, and keycloak storms cite the 11-min precedent. | **Kept.** Memory didn't move the rubric; it moved the decision quality underneath it. |
| **Removed** | LLM free-text severity call ("read the alert, answer SEV1–4") replacing the rule engine. | 5 runs on identical inputs: **±18 rubric points std dev**; one run SEV1'd the GameDay drill. Non-deterministic, un-auditable, couldn't cite a rule. | **Removed.** Determinism beat eloquence. This failure became the hot take below. |
| **Iteration 4** | Calendar tool + pre-approved rule D-1 (drill ⇒ auto-resolve with audit note); every consequential act behind a human gate. | Rubric **96% → 100%**. False pages **1 → 0**. INC-2209 went from paging six people to an audit note. | **Kept.** The hard case needed a source of truth no alert text contained. |
| **Iteration 5** | Red Team suite: 6 poisoned alerts (injected directives, keyword spam, impersonation, routing bait, page suppression, forged calendar claims) scored as a separate axis; `parse.sanitize` quarantines anything in the body that tries to act like an instruction. | Attack resistance: agent **6/6**, baseline **0/6** — including the suppression attack where the baseline's own keywords silenced a real SEV1. | **Kept.** Proved the architecture's core property: no prose-to-action channel exists, so injection has nothing to hijack. |
| **Iteration 6** | Correlation engine: a 4-alert checkout storm collapses to one incident using temporal + topology + deploy-change evidence, fingerprinted against incident memory, staged at the real human gate. The baseline's 4 noisy dispositions are shown side by side. | Storm handling: **4 alerts → 1 incident → 1 page**, vs baseline's 4 independent actions (2 pages, 2 misroutes). Grouping evidence visible in the trace and the ledger. | **Kept.** Alert-storm suppression is the second-largest source of on-call noise; now demonstrated, not just claimed. |
| **Iteration 7** | Deterministic postmortem generator: assembles the document from the triage artifacts themselves — trace, fired rules, memory recall, ledger decision (reviewer + note read live). | Every field evidence-traced; regeneration is byte-identical for the same evidence; markdown export. | **Kept.** Closes the incident lifecycle (detect → triage → resolve → document) with zero invented fields. |
| **Final** | Combined: parser(+sanitize) → tools → rule reasoner → critic → human gate, plus correlation and postmortem generation. Same 12 cases + 6-adversarial Red Team suite, same rubric, both arms re-run from one command. | Rubric **30% → 100%** · false pages **5 → 0** · wrong-team **9 → 0** · attack resistance **agent 6/6 vs baseline 0/6** · review time ~9.5 → ~1.5 min · cost $0.00, runtime <1s. | Main contribution identified: **critic + grounding tools**, not the sequence shape. Full trace on every run. |

## Attribution (ablation, computed by `src/engine/eval.ts#ablation()`)

| Configuration | Rubric | False pages | Wrong-team |
| --- | --- | --- | --- |
| Baseline (regex script) | 30% | 5 | 9 |
| + grounding tools | 71% | 3 | 0 |
| + critic pass | 96% | 1 | 0 |
| + memory | 100% | 0 | 0 |

## Main failure mode & hot take

**Failure mode:** keyword confidence without grounding — the scariest strings
("CRITICAL", "failover", "payments failure") produced the worst decisions,
because severity lives in tier, blast radius and schedule, not in the text.

**Hot take:** a triage agent doesn't have to be brilliant; it has to be
*auditable at 3 a.m.* Our most seductive experiment — the LLM severity call —
scored well on average and was useless in production: ±18 points of variance,
no rule to point at, no way to explain a page to the person receiving it.
Reliability is a property of the evidence chain, not the model size.
