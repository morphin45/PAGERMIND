import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { STORM, CORRELATED, GROUPING_EVIDENCE, ROOT_CAUSE, baselineOnStorm } from "../engine/burst";
import { runAgent } from "../engine/agent";
import { gates, audit } from "../backend/services";
import { Reveal, SectionHead, SevChip, useToasts } from "./ui";
import { IconGate, IconPulse, IconReplay, IconX } from "./icons";

const SOURCE_COLOR: Record<string, string> = {
  k8s: "#5ab8ff",
  redis: "#ff5d5d",
  "api-monitor": "#ffb224",
  db: "#c792ea",
};

type Phase = "idle" | "storm" | "correlating" | "done";

/* node positions on the correlation canvas (percent coords) */
const POS = [
  { x: 16, y: 18 },
  { x: 84, y: 14 },
  { x: 12, y: 78 },
  { x: 86, y: 82 },
];

export default function CorrelationEngine() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [alertsIn, setAlertsIn] = useState(0);
  const { push } = useToasts();
  const timers = useRef<Set<number>>(new Set());
  const verdict = useMemo(() => runAgent(CORRELATED), []);
  const baselineRows = useMemo(() => baselineOnStorm(), []);
  const stagedRef = useRef(false);

  const later = useCallback((ms: number, fn: () => void) => {
    const id = window.setTimeout(() => {
      timers.current.delete(id);
      fn();
    }, ms);
    timers.current.add(id);
  }, []);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const replay = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current.clear();
    setAlertsIn(0);
    setPhase("storm");
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const gap = reduced ? 60 : 720;
    STORM.forEach((_, i) => later(gap * (i + 1), () => setAlertsIn(i + 1)));
    later(gap * STORM.length + 700, () => setPhase("correlating"));
    later(gap * STORM.length + 2300, () => {
      setPhase("done");
      // stage the correlated page-worthy incident at the REAL human gate
      if (!stagedRef.current) {
        const existing = gates.list().some((g) => g.caseId === CORRELATED.id);
        if (!existing) {
          gates.propose({
            caseId: CORRELATED.id,
            uid: `${CORRELATED.id}·storm`,
            title: CORRELATED.title,
            service: CORRELATED.service,
            severity: verdict.severity,
            team: verdict.team,
            runbookId: verdict.runbook.id,
            runbookTitle: verdict.runbook.title,
            action: verdict.action,
            confidence: verdict.confidence,
            evidence: verdict.evidence,
          });
          audit.append({
            actor: "pagermind/correlation",
            action: "correlate.group",
            target: `${CORRELATED.id} · 4 alerts → 1 incident`,
            outcome: "ok",
            detail: "temporal + topology + change correlation · fingerprint match INC-2201",
            requestId: "storm",
          });
          window.dispatchEvent(new CustomEvent("pm:gates-changed"));
          stagedRef.current = true;
          push("ok", "storm correlated → 1 incident", "the SEV1 page is waiting at your gate");
        }
      }
    });
  }, [later, push, verdict]);

  /* the guided tour can trigger the storm on cue */
  useEffect(() => {
    const onStorm = () => replay();
    window.addEventListener("pm:storm", onStorm);
    return () => window.removeEventListener("pm:storm", onStorm);
  }, [replay]);

  const baselinePages = baselineRows.filter((r) => r.page).length;
  const baselineUnassigned = baselineRows.filter((r) => r.team.startsWith("unassigned")).length;

  return (
    <section id="correlation" className="mx-auto max-w-7xl scroll-mt-20 px-4 md:px-8 py-16 md:py-24">
      <SectionHead
        index="01"
        kicker="Correlation engine — alert storm → one incident"
        title={
          <>
            Four alarms.
            <br />
            <span className="text-amber">One root cause.</span>
          </>
        }
        lede="A production storm arrives as four symptoms from four sources. In isolation each is noise — together they are one failure. The engine groups on time, topology and change, then cross-checks the fingerprint against memory. The baseline's four dispositions below are computed by actually running the regex script on each raw alert."
      />

      <Reveal className="mb-5 flex items-center gap-3">
        <button className="btn-solid" onClick={replay} disabled={phase === "storm" || phase === "correlating"}>
          <IconReplay size={13} /> {phase === "idle" ? "replay the storm" : "replay"}
        </button>
        <span className="font-mono text-[11px] text-fog-2">
          {phase === "idle" && "03:41:12 – 03:41:59 sim · 4 sources · 47s window"}
          {phase === "storm" && `receiving raw alerts… ${alertsIn}/4`}
          {phase === "correlating" && "grouping: temporal ∧ topology ∧ change-correlation…"}
          {phase === "done" && "grouped · triaged · staged at the human gate"}
        </span>
      </Reveal>

      <div className="grid gap-4 lg:grid-cols-12">
        {/* raw alerts */}
        <Reveal className="lg:col-span-4">
          <div className="panel-solid h-full">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="font-mono text-[10px] tracking-[0.22em] text-fog-2 uppercase">raw alerts · 4</span>
              <span className={`chip ${alertsIn > 0 ? "text-alarm border-alarm/40" : "text-fog-2"}`}>
                {alertsIn}/4 in
              </span>
            </div>
            <ul className="space-y-2 p-4">
              {STORM.map((a, i) => (
                <li
                  key={a.id}
                  className={`border border-line bg-ink-900/70 px-3 py-2.5 transition-all duration-500 ${
                    i < alertsIn ? "feed-in opacity-100" : "opacity-25"
                  } ${phase === "done" ? "border-line/40" : ""}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 shrink-0" style={{ background: SOURCE_COLOR[a.source] }} />
                    <span className="font-mono text-[10px] text-fog-2">{a.t}</span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: SOURCE_COLOR[a.source] }}>
                      {a.source}
                    </span>
                    {phase === "done" && <span className="chip ml-auto text-[9px] text-fog-2 border-line-2">grouped</span>}
                  </div>
                  <p className={`mt-1 font-mono text-[11px] leading-snug ${phase === "done" ? "text-fog" : "text-snow"}`}>
                    {a.text}
                  </p>
                </li>
              ))}
              {alertsIn === 0 && (
                <li className="px-1 pt-1 font-mono text-[10.5px] text-fog-2">waiting — hit replay to receive the storm.</li>
              )}
            </ul>
          </div>
        </Reveal>

        {/* correlation canvas */}
        <Reveal delay={80} className="lg:col-span-8">
          <div className="panel-solid scanlines relative h-full min-h-[380px] overflow-hidden">
            <div className="absolute left-4 top-3 z-10 font-mono text-[10px] tracking-[0.22em] text-fog-2 uppercase">
              correlation canvas
            </div>
            <svg viewBox="0 0 100 100" className="h-full w-full" preserveAspectRatio="none" aria-hidden="true">
              {(phase === "correlating" || phase === "done") &&
                POS.map((p, i) => (
                  <line
                    key={i}
                    x1={p.x}
                    y1={p.y}
                    x2={50}
                    y2={50}
                    stroke={SOURCE_COLOR[STORM[i].source]}
                    strokeWidth={0.35}
                    strokeDasharray="2 2"
                    className="dash-flow"
                    opacity={0.75}
                  />
                ))}
              {phase === "done" && <circle cx={50} cy={50} r={13} fill="rgba(255,178,36,0.08)" stroke="rgba(255,178,36,0.5)" strokeWidth={0.3} />}
            </svg>
            {STORM.map((a, i) => (
              <div
                key={a.id}
                className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-700"
                style={{ left: `${POS[i].x}%`, top: `${POS[i].y}%`, opacity: i < alertsIn ? 1 : 0 }}
              >
                <span
                  className="block h-3 w-3 rotate-45 border transition-transform duration-700"
                  style={{
                    borderColor: SOURCE_COLOR[a.source],
                    background: `${SOURCE_COLOR[a.source]}22`,
                    transform: phase === "done" ? "rotate(45deg) scale(0.7)" : "rotate(45deg)",
                  }}
                />
                <span className="mt-1 block whitespace-nowrap font-mono text-[9px] uppercase tracking-[0.14em] text-fog-2">
                  {a.source}
                </span>
              </div>
            ))}

            {/* center: correlated incident */}
            <div className="absolute inset-0 grid place-items-center p-6">
              {phase !== "done" ? (
                <div
                  className={`grid h-16 w-16 place-items-center border border-line-2 text-fog-2 transition-all duration-500 ${
                    phase === "correlating" ? "pulse-amber border-amber/60 text-amber" : ""
                  }`}
                >
                  <IconPulse size={20} />
                </div>
              ) : (
                <div className="step-in w-full max-w-md border border-amber/50 bg-ink-950/90 p-4 shadow-[0_20px_60px_-20px_rgba(255,178,36,0.25)]">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-amber">{CORRELATED.id}</span>
                    <SevChip sev={verdict.severity} />
                    <span className="chip ml-auto text-[9px] text-mint border-mint/40">4 alerts → 1 incident</span>
                  </div>
                  <p className="mt-2 text-[14px] font-semibold leading-snug text-snow">{CORRELATED.title}</p>
                  <p className="mt-1.5 font-mono text-[10.5px] leading-relaxed text-fog">
                    <span className="text-fog-2">root cause · </span>
                    {ROOT_CAUSE}
                  </p>
                  <p className="mt-2 flex items-center gap-2 font-mono text-[10.5px] text-amber">
                    <IconGate size={12} /> staged at the human gate — {verdict.team}
                  </p>
                </div>
              )}
            </div>
          </div>
        </Reveal>
      </div>

      {/* grouping evidence + baseline contrast */}
      <div className="mt-4 grid gap-4 lg:grid-cols-12">
        <Reveal className="lg:col-span-5">
          <div className="panel-solid h-full p-5">
            <p className="font-mono text-[10px] tracking-[0.22em] text-fog-2 uppercase">why these four belong together</p>
            <ul className="mt-3 space-y-2.5">
              {GROUPING_EVIDENCE.map((g, i) => (
                <li
                  key={g}
                  className={`flex gap-2.5 font-mono text-[11.5px] leading-relaxed text-fog transition-opacity duration-500 ${
                    phase === "done" ? "step-in opacity-100" : "opacity-30"
                  }`}
                  style={{ transitionDelay: `${i * 120}ms` }}
                >
                  <span className="text-mint shrink-0">▸</span> {g}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>

        <Reveal delay={80} className="lg:col-span-7">
          <div className="panel-solid h-full">
            <div className="flex items-center justify-between border-b border-line px-5 py-3">
              <span className="font-mono text-[10px] tracking-[0.22em] text-fog-2 uppercase">
                what the baseline does instead — computed live
              </span>
              <span className="chip text-alarm border-alarm/40">
                {baselinePages} noisy page · {baselineUnassigned} unassigned
              </span>
            </div>
            <ul className="divide-y divide-line/60">
              {baselineRows.map((r) => (
                <li key={r.raw.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2.5 font-mono text-[11px]">
                  <span className="text-fog-2 w-14 shrink-0">{r.raw.t.slice(3)}</span>
                  <span className="w-24 shrink-0 truncate" style={{ color: SOURCE_COLOR[r.raw.source] }}>
                    {r.raw.source}
                  </span>
                  <SevChip sev={r.severity} />
                  <span className={`truncate ${r.team.startsWith("unassigned") ? "text-alarm" : "text-fog"}`}>
                    {r.team}
                  </span>
                  {r.page && <span className="chip text-[9px] text-alarm border-alarm/40">pages a human</span>}
                  <span className="ml-auto hidden font-mono text-[9.5px] text-fog-2 sm:block">{r.how}</span>
                </li>
              ))}
            </ul>
            <p className="border-t border-line px-5 py-3 font-mono text-[10.5px] leading-relaxed text-fog-2">
              Four dispositions, one of them a 3 a.m. page for a crash-loop that is merely a symptom — and two alerts
              nobody is routed to. The correlated engine produces <span className="text-snow">one incident, one page,
              cause named</span>. Noise reduction: 75%.
            </p>
          </div>
        </Reveal>
      </div>

      {phase !== "done" && alertsIn === 0 && (
        <p className="mt-4 flex items-center gap-2 font-mono text-[10.5px] text-fog-2">
          <IconX size={11} className="text-fog-2" /> nothing received yet — this section is dormant until the storm runs.
        </p>
      )}
    </section>
  );
}


