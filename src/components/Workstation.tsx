import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ADVERSARIAL, CASES, onCallFor, sevColor, type IncidentCase } from "../data/cases";
import { runAgent, buildBrief } from "../engine/engine";
import { ApiError, audit, call, gates, sessions, triage } from "../backend/backend";
import { copyText, SevChip, useCountUp, usePlayer, useToasts, useUtcClock, IconAlert, IconGate, IconMemory, IconReplay } from "./ui";

type RowStatus = "queued" | "triaging" | "auto" | "gate" | "paged" | "rejected" | "error";

interface SimIncident {
  uid: string;
  round: number;
  c: IncidentCase;
  arrivedAt: string;
  status: RowStatus;
  gateId?: string;
  decidedBy?: string;
}

const STATUS_CHIP: Record<RowStatus, { label: string; cls: string }> = {
  queued: { label: "queued", cls: "text-fog-2 border-line-2" },
  triaging: { label: "agent triaging", cls: "text-sky border-sky/50" },
  auto: { label: "auto-resolved", cls: "text-mint border-mint/50" },
  gate: { label: "at human gate", cls: "text-amber border-amber/60 bg-amber/10" },
  paged: { label: "page fired", cls: "text-alarm border-alarm/60 bg-alarm/10" },
  rejected: { label: "page rejected", cls: "text-lemon border-lemon/50" },
  error: { label: "503 — retrying", cls: "text-alarm border-alarm/50" },
};

const KIND_COLOR: Record<string, string> = {
  parse: "#5ab8ff",
  sanitize: "#ff5d5d",
  tool: "#5ab8ff",
  memory: "#c792ea",
  reason: "#ffb224",
  verify: "#ff5d5d",
  gate: "#31d48e",
};

const PAGE_STAGES = ["routing to on-call", "page sent", "delivered to device", "acknowledged"];

