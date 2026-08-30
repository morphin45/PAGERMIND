import { useEffect, useMemo, useState } from "react";
import { CASES, sevColor } from "../data/incidents";
import { runAgent } from "../engine/agent";
import type { Aggregate } from "../engine/eval";
import { SevChip, usePlayer } from "./ui";
import { IconReplay, IconTerminal } from "./icons";

const STEP_KIND_COLOR: Record<string, string> = {
  parse: "#5ab8ff",
  tool: "#5ab8ff",
  memory: "#c792ea",
  reason: "#ffb224",
  verify: "#ff5d5d",
  gate: "#31d48e",
};

const STEP_KIND_LABEL: Record<string, string> = {
  parse: "PARSE",
  tool: "TOOL",
  memory: "MEM",
  reason: "RULE",
  verify: "CHK",
  gate: "GATE",
};

function TraceReplay() {
  const featured = useMemo(() => CASES.find((c) => c.id === "INC-2209")!, []);
  const result = useMemo(() => runAgent(featured), [featured]);
  const [runId, setRunId] = useState(0);
  const { visible, done } = usePlayer(result.steps.length, runId, 640);

  useEffect(() => {
    if (!done) return;
    const t = window.setTimeout(() => setRunId((r) => r + 1), 3600);
    return () => window.clearTimeout(t);
  }, [done]);

  return (
    <div className="border-t border-line p-4 md:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="font-mono text-[10px] tracking-[0.22em] text-fog-2 uppercase">
          Agent trace · {featured.id} {featured.title.toLowerCase()}
        </span>
        <button className="btn py-1.5 px-3" onClick={() => setRunId((r) => r + 1)}>
          <IconReplay size={12} /> Replay
        </button>
      </div>
      <ol className="space-y-1.5 font-mono text-[11.5px] leading-relaxed min-h-[248px]">
        {result.steps.slice(0, visible).map((s, i) => (
          <li key={`${runId}-${i}`} className="step-in flex gap-2.5">
            <span
              className="chip px-1.5 py-0.5 shrink-0 self-start"
              style={{ color: STEP_KIND_COLOR[s.kind], borderColor: `${STEP_KIND_COLOR[s.kind]}55` }}
            >
              {STEP_KIND_LABEL[s.kind]}
            </span>
            <span className="min-w-0">
              <span className="text-snow">{s.label}</span>
              <span className="block text-fog-2 break-words">{s.detail}</span>
            </span>
          </li>
        ))}
        {!done && (
          <li className="flex items-center gap-2 text-fog-2">
            <span className="cursor-blink inline-block h-3.5 w-2 bg-mint" />
            <span className="text-[10px] tracking-[0.2em] uppercase">working…</span>
          </li>
        )}
      </ol>
      {done && (
        <div className="step-in mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <span className="font-mono text-[10px] tracking-[0.22em] text-fog-2 uppercase">verdict</span>
          <SevChip sev="DRILL" />
          <span className="chip text-mint border-mint/40 bg-mint/10">no page — rule D-1</span>
          <span className="chip text-fog-2">confidence 0.92</span>
          <span className="ml-auto font-mono text-[10px] text-fog-2">
            {result.steps.length} steps · 6 tools · 0 humans woken
          </span>
        </div>
      )}
    </div>
  );
}

