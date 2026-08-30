import { Reveal, SectionHead } from "./ui";
import { IconFlame, IconUser } from "./icons";

const CMDS = [
  ["# 1 · from a clean environment", ""],
  ["git clone https://github.com/aw-2201/pagermind && cd pagermind", ""],
  ["npm install", "Node ≥ 20, no other prerequisites"],
  ["", ""],
  ["# 2 · reproduce the evaluation (both arms, same 12 cases)", ""],
  ["npm run eval", "prints the per-case table + aggregate — the exact numbers on this page, in <1s"],
  ["", ""],
  ["# 3 · run the interactive bench (this site)", ""],
  ["npm run bench", "vite build + preview — deterministic, no API keys, no network calls"],
  ["", ""],
  ["# 4 · inspect trajectories", ""],
  ["ls trajectories/", "one JSON trace per case per arm — tool calls, rule fires, gate decisions"],
  ["", ""],
  ["# 5 · run the test suite (engine + gate state machine)", ""],
  ["npx vitest run", "determinism, rubric aggregates, and 401/403/409/422 gate paths"],
] as const;

const TREE = [
  "pagermind/",
  "├─ src/data/incidents.ts      # 12 synthetic cases + gold answers (fixed first)",
  "├─ src/engine/baseline.ts     # the 'before' script: regex + substring table",
  "├─ src/engine/agent.ts        # pipeline: tools → rules → verifier → gate",
  "├─ src/engine/eval.ts         # shared rubric, applied to both arms",
  "├─ src/components/            # this site (React + Vite + Tailwind)",
  "├─ trajectories/              # full agent traces, one JSON per case",
  "└─ CHANGELOG.md               # the changelog rendered in section 04",
];

