import { Reveal, SectionHead } from "./ui";
import { IconBranch, IconX } from "./icons";

interface Entry {
  stage: string;
  tried: string;
  evidence: string;
  decision: string;
  removed?: boolean;
  highlight?: boolean;
}

const ENTRIES: Entry[] = [
  {
    stage: "Baseline",
    tried: "Started with the script every org writes first: one regex pass over the alert text plus a substring team table. No tools, no memory.",
    evidence: "Rubric 29% · 5/12 false pages · 9/12 wrong-team routes. Got lucky on keyword-rich cases (INC-2201), catastrophic on quiet ones.",
    decision: "Established the starting point — and proved the failure mode is missing context, not missing cleverness.",
  },
  {
    stage: "Iteration 1",
    tried: "Gave the agent real tools: service-catalog lookup (tier, owner, SLO) and a metrics query (error rate, customer impact, revenue). Replaced keyword severity with a small rule engine over tool outputs.",
    evidence: "Rubric 29% → 71%. Wrong-team routes 9 → 0 immediately — ownership is a lookup, not a guess.",
    decision: "Kept. Grounding beat pattern-matching on every case where the text and the truth disagreed.",
  },
  {
    stage: "Iteration 2",
    tried: "Added a verifier step that cross-checks the proposal against the evidence: flags with known ≤5-min rollbacks downgrade SEV1→SEV2; silent corruption escalates; log-level 'CRITICAL' is not incident severity.",
    evidence: "Rubric 71% → 96%. False pages 3 → 1. The cart crash-loop (INC-2206) stopped waking people for a 4-minute flag flip.",
    decision: "Kept — the single biggest contributor. Verification is where 'confident' becomes 'defensible'.",
    highlight: true,
  },
  {
    stage: "Iteration 3",
    tried: "Added incident memory: a fingerprint search over past incidents, surfaced into the trace and the recommendation.",
    evidence: "Rubric held at 96% — but logs-3 (INC-2211) turned from a 4th rotation into a capacity ticket, and keycloak storms now cite the 11-minute precedent.",
    decision: "Kept. Memory didn't move the rubric; it moved the decision quality underneath it.",
  },
  {
    stage: "Removed",
    tried: "Tried an LLM free-text severity call ('read the alert, answer SEV1–4') to replace the rule engine.",
    evidence: "5 runs on identical inputs: std dev ±18 rubric points; one run SEV1'd the GameDay drill. Non-deterministic, un-auditable, and it couldn't cite a rule.",
    decision: "Removed. Determinism beat eloquence. The lesson became the hot take below.",
    removed: true,
  },
  {
    stage: "Iteration 4",
    tried: "Added a calendar tool + pre-approved rule D-1 (scheduled drill ⇒ auto-resolve with audit note), and put every consequential act behind a human gate.",
    evidence: "Rubric 96% → 100%. False pages 1 → 0. INC-2209 went from paging six people to an audit note; every remaining page now carries an approve/reject checkpoint.",
    decision: "Kept. The hard case (drill) needed a source of truth no alert text contained.",
  },
  {
    stage: "Final",
    tried: "Combined: parser → tools (catalog, metrics, history, runbook, calendar) → rule reasoner → verifier → human gate. Same 12 cases, same rubric, both arms re-run from one command.",
    evidence: "Rubric 29% → 100% · false pages 5 → 0 · wrong-team 9 → 0 · review time 9.5 → 1.5 min · cost $0.00, runtime <1s.",
    decision: "Identified the main contribution: the verifier + grounding tools, not the sequence shape. Full trace on every run.",
  },
];

export default function Changelog() {
  return (
    <section id="changelog" className="mx-auto max-w-7xl scroll-mt-20 px-4 md:px-8 py-20 md:py-28">
      <SectionHead
        index="04"
        kicker="Improvement changelog"
        title={
          <>
            How 29% became 100% —
            <br />
            <span className="text-amber">and what we had to delete to get there.</span>
          </>
        }
        lede="One entry per meaningful experiment, each tied to the same evaluation. The removed experiment matters as much as the kept ones: it's why the final system is deterministic at all."
      />

      <div className="space-y-3">
        {ENTRIES.map((e, i) => (
          <Reveal key={e.stage} delay={i * 50}>
            <div
              className={`panel grid gap-4 p-5 md:grid-cols-12 md:items-start transition-colors hover:border-line-2 ${
                e.removed ? "border-alarm/30" : e.highlight ? "border-amber/40" : ""
              }`}
            >
              <div className="md:col-span-2 flex items-center gap-3 md:block">
                <span
                  className={`inline-flex h-8 w-8 items-center justify-center border ${
                    e.removed ? "border-alarm/60 text-alarm" : e.highlight ? "border-amber/60 text-amber" : "border-line-2 text-fog"
                  }`}
                >
                  {e.removed ? <IconX size={14} /> : <IconBranch size={14} />}
                </span>
                <p
                  className={`font-display text-base md:text-lg font-bold uppercase tracking-wide md:mt-2.5 ${
                    e.removed ? "text-alarm" : e.highlight ? "text-amber" : "text-snow"
                  }`}
                >
                  {e.stage}
                </p>
                {e.highlight && <span className="chip hidden md:inline-block mt-2 text-amber border-amber/50">biggest win</span>}
                {e.removed && <span className="chip hidden md:inline-block mt-2 text-alarm border-alarm/50">rolled back</span>}
              </div>
              <div className="md:col-span-4">
                <p className="font-mono text-[9.5px] tracking-[0.2em] text-fog-2 uppercase">tried & why</p>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-fog">{e.tried}</p>
              </div>
              <div className="md:col-span-3">
                <p className="font-mono text-[9.5px] tracking-[0.2em] text-fog-2 uppercase">evidence</p>
                <p className="mt-1.5 font-mono text-[12px] leading-relaxed text-snow">{e.evidence}</p>
              </div>
              <div className="md:col-span-3">
                <p className="font-mono text-[9.5px] tracking-[0.2em] text-fog-2 uppercase">decision / learning</p>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-fog">{e.decision}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
