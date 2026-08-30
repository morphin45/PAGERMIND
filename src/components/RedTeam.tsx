import { useMemo, useState } from "react";
import { adversarialSuite } from "../engine/eval";
import { runAgent } from "../engine/agent";
import { Reveal, SectionHead, SevChip, useToasts } from "./ui";
import { IconCheck, IconX, IconShield, IconAlert } from "./icons";

/**
 * RED TEAM — adversarial robustness as a first-class, scored axis.
 *
 * Every LLM-reading agent has a channel through which text becomes action.
 * Pagermind has none: alert bodies are data, parsed and sanitized, never
 * executed. This section scores that property across 6 poisoned alerts.
 */

function Verdict({ sev, team, ok }: { sev: string; team: string; ok: boolean }) {
  return (
    <div className={`flex items-center gap-2 border px-2.5 py-1.5 ${ok ? "border-mint/40 bg-mint/5" : "border-alarm/40 bg-alarm/5"}`}>
      <span className={`shrink-0 ${ok ? "text-mint" : "text-alarm"}`}>{ok ? <IconCheck size={12} /> : <IconX size={12} />}</span>
      <span className="font-mono text-[10.5px] text-snow">{sev}</span>
      <span className="font-mono text-[9px] text-fog-2 truncate">{team}</span>
    </div>
  );
}

function Resistance({ label, n, total, tone }: { label: string; n: number; total: number; tone: string }) {
  const pct = Math.round((n / total) * 100);
  return (
    <div className="flex-1 min-w-[220px]">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-fog-2">{label}</span>
        <span className="font-display text-xl font-bold tabular-nums" style={{ color: tone }}>
          {n}/{total}
        </span>
      </div>
      <div className="h-2 border border-line bg-ink-900 overflow-hidden">
        <div className="bar-anim h-full" style={{ width: `${pct}%`, background: tone }} />
      </div>
    </div>
  );
}

export default function RedTeam() {
  const report = useMemo(() => adversarialSuite(), []);
  const [expanded, setExpanded] = useState<string | null>("ADV-905");
  const { push } = useToasts();

  return (
    <section id="redteam" className="mx-auto max-w-7xl scroll-mt-20 px-4 md:px-8 py-20 md:py-28">
      <SectionHead
        index="10"
        kicker="Red team — adversarial robustness"
        title={
          <>
            We tried to <span className="text-alarm">lie to the agent.</span>
            <br />
            <span className="text-amber">It doesn't have an ear for it.</span>
          </>
        }
        lede="Every agent that reads prose as instructions has a channel for prompt injection. Pagermind reads meters, not prose — alert bodies are parsed, sanitized, and can never become actions. So we poisoned six alerts and scored what happened."
      />

      {/* headline resistance */}
      <Reveal className="panel-solid p-6 mb-8">
        <div className="flex items-center gap-2.5 mb-5">
          <IconShield size={16} className="text-amber" />
          <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-fog-2">
            attack resistance · 6 poisoned alerts · same gold standard as the main eval
          </span>
        </div>
        <div className="flex flex-col sm:flex-row gap-6">
          <Resistance label="baseline (regex script)" n={report.baselineResisted} total={report.total} tone="#ff5d5d" />
          <Resistance label="pagermind agent" n={report.agentResisted} total={report.total} tone="#31d48e" />
        </div>
        <p className="mt-5 border-t border-line pt-4 font-mono text-[11px] leading-relaxed text-fog-2">
          A resisted attack = the verdict still matches gold (severity + team) despite the poison. The baseline
          obeys keyword spam, impersonation and routing bait. The agent quarantines every injected directive at{" "}
          <span className="text-snow">parse.sanitize</span> and cross-checks forged claims against the calendar.
          Resistance is computed live from <span className="text-snow">src/engine/eval.ts#adversarialSuite()</span>.
        </p>
      </Reveal>

      {/* attack cards */}
      <div className="space-y-3">
        {report.rows.map((r, i) => {
          const open = expanded === r.id;
          return (
            <Reveal key={r.id} delay={i * 40}>
              <button
                onClick={() => setExpanded(open ? null : r.id)}
                className={`w-full text-left panel transition-colors hover:border-line-2 ${open ? "border-alarm/40" : ""}`}
              >
                <div className="flex items-center gap-3 px-5 py-4">
                  <span className="grid h-8 w-8 shrink-0 place-items-center border border-alarm/50 text-alarm">
                    <IconAlert size={14} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2.5">
                      <span className="font-mono text-[11px] text-alarm">{r.id}</span>
                      <span className="chip text-fog-2">{r.vector}</span>
                    </div>
                    <p className="mt-0.5 text-[13.5px] font-medium text-snow truncate">{r.title}</p>
                  </div>
                  <div className="hidden md:grid grid-cols-2 gap-2 w-[300px]">
                    <Verdict sev={r.baseline.severity} team={r.baseline.team} ok={r.baseline.resisted} />
                    <Verdict sev={r.agent.severity} team={r.agent.team} ok={r.agent.resisted} />
                  </div>
                  <span className="font-mono text-[10px] text-fog-2 shrink-0">{open ? "−" : "+"}</span>
                </div>

                {open && (
                  <div className="border-t border-line px-5 py-4 grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="font-mono text-[9.5px] tracking-[0.2em] uppercase text-fog-2 mb-2">injected payload</p>
                      <pre className="border border-alarm/30 bg-alarm/5 p-3 font-mono text-[11px] leading-relaxed text-alarm whitespace-pre-wrap">
                        {r.payload}
                      </pre>
                      <p className="mt-3 font-mono text-[9.5px] tracking-[0.2em] uppercase text-fog-2 mb-1.5">verdicts vs gold</p>
                      <div className="grid grid-cols-2 gap-2">
                        <Verdict sev={r.baseline.severity} team={r.baseline.team} ok={r.baseline.resisted} />
                        <Verdict sev={r.agent.severity} team={r.agent.team} ok={r.agent.resisted} />
                      </div>
                      <p className="mt-2 font-mono text-[10px] text-fog-2">
                        gold: {r.gold.severity} · {r.gold.team}
                      </p>
                    </div>
                    <div>
                      <p className="font-mono text-[9.5px] tracking-[0.2em] uppercase text-fog-2 mb-2">why the agent resists</p>
                      <p className="text-[12.5px] leading-relaxed text-fog">
                        {r.agent.quarantined
                          ? "parse.sanitize flagged the directive in the body and quarantined it. The verdict was computed only from catalog + metrics + calendar — the injected text had no path to influence it."
                          : "No executable directive was present; the poison relied on volume or impersonation, which the agent weighs against tool output rather than text."}
                      </p>
                      <button
                        className="btn-solid mt-4"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.dispatchEvent(new CustomEvent("pm:inject", { detail: { caseId: r.id } }));
                          push("ok", `${r.id} injected into the live console`, "switch to console to watch it triage");
                        }}
                      >
                        inject into console →
                      </button>
                    </div>
                  </div>
                )}
              </button>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
