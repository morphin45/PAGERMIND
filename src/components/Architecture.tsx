import { Reveal, SectionHead } from "./ui";
import {
  IconPulse,
  IconCpu,
  IconLayers,
  IconScale,
  IconGate,
  IconMemory,
  IconBook,
  IconClock,
  IconEye,
  IconTerminal,
} from "./icons";

const FlowArrow = () => (
  <svg width="44" height="14" viewBox="0 0 44 14" className="hidden shrink-0 text-line-2 md:block" aria-hidden>
    <line x1="0" y1="7" x2="34" y2="7" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4" className="dash-flow" />
    <path d="M34 2l8 5-8 5z" fill="currentColor" stroke="none" />
  </svg>
);

const STAGES = [
  { icon: IconPulse, name: "Ingest", desc: "raw alert, any source", tone: "#5ab8ff" },
  { icon: IconTerminal, name: "Parser", desc: "extract service, signals, synthetic-source flags", tone: "#5ab8ff" },
  { icon: IconLayers, name: "Tool belt", desc: "catalog · metrics · history · runbook · calendar", tone: "#c792ea" },
  { icon: IconCpu, name: "Rule reasoner", desc: "severity from tool outputs, every rule cited", tone: "#ffb224" },
  { icon: IconScale, name: "Verifier", desc: "cross-checks proposal against evidence", tone: "#ff5d5d" },
  { icon: IconGate, name: "Human gate", desc: "pages & bridges wait for approval", tone: "#31d48e" },
];

const TOOLS = [
  { icon: IconLayers, name: "catalog.lookup", out: "tier · owner · SLO · on-call" },
  { icon: IconEye, name: "metrics.query", out: "err% · p99 · customer impact · revenue" },
  { icon: IconMemory, name: "history.search", out: "similar incidents · precedents · recurrence" },
  { icon: IconBook, name: "runbook.match", out: "playbook + rev, matched on symptoms" },
  { icon: IconClock, name: "calendar.check", out: "drills & maintenance windows" },
];

const CHOICES = [
  {
    t: "Verification is a step, not a vibe",
    d: "The verifier only sees the proposal plus tool outputs — never the raw text that biased the reasoner. That separation is what catches 'CRITICAL log line, zero customer impact'.",
  },
  {
    t: "Memory is search, not summary",
    d: "History returns concrete incidents with outcomes (INC-2163: flag flip recovered in 4 min), not a paraphrase. Recommendations stay traceable to a case a human can open.",
  },
  {
    t: "The gate blocks acts, not proposals",
    d: "The agent always produces a full recommendation. The human gate decides which consequential acts may fire — paging and bridges wait; tickets and audit notes are pre-approved.",
  },
];

export default function Architecture() {
  return (
    <section id="arch" className="mx-auto max-w-7xl scroll-mt-20 px-4 md:px-8 py-20 md:py-28">
      <SectionHead
        index="07"
        kicker="Agent solution & engineering"
        title={
          <>
            Six stages. Five tools.
            <br />
            <span className="text-amber">One rule: show the receipt.</span>
          </>
        }
        lede="Purposeful components only — each one exists because a specific eval case regressed without it. The pipeline shape is deliberately boring; the reliability lives in the grounding."
      />

      <Reveal className="panel p-6 md:p-8 overflow-x-auto">
        <div className="flex min-w-[900px] items-stretch gap-0">
          {STAGES.map((s, i) => (
            <div key={s.name} className="flex items-center">
              <div
                className="panel-solid group w-[150px] shrink-0 p-4 transition-all hover:-translate-y-1 hover:border-line-2"
                style={{ borderTop: `2px solid ${s.tone}` }}
              >
                <s.icon size={18} className="transition-colors" style={{ color: s.tone }} />
                <p className="font-display mt-2.5 text-[15px] font-bold uppercase tracking-wide text-snow">{s.name}</p>
                <p className="mt-1 text-[11px] leading-snug text-fog">{s.desc}</p>
              </div>
              {i < STAGES.length - 1 && <FlowArrow />}
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-px border border-line bg-line md:grid-cols-5">
          {TOOLS.map((t) => (
            <div key={t.name} className="bg-ink-900 p-4 transition-colors hover:bg-ink-800">
              <p className="flex items-center gap-2 font-mono text-[11.5px] text-orchid">
                <t.icon size={14} /> {t.name}
              </p>
              <p className="mt-1.5 text-[11px] leading-snug text-fog">{t.out}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 font-mono text-[10.5px] text-fog-2">
          ↑ the tool belt feeds the reasoner; the verifier may call calendar.check when the evidence contradicts the
          proposal (see INC-2209).
        </p>
      </Reveal>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {CHOICES.map((c, i) => (
          <Reveal key={c.t} delay={i * 80} className="panel p-6 transition-colors hover:border-line-2">
            <p className="font-mono text-[10px] tracking-[0.22em] text-amber uppercase">design choice {i + 1}</p>
            <h3 className="font-display mt-2.5 text-lg font-bold uppercase tracking-wide text-snow">{c.t}</h3>
            <p className="mt-2 text-[13.5px] leading-relaxed text-fog">{c.d}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
