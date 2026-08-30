import { useMemo, useState } from "react";
import { ADVERSARIAL, CASES, sevColor, type IncidentCase } from "../data/cases";
import {
  ablation,
  adversarialSuite,
  aggregate,
  buildBrief,
  buildPostmortem,
  evaluateAll,
  runAgent,
  runBaseline,
  type CaseEval,
} from "../engine/engine";
import { CORRELATED } from "../data/cases";
import { validateDecision } from "../backend/backend";
import { copyText, downloadFile, Mark, Reveal, SectionHead, SevChip, useCountUp, usePlayer, useToasts, IconAlert, IconBook, IconBranch, IconCheck, IconDownload, IconFlame, IconGate, IconMemory, IconReplay, IconShield, IconTerminal, IconUser, IconX } from "./ui";

/* ================= PROBLEM — editorial, not cards ================= */

const QUESTIONS = [
  {
    n: "01",
    q: "Who has this problem?",
    a: "On-call engineers and the SRE teams behind them — the people whose sleep and whose customers depend on one question answered correctly at 3 a.m.: is this real, how bad is it, and whose problem is it?",
  },
  {
    n: "02",
    q: "What's the bottleneck?",
    a: "Severity doesn't live in the alert text. It lives in service tier, blast radius, revenue exposure, deploy state and the change calendar. Triage from prose alone fails in both directions: it wakes six people for a scheduled drill, and files silent data corruption as noise.",
  },
  {
    n: "03",
    q: "Why does solving it matter?",
    a: "Every false page trains the team to distrust the pager. Every missed escalation extends an outage. Every page that can't be explained corrodes the on-call contract — and regulators are starting to ask for the explanation in writing.",
  },
  {
    n: "04",
    q: "Can anyone reproduce it?",
    a: "Clean machine, two commands, under a second, zero dollars. The engine is a pure function: same incident in, byte-identical trace out — on your laptop, in CI, or in front of the judges.",
  },
];