function AlertFeed() {
  const [head, setHead] = useState(5);
  useEffect(() => {
    const t = window.setInterval(() => setHead((h) => h + 1), 3000);
    return () => window.clearInterval(t);
  }, []);

  const items = useMemo(() => {
    const list = [];
    for (let i = 0; i < 5; i++) {
      const idx = head - i;
      const c = CASES[idx % CASES.length];
      list.push({ key: idx, c, fresh: i === 0 });
    }
    return list;
  }, [head]);

  return (
    <div className="p-4 md:p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-[10px] tracking-[0.22em] text-fog-2 uppercase">inbound alert feed</span>
        <span className="flex items-center gap-1.5 font-mono text-[10px] text-alarm">
          <span className="h-1.5 w-1.5 bg-alarm pulse-amber" /> STREAMING
        </span>
      </div>
      <ul className="space-y-2 font-mono text-[11.5px]">
        {items.map(({ key, c, fresh }) => (
          <li
            key={key}
            className={`flex items-center gap-3 border border-line bg-ink-900/70 px-3 py-2 ${fresh ? "feed-in border-line-2" : ""}`}
          >
            <span className="text-fog-2 shrink-0">{c.time.slice(0, 5)}</span>
            <span className="shrink-0" style={{ color: sevColor[c.gold.severity] }}>
              ●
            </span>
            <span className="truncate text-snow">
              <span className="text-fog">{c.service}</span> — {c.title}
            </span>
            {fresh && <span className="chip ml-auto text-amber border-amber/50 shrink-0">new</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function WarRoom({ agg }: { agg: Aggregate }) {
  return (
    <section id="top" className="relative mx-auto max-w-7xl px-4 md:px-8 pt-24 md:pt-28 pb-10">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-8 items-start">
        {/* left — manifesto */}
        <div className="lg:col-span-5">
          <p className="font-mono text-[11px] tracking-[0.28em] text-amber uppercase">
            micro1 · Agentic Workflows Hackathon — entry AW-2201
          </p>
          <h1 className="font-display mt-5 text-[42px] leading-[0.98] font-bold uppercase tracking-tight text-snow sm:text-6xl xl:text-[72px]">
            The pager fires
            <br />
            at 03:12.
            <br />
            <span className="text-amber">Context is</span>
            <br />
            <span className="text-amber">the bottleneck.</span>
          </h1>
          <p className="mt-6 max-w-md text-[15px] leading-relaxed text-fog">
            <strong className="text-snow">Pagermind</strong> is an incident-triage agent that reads the alert, pulls
            the catalog, the metrics, the history and the calendar — then proposes a severity, a team and a runbook{" "}
            <em className="text-snow not-italic font-medium">with the evidence chain to defend it</em>. Consequential
            acts wait for a human. Everything below runs live in your browser on 12 synthetic incidents: the 40-line
            regex baseline we all ship first, and the agent that replaced it.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href="#bench" className="btn-solid">
              <IconTerminal size={13} /> Run the bench
            </a>
            <a href="#eval" className="btn">
              Read the evidence
            </a>
          </div>
          <dl className="mt-10 grid grid-cols-3 gap-px border border-line bg-line max-w-md">
            {[
              ["rubric score", `${agg.baselinePct}% → ${agg.agentPct}%`],
              ["false pages", `${agg.baselineFalsePages} → ${agg.agentFalsePages}`],
              ["wrong team", `${agg.baselineWrongTeam} → ${agg.agentWrongTeam}`],
            ].map(([k, v]) => (
              <div key={k} className="bg-ink-900 px-4 py-3">
                <dt className="font-mono text-[9px] tracking-[0.2em] text-fog-2 uppercase">{k}</dt>
                <dd className="font-display mt-1 text-lg font-bold text-snow tabular-nums">
                  {v.split(" → ")[0]}
                  <span className="text-fog-2"> → </span>
                  <span className="text-mint">{v.split(" → ")[1]}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* right — live console */}
        <div className="lg:col-span-7">
          <div className="panel scanlines overflow-hidden">
            <div className="flex items-center gap-2 border-b border-line bg-ink-900 px-4 py-2.5">
              <span className="h-2.5 w-2.5 bg-alarm" />
              <span className="h-2.5 w-2.5 bg-amber" />
              <span className="h-2.5 w-2.5 bg-mint" />
              <span className="ml-3 font-mono text-[11px] text-fog">pagermind — triage/01 · war-room</span>
              <span className="ml-auto font-mono text-[10px] text-fog-2 hidden sm:block">seed 0x2201 · deterministic</span>
            </div>
            <AlertFeed />
            <TraceReplay />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] tracking-[0.2em] text-fog-2 uppercase mr-1">severity scale</span>
            {(["SEV1", "SEV2", "SEV3", "SEV4", "DRILL"] as const).map((s) => (
              <SevChip key={s} sev={s} />
            ))}
          </div>
        </div>
      </div>

      {/* ticker */}
      <div className="mt-12 border-y border-line py-2.5 overflow-hidden">
        <div className="ticker-track font-mono text-[11px] tracking-[0.14em] text-fog uppercase">
          {[0, 1].map((dup) => (
            <div key={dup} className="flex shrink-0 items-center">
              {[
                `rubric score ${agg.baselinePct}% → ${agg.agentPct}%`,
                `false pages ${agg.baselineFalsePages} → ${agg.agentFalsePages}`,
                `wrong-team routes ${agg.baselineWrongTeam} → ${agg.agentWrongTeam}`,
                "12 cases · 8 traps · 1 hard case",
                "human gate on every page",
                "baseline = one regex script",
                "runtime < 1s · cost $0.00",
                "same eval, both arms",
              ].map((t) => (
                <span key={t} className="flex items-center">
                  <span className="px-6">{t}</span>
                  <span className="text-amber">◆</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
