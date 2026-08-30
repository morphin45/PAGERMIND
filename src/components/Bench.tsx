import { useMemo, useState } from "react";
import { CASES, type IncidentCase } from "../data/incidents";
import { runBaseline } from "../engine/baseline";
import { runAgent, type TraceStep } from "../engine/agent";
import { buildBrief } from "../engine/brief";
import { Reveal, SectionHead, SevChip, usePlayer, useToasts } from "./ui";
import { IconCheck, IconReplay, IconX, IconBook, IconGate, IconMemory, IconDownload } from "./icons";

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

const KIND_COLOR: Record<string, string> = {
  parse: "#5ab8ff",
  tool: "#5ab8ff",
  memory: "#c792ea",
  reason: "#ffb224",
  verify: "#ff5d5d",
  gate: "#31d48e",
};
const KIND_LABEL: Record<string, string> = {
  parse: "PARSE",
  tool: "TOOL",
  memory: "MEM",
  reason: "RULE",
  verify: "CHK",
  gate: "GATE",
};

function StepLine({ s, i, runId }: { s: TraceStep; i: number; runId: number }) {
  return (
    <li key={`${runId}-${i}`} className="step-in flex gap-2">
      <span
        className="chip px-1.5 py-0.5 shrink-0 self-start text-[9px]"
        style={{ color: KIND_COLOR[s.kind], borderColor: `${KIND_COLOR[s.kind]}55` }}
      >
        {KIND_LABEL[s.kind]}
      </span>
      <span className="min-w-0">
        <span className="text-snow">{s.label}</span>
        <span className="block text-fog-2 break-words">{s.detail}</span>
      </span>
    </li>
  );
}

