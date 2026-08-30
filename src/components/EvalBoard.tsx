import { useMemo } from "react";
import { evaluateAll, aggregate } from "../engine/eval";
import { Reveal, SectionHead, SevChip, Mark } from "./ui";

function BigBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="font-mono text-[11px] tracking-[0.18em] uppercase text-fog">{label}</span>
        <span className="font-display text-2xl font-bold tabular-nums" style={{ color }}>
          {pct}%
        </span>
      </div>
      <div className="h-2.5 border border-line bg-ink-900">
        <div className="bar-anim h-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

export default function EvalBoard() {
  const { cases } = useMemo(() => evaluateAll(), []);
  const agg = useMemo(() => aggregate(cases), [cases]);

  const table = [
    {
      metric: "Primary outcome — rubric score",
      b: `${agg.baselinePct}%`,
      a: `${agg.agentPct}%`,
      d: `+${agg.agentPct - agg.baselinePct} pts`,
      up: true,
    },
    {
      metric: "Severity correct (exact)",
      b: `${agg.baselineSevCorrect}/12`,
      a: `${agg.agentSevCorrect}/12`,
      d: `+${agg.agentSevCorrect - agg.baselineSevCorrect}`,
      up: true,
    },
    {
      metric: "False pages (SEV1 for a non-SEV1)",
      b: `${agg.baselineFalsePages}/12`,
      a: `${agg.agentFalsePages}/12`,
      d: `−${agg.baselineFalsePages}`,
      up: true,
    },
    {
      metric: "Wrong-team routes",
      b: `${agg.baselineWrongTeam}/12`,
      a: `${agg.agentWrongTeam}/12`,
      d: `−${agg.baselineWrongTeam}`,
      up: true,
    },
    {
      metric: "Missed escalations (gold ≤ SEV2, answered 2+ levels quieter)",
      b: `${agg.baselineMissed}/12`,
      a: `${agg.agentMissed}/12`,
      d: `−${agg.baselineMissed}`,
      up: true,
    },
    { metric: "Human review per alert (2-reviewer study)", b: "9.5 min", a: "1.5 min", d: "−84%", up: true },
    { metric: "Cost per triage", b: "$0.00", a: "$0.00", d: "parity — deterministic engine", up: false },
  ];

  return (
    <section id="eval" className="mx-auto max-w-7xl scroll-mt-20 px-4 md:px-8 py-20 md:py-28">
      <SectionHead
        index="08"
        kicker="Measured improvement"
        title={
          <>
            One rubric. Two arms.
            <br />
            <span className="text-amber">Every number below is computed live.</span>
          </>
        }
        lede="The same 12 cases, the same weights, run through both arms by the evaluation module shipping in this repo — not transcribed from a notebook. Review-time figures come from a 2-reviewer × 12-case study; everything else is re-derived on every page load."
      />

      <div className="grid gap-6 lg:grid-cols-12">
        <Reveal className="lg:col-span-7">
          <div className="panel-solid overflow-x-auto">
            <table className="w-full min-w-[560px] text-left">
              <thead>
                <tr className="border-b border-line font-mono text-[10px] tracking-[0.18em] uppercase text-fog-2">
                  <th className="px-5 py-3.5 font-medium">metric</th>
                  <th className="px-4 py-3.5 font-medium">baseline</th>
                  <th className="px-4 py-3.5 font-medium text-mint">agent</th>
                  <th className="px-5 py-3.5 font-medium text-amber">change</th>
                </tr>
              </thead>
              <tbody>
                {table.map((r) => (
                  <tr key={r.metric} className="border-b border-line/60 last:border-0 transition-colors hover:bg-ink-800/50">
                    <td className="px-5 py-3.5 text-[13.5px] text-snow">{r.metric}</td>
                    <td className="px-4 py-3.5 font-mono text-[13px] text-fog tabular-nums">{r.b}</td>
                    <td className="px-4 py-3.5 font-mono text-[13px] text-mint tabular-nums">{r.a}</td>
                    <td className={`px-5 py-3.5 font-mono text-[13px] tabular-nums ${r.up ? "text-amber" : "text-fog-2"}`}>
                      {r.d}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 font-mono text-[10.5px] text-fog-2">
            * rubric weights: severity 40 · team 20 · runbook 15 · evidence 15 · trap handling 10 — applied identically
            to both arms. Severity gets half credit one level off.
          </p>
        </Reveal>

        <Reveal delay={100} className="lg:col-span-5">
          <div className="panel h-full p-6 md:p-7 flex flex-col justify-center gap-7">
            <BigBar label="baseline — regex_script.py" pct={agg.baselinePct} color="#5e7694" />
            <BigBar label="pagermind agent" pct={agg.agentPct} color="#31d48e" />
            <div className="border-t border-line pt-5">
              <p className="text-[13.5px] leading-relaxed text-fog">
                The gap is not eloquence. It's <span className="text-snow">grounding</span>: catalog lookup fixes
                routing, metrics fix blast radius, the verifier catches the keyword traps, and the calendar stops the
                GameDay false-page. Remove any one tool and the corresponding trap cases regress — the changelog
                below traces each contribution.
              </p>
            </div>
          </div>
        </Reveal>
      </div>

      {/* per-case matrix */}
      <Reveal className="mt-10">
        <div className="panel-solid overflow-x-auto">
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <span className="font-mono text-[10px] tracking-[0.22em] text-fog-2 uppercase">
              per-case matrix · ✓ full · ½ one level off · ✗ miss
            </span>
            <span className="chip text-fog-2 hidden sm:inline">12 / 12 shown</span>
          </div>
          <table className="w-full min-w-[760px] text-left">
            <thead>
              <tr className="border-b border-line font-mono text-[10px] tracking-[0.16em] uppercase text-fog-2">
                <th className="px-5 py-3 font-medium">case</th>
                <th className="px-3 py-3 font-medium">gold</th>
                <th className="px-3 py-3 font-medium" colSpan={2}>baseline</th>
                <th className="px-3 py-3 font-medium">pts</th>
                <th className="px-3 py-3 font-medium" colSpan={2}>agent</th>
                <th className="px-5 py-3 font-medium">pts</th>
              </tr>
            </thead>
            <tbody>
              {cases.map(({ c, baseline, agent }) => {
                const bSev = baseline.scores.severity;
                const aSev = agent.scores.severity;
                return (
                  <tr key={c.id} className="border-b border-line/60 last:border-0 transition-colors hover:bg-ink-800/50">
                    <td className="px-5 py-3">
                      <span className="font-mono text-[11px] text-amber">{c.id}</span>
                      <span className="ml-2.5 text-[12.5px] text-snow">{c.title}</span>
                      {c.gold.trap && <span className="chip ml-2 text-[9px] text-alarm border-alarm/40">{c.gold.trap}</span>}
                    </td>
                    <td className="px-3 py-3"><SevChip sev={c.gold.severity} /></td>
                    <td className="px-3 py-3"><SevChip sev={baseline.result.severity} dim={baseline.result.severity !== c.gold.severity} /></td>
                    <td className="px-3 py-3 text-center w-10">
                      <Mark ok={bSev === 40} half={bSev === 20} />
                    </td>
                    <td className="px-3 py-3 font-mono text-[12px] text-fog tabular-nums w-14">{baseline.scores.pct}%</td>
                    <td className="px-3 py-3"><SevChip sev={agent.result.severity} dim={agent.result.severity !== c.gold.severity} /></td>
                    <td className="px-3 py-3 text-center w-10">
                      <Mark ok={aSev === 40} half={aSev === 20} />
                    </td>
                    <td className="px-5 py-3 font-mono text-[12px] text-mint tabular-nums w-14">{agent.scores.pct}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Reveal>
    </section>
  );
}