export function Problem({ agg }: { agg: ReturnType<typeof aggregate> }) {
  return (
    <section id="problem" className="mx-auto max-w-7xl scroll-mt-20 px-4 md:px-8 py-20 md:py-28">
      <SectionHead
        index="06"
        kicker="Problem & user value"
        title={
          <>
            The pager fires at 03:12.
            <br />
            <span className="text-amber">Context is the bottleneck.</span>
          </>
        }
      />
      <div className="space-y-2">
        {QUESTIONS.map((item, i) => (
          <Reveal key={item.n} delay={i * 60}>
            <div className="group grid gap-4 border border-line bg-ink-900/40 px-5 py-6 transition-all hover:border-line-2 hover:bg-ink-800/60 md:grid-cols-12 md:items-baseline md:px-8">
              <span className="font-display text-4xl font-bold text-line-2 transition-colors group-hover:text-amber md:col-span-2 md:text-6xl">{item.n}</span>
              <h3 className="font-display text-xl font-bold uppercase tracking-wide text-snow md:col-span-4 md:text-2xl">{item.q}</h3>
              <p className="text-[14px] leading-relaxed text-fog md:col-span-6">{item.a}</p>
            </div>
          </Reveal>
        ))}
      </div>
      <Reveal delay={120}>
        <div className="mt-6 grid grid-cols-2 gap-px border border-line bg-line md:grid-cols-4">
          {[
            ["rubric score", `${agg.baselinePct}%`, `${agg.agentPct}%`],
            ["false pages", String(agg.baselineFalsePages), String(agg.agentFalsePages)],
            ["wrong-team routes", String(agg.baselineWrongTeam), String(agg.agentWrongTeam)],
            ["missed criticals", String(agg.baselineMissed), String(agg.agentMissed)],
          ].map(([k, b, a]) => (
            <div key={k} className="bg-ink-900 px-4 py-4">
              <p className="font-mono text-[9px] tracking-[0.2em] text-fog-2 uppercase">{k}</p>
              <p className="font-display mt-1 text-xl font-bold tabular-nums text-fog-2">
                {b} <span className="text-fog-2">→</span> <span className="text-mint">{a}</span>
              </p>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

/* ================= BENCH ================= */

function Match({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${ok ? "text-mint" : "text-alarm"}`}>
      {ok ? <IconCheck size={12} /> : <IconX size={12} />}
      {children}
    </span>
  );
}

export function Bench() {
  const [selectedId, setSelectedId] = useState("INC-2209");
  const [runId, setRunId] = useState(0);
  const { push } = useToasts();

  const c = useMemo(() => CASES.find((x) => x.id === selectedId) as IncidentCase, [selectedId]);
  const baseline = useMemo(() => runBaseline(c), [c]);
  const agent = useMemo(() => runAgent(c), [c]);
  const { visible, done } = usePlayer(agent.steps.length, runId + selectedId.length, 360);

  const rows = [
    ["severity", baseline.severity, agent.severity, c.gold.severity],
    ["team", baseline.team, agent.team, c.gold.team],
    ["runbook", baseline.runbook ?? "—", `${agent.runbook.id} · ${agent.runbook.title}`, `${c.runbook.id} · ${c.runbook.title}`],
    ["pages a human?", String(baseline.page), String(agent.page), String(c.gold.severity === "SEV1" || c.gold.severity === "SEV2")],
  ] as const;

  return (
    <section id="bench" className="mx-auto max-w-7xl scroll-mt-20 px-4 md:px-8 py-20 md:py-28">
      <SectionHead
        index="07"
        kicker="Live bench — baseline vs agent"
        title={
          <>
            Same 12 cases. Same rubric.
            <br />
            <span className="text-amber">Two very different nights on-call.</span>
          </>
        }
        lede="Pick an incident. The baseline is a regex script — the honest 'before' picture. The agent runs its full pipeline; every step of the trace is the evidence it will be judged on."
      />
      <div className="grid gap-6 lg:grid-cols-12">
        <Reveal className="lg:col-span-4">
          <div className="panel-solid">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="font-mono text-[10px] tracking-[0.22em] text-fog-2 uppercase">evaluation set · 12</span>
              <span className="chip text-fog-2">fixed seed</span>
            </div>
            <ul className="max-h-[520px] overflow-y-auto">
              {CASES.map((x) => (
                <li key={x.id}>
                  <button onClick={() => { setSelectedId(x.id); setRunId((r) => r + 1); }} className={`case-row w-full px-4 py-3 text-left ${x.id === selectedId ? "active" : ""}`}>
                    <span className="flex items-center gap-2.5">
                      <span className={`font-mono text-[11px] ${x.id === selectedId ? "text-amber" : "text-fog-2"}`}>{x.id}</span>
                      <span className="font-mono text-[10px] text-fog-2">{x.time}</span>
                      {x.gold.trap && x.gold.trap !== "control" && <span className="chip ml-auto border-alarm/40 text-[9px] text-alarm">{x.gold.trap}</span>}
                    </span>
                    <span className="mt-1 block text-[13px] font-medium leading-snug text-snow">{x.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
        <div className="space-y-4 lg:col-span-8">
          <Reveal className="panel p-4 md:p-5">
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <span className="font-mono text-[10px] tracking-[0.22em] text-fog-2 uppercase">raw alert · as paged</span>
              <span className="chip text-fog-2">{c.id}</span>
              <span className="chip text-fog-2">{c.source}</span>
              <span className="chip ml-auto text-fog-2">{c.service}</span>
            </div>
            <pre className="whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-snow">{c.alertText.join("\n")}</pre>
          </Reveal>
          <div className="grid gap-4 md:grid-cols-2">
            <Reveal className="panel-solid flex flex-col">
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <span className="font-mono text-[10px] tracking-[0.2em] text-fog uppercase">BASELINE · <span className="text-fog-2">regex_script</span></span>
                <span className="chip text-fog-2">no tools</span>
              </div>
              <div className="space-y-2.5 p-4 font-mono text-[12px]">
                <p className="text-fog-2"><span className="text-fog">how it decided:</span> {baseline.how}</p>
                <p className="flex items-center gap-2"><span className="w-14 text-[10px] uppercase tracking-[0.18em] text-fog-2">sev</span><SevChip sev={baseline.severity} /></p>
                <p className="flex gap-2"><span className="w-14 shrink-0 text-[10px] uppercase tracking-[0.18em] text-fog-2">team</span><span className="text-snow">{baseline.team}</span></p>
                <p className="flex gap-2"><span className="w-14 shrink-0 text-[10px] uppercase tracking-[0.18em] text-fog-2">action</span>
                  <span className={baseline.page ? "text-alarm" : "text-snow"}>{baseline.action}{baseline.page && <span className="chip ml-2 border-alarm/40 text-alarm">pages a human</span>}</span>
                </p>
              </div>
              <div className="mt-auto border-t border-line px-4 py-2.5">
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-fog-2">evidence: <span className="text-alarm">none — keywords only</span></span>
              </div>
            </Reveal>
            <Reveal delay={80} className="panel-solid flex flex-col border-mint/25">
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <span className="font-mono text-[10px] tracking-[0.2em] text-mint uppercase">PAGERMIND AGENT</span>
                <span className="chip text-fog-2">{visible}/{agent.steps.length} steps</span>
              </div>
              <div className="p-4">
                <ol className="min-h-[170px] space-y-1.5 font-mono text-[11px] leading-relaxed">
                  {agent.steps.slice(0, visible).map((s, i) => (
                    <li key={`${runId}-${i}`} className="step-in flex gap-2">
                      <span className="chip shrink-0 self-start px-1.5 py-0.5 text-[8.5px]" style={{ color: s.kind === "sanitize" || s.kind === "verify" ? "#ff5d5d" : s.kind === "memory" ? "#c792ea" : s.kind === "reason" ? "#ffb224" : s.kind === "gate" ? "#31d48e" : "#5ab8ff", borderColor: "#2a405f" }}>
                        {s.kind.slice(0, 4).toUpperCase()}
                      </span>
                      <span className="min-w-0"><span className="text-snow">{s.label}</span><span className="block break-words text-fog-2">{s.detail}</span></span>
                    </li>
                  ))}
                  {!done && (
                    <li className="flex items-center gap-2 text-fog-2">
                      <span className="cursor-blink inline-block h-3 w-1.5 bg-mint" />
                      <span className="text-[9px] tracking-[0.2em] uppercase">working…</span>
                    </li>
                  )}
                </ol>
                {done && (
                  <div className="step-in mt-3 space-y-2 border-t border-line pt-3 font-mono text-[12px]">
                    <p className="flex items-center gap-2">
                      <span className="w-14 text-[10px] uppercase tracking-[0.18em] text-fog-2">sev</span>
                      <SevChip sev={agent.severity} />
                      {agent.adjustment && <span className="chip border-lemon/40 text-lemon">{agent.adjustment} by critic</span>}
                      <span className="ml-auto text-fog-2">conf {agent.confidence.toFixed(2)}</span>
                    </p>
                    <p className="flex gap-2"><span className="w-14 shrink-0 text-[10px] uppercase tracking-[0.18em] text-fog-2">team</span><span className="text-snow">{agent.team}</span></p>
                    <p className="flex gap-2"><span className="w-14 shrink-0 text-[10px] uppercase tracking-[0.18em] text-fog-2">action</span><span className="text-mint">{agent.action}</span></p>
                    <ul className="space-y-1 border-t border-line pt-2">
                      {agent.evidence.map((e) => (
                        <li key={e} className="flex gap-2 text-[10.5px] text-fog"><span className="text-mint">▸</span>{e}</li>
                      ))}
                    </ul>
                    <button className="btn mt-1 w-full justify-center py-1.5" onClick={async () => (await copyText(buildBrief(c, agent))) ? push("ok", "handoff brief copied") : push("err", "clipboard unavailable")}>
                      copy handoff brief
                    </button>
                  </div>
                )}
              </div>
              <div className="mt-auto flex items-center gap-2 border-t border-line px-4 py-2.5">
                <IconGate size={13} className={agent.page ? "text-amber" : "text-mint"} />
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-fog-2">
                  {agent.page ? "human approval required before page fires" : "non-consequential — pre-approved automation"}
                </span>
              </div>
            </Reveal>
          </div>
          <Reveal className="panel-solid">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="font-mono text-[10px] tracking-[0.22em] text-fog-2 uppercase">verdict vs gold answer (fixed before the agent rules were written)</span>
              <IconBook size={14} className="text-amber" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left font-mono text-[11.5px]">
                <thead>
                  <tr className="border-b border-line text-[10px] uppercase tracking-[0.18em] text-fog-2">
                    <th className="w-28 px-4 py-2.5 font-medium">criterion</th>
                    <th className="px-4 py-2.5 font-medium">baseline</th>
                    <th className="px-4 py-2.5 font-medium">agent</th>
                    <th className="px-4 py-2.5 font-medium text-amber">gold</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(([label, b, a, g]) => (
                    <tr key={label} className="border-b border-line/60 align-top last:border-0">
                      <td className="px-4 py-2.5 text-[10px] uppercase tracking-[0.18em] text-fog-2">{label}</td>
                      <td className="px-4 py-2.5"><Match ok={String(b) === String(g)}><span className={String(b) === String(g) ? "text-snow" : "text-alarm"}>{b}</span></Match></td>
                      <td className="px-4 py-2.5"><Match ok={String(a) === String(g)}><span className={String(a) === String(g) ? "text-snow" : "text-alarm"}>{a}</span></Match></td>
                      <td className="px-4 py-2.5 text-amber">{g}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-amber/25 bg-amber/5 px-4 py-3.5">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber">why this case is in the set</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-fog">{c.gold.trapNote}</p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ================= EVAL BOARD ================= */

function BigStat({ label, from, to, suffix, tone }: { label: string; from: number; to: number; suffix?: string; tone: string }) {
  const [active, setActive] = useState(false);
  const ref = useMemo(() => ({ current: null as HTMLDivElement | null }), []);
  const to2 = useCountUp(to, active);
  return (
    <div
      ref={(el) => {
        ref.current = el;
        if (el && !active) {
          const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setActive(true); io.disconnect(); } }, { threshold: 0.3 });
          io.observe(el);
        }
      }}
      className="border border-line bg-ink-900/60 px-5 py-4 transition-all hover:border-line-2"
    >
      <p className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-fog-2">{label}</p>
      <p className="font-display mt-1.5 text-3xl font-bold tabular-nums">
        <span className="text-fog-2">{from}{suffix}</span>
        <span className="text-fog-2"> → </span>
        <span style={{ color: tone }}>{to2}{suffix}</span>
      </p>
    </div>
  );
}

export function EvalBoard() {
  const { cases } = useMemo(() => evaluateAll(), []);
  const agg = useMemo(() => aggregate(cases), [cases]);
  const cats = ["severity", "team", "runbook", "evidence", "trap"] as const;
  const totals = (arm: "baseline" | "agent") =>
    cats.map((k) => cases.reduce((s, e) => s + e[arm].scores[k], 0));
  const maxTotals = cats.map((_, i) => cases.reduce((s, e) => s + (i === 0 ? 40 : i === 1 ? 20 : i === 2 ? 15 : i === 3 ? 15 : 10), 0));
  const bT = totals("baseline");
  const aT = totals("agent");
  const catColors = ["#ff5d5d", "#ffb224", "#5ab8ff", "#c792ea", "#31d48e"];

  return (
    <section id="eval" className="mx-auto max-w-7xl scroll-mt-20 px-4 md:px-8 py-20 md:py-28">
      <SectionHead
        index="08"
        kicker="Measured improvement"
        title={<>The scoreboard — <span className="text-amber">computed, not claimed.</span></>}
        lede="One rubric, both arms, identical cases. Every number on this page is produced by src/engine/engine.ts at render time; the acceptance audit in the next section re-proves it in your browser."
      />
      <Reveal>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <BigStat label="rubric score" from={agg.baselinePct} to={agg.agentPct} suffix="%" tone="#31d48e" />
          <BigStat label="false pages" from={agg.baselineFalsePages} to={agg.agentFalsePages} tone="#31d48e" />
          <BigStat label="wrong-team routes" from={agg.baselineWrongTeam} to={agg.agentWrongTeam} tone="#31d48e" />
          <BigStat label="missed criticals" from={agg.baselineMissed} to={agg.agentMissed} tone="#31d48e" />
        </div>
      </Reveal>
      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        <Reveal className="lg:col-span-7">
          <div className="panel-solid">
            <div className="border-b border-line px-4 py-3">
              <span className="font-mono text-[10px] tracking-[0.22em] text-fog-2 uppercase">per-case rubric · baseline vs agent</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left font-mono text-[11px]">
                <thead>
                  <tr className="border-b border-line text-[9.5px] uppercase tracking-[0.18em] text-fog-2">
                    <th className="px-4 py-2 font-medium">case</th>
                    <th className="px-3 py-2 font-medium">gold</th>
                    <th className="px-3 py-2 font-medium">baseline</th>
                    <th className="px-3 py-2 font-medium">agent</th>
                    <th className="px-4 py-2 font-medium">baseline / agent</th>
                  </tr>
                </thead>
                <tbody>
                  {cases.map((e: CaseEval) => (
                    <tr key={e.c.id} className="border-b border-line/60 transition-colors last:border-0 hover:bg-ink-800/50">
                      <td className="px-4 py-2">
                        <span className="text-snow">{e.c.id}</span>
                        {e.c.gold.trap && e.c.gold.trap !== "control" && <span className="chip ml-2 border-alarm/40 text-[8.5px] text-alarm">{e.c.gold.trap}</span>}
                      </td>
                      <td className="px-3 py-2"><SevChip sev={e.c.gold.severity} /></td>
                      <td className="px-3 py-2"><SevChip sev={e.baseline.result.severity} dim={e.baseline.result.severity === e.c.gold.severity} /></td>
                      <td className="px-3 py-2"><SevChip sev={e.agent.result.severity} dim={e.agent.result.severity === e.c.gold.severity} /></td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 bg-ink-950"><div className="h-full bg-fog-2" style={{ width: `${e.baseline.scores.pct}%` }} /></div>
                          <div className="h-1.5 w-16 bg-ink-950"><div className="h-full bg-mint" style={{ width: `${e.agent.scores.pct}%` }} /></div>
                          <span className="tabular-nums text-fog-2">{e.baseline.scores.pct} / <span className="text-mint">{e.agent.scores.pct}</span></span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Reveal>
        <Reveal delay={90} className="lg:col-span-5">
          <div className="panel-solid h-full p-5">
            <p className="font-mono text-[10px] tracking-[0.22em] text-fog-2 uppercase">points by category (12 cases)</p>
            <div className="mt-5 space-y-5">
              {cats.map((k, i) => (
                <div key={k}>
                  <div className="mb-1.5 flex items-baseline justify-between">
                    <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-fog">{k}</span>
                    <span className="font-mono text-[10.5px] tabular-nums text-fog-2">{bT[i]} → <span className="text-mint">{aT[i]}</span> / {maxTotals[i]}</span>
                  </div>
                  <div className="space-y-1">
                    <div className="h-2 bg-ink-950"><div className="bar-anim h-full bg-fog-2/70" style={{ width: `${(bT[i] / maxTotals[i]) * 100}%` }} /></div>
                    <div className="h-2 bg-ink-950"><div className="bar-anim h-full" style={{ width: `${(aT[i] / maxTotals[i]) * 100}%`, background: catColors[i] }} /></div>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-6 border-t border-line pt-4 font-mono text-[10.5px] leading-relaxed text-fog-2">
              Baseline scores zero on runbook and evidence by construction — it cites neither. Its severity points come
              from the five keyword-lucky cases; its team points from four substrings.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ================= EVIDENCE — attribution + live audit ================= */

interface Check { id: string; label: string; detail: string; pass: boolean }

function runAudit(): { checks: Check[]; tookMs: number } {
  const t0 = performance.now();
  const checks: Check[] = [];
  const push = (id: string, label: string, detail: string, pass: boolean) => checks.push({ id, label, detail, pass });

  let deterministic = true;
  for (const c of CASES) if (JSON.stringify(runAgent(c).steps) !== JSON.stringify(runAgent(c).steps)) deterministic = false;
  push("det", "determinism", "runAgent twice on all 12 cases — byte-identical traces", deterministic);

  const { cases } = evaluateAll();
  const goldOk = cases.every((e) => e.agent.result.severity === e.c.gold.severity && e.agent.result.team === e.c.gold.team && e.agent.result.runbook.id === e.c.runbook.id);
  push("gold", "gold conformance", "agent severity + team + runbook match the human-fixed gold answer ×12", goldOk);

  const agg = aggregate(cases);
  push("agg", "headline aggregates", `rubric ${agg.baselinePct}% → ${agg.agentPct}% · false pages ${agg.baselineFalsePages} → ${agg.agentFalsePages} · wrong-team ${agg.baselineWrongTeam} → ${agg.agentWrongTeam}`,
    agg.baselinePct === 23 && agg.agentPct === 100 && agg.baselineFalsePages === 5 && agg.agentFalsePages === 0 && agg.baselineWrongTeam === 9 && agg.agentWrongTeam === 0);

  const lad = ablation().map((s) => s.pct);
  push("abl", "attribution ladder", `ablation computes [${lad.join(", ")}] — tools carry the weight, critic closes the traps`, lad[0] === 23 && lad[1] === 89 && lad[2] === 100 && lad[3] === 100);

  const red = adversarialSuite();
  push("red", "red team resistance", `agent resists ${red.agentResisted}/6 poisoned alerts; baseline ${red.baselineResisted}/6`, red.agentResisted === 6 && red.baselineResisted === 0);

  const storm = runAgent(CORRELATED);
  push("storm", "storm correlation", "BURST-7742 triages to its gold (SEV1 · team-checkout) with memory recall", storm.severity === CORRELATED.gold.severity && storm.team === CORRELATED.gold.team && !!storm.memoryNote);

  const docA = buildPostmortem(CORRELATED, storm, "2026-02-15T03:50:00.000Z");
  const docB = buildPostmortem(CORRELATED, storm, "2026-02-15T03:50:00.000Z");
  push("pm", "postmortem determinism", "same evidence + same clock → byte-identical document", docA === docB && docA.includes("BURST-7742"));

  const bad = validateDecision({ decision: "maybe", reason: "" });
  const noReason = validateDecision({ decision: "reject", reason: "no" });
  const good = validateDecision({ decision: "approve", reason: "verified against RB-114" });
  push("val", "boundary validation", "invalid decision and reason-less reject both refused; well-formed approve accepted", !bad.ok && !noReason.ok && good.ok);

  return { checks, tookMs: Math.round(performance.now() - t0) };
}

function exportTrajectories() {
  const runs = [...CASES, CORRELATED, ...ADVERSARIAL].flatMap((c) => {
    const b = runBaseline(c);
    const a = runAgent(c);
    return [
      { case: c.id, title: c.title, arm: "baseline", input: c.alertText, verdict: { severity: b.severity, team: b.team, action: b.action, page: b.page }, how: b.how },
      { case: c.id, title: c.title, arm: "agent", input: c.alertText, steps: a.steps, verdict: { severity: a.severity, team: a.team, action: a.action, page: a.page, confidence: a.confidence }, evidence: a.evidence, adjustment: a.adjustment, memory: a.memoryNote, gold: c.gold },
    ];
  });
  downloadFile("pagermind-trajectories.json", JSON.stringify({ exportedAt: new Date().toISOString(), runs }, null, 2));
}

function exportSnapshot() {
  const { cases } = evaluateAll();
  const agg = aggregate(cases);
  downloadFile(
    "pagermind-evidence.json",
    JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        headline: agg,
        ablation: ablation(),
        redTeam: adversarialSuite().rows.map((r) => ({ id: r.c.id, vector: r.c.poison.vector, gold: r.c.gold, baseline: r.baseline, agent: { severity: r.agent.severity, team: r.agent.team, resisted: r.agent.resisted, quarantined: r.agent.quarantined } })),
        cases: cases.map((e) => ({ id: e.c.id, gold: { severity: e.c.gold.severity, team: e.c.gold.team }, baseline: { severity: e.baseline.result.severity, team: e.baseline.result.team, pct: e.baseline.scores.pct }, agent: { severity: e.agent.result.severity, team: e.agent.result.team, pct: e.agent.scores.pct } })),
        reproduce: "npm install && npx vitest run  # <1s, $0.00, deterministic",
      },
      null,
      2
    )
  );
}

export function Evidence() {
  const stages = useMemo(() => ablation(), []);
  const [result, setResult] = useState<{ checks: Check[]; tookMs: number } | null>(null);
  const [running, setRunning] = useState(false);
  const { push } = useToasts();

  const run = () => {
    setRunning(true);
    setResult(null);
    window.setTimeout(() => {
      const r = runAudit();
      setResult(r);
      setRunning(false);
      const failed = r.checks.filter((c) => !c.pass).length;
      push(failed === 0 ? "ok" : "err", failed === 0 ? `audit passed — ${r.checks.length}/${r.checks.length}` : `audit failed — ${failed} check(s)`);
    }, 120);
  };

  return (
    <section id="evidence" className="mx-auto max-w-7xl scroll-mt-20 px-4 md:px-8 py-20 md:py-28">
      <SectionHead
        index="09"
        kicker="Evidence — attribution & verification"
        title={<>Which design choice <span className="text-amber">actually bought the points?</span></>}
        lede="The ladder re-runs the evaluation with one capability disabled at a time. The console re-executes the same assertions as the test suite — live, in your browser, on this engine."
      />
      <div className="grid items-start gap-6 lg:grid-cols-12">
        <Reveal className="lg:col-span-7">
          <div className="panel-solid">
            <div className="flex items-center gap-2.5 border-b border-line px-5 py-3.5">
              <IconBranch size={14} className="text-sky" />
              <span className="font-mono text-[10px] tracking-[0.22em] text-fog-2 uppercase">attribution — ablate one choice at a time, same 12 cases</span>
            </div>
            <div className="space-y-6 p-5 md:p-6">
              {stages.map((s, i) => {
                const prev = i === 0 ? null : stages[i - 1];
                const delta = prev ? s.pct - prev.pct : s.pct;
                return (
                  <div key={s.id}>
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="font-mono text-[12px] text-snow">{s.label}</span>
                      <span className="font-mono text-[10px] text-fog-2">false pages {s.falsePages} · wrong-team {s.wrongTeam}</span>
                      {prev && delta !== 0 && <span className="chip ml-auto border-mint/40 bg-mint/10 text-mint">+{delta} pts</span>}
                    </div>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-fog">{s.note}</p>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="h-2.5 flex-1 overflow-hidden border border-line bg-ink-900">
                        <div className={`bar-anim h-full ${i === stages.length - 1 ? "bg-amber" : i === 0 ? "bg-fog-2" : "bg-sky"}`} style={{ width: `${s.pct}%`, transitionDelay: `${i * 160}ms` }} />
                      </div>
                      <span className="font-display w-14 text-right text-lg font-bold tabular-nums" style={{ color: i === stages.length - 1 ? "#ffb224" : i === 0 ? "#8ca3bf" : "#5ab8ff" }}>{s.pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-2 border-t border-line px-5 py-3.5">
              <button className="btn py-1.5 px-3" onClick={() => { exportTrajectories(); push("ok", "trajectories downloaded", "38 runs · both arms · every tool call"); }}>
                <IconDownload size={12} /> trajectories
              </button>
              <button className="btn py-1.5 px-3" onClick={() => { exportSnapshot(); push("ok", "evidence snapshot downloaded", "headline + ablation + red team + per-case"); }}>
                <IconDownload size={12} /> evidence snapshot
              </button>
              <span className="ml-auto self-center font-mono text-[10px] text-fog-2">computed at render · src/engine/engine.ts</span>
            </div>
          </div>
        </Reveal>
        <Reveal delay={90} className="lg:col-span-5">
          <div className="panel-solid">
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <IconTerminal size={14} className="text-amber" />
                <span className="font-mono text-[10px] tracking-[0.22em] text-fog-2 uppercase">acceptance audit</span>
              </div>
              <button className="btn-solid px-3.5 py-1.5" onClick={run} disabled={running}>{running ? "auditing…" : "run audit"}</button>
            </div>
            <div className="p-5">
              {!result && !running && (
                <p className="font-mono text-[12px] leading-relaxed text-fog-2">
                  Nothing here is asserted on faith. One click re-executes eight checks — determinism, gold conformance,
                  aggregates, attribution, red team, storm, postmortem, validation — the same numbers the README claims.
                </p>
              )}
              {running && (
                <div className="space-y-2">
                  {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skel h-9" style={{ animationDelay: `${i * 90}ms` }} />)}
                </div>
              )}
              {result && (
                <ul className="space-y-2">
                  {result.checks.map((c, i) => (
                    <li key={c.id} className="step-in flex items-start gap-3 border border-line bg-ink-900/60 px-4 py-2.5" style={{ animationDelay: `${i * 60}ms` }}>
                      <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center border ${c.pass ? "border-mint/50 text-mint" : "border-alarm/50 text-alarm"}`}>
                        {c.pass ? <IconCheck size={11} /> : <IconX size={11} />}
                      </span>
                      <div className="min-w-0">
                        <p className="font-mono text-[12px] text-snow">{c.label} <span className="text-fog-2">· {c.pass ? "PASS" : "FAIL"}</span></p>
                        <p className="break-words font-mono text-[10.5px] text-fog-2">{c.detail}</p>
                      </div>
                    </li>
                  ))}
                  <li className="step-in pt-1 font-mono text-[10.5px] text-fog-2" style={{ animationDelay: "500ms" }}>
                    {result.checks.every((c) => c.pass) ? "all checks green" : "FAILURES — inspect the engine"} · {result.tookMs}ms
                  </li>
                </ul>
              )}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ================= RED TEAM ================= */

export function RedTeam() {
  const report = useMemo(() => adversarialSuite(), []);
  const [openId, setOpenId] = useState<string | null>(null);
  const agentPct = useCountUp(Math.round((report.agentResisted / report.total) * 100), true);
  const baselinePct = useCountUp(Math.round((report.baselineResisted / report.total) * 100), true);

  return (
    <section id="redteam" className="mx-auto max-w-7xl scroll-mt-20 px-4 md:px-8 py-20 md:py-28">
      <SectionHead
        index="10"
        kicker="Red team — adversarial robustness"
        title={<>Six poisoned alerts. <span className="text-amber">The agent shrugs.</span></>}
        lede="Agents that read alert prose as instructions have a channel to be hijacked. Pagermind has no such channel by construction — and this suite proves it: forged directives, keyword spam, impersonation, routing bait, page suppression, fake drill claims."
      />
      <div className="grid gap-6 lg:grid-cols-12">
        <Reveal className="lg:col-span-4">
          <div className="panel-solid p-5">
            <p className="font-mono text-[10px] tracking-[0.22em] text-fog-2 uppercase">attack resistance · same verdict criterion</p>
            <div className="mt-5 space-y-5">
              <div>
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-mint">agent</span>
                  <span className="font-display text-4xl font-bold tabular-nums text-mint">{agentPct}%</span>
                </div>
                <p className="mt-1 font-mono text-[10.5px] text-fog-2">{report.agentResisted}/{report.total} resisted · every attempt quarantined in parse.sanitize</p>
                <div className="mt-2 h-2 bg-ink-950"><div className="bar-anim h-full bg-mint" style={{ width: `${(report.agentResisted / report.total) * 100}%` }} /></div>
              </div>
              <div>
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-alarm">baseline</span>
                  <span className="font-display text-4xl font-bold tabular-nums text-alarm">{baselinePct}%</span>
                </div>
                <p className="mt-1 font-mono text-[10.5px] text-fog-2">{report.baselineResisted}/{report.total} — it obeyed the poison five times and slept through the sixth</p>
                <div className="mt-2 h-2 bg-ink-950"><div className="bar-anim h-full bg-alarm" style={{ width: `${(report.baselineResisted / report.total) * 100}%` }} /></div>
              </div>
            </div>
            <div className="mt-6 flex items-start gap-3 border-t border-line pt-4">
              <IconShield size={18} className="shrink-0 text-amber" />
              <p className="text-[12.5px] leading-relaxed text-fog">
                The immunity is architectural: severity comes from <span className="text-snow">catalog + metrics</span>,
                ownership from a <span className="text-snow">lookup</span>, drill claims from{" "}
                <span className="text-snow">calendar.check</span>. Prose is data — it never reaches the decision path.
              </p>
            </div>
          </div>
        </Reveal>
        <Reveal delay={90} className="lg:col-span-8">
          <div className="panel-solid">
            <div className="border-b border-line px-4 py-3">
              <span className="font-mono text-[10px] tracking-[0.22em] text-fog-2 uppercase">the six attacks — expand any row</span>
            </div>
            <ul>
              {report.rows.map((r) => {
                const open = openId === r.c.id;
                return (
                  <li key={r.c.id} className="border-b border-line/60 last:border-0">
                    <button onClick={() => setOpenId(open ? null : r.c.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-ink-800/50">
                      <span className="font-mono text-[11px] text-fog-2">{r.c.id}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-snow">{r.c.poison.vector}</span>
                        <span className="block truncate font-mono text-[10.5px] text-fog-2">{r.c.poison.payload}</span>
                      </span>
                      <span className="flex items-center gap-1.5"><Mark ok={r.baseline.resisted} /><span className="font-mono text-[10px] text-fog-2">base</span></span>
                      <span className="flex items-center gap-1.5"><Mark ok={r.agent.resisted} /><span className="font-mono text-[10px] text-fog-2">agent</span></span>
                    </button>
                    {open && (
                      <div className="step-in grid gap-3 border-t border-line/60 bg-ink-900/50 px-4 py-3 md:grid-cols-3">
                        <div>
                          <p className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-fog-2">poisoned alert</p>
                          <pre className="mt-1 whitespace-pre-wrap font-mono text-[10.5px] leading-relaxed text-fog">{r.c.alertText.join("\n")}</pre>
                        </div>
                        <div>
                          <p className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-fog-2">baseline obeys</p>
                          <p className="mt-1 font-mono text-[11px] text-alarm">{r.baseline.severity} → {r.baseline.team}</p>
                          <p className="mt-2 font-mono text-[9.5px] uppercase tracking-[0.2em] text-fog-2">agent resists</p>
                          <p className="mt-1 font-mono text-[11px] text-mint">{r.agent.severity} → {r.agent.team}</p>
                          {r.agent.quarantined && <p className="mt-1 font-mono text-[10px] text-lemon">⊘ directive quarantined in parse.sanitize</p>}
                        </div>
                        <div>
                          <p className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-fog-2">gold · human-reviewed</p>
                          <p className="mt-1 font-mono text-[11px] text-amber">{r.c.gold.severity} → {r.c.gold.team}</p>
                          <p className="mt-2 text-[11.5px] leading-relaxed text-fog">{r.c.gold.trapNote}</p>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ================= CHANGELOG ================= */

const ENTRIES = [
  { stage: "Baseline", tried: "The script every org writes first: regex severity + four team substrings. No tools, no memory.", evidence: "Rubric 23% · 5/12 false pages · 9/12 wrong-team routes · 1 missed critical.", decision: "Established the starting point. Failure mode: missing context, not missing cleverness.", tag: null },
  { stage: "Iteration 1", tried: "Grounding tools (catalog, metrics) + a rule engine over their outputs. Severity from tier × blast radius; ownership a lookup.", evidence: "Rubric 23% → 89%. Wrong-team 9 → 0. False pages 5 → 1.", decision: "Kept. Grounding beat pattern-matching wherever text and truth disagreed.", tag: null },
  { stage: "Iteration 2", tried: "Critic pass: an independent falsifier. Flag-rollback downgrade, silent-corruption escalation, GameDay contradiction via calendar.", evidence: "Rubric 89% → 100%. False pages 1 → 0. Missed criticals 1 → 0.", decision: "Kept — closes exactly the cases where being wrong is expensive.", tag: "biggest win" },
  { stage: "Iteration 3", tried: "Incident memory: fingerprint search over past incidents, surfaced into trace and recommendation.", evidence: "Score holds at 100% — logs-3 became a capacity ticket, storms cite the 6-min precedent.", decision: "Kept. Memory didn't move the rubric; it moved decision quality underneath it.", tag: null },
  { stage: "Removed", tried: "LLM free-text severity call replacing the rule engine.", evidence: "5 identical-input runs: ±18 rubric points std dev; one run SEV1'd the GameDay drill.", decision: "Removed. Determinism beat eloquence — this failure became the hot take.", tag: "rolled back", removed: true },
  { stage: "Iteration 4", tried: "Calendar tool + pre-approved rule D-1 (drill ⇒ auto-resolve with audit note); human gate on every consequential act.", evidence: "INC-2209: six-person page → audit note. Every remaining page carries an approve/reject checkpoint.", decision: "Kept. The hard case needed a source of truth no alert text contained.", tag: null },
  { stage: "Iteration 5", tried: "Red Team suite: 6 poisoned alerts scored as a separate axis; parse.sanitize quarantines body-level directives.", evidence: "Attack resistance: agent 6/6, baseline 0/6 — including a suppression attack that silenced a real SEV1.", decision: "Kept. Proved the architecture's core property: no prose-to-action channel exists.", tag: null },
  { stage: "Iteration 6", tried: "Correlation: a 4-alert checkout storm collapses to one incident on temporal + topology + change evidence.", evidence: "4 alerts → 1 incident → 1 page, vs baseline's 4 independent actions (2 pages, 2 misroutes).", decision: "Kept. Alert-storm suppression is the second-largest source of on-call noise.", tag: null },
  { stage: "Iteration 7", tried: "Deterministic postmortem generator assembled from the triage artifacts — trace, rules, memory, ledger decision.", evidence: "Every field evidence-traced; regeneration byte-identical; markdown export.", decision: "Kept. Closes the incident lifecycle with zero invented fields.", tag: null },
  { stage: "Final", tried: "Combined pipeline: parse(+sanitize) → tools → rules → critic → gate, plus correlation and postmortem. Both arms re-run from one command.", evidence: "Rubric 23% → 100% · false pages 5 → 0 · wrong-team 9 → 0 · resistance 6/6 vs 0/6 · runtime <1s · cost $0.00.", decision: "Main contribution: grounding tools + critic. Full trace on every run.", tag: null },
];

export function Changelog() {
  return (
    <section id="changelog" className="mx-auto max-w-7xl scroll-mt-20 px-4 md:px-8 py-20 md:py-28">
      <SectionHead
        index="11"
        kicker="Improvement changelog"
        title={<>How 23% became 100% — <span className="text-amber">and what we deleted to get there.</span></>}
        lede="One entry per meaningful experiment, each tied to the same evaluation. The removed experiment matters as much as the kept ones: it's why the final system is deterministic at all."
      />
      <div className="space-y-3">
        {ENTRIES.map((e, i) => (
          <Reveal key={e.stage} delay={Math.min(i * 40, 160)}>
            <div className={`panel grid gap-4 p-5 transition-colors hover:border-line-2 md:grid-cols-12 md:items-start ${"removed" in e && e.removed ? "border-alarm/30" : e.tag === "biggest win" ? "border-amber/40" : ""}`}>
              <div className="flex items-center gap-3 md:col-span-2 md:block">
                <span className={`inline-flex h-8 w-8 items-center justify-center border ${"removed" in e && e.removed ? "border-alarm/60 text-alarm" : e.tag === "biggest win" ? "border-amber/60 text-amber" : "border-line-2 text-fog"}`}>
                  {"removed" in e && e.removed ? <IconX size={14} /> : <IconBranch size={14} />}
                </span>
                <p className={`font-display text-base font-bold uppercase tracking-wide md:mt-2.5 md:text-lg ${"removed" in e && e.removed ? "text-alarm" : e.tag === "biggest win" ? "text-amber" : "text-snow"}`}>{e.stage}</p>
                {e.tag && <span className={`chip mt-2 hidden md:inline-block ${e.tag === "biggest win" ? "border-amber/50 text-amber" : "border-alarm/50 text-alarm"}`}>{e.tag}</span>}
              </div>
              <div className="md:col-span-4">
                <p className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-fog-2">tried & why</p>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-fog">{e.tried}</p>
              </div>
              <div className="md:col-span-3">
                <p className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-fog-2">evidence</p>
                <p className="mt-1.5 font-mono text-[12px] leading-relaxed text-snow">{e.evidence}</p>
              </div>
              <div className="md:col-span-3">
                <p className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-fog-2">decision / learning</p>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-fog">{e.decision}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ================= ARCHITECTURE ================= */

const PIPE = [
  { label: "parse + sanitize", note: "extract signals · quarantine directives", color: "#5ab8ff" },
  { label: "tools", note: "catalog · metrics · history · calendar", color: "#5ab8ff" },
  { label: "rule reasoner", note: "R1–R12 over tool outputs", color: "#ffb224" },
  { label: "critic", note: "falsify · downgrade · escalate", color: "#ff5d5d" },
  { label: "human gate", note: "approve / reject · audited · immutable", color: "#31d48e" },
];

export function Architecture() {
  return (
    <section id="arch" className="mx-auto max-w-7xl scroll-mt-20 px-4 md:px-8 py-20 md:py-28">
      <SectionHead
        index="12"
        kicker="Agent solution & engineering"
        title={<>The pipeline — <span className="text-amber">and why each box exists.</span></>}
        lede="Deterministic by construction: a pure function from incident to verdict. The LLM-shaped seams (tools, traces, checkpoints) are deliberate — a model can be added where eloquence helps, without losing auditability where it matters."
      />
      <div className="grid gap-6 lg:grid-cols-12">
        <Reveal className="lg:col-span-7">
          <div className="panel scanlines overflow-hidden">
            <div className="border-b border-line bg-ink-900 px-4 py-2.5">
              <span className="font-mono text-[11px] text-fog">pagermind — agent pipeline</span>
            </div>
            <svg viewBox="0 0 640 300" className="w-full">
              {PIPE.map((p, i) => {
                const y = 24 + i * 56;
                return (
                  <g key={p.label}>
                    {i < PIPE.length - 1 && (
                      <line x1="40" y1={y + 34} x2="40" y2={y + 56} stroke="#2a405f" strokeWidth="1.5" strokeDasharray="4 4" className="dash-flow" style={{ strokeDashoffset: 0 }} />
                    )}
                    <rect x="16" y={y} width="8" height="34" fill={p.color} opacity="0.9" />
                    <text x="40" y={y + 15} fill="#e9f1fb" fontFamily="JetBrains Mono, monospace" fontSize="13" fontWeight="700">{p.label}</text>
                    <text x="40" y={y + 30} fill="#5e7694" fontFamily="JetBrains Mono, monospace" fontSize="10">{p.note}</text>
                    <line x1="330" y1={y + 17} x2="600" y2={y + 17} stroke="#1c2b42" strokeWidth="1" />
                    <text x="600" y={y + 21} fill={p.color} fontFamily="JetBrains Mono, monospace" fontSize="10" textAnchor="end">
                      {i === 0 ? "poison has no channel" : i === 1 ? "grounding ≠ guessing" : i === 2 ? "every verdict cites a rule" : i === 3 ? "confidence → defensible" : "consequential acts wait"}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </Reveal>
        <Reveal delay={90} className="lg:col-span-5">
          <div className="panel-solid h-full p-5">
            <p className="font-mono text-[10px] tracking-[0.22em] text-fog-2 uppercase">rules excerpt — src/engine/engine.ts</p>
            <pre className="mt-3 overflow-x-auto font-mono text-[10.5px] leading-[1.8] text-fog">
{`R1  tier-1 ∧ (customers blocked ∨ err ≥ 8%)  → SEV1
R3  tier-1 ∧ customers degraded              → SEV2
R7  |model drift| ≥ 15%                      → SEV3
R9  cache hit < 70%                          → SEV3
R11 tier-1 ∧ no other rule                   → SEV3  (investigate)
R12 otherwise                                → SEV4

critic.downgrade   rollbackKnown ∧ SEV1 ∧ err < 15% → SEV2
critic.escalate    corruption-signal ∧ ≤ SEV3        → SEV2
critic.contradict  probes ∧ real-user 0% ∧ drill     → DRILL (D-1)
sanitize           body directives → quarantined, always`}
            </pre>
            <div className="mt-4 space-y-2 border-t border-line pt-4">
              {[
                [IconMemory, "memory", "fingerprint recall — prior decisions reshape runbooks"],
                [IconShield, "sanitize", "prose is data; no prose-to-action channel"],
                [IconGate, "gate", "401 / 403-audited / 409-immutable / 422-validated"],
              ].map(([Ic, k, v]) => {
                const I = Ic as typeof IconMemory;
                return (
                  <p key={k as string} className="flex items-center gap-2.5 font-mono text-[11px]">
                    <I size={13} className="text-amber" />
                    <span className="w-16 text-snow">{k as string}</span>
                    <span className="text-fog-2">{v as string}</span>
                  </p>
                );
              })}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ================= REPRO ================= */

const CMDS = [
  ["# 1 · from a clean environment", ""],
  ["git clone <repo> && cd pagermind", ""],
  ["npm install", "Node ≥ 20 · no other prerequisites · no API keys"],
  ["", ""],
  ["# 2 · the live product", ""],
  ["npm run dev", "console at localhost:5173 — incidents start streaming"],
  ["", ""],
  ["# 3 · the scored evaluation (both arms, same 12 cases)", ""],
  ["npx vitest run", "aggregates + ablation + red team + gate state machine, <1s"],
  ["", ""],
  ["# 4 · the static artifact for judges", ""],
  ["npm run build && npm run preview", "serve dist/ anywhere static — the whole product"],
] as const;

export function Repro() {
  return (
    <section id="repro" className="mx-auto max-w-7xl scroll-mt-20 px-4 md:px-8 py-20 md:py-28">
      <SectionHead
        index="13"
        kicker="Reproducibility"
        title={<>Clean machine. Two commands. <span className="text-amber">Same numbers.</span></>}
        lede="No model endpoint, no seed to chase, no bill. The eval you read is the eval you run — runtime <1s, cost $0.00."
      />
      <div className="grid gap-6 lg:grid-cols-12">
        <Reveal className="lg:col-span-7">
          <div className="panel scanlines overflow-hidden">
            <div className="flex items-center gap-2 border-b border-line bg-ink-900 px-4 py-2.5">
              <span className="h-2.5 w-2.5 bg-alarm" /><span className="h-2.5 w-2.5 bg-amber" /><span className="h-2.5 w-2.5 bg-mint" />
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
            <p className="font-mono text-[10px] tracking-[0.22em] text-fog-2 uppercase">expect to see</p>
            <ul className="mt-3 space-y-2 text-[13px] text-fog">
              <li><span className="text-mint">▸</span> baseline <span className="font-mono text-snow">23%</span> · agent <span className="font-mono text-snow">100%</span></li>
              <li><span className="text-mint">▸</span> false pages <span className="font-mono text-snow">5 → 0</span> · wrong-team <span className="font-mono text-snow">9 → 0</span> · missed <span className="font-mono text-snow">1 → 0</span></li>
              <li><span className="text-mint">▸</span> ablation ladder <span className="font-mono text-snow">[23, 89, 100, 100]</span></li>
              <li><span className="text-mint">▸</span> red team resistance <span className="font-mono text-snow">agent 6/6 · baseline 0/6</span></li>
              <li><span className="text-mint">▸</span> gate paths <span className="font-mono text-snow">401 · 403 · 409 · 422</span> all asserted</li>
            </ul>
            <p className="mt-5 border-t border-line pt-4 font-mono text-[10px] leading-relaxed text-fog-2 uppercase tracking-[0.18em]">
              showing it to judges
            </p>
            <p className="mt-2 text-[12.5px] leading-relaxed text-fog">
              Click the amber <span className="font-mono text-amber">▶ demo</span> button: a narrated, spotlight-driven
              tour walks the live product end-to-end in under five minutes — auto mode is hands-free. Record one take
              for the submission video; the engine is deterministic, so retakes are free.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ================= HOT TAKE ================= */

export function HotTake() {
  return (
    <section id="take" className="mx-auto max-w-7xl scroll-mt-20 px-4 md:px-8 py-20 md:py-28">
      <SectionHead index="14" kicker="Hot take / insights" title={<>The failure mode wasn't stupidity. <span className="text-amber">It was confidence.</span></>} />
      <div className="grid gap-6 lg:grid-cols-12">
        <Reveal className="lg:col-span-7">
          <blockquote className="panel relative overflow-hidden p-7 md:p-10">
            <IconFlame size={44} className="text-amber/80" />
            <p className="font-display mt-6 text-2xl font-bold leading-[1.15] text-snow md:text-[34px]">
              “A triage agent doesn't have to be brilliant. It has to be <span className="text-amber">auditable at 3 a.m.</span> —
              every verdict traceable to a tool output and a rule a tired human can disagree with in ten seconds.”
            </p>
            <p className="mt-6 text-[14px] leading-relaxed text-fog">
              Our most seductive experiment — an LLM free-text severity call — scored well on average and was{" "}
              <span className="text-snow">useless in production</span>: ±18 points of variance per run, no rule to point at,
              and it once paged six people for a scheduled drill it couldn't explain. We deleted it. The deterministic
              reasoner plus a critic scored higher <em className="not-italic text-snow">and</em> could defend itself.
              Then the Red Team suite showed the deeper property: with no prose-to-action channel, injection has nothing
              to hijack. Reliability is a property of the evidence chain, not the model size.
            </p>
            <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.18em] text-fog-2">— team AW-2201, after the third 4 a.m. test run</p>
          </blockquote>
        </Reveal>
        <div className="space-y-4 lg:col-span-5">
          <Reveal delay={80} className="panel p-6">
            <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-alarm"><IconAlert size={12} /> observed failure mode</p>
            <h3 className="font-display mt-2 text-lg font-bold uppercase tracking-wide text-snow">Confidence without grounding</h3>
            <p className="mt-2 text-[13.5px] leading-relaxed text-fog">
              The scariest strings produced the worst decisions — because the text describes symptoms while severity
              lives in tier, blast radius and schedule. Five of twelve baseline pages were exactly this; the sixth
              direction of attack (suppression) shows the reverse is just as dangerous.
            </p>
          </Reveal>
          <Reveal delay={160} className="panel p-6">
            <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-mint"><IconUser size={12} /> what we build next</p>
            <h3 className="font-display mt-2 text-lg font-bold uppercase tracking-wide text-snow">Holdout evals + override tracking</h3>
            <p className="mt-2 text-[13.5px] leading-relaxed text-fog">
              The rubric and rules were co-designed on these 12 cases — honest caveat: that invites overfitting. Next: a
              held-out set written by reviewers who haven't seen the rules, plus tracking whether humans override the
              agent less over time. And the roadmap beyond: correlation across services at scale, and the LLM back in —
              as a witness that summarizes, never a judge that decides.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ================= FOOTER ================= */

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto max-w-7xl px-4 py-10 md:px-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-display text-xl font-bold tracking-[0.14em] text-snow">
              PAGERMIND <span className="text-amber">/</span> AW-2201
            </p>
            <p className="mt-2 max-w-md text-[13px] leading-relaxed text-fog">
              Submitted to the micro1 Agentic Workflows Hackathon. All incident data is synthetic; every evaluation
              number is computed by the code in this repo. Starter template (Vite/React/TS/Tailwind) pre-existed;
              everything else is this submission.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {["deterministic", "injection-proof by construction", "human-in-the-loop", "$0.00", "typescript", "mit-licensed"].map((t) => (
              <span key={t} className="chip text-fog-2">{t}</span>
            ))}
          </div>
        </div>
        <div className="mt-8 flex flex-col gap-2 border-t border-line pt-5 font-mono text-[10.5px] text-fog-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-2"><IconUser size={12} /> built with coding agents · reviewed by a qualified human (ground rule 05)</span>
          <span>© 2026 team AW-2201 — same trace on every machine</span>
        </div>
      </div>
    </footer>
  );
}