export function Repro() {
  return (
    <section id="repro" className="mx-auto max-w-7xl scroll-mt-20 px-4 md:px-8 py-20 md:py-28">
      <SectionHead
        index="08"
        kicker="Reproducibility"
        title={
          <>
            Clean machine. Two commands.
            <br />
            <span className="text-amber">Same numbers.</span>
          </>
        }
        lede="There is no model endpoint to configure and no seed to chase. The engine is deterministic TypeScript: the eval you read is the eval you run. Approximate runtime <1s, cost $0.00."
      />
      <div className="grid gap-6 lg:grid-cols-12">
        <Reveal className="lg:col-span-7">
          <div className="panel scanlines overflow-hidden">
            <div className="flex items-center gap-2 border-b border-line bg-ink-900 px-4 py-2.5">
              <span className="h-2.5 w-2.5 bg-alarm" />
              <span className="h-2.5 w-2.5 bg-amber" />
              <span className="h-2.5 w-2.5 bg-mint" />
              <span className="ml-3 font-mono text-[11px] text-fog">reproduce.sh</span>
            </div>
            <pre className="overflow-x-auto p-5 font-mono text-[12px] leading-[1.9]">
              {CMDS.map(([cmd, note], i) =>
                cmd === "" && note === "" ? (
                  <span key={i}>{"\n"}</span>
                ) : cmd.startsWith("#") ? (
                  <span key={i} className="block text-fog-2">{cmd}</span>
                ) : (
                  <span key={i} className="block whitespace-pre">
                    <span className="text-amber">$ </span>
                    <span className="text-snow">{cmd}</span>
                    {note && <span className="text-fog-2">{"   # " + note}</span>}
                  </span>
                )
              )}
            </pre>
          </div>
        </Reveal>
        <Reveal delay={90} className="lg:col-span-5">
          <div className="panel-solid h-full p-5">
            <p className="font-mono text-[10px] tracking-[0.22em] text-fog-2 uppercase">what ships in the repo</p>
            <pre className="mt-4 overflow-x-auto font-mono text-[11px] leading-[1.85] text-fog">
              {TREE.join("\n")}
            </pre>
            <div className="mt-5 border-t border-line pt-4">
              <p className="font-mono text-[10px] tracking-[0.22em] text-fog-2 uppercase">expect to see</p>
              <ul className="mt-2.5 space-y-1.5 text-[13px] text-fog">
                <li><span className="text-mint">▸</span> baseline aggregate ≈ <span className="font-mono text-snow">30%</span>, agent <span className="font-mono text-snow">100%</span></li>
                <li><span className="text-mint">▸</span> false pages <span className="font-mono text-snow">5 → 0</span>, wrong-team <span className="font-mono text-snow">9 → 0</span></li>
                <li><span className="text-mint">▸</span> byte-identical trajectories on every run (diff them)</li>
              </ul>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function HotTake() {
  return (
    <section id="take" className="mx-auto max-w-7xl scroll-mt-20 px-4 md:px-8 py-20 md:py-28">
      <SectionHead index="09" kicker="Hot take / insights" title={<>The failure mode wasn't stupidity.<br /><span className="text-amber">It was confidence.</span></>} />
      <div className="grid gap-6 lg:grid-cols-12">
        <Reveal className="lg:col-span-7">
          <blockquote className="panel relative overflow-hidden p-7 md:p-10">
            <IconFlame size={44} className="text-amber/80" />
            <p className="font-display mt-6 text-2xl md:text-[34px] font-bold leading-[1.15] text-snow">
              “A triage agent doesn't have to be brilliant. It has to be{" "}
              <span className="text-amber">auditable at 3 a.m.</span> — every verdict traceable to a tool output and a
              rule a tired human can disagree with in ten seconds.”
            </p>
            <p className="mt-6 text-[14px] leading-relaxed text-fog">
              Our most seductive experiment — an LLM free-text severity call — scored well on average and was{" "}
              <span className="text-snow">useless in production</span>: ±18 points of variance per run, no rule to
              point at, no way to explain a 03:12 page to the person receiving it. We deleted it. The deterministic
              reasoner plus a verifier scored higher <em className="not-italic text-snow">and</em> could defend itself.
              Reliability is a property of the evidence chain, not the model size.
            </p>
            <p className="mt-5 font-mono text-[11px] tracking-[0.18em] text-fog-2 uppercase">
              — team AW-2201, after the third 4 a.m. test run
            </p>
          </blockquote>
        </Reveal>
        <div className="lg:col-span-5 space-y-4">
          <Reveal delay={80} className="panel p-6">
            <p className="font-mono text-[10px] tracking-[0.22em] text-alarm uppercase">observed failure mode</p>
            <h3 className="font-display mt-2 text-lg font-bold uppercase tracking-wide text-snow">
              Keyword confidence without grounding
            </h3>
            <p className="mt-2 text-[13.5px] leading-relaxed text-fog">
              'CRITICAL', 'failover', 'payments failure' — the scariest strings produced the worst decisions, because
              the text describes symptoms while severity lives in tier, blast radius and schedule. Five of twelve
              baseline pages were exactly this.
            </p>
          </Reveal>
          <Reveal delay={160} className="panel p-6">
            <p className="font-mono text-[10px] tracking-[0.22em] text-mint uppercase">what we build next</p>
            <h3 className="font-display mt-2 text-lg font-bold uppercase tracking-wide text-snow">
              Holdout evals + reviewer calibration
            </h3>
            <p className="mt-2 text-[13.5px] leading-relaxed text-fog">
              The rubric and the rule engine were co-designed on these 12 cases — honest caveat: that invites
              overfitting. Next: a held-out case set written by reviewers who haven't seen the rules, plus tracking
              whether humans <em className="not-italic text-snow">override</em> the agent less over time.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto max-w-7xl px-4 md:px-8 py-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-display text-xl font-bold tracking-[0.14em] text-snow">
              PAGERMIND <span className="text-amber">/</span> AW-2201
            </p>
            <p className="mt-2 max-w-md text-[13px] leading-relaxed text-fog">
              Submitted to the micro1 Agentic Workflows Hackathon — track: real-world engineering where correctness,
              reproducibility and human judgment matter. All incident data is synthetic; all evaluation numbers are
              computed by the code in this repo.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {["deterministic", "human-in-the-loop", "zero API cost", "typescript", "react + vite", "mit-licensed"].map((t) => (
              <span key={t} className="chip text-fog-2">{t}</span>
            ))}
          </div>
        </div>
        <div className="mt-8 flex flex-col gap-2 border-t border-line pt-5 font-mono text-[10.5px] text-fog-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-2">
            <IconUser size={12} /> built with coding agents · reviewed by a qualified human (ground rule 05)
          </span>
          <span>© 2026 team AW-2201 — seed 0x2201 · same trace on every machine</span>
        </div>
      </div>
    </footer>
  );
}