function fmtClock(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

function errText(e: unknown): string {
  if (e instanceof ApiError) return `${e.status} ${e.code} · ${e.message} · ${e.requestId}`;
  return e instanceof Error ? e.message : "unknown error";
}

/* ---------------- page delivery — the consequential act lands on a person ---------------- */

function PageDelivery({ team }: { team: string }) {
  const eng = onCallFor(team);
  const [stage, setStage] = useState(0);
  useEffect(() => {
    setStage(0);
    const timers = [600, 1400, 2400].map((ms, i) => window.setTimeout(() => setStage(i + 1), ms));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [team]);
  return (
    <div className="space-y-2.5 border border-alarm/35 bg-alarm/5 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-mono text-[10px] tracking-[0.18em] text-alarm uppercase">
          <IconAlert size={13} /> page fired
        </p>
        <span className="font-mono text-[10px] tabular-nums text-fog-2">immutable · audited</span>
      </div>
      <div className="flex items-center gap-3 border border-line-2 bg-ink-950/70 px-3 py-2.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center border border-alarm/50 font-display text-sm font-bold text-alarm">
          {eng.name.split(" ").map((w) => w[0]).join("")}
        </span>
        <div className="min-w-0">
          <p className="font-mono text-[12px] font-semibold text-snow">{eng.name}</p>
          <p className="font-mono text-[10px] text-fog-2">
            {eng.handle} · {eng.tz} · shift ends {eng.shiftEnds}
          </p>
        </div>
        <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.16em] text-fog-2">{team}</span>
      </div>
      <ol className="grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-4">
        {PAGE_STAGES.map((label, i) => (
          <li key={label} className="flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 shrink-0 transition-colors duration-300 ${i < stage ? "bg-mint" : i === stage ? "bg-amber pulse-amber" : "bg-line-2"}`} />
            <span className={`font-mono text-[9px] uppercase tracking-[0.1em] ${i <= stage ? "text-fog" : "text-fog-2"}`}>{label}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ---------------- KPI tile ---------------- */

function Kpi({ label, value, tone, active }: { label: string; value: number; tone: string; active: boolean }) {
  const n = useCountUp(value, active, 700);
  return (
    <div className="group border border-line bg-ink-900/70 px-4 py-3 transition-all hover:border-line-2 hover:bg-ink-800">
      <p className="font-mono text-[9px] tracking-[0.2em] text-fog-2 uppercase">{label}</p>
      <p className="font-display mt-1 text-2xl font-bold tabular-nums transition-colors group-hover:text-snow" style={{ color: tone }}>
        {n}
      </p>
    </div>
  );
}

/* ---------------- main ---------------- */

export default function Workstation() {
  const { push } = useToasts();
  const clock = useUtcClock();

  const [rows, setRows] = useState<SimIncident[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [session, setSession] = useState(sessions.current());
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const idxRef = useRef(0);
  const roundRef = useRef(1);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const timers = useRef<Set<number>>(new Set());

  const later = useCallback((ms: number, fn: () => void) => {
    const id = window.setTimeout(() => {
      timers.current.delete(id);
      fn();
    }, ms);
    timers.current.add(id);
  }, []);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  useEffect(() => sessions.onChange(() => setSession(sessions.current())), []);

  const patch = useCallback((uid: string, p: Partial<SimIncident>) => {
    setRows((rs) => rs.map((r) => (r.uid === uid ? { ...r, ...p } : r)));
  }, []);

  /* resolve: run the agent through the real API, then dispose */
  const resolve = useCallback(
    (uid: string, retried = false) => {
      const row = rowsRef.current.find((r) => r.uid === uid);
      if (!row) return;
      call<{ verdict: ReturnType<typeof runAgent> }>("GET", `/v1/triage/${row.c.id}`)
        .then((env) => {
          const verdict = env.data.verdict;
          if (!verdict.page) {
            patch(uid, { status: "auto" });
            audit.append({
              actor: "pagermind/agent",
              action: verdict.severity === "DRILL" ? "auto.resolve (rule D-1)" : "auto.dispatch",
              target: `${row.c.id} → ${verdict.team}`,
              outcome: "ok",
              detail: `${verdict.action} · conf ${verdict.confidence.toFixed(2)}`,
              requestId: env.requestId,
            });
          } else {
            const g = gates.propose({
              caseId: row.c.id,
              uid,
              title: row.c.title,
              service: row.c.service,
              severity: verdict.severity as "SEV1" | "SEV2",
              team: verdict.team,
              runbookId: verdict.runbook.id,
              runbookTitle: verdict.runbook.title,
              action: verdict.action,
              confidence: verdict.confidence,
              evidence: verdict.evidence,
            });
            patch(uid, { status: "gate", gateId: g.id });
            push("warn", `${row.c.id} is waiting for you`, `${verdict.severity} → ${verdict.team} · approve or reject at the gate`);
          }
        })
        .catch((e) => {
          if (!retried) {
            later(900, () => resolve(uid, true));
            push("err", "triage failed — retrying", errText(e));
          } else {
            patch(uid, { status: "error" });
          }
        });
    },
    [later, patch, push]
  );

  const TRIAGE_MS = 2300;

  const arrive = useCallback(
    (c: IncidentCase, round: number) => {
      const uid = `${c.id}·r${round}`;
      const fresh: SimIncident = { uid, round, c, arrivedAt: fmtClock(), status: "queued" };
      setRows((rs) => [fresh, ...rs].slice(0, 16));
      setSelected((sel) => sel ?? uid);
      later(380, () => patch(uid, { status: "triaging" }));
      later(380 + TRIAGE_MS, () => resolve(uid));
    },
    [later, patch, resolve]
  );

  /* the sandbox clock */
  useEffect(() => {
    if (paused) return;
    const t = window.setInterval(() => {
      if (idxRef.current >= CASES.length) {
        idxRef.current = 0;
        roundRef.current += 1;
      }
      arrive(CASES[idxRef.current++], roundRef.current);
    }, 5200 / speed);
    return () => window.clearInterval(t);
  }, [paused, speed, arrive]);

  /* first blood — three quick arrivals so the console opens alive */
  useEffect(() => {
    [0, 1, 2].forEach((i) => later(400 + i * 900, () => arrive(CASES[i], 1)));
    idxRef.current = 3;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* guided-demo hook: inject a specific incident on cue */
  useEffect(() => {
    const onInject = (e: Event) => {
      const caseId = (e as CustomEvent<{ caseId?: string }>).detail?.caseId;
      const c = [...CASES, ...ADVERSARIAL].find((x) => x.id === caseId);
      if (!c) return;
      arrive(c, roundRef.current);
      push("ok", `${c.id} injected on cue`, `${c.service} — ${c.title}`);
    };
    window.addEventListener("pm:inject", onInject);
    return () => window.removeEventListener("pm:inject", onInject);
  }, [arrive, push]);

  const reset = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current.clear();
    idxRef.current = 0;
    roundRef.current = 1;
    setRows([]);
    setSelected(null);
    [0, 1, 2].forEach((i) => later(300 + i * 700, () => arrive(CASES[i], 1)));
    idxRef.current = 3;
    push("ok", "simulation reset", "sandbox clock restarted at round 1");
  };

  const decide = async (row: SimIncident, decision: "approve" | "reject") => {
    if (!row.gateId) return;
    setBusy(true);
    try {
      const env = await call<import("../backend/backend").GateProposal>("POST", `/v1/gates/${row.gateId}/decisions`, { body: { decision, reason }, session });
      patch(row.uid, { status: decision === "approve" ? "paged" : "rejected", decidedBy: env.data.decidedBy });
      push(decision === "approve" ? "ok" : "warn", `${row.c.id} ${decision === "approve" ? "approved — page fired" : "rejected"}`, `by ${env.data.decidedBy} · ${env.requestId}`);
      setReason("");
    } catch (e) {
      push("err", "decision rejected", errText(e));
    } finally {
      setBusy(false);
    }
  };

  const selectedRow = rows.find((r) => r.uid === selected) ?? null;
  const verdict = useMemo(() => (selectedRow ? runAgent(selectedRow.c) : null), [selectedRow]);
  const uidHash = useMemo(() => [...(selectedRow?.uid ?? "")].reduce((a, ch) => a + ch.charCodeAt(0), 0), [selectedRow?.uid]);
  const { visible, done } = usePlayer(verdict?.steps.length ?? 0, uidHash, 300);

  const kpi = {
    auto: rows.filter((r) => r.status === "auto").length,
    gate: rows.filter((r) => r.status === "gate").length,
    paged: rows.filter((r) => r.status === "paged").length,
    prevented: rows.filter((r) => r.status === "auto" && r.c.gold.severity === "DRILL").length,
  };

  return (
    <section id="console" className="mx-auto max-w-7xl scroll-mt-20 px-4 md:px-8 pt-20 md:pt-24 pb-6">
      {/* control strip */}
      <div className="panel flex flex-wrap items-center gap-3 px-4 py-3">
        <span className="flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] text-fog-2 uppercase">
          <span className={`h-1.5 w-1.5 ${paused ? "bg-lemon" : "bg-mint pulse-dot"}`} />
          sandbox clock
        </span>
        <span className="font-mono text-[12px] tabular-nums text-snow">{clock}</span>
        <span className="chip text-fog-2">round {roundRef.current}</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button className="btn py-1.5 px-3" onClick={() => setPaused((p) => !p)}>
            {paused ? "resume" : "pause"}
          </button>
          <button className="btn py-1.5 px-3" onClick={() => setSpeed((s) => (s === 1 ? 2 : s === 2 ? 4 : 1))}>
            speed ×{speed}
          </button>
          <button className="btn py-1.5 px-3" onClick={reset}>
            <IconReplay size={12} /> reset
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        <Kpi label="auto-resolved" value={kpi.auto} tone="#31d48e" active />
        <Kpi label="at human gate" value={kpi.gate} tone="#ffb224" active />
        <Kpi label="pages fired (approved)" value={kpi.paged} tone="#ff5d5d" active />
        <Kpi label="false pages prevented" value={kpi.prevented} tone="#5ab8ff" active />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-12">
        {/* feed */}
        <div className="lg:col-span-5">
          <div className="panel-solid">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="font-mono text-[10px] tracking-[0.22em] text-fog-2 uppercase">incident feed</span>
              <span className="flex items-center gap-1.5 font-mono text-[10px] text-alarm">
                <span className="h-1.5 w-1.5 bg-alarm pulse-amber" /> streaming
              </span>
            </div>
            <ul className="max-h-[560px] overflow-y-auto">
              {rows.length === 0 && (
                <li className="px-4 py-8 text-center font-mono text-[11px] text-fog-2">waiting for the first alert…</li>
              )}
              {rows.map((r) => {
                const chip = STATUS_CHIP[r.status];
                return (
                  <li key={r.uid}>
                    <button onClick={() => setSelected(r.uid)} className={`case-row w-full px-4 py-2.5 text-left ${r.uid === selected ? "active" : ""}`}>
                      <span className="flex items-center gap-2">
                        <span className={`font-mono text-[10.5px] ${r.uid === selected ? "text-amber" : "text-fog-2"}`}>{r.c.id}</span>
                        <span className="font-mono text-[10px] text-fog-2">{r.arrivedAt}</span>
                        <span className={`chip ml-auto text-[9px] ${chip.cls}`}>{chip.label}</span>
                      </span>
                      <span className="mt-0.5 flex items-center gap-2">
                        <span className="h-1.5 w-1.5 shrink-0" style={{ background: sevColor[r.c.gold.severity] }} />
                        <span className="truncate text-[12.5px] font-medium text-snow">{r.c.title}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* detail */}
        <div className="lg:col-span-7">
          <div className="panel-solid">
            {!selectedRow && (
              <div className="grid h-64 place-items-center font-mono text-[11px] text-fog-2">select an incident to watch the agent work</div>
            )}
            {selectedRow && verdict && (
              <>
                <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
                  <span className="font-mono text-[11px] text-amber">{selectedRow.c.id}</span>
                  <span className="chip text-fog-2">{selectedRow.c.source}</span>
                  <span className="chip text-fog-2">{selectedRow.c.service}</span>
                  <span className={`chip ml-auto text-[9px] ${STATUS_CHIP[selectedRow.status].cls}`}>{STATUS_CHIP[selectedRow.status].label}</span>
                </div>
                <div className="grid gap-0 md:grid-cols-2">
                  {/* raw alert */}
                  <div className="border-b border-line p-4 md:border-b-0 md:border-r">
                    <p className="mb-2 font-mono text-[9.5px] tracking-[0.22em] text-fog-2 uppercase">raw alert · as paged</p>
                    <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-snow">{selectedRow.c.alertText.join("\n")}</pre>
                  </div>
                  {/* live trace */}
                  <div className="p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="font-mono text-[9.5px] tracking-[0.22em] text-fog-2 uppercase">agent trace</p>
                      <span className="font-mono text-[10px] text-fog-2">
                        {visible}/{verdict.steps.length}
                      </span>
                    </div>
                    <ol className="min-h-[150px] space-y-1 font-mono text-[10.5px] leading-relaxed">
                      {verdict.steps.slice(0, visible).map((s, i) => (
                        <li key={i} className="step-in flex gap-2">
                          <span className="chip shrink-0 self-start px-1.5 py-0.5 text-[8.5px]" style={{ color: KIND_COLOR[s.kind], borderColor: `${KIND_COLOR[s.kind]}55` }}>
                            {s.kind.slice(0, 4).toUpperCase()}
                          </span>
                          <span className="min-w-0">
                            <span className="text-snow">{s.label}</span>
                            <span className="block break-words text-fog-2">{s.detail}</span>
                          </span>
                        </li>
                      ))}
                      {!done && (
                        <li className="flex items-center gap-2 text-fog-2">
                          <span className="cursor-blink inline-block h-3 w-1.5 bg-mint" />
                          <span className="text-[9px] tracking-[0.2em] uppercase">working…</span>
                        </li>
                      )}
                    </ol>
                  </div>
                </div>

                {/* verdict + actions */}
                {done && (
                  <div className="step-in space-y-3 border-t border-line p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <SevChip sev={verdict.severity} />
                      <span className="font-mono text-[11.5px] text-snow">{verdict.team}</span>
                      {verdict.adjustment && <span className="chip border-lemon/40 text-lemon">{verdict.adjustment} by critic</span>}
                      {verdict.memoryNote && (
                        <span className="flex items-center gap-1.5 font-mono text-[10.5px] text-orchid">
                          <IconMemory size={12} /> {verdict.memoryNote}
                        </span>
                      )}
                      <span className="ml-auto font-mono text-[10px] text-fog-2">conf {verdict.confidence.toFixed(2)}</span>
                    </div>
                    <p className="font-mono text-[11.5px] text-mint">{verdict.action}</p>

                    {selectedRow.status === "paged" && <PageDelivery team={verdict.team} />}

                    {selectedRow.status === "gate" && (
                      <div className="space-y-2.5 border border-amber/35 bg-amber/5 p-3">
                        <p className="flex items-center gap-2 font-mono text-[10px] tracking-[0.18em] text-amber uppercase">
                          <IconGate size={13} /> human approval required
                        </p>
                        {!session ? (
                          <p className="font-mono text-[11px] text-fog">
                            sign in at the <a href="#desk" className="text-amber underline underline-offset-2">operations desk</a> to decide this page.
                          </p>
                        ) : (
                          <>
                            <div className="flex gap-2">
                              <input
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                aria-label="Decision note for the audit ledger"
                                placeholder="decision note (required for reject — goes to the ledger)"
                                className="min-w-0 flex-1 border border-line bg-ink-900 px-2.5 py-1.5 font-mono text-[11px] text-snow placeholder:text-fog-2 focus:border-amber focus:outline-none"
                              />
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <button className="btn-solid py-1.5 px-3.5" disabled={busy} onClick={() => decide(selectedRow, "approve")}>
                                approve page
                              </button>
                              <button className="btn py-1.5 px-3.5" disabled={busy} onClick={() => decide(selectedRow, "reject")}>
                                reject
                              </button>
                              <span className="font-mono text-[10px] text-fog-2">as {session.name} ({session.role})</span>
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        className="btn py-1.5 px-3"
                        onClick={async () => {
                          const ok = await copyText(buildBrief(selectedRow.c, verdict));
                          push(ok ? "ok" : "err", ok ? "handoff brief copied" : "clipboard unavailable");
                        }}
                      >
                        copy handoff brief
                      </button>
                      <span className="font-mono text-[10px] text-fog-2">verdict + evidence chain, paste-ready</span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