function Match({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${ok ? "text-mint" : "text-alarm"}`}>
      {ok ? <IconCheck size={12} /> : <IconX size={12} />}
      {children}
    </span>
  );
}

export default function Bench() {
  const [selectedId, setSelectedId] = useState("INC-2202");
  const [runId, setRunId] = useState(0);

  const c = useMemo(() => CASES.find((x) => x.id === selectedId) as IncidentCase, [selectedId]);
  const baseline = useMemo(() => runBaseline(c), [c]);
  const agent = useMemo(() => runAgent(c), [c]);
  const { visible, done } = usePlayer(agent.steps.length, runId + selectedId.length, 400);

  const pick = (id: string) => {
    setSelectedId(id);
    setRunId((r) => r + 1);
  };

  // The gold action's intent is binary for judging: does it wake a human?
  const goldPages = /page on-call/i.test(c.gold.action) && !/no page/i.test(c.gold.action);
  const yn = (v: boolean) => (v ? "yes — pages" : "no");
  const rows = [
    ["severity", baseline.severity, agent.severity, c.gold.severity],
    ["team", baseline.team, agent.team, c.gold.team],
    ["runbook", baseline.runbook ?? "—", `${agent.runbook.id} · ${agent.runbook.title}`, `${c.runbook.id} · ${c.runbook.title}`],
    ["pages a human?", yn(baseline.page), yn(agent.page), yn(goldPages)],
  ] as const;

  return (
    <section id="bench" className="mx-auto max-w-7xl scroll-mt-20 px-4 md:px-8 py-20 md:py-28">
      <SectionHead
        index="02"
        kicker="Live bench — baseline vs agent"
        title={
          <>
            Same 12 cases. Same rubric.
            <br />
            <span className="text-amber">Two very different nights on-call.</span>
          </>
        }
        lede="Pick an incident. The baseline is a 40-line regex script — the honest 'before' picture. The agent runs its full tool-grounded pipeline; every step of the trace is the evidence it will be judged on."
      />

      <div className="grid gap-6 lg:grid-cols-12">
        {/* case list */}
        <Reveal className="lg:col-span-4">
          <div className="panel-solid">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="font-mono text-[10px] tracking-[0.22em] text-fog-2 uppercase">evaluation set · 12</span>
              <span className="chip text-fog-2">fixed seed</span>
            </div>
            <ul className="max-h-[520px] overflow-y-auto">
              {CASES.map((x) => (
                <li key={x.id}>
                  <button
                    onClick={() => pick(x.id)}
                    className={`case-row w-full px-4 py-3 text-left ${x.id === selectedId ? "active" : ""}`}
                  >
                    <span className="flex items-center gap-2.5">
                      <span className={`font-mono text-[11px] ${x.id === selectedId ? "text-amber" : "text-fog-2"}`}>
                        {x.id}
                      </span>
                      <span className="font-mono text-[10px] text-fog-2">{x.time}</span>
                      {x.gold.trap && (
                        <span className="chip ml-auto text-[9px] text-alarm border-alarm/40">trap</span>
                      )}
                    </span>
                    <span className="mt-1 block text-[13px] font-medium leading-snug text-snow">{x.title}</span>
                    <span className="font-mono text-[10.5px] text-fog-2">{x.service} · via {x.source}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>

        {/* run area */}
        <div className="lg:col-span-8 space-y-4">
          <Reveal className="flex flex-wrap items-center gap-3">
            <button className="btn-solid" onClick={() => setRunId((r) => r + 1)}>
              <IconReplay size={13} /> Run both arms
            </button>
            <span className="font-mono text-[11px] text-fog-2">
              deterministic — identical trace on every run, on every machine
            </span>
          </Reveal>

          {/* raw alert */}
          <Reveal className="panel p-4 md:p-5">
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <span className="font-mono text-[10px] tracking-[0.22em] text-fog-2 uppercase">raw alert · as paged</span>
              <span className="chip text-fog-2">{c.id}</span>
              <span className="chip text-fog-2">{c.source}</span>
              <span className="chip text-fog-2">{c.time}</span>
              <span className="chip text-fog-2 ml-auto">{c.service}</span>
            </div>
            <pre className="font-mono text-[12px] leading-relaxed text-snow whitespace-pre-wrap">
              {c.alertText.join("\n")}
            </pre>
          </Reveal>

          {/* arms */}
          <div className="grid gap-4 md:grid-cols-2">
            <Reveal className="panel-solid flex flex-col">
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <span className="font-mono text-[10px] tracking-[0.2em] text-fog uppercase">
                  BASELINE · <span className="text-fog-2">regex_script.py</span>
                </span>
                <span className="chip text-fog-2">t ≈ 0.4s · no tools</span>
              </div>
              <div className="p-4 md:p-5 space-y-3 font-mono text-[12px]">
                <p className="text-fog-2">
                  <span className="text-fog">how it decided:</span> {baseline.how}
                </p>
                <div className="space-y-2 border-t border-line pt-3">
                  <p className="flex items-center gap-2">
                    <span className="w-16 text-fog-2 text-[10px] tracking-[0.18em] uppercase">sev</span>
                    <SevChip sev={baseline.severity} />
                  </p>
                  <p className="flex gap-2">
                    <span className="w-16 shrink-0 text-fog-2 text-[10px] tracking-[0.18em] uppercase">team</span>
                    <span className="text-snow">{baseline.team}</span>
                  </p>
                  <p className="flex gap-2">
                    <span className="w-16 shrink-0 text-fog-2 text-[10px] tracking-[0.18em] uppercase">runbook</span>
                    <span className="text-fog-2">— none cited</span>
                  </p>
                  <p className="flex gap-2">
                    <span className="w-16 shrink-0 text-fog-2 text-[10px] tracking-[0.18em] uppercase">action</span>
                    <span className={baseline.page ? "text-alarm" : "text-snow"}>
                      {baseline.action}
                      {baseline.page && <span className="ml-2 chip text-alarm border-alarm/40">pages a human</span>}
                    </span>
                  </p>
                </div>
              </div>
              <div className="mt-auto border-t border-line px-4 py-2.5">
                <span className="font-mono text-[10px] text-fog-2 uppercase tracking-[0.18em]">
                  evidence: <span className="text-alarm">none — keywords only</span>
                </span>
              </div>
            </Reveal>

            <Reveal delay={80} className="panel-solid flex flex-col border-mint/25">
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <span className="font-mono text-[10px] tracking-[0.2em] text-mint uppercase">PAGERMIND AGENT</span>
                <span className="chip text-fog-2">
                  {visible}/{agent.steps.length} steps
                </span>
              </div>
              <div className="p-4 md:p-5">
                <ol className="space-y-1.5 font-mono text-[11px] leading-relaxed min-h-[196px]">
                  {agent.steps.slice(0, visible).map((s, i) => (
                    <StepLine key={i} s={s} i={i} runId={runId} />
                  ))}
                  {!done && (
                    <li className="flex items-center gap-2 text-fog-2">
                      <span className="cursor-blink inline-block h-3 w-1.5 bg-mint" />
                      <span className="text-[9px] tracking-[0.2em] uppercase">working…</span>
                    </li>
                  )}
                </ol>
                {done && (
                  <div className="step-in mt-3 space-y-2.5 border-t border-line pt-3 font-mono text-[12px]">
                    <p className="flex items-center gap-2">
                      <span className="w-16 text-fog-2 text-[10px] tracking-[0.18em] uppercase">sev</span>
                      <SevChip sev={agent.severity} />
                      {agent.adjustment && <span className="chip text-lemon border-lemon/40">{agent.adjustment} by verifier</span>}
                      <span className="ml-auto text-fog-2">conf {agent.confidence.toFixed(2)}</span>
                    </p>
                    <p className="flex gap-2">
                      <span className="w-16 shrink-0 text-fog-2 text-[10px] tracking-[0.18em] uppercase">team</span>
                      <span className="text-snow">{agent.team}</span>
                    </p>
                    <p className="flex gap-2">
                      <span className="w-16 shrink-0 text-fog-2 text-[10px] tracking-[0.18em] uppercase">runbook</span>
                      <span className="text-snow">
                        {agent.runbook.id} · {agent.runbook.title}
                      </span>
                    </p>
                    <p className="flex gap-2">
                      <span className="w-16 shrink-0 text-fog-2 text-[10px] tracking-[0.18em] uppercase">action</span>
                      <span className="text-mint">{agent.action}</span>
                    </p>
                    {agent.memoryNote && (
                      <p className="flex gap-2 text-orchid">
                        <IconMemory size={13} className="mt-0.5 shrink-0" />
                        <span className="text-[11px]">{agent.memoryNote}</span>
                      </p>
                    )}
                    <ul className="space-y-1 border-t border-line pt-2.5">
                      {agent.evidence.map((e) => (
                        <li key={e} className="flex gap-2 text-[11px] text-fog">
                          <span className="text-mint">▸</span> {e}
                        </li>
                      ))}
                    </ul>
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

          {/* verdict vs gold */}
          <Reveal className="panel-solid">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="font-mono text-[10px] tracking-[0.22em] text-fog-2 uppercase">
                verdict vs gold answer (fixed before agent rules were written)
              </span>
              <IconBook size={14} className="text-amber" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left font-mono text-[11.5px]">
                <thead>
                  <tr className="border-b border-line text-[10px] tracking-[0.18em] uppercase text-fog-2">
                    <th className="px-4 py-2.5 font-medium w-24">criterion</th>
                    <th className="px-4 py-2.5 font-medium">baseline</th>
                    <th className="px-4 py-2.5 font-medium">agent</th>
                    <th className="px-4 py-2.5 font-medium text-amber">gold · human-reviewed</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(([label, b, a, g]) => (
                    <tr key={label} className="border-b border-line/60 last:border-0 align-top">
                      <td className="px-4 py-2.5 text-fog-2 uppercase text-[10px] tracking-[0.18em]">{label}</td>
                      <td className="px-4 py-2.5">
                        <Match ok={String(b) === String(g)}>
                          <span className={String(b) === String(g) ? "text-snow" : "text-alarm"}>{b}</span>
                        </Match>
                      </td>
                      <td className="px-4 py-2.5">
                        <Match ok={String(a) === String(g)}>
                          <span className={String(a) === String(g) ? "text-snow" : "text-alarm"}>{a}</span>
                        </Match>
                      </td>
                      <td className="px-4 py-2.5 text-amber">{g}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-amber/25 bg-amber/5 px-4 py-3.5">
              <p className="font-mono text-[10px] tracking-[0.2em] text-amber uppercase">why this case is in the set</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-fog">{c.gold.trapNote}</p>
            </div>
          </Reveal>

          {/* handoff brief — the end-to-end artifact */}
          <Reveal>
            <BriefPanel caseId={c.id} ready={done} />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function BriefPanel({ caseId, ready }: { caseId: string; ready: boolean }) {
  const [open, setOpen] = useState(false);
  const { push } = useToasts();
  const c = useMemo(() => CASES.find((x) => x.id === caseId)!, [caseId]);
  const brief = useMemo(() => buildBrief(c, runAgent(c)), [c]);

  const copy = async () => {
    const ok = await copyText(brief);
    push(ok ? "ok" : "err", ok ? "handoff brief copied to clipboard" : "clipboard unavailable — select and copy manually");
  };

  return (
    <div className="panel-solid">
      <div className="flex items-center gap-3 border-b border-line px-4 py-3">
        <IconDownload size={14} className="text-mint" />
        <span className="font-mono text-[10px] tracking-[0.2em] text-fog-2 uppercase">
          end-to-end artifact · handoff brief for the incident channel
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button className="btn py-1.5 px-3" onClick={copy} disabled={!ready}>
            copy brief
          </button>
          <button className="btn py-1.5 px-3" onClick={() => setOpen((o) => !o)} disabled={!ready}>
            {open ? "hide" : "view"}
          </button>
        </div>
      </div>
      {!ready && (
        <p className="px-4 py-3 font-mono text-[11px] text-fog-2">
          the brief is generated from the completed trace — run the agent first.
        </p>
      )}
      {ready && open && (
        <pre className="step-in max-h-80 overflow-auto whitespace-pre-wrap border-t border-line bg-ink-950/60 p-4 font-mono text-[11px] leading-relaxed text-snow">
          {brief}
        </pre>
      )}
      {ready && !open && (
        <p className="px-4 py-3 font-mono text-[11px] text-fog-2">
          verdict, action, runbook, gate state and the full evidence chain — paste-ready, reviewable in five seconds,
          every claim traceable to the trace above.
        </p>
      )}
    </div>
  );
}
