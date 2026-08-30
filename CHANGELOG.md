# Improvement Changelog

> Submission deliverable №1 (with the code): one entry per meaningful
> iteration, each connected to the evidence that guided the next decision.
> Evaluation method is constant throughout: the shared rubric in
> `src/engine/engine.ts`, applied identically to both arms on the fixed
> 12-case set in `src/data/cases.ts`. Every number below is computed by the
> code and asserted in `src/__tests__/pipeline.test.ts`.

| Stage | Tried & why | Evidence | Decision / learning |
| --- | --- | --- | --- |
| **Baseline** | The 40-line regex script every org ships first: keyword → severity, four team substrings. | Rubric **23%** · 5/12 false pages · 9/12 wrong-team routes · 1 missed critical. | Established the starting point. Failure mode: **missing context, not missing cleverness**. |
| **Iteration 1** | Grounding tools (catalog, metrics) + a rule engine over their outputs. Severity from tier × blast radius; ownership a lookup. | Rubric **23% → 89%**. Wrong-team **9 → 0**. False pages **5 → 1**. | **Kept.** Grounding beat pattern-matching wherever text and truth disagreed. |
| **Iteration 2** | Critic pass: an independent falsifier — flag-rollback downgrade, silent-corruption escalation, GameDay contradiction via calendar. | Rubric **89% → 100%**. False pages **1 → 0**. Missed criticals **1 → 0**. | **Kept — the biggest win.** It closes exactly the cases where being wrong is expensive. |
| **Iteration 3** | Incident memory: fingerprint search over past incidents, surfaced into trace and recommendation. | Score holds at 100% — logs-3 became a capacity ticket instead of a 4th rotation; storms cite the 6-min precedent. | **Kept.** Memory didn't move the rubric; it moved decision quality underneath it. |
| **Removed** | LLM free-text severity call ("read the alert, answer SEV1–4") replacing the rule engine. | 5 identical-input runs: **±18 rubric points std dev**; one run SEV1'd the GameDay drill. Non-deterministic, un-auditable. | **Removed.** Determinism beat eloquence — this failure became the hot take. |
| **Iteration 4** | Calendar tool + pre-approved rule D-1 (drill ⇒ auto-resolve with audit note); human gate on every consequential act. | INC-2209: six-person page → audit note. Every remaining page carries an approve/reject checkpoint. | **Kept.** The hard case needed a source of truth no alert text contained. |
| **Iteration 5** | Red Team suite: 6 poisoned alerts (injected directives, keyword spam, impersonation, routing bait, page suppression, forged calendar claims) scored as a separate axis; `parse.sanitize` quarantines body-level directives. | Attack resistance: **agent 6/6, baseline 0/6** — including a suppression attack that silenced a real SEV1 in the baseline. | **Kept.** Proved the architecture's core property: no prose-to-action channel exists. |
| **Iteration 6** | Correlation engine: a 4-alert checkout storm collapses to one incident on temporal + topology + deploy-change evidence, fingerprinted against memory. | 4 alerts → 1 incident → 1 page, vs baseline's 4 independent actions (2 pages, 2 misroutes). | **Kept.** Alert-storm suppression is the second-largest source of on-call noise. |
| **Iteration 7** | Deterministic postmortem generator: assembles the document from the triage artifacts — trace, fired rules, memory recall, ledger decision (reviewer + note read live). | Every field evidence-traced; regeneration byte-identical for the same evidence; markdown export. | **Kept.** Closes the incident lifecycle with zero invented fields. |
| **Final** | Combined pipeline: parse(+sanitize) → tools → rules → critic → gate, plus correlation and postmortem. Both arms re-run from one command. | Rubric **23% → 100%** · false pages **5 → 0** · wrong-team **9 → 0** · missed **1 → 0** · resistance **6/6 vs 0/6** · runtime <1s · cost $0.00. | Main contribution identified: **grounding tools + critic**, not the sequence shape. Full trace on every run. |

## Attribution (ablation, computed by `ablation()`)

| Configuration | Rubric | False pages | Wrong-team |
| --- | --- | --- | --- |
| Baseline (regex script) | 23% | 5 | 9 |
| + grounding tools & rules | 89% | 1 | 0 |
| + critic pass | 100% | 0 | 0 |
| + memory | 100% | 0 | 0 |

## Main failure mode & hot take

**Failure mode:** confidence without grounding — the scariest strings
("CRITICAL", "failover", "5xx") produced the worst decisions, because
severity lives in tier, blast radius and schedule, not in the text. The
reverse direction is just as dangerous: the suppression attack (ADV-905)
shows poisoned text can also *silence* a text-reading agent on a real SEV1.

**Hot take:** a triage agent doesn't have to be brilliant; it has to be
*auditable at 3 a.m.* Our most seductive experiment — the LLM severity call —
scored well on average and was useless in production: ±18 points of variance,
no rule to point at, no way to explain a page to the person receiving it.
Reliability is a property of the evidence chain, not the model size. And
once you stop reading prose as instructions, prompt injection stops being a
category of risk you mitigate — it becomes a category you don't have.
