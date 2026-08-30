import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { call, onChaos } from "../backend/api";
import { audit, gates, REVIEWERS } from "../backend/services";
import { ApiError, type Session } from "../backend/types";
import { runAgent } from "../engine/agent";
import { runBaseline } from "../engine/baseline";
import {
  createDeck,
  fmtClock,
  nextArrivalDelay,
  onCallFor,
  resetClock,
  tickClock,
  TRIAGE_MS,
  type SimIncident,
} from "../engine/sim";
import { CASES, sevColor } from "../data/incidents";
import { ADVERSARIAL } from "../data/adversarial";
import { SevChip, usePlayer, useToasts } from "./ui";
import { IconAlert, IconCheck, IconGate, IconReplay, IconUser, IconX } from "./icons";

const SESSION_KEY = "pagermind.session-id";

const STATUS_META: Record<SimIncident["status"], { label: string; cls: string }> = {
  queued: { label: "QUEUED", cls: "text-fog-2 border-line-2" },
  triaging: { label: "AGENT TRIAGING", cls: "text-sky border-sky/50" },
  auto: { label: "AUTO-RESOLVED", cls: "text-mint border-mint/45" },
  gate: { label: "AWAITING HUMAN", cls: "text-amber border-amber/55" },
  paged: { label: "PAGE FIRED", cls: "text-alarm border-alarm/50" },
  rejected: { label: "REJECTED", cls: "text-fog-2 border-line-2" },
};

function errText(e: unknown): string {
  if (e instanceof ApiError) return `${e.status} ${e.code} · ${e.message} · ${e.requestId}`;
  return e instanceof Error ? e.message : "unknown error";
}

/* ---------------- page delivery — the consequential act lands on a person ---------------- */
const PAGE_STAGES = ["routing to on-call", "page sent", "delivered to device", "acknowledged"];

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
            <span
              className={`h-1.5 w-1.5 shrink-0 transition-colors duration-300 ${
                i < stage ? "bg-mint" : i === stage ? "bg-amber pulse-amber" : "bg-line-2"
              }`}
            />
            <span className={`font-mono text-[9px] uppercase tracking-[0.1em] ${i <= stage ? "text-fog" : "text-fog-2"}`}>
              {label}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ---------------- KPI tile ---------------- */
function Kpi({ label, value, tone, sub }: { label: string; value: number; tone: string; sub: string }) {
  return (
    <div className="panel px-4 py-3.5 transition-colors hover:border-line-2">
      <p className="font-mono text-[9px] tracking-[0.22em] text-fog-2 uppercase">{label}</p>
      <p className="font-display mt-1 text-3xl font-bold tabular-nums" style={{ color: tone }}>
        {value}
      </p>
      <p className="mt-0.5 font-mono text-[10px] text-fog-2">{sub}</p>
    </div>
  );
}

/* ---------------- incident detail panel ---------------- */
function DetailPanel({
  row,
  session,
  onSession,
  onDecided,
}: {
  row: SimIncident | null;
  session: Session | null;
  onSession: (s: Session | null) => void;
  onDecided: (uid: string, status: "paged" | "rejected") => void;
}) {
  const { push } = useToasts();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const verdict = useMemo(() => (row ? runAgent(row.c) : null), [row]);
  const uidHash = useMemo(() => [...(row?.uid ?? "")].reduce((a, ch) => a + ch.charCodeAt(0), 0), [row?.uid]);
  const { visible, done } = usePlayer(verdict?.steps.length ?? 0, uidHash, 340);

  useEffect(() => setReason(""), [row?.uid]);

  if (!row || !verdict) {
    return (
      <div className="panel flex h-full min-h-[420px] flex-col items-center justify-center gap-3 p-8 text-center">
        <IconGate size={30} className="text-fog-2" />
        <p className="font-mono text-[11px] leading-relaxed text-fog-2">
          select an incident — or wait.
          <br />
          the night is young and the feed is live.
        </p>
      </div>
    );
  }

  const decide = async (decision: "approve" | "reject") => {
    if (!row.gateId) return;
    if (!session) {
      push("err", "sign-in required", "pick a reviewer below — the gate checks your role server-side");
      return;
    }
    setBusy(true);
    try {
      await call("POST", `/v1/gates/${row.gateId}/decisions`, {
        body: { decision, reason: reason.trim() || (decision === "approve" ? "verified against runbook" : "") },
        session,
      });
      onDecided(row.uid, decision === "approve" ? "paged" : "rejected");
      push("ok", decision === "approve" ? "page approved & fired" : "page rejected", "written to the audit ledger");
    } catch (e) {
      push("err", "decision failed", errText(e));
    } finally {
      setBusy(false);
    }
  };

  const signIn = async (reviewerId: string) => {
    setBusy(true);
    try {
      const env = await call<Session>("POST", "/v1/sessions", { body: { reviewerId } });
      window.localStorage.setItem(SESSION_KEY, env.data.id);
      onSession(env.data);
      push("ok", `signed in as ${env.data.name}`, `role=${env.data.role}`);
    } catch (e) {
      push("err", "sign-in failed", errText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel flex h-full flex-col">
      <div className="border-b border-line px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-amber">{row.uid}</span>
          <span className="font-mono text-[10px] text-fog-2">{row.arrivedAt}</span>
          <span className={`chip ml-auto ${STATUS_META[row.status].cls}`}>{STATUS_META[row.status].label}</span>
        </div>
        <p className="mt-1.5 text-[14px] font-semibold leading-snug text-snow">{row.c.title}</p>
        <p className="font-mono text-[10.5px] text-fog-2">{row.c.service} · via {row.c.source}</p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <ol className="space-y-1.5 font-mono text-[10.5px] leading-relaxed">
          {verdict.steps.slice(0, visible).map((s, i) => (
            <li key={i} className="step-in flex gap-2">
              <span className="text-fog-2 shrink-0 w-12 uppercase text-[9px] tracking-[0.14em] pt-0.5">{s.kind}</span>
              <span className="min-w-0">
                <span className="text-snow">{s.label}</span>
                <span className="block break-words text-fog-2">{s.detail}</span>
              </span>
            </li>
          ))}
          {!done && (
            <li className="flex items-center gap-2 text-fog-2">
              <span className="cursor-blink inline-block h-3 w-1.5 bg-mint" />
            </li>
          )}
        </ol>

        {done && (
          <div className="step-in mt-4 space-y-3 border-t border-line pt-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <SevChip sev={verdict.severity} />
              <span className="font-mono text-[11px] text-snow">{verdict.team}</span>
              <span className="ml-auto font-mono text-[10px] text-fog-2">conf {verdict.confidence.toFixed(2)}</span>
            </div>
            <p className="font-mono text-[11px] text-fog">
              <span className="text-fog-2">action · </span>
              {verdict.action}
            </p>
            <ul className="space-y-1">
              {verdict.evidence.map((e) => (
                <li key={e} className="flex gap-2 font-mono text-[10.5px] text-fog">
                  <span className="text-mint">▸</span> {e}
                </li>
              ))}
            </ul>
            {verdict.memoryNote && (
              <p className="font-mono text-[10.5px] text-orchid">mem · {verdict.memoryNote}</p>
            )}

            {/* gate controls */}
            {row.status === "gate" && row.gateId && (
              <div className="space-y-2.5 border-t border-amber/30 bg-amber/5 p-3">
                <p className="flex items-center gap-2 font-mono text-[10px] tracking-[0.18em] text-amber uppercase">
                  <IconGate size={13} /> human checkpoint — consequential act
                </p>
                {!session ? (
                  <div className="space-y-2">
                    <p className="font-mono text-[10.5px] text-fog">sign in to act (sandbox roster — roles are enforced server-side):</p>
                    <div className="flex flex-wrap gap-2">
                      {REVIEWERS.map((r) => (
                        <button key={r.id} className="btn py-1.5 px-2.5" disabled={busy} onClick={() => signIn(r.id)}>
                          <IconUser size={12} /> {r.name.split(" ")[0]} · {r.role}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="font-mono text-[10px] text-fog-2">
                      {session.name} · {session.role}
                      {session.role !== "reviewer" && <span className="text-alarm"> — viewer cannot act (403 will be audited)</span>}
                    </p>
                    <input
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      aria-label="Decision note for the audit ledger"
                      placeholder="decision note (required for reject — goes to the ledger)"
                      className="w-full border border-line-2 bg-ink-950 px-3 py-2 font-mono text-[11px] text-snow placeholder:text-fog-2 focus:border-amber focus:outline-none"
                    />
                    <div className="flex gap-2">
                      <button className="btn-solid flex-1 justify-center py-2" disabled={busy} onClick={() => decide("approve")}>
                        <IconCheck size={12} /> approve page
                      </button>
                      <button className="btn flex-1 justify-center py-2" disabled={busy} onClick={() => decide("reject")}>
                        <IconX size={12} /> reject
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
            {row.status === "auto" && (
              <p className="border-t border-line pt-3 font-mono text-[10.5px] text-mint">
                non-consequential — executed under pre-approved automation, audit note attached
              </p>
            )}
            {row.status === "paged" && (
              <div className="border-t border-line pt-3">
                <PageDelivery team={verdict.team} />
              </div>
            )}
            {row.status === "rejected" && (
              <p className="border-t border-line pt-3 font-mono text-[10.5px] text-fog">
                rejected — decision is immutable and audited
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- workstation ---------------- */
export default function Workstation() {
  const { push } = useToasts();
  const [rows, setRows] = useState<SimIncident[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState<1 | 4>(1);
  const [chaos, setChaosState] = useState(false);
  const [clock, setClock] = useState(fmtClock());
  const [session, setSession] = useState<Session | null>(null);
  const [round, setRound] = useState(1);

  const deckRef = useRef(createDeck(1));
  const idxRef = useRef(0);
  const timersRef = useRef<Set<number>>(new Set());
  const preventedRef = useRef(0);

  const later = useCallback((ms: number, fn: () => void) => {
    const id = window.setTimeout(() => {
      timersRef.current.delete(id);
      fn();
    }, ms);
    timersRef.current.add(id);
  }, []);

  /* session rehydration */
  useEffect(() => {
    const id = window.localStorage.getItem(SESSION_KEY);
    if (!id) return;
    call<Session>("GET", `/v1/sessions/${id}`)
      .then((env) => setSession(env.data))
      .catch(() => window.localStorage.removeItem(SESSION_KEY));
  }, []);

  useEffect(() => onChaos(setChaosState), []);

  /* sim clock */
  useEffect(() => {
    const t = window.setInterval(() => setClock(tickClock(speed)), 1000);
    return () => window.clearInterval(t);
  }, [speed]);

  /* resolve an incident through the real API */
  const resolve = useCallback(
    (uid: string, retry = 0) => {
      const row = rowsRef.current.find((r) => r.uid === uid);
      if (!row) return;
      call<{ verdict: ReturnType<typeof runAgent> }>("GET", `/v1/triage/${row.c.id}`)
        .then((env) => {
          const v = env.data.verdict;
          if (v.page) {
            const gate = gates.propose({
              caseId: row.c.id,
              uid,
              title: row.c.title,
              service: row.c.service,
              severity: v.severity,
              team: v.team,
              runbookId: v.runbook.id,
              runbookTitle: v.runbook.title,
              action: v.action,
              confidence: v.confidence,
              evidence: v.evidence,
            });
            patch(uid, { status: "gate", gateId: gate.id });
          } else {
            audit.append({
              actor: "pagermind/triage",
              action: "triage.resolve",
              target: uid,
              outcome: "ok",
              detail: `${v.severity} · ${v.action}`,
              requestId: env.requestId,
            });
            if (runBaseline(row.c).page) preventedRef.current += 1;
            patch(uid, { status: "auto" });
          }
        })
        .catch((e) => {
          if (retry < 3) later(900, () => resolve(uid, retry + 1));
          else push("err", "triage failed after retries", errText(e));
        });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  /* rows ref mirror for async callbacks */
  const rowsRef = useRef<SimIncident[]>([]);
  rowsRef.current = rows;

  const roundRef = useRef(1);
  roundRef.current = round;

  const patch = useCallback((uid: string, p: Partial<SimIncident>) => {
    setRows((rs) => rs.map((r) => (r.uid === uid ? { ...r, ...p } : r)));
  }, []);

  /* spawn loop */
  useEffect(() => {
    if (!running) return;
    let cancelled = false;
    const schedule = () => {
      later(nextArrivalDelay(speed), () => {
        if (cancelled) return;
        if (idxRef.current >= deckRef.current.length) {
          setRound((r) => {
            deckRef.current = createDeck(r + 1);
            return r + 1;
          });
          idxRef.current = 0;
        }
        const c = deckRef.current[idxRef.current++];
        const uid = `${c.id}·r${round}`;
        const fresh: SimIncident = { uid, round, c, arrivedAt: fmtClock(), status: "queued" };
        setRows((rs) => [fresh, ...rs].slice(0, 16));
        later(380, () => patch(uid, { status: "triaging" }));
        later(380 + TRIAGE_MS, () => resolve(uid));
        schedule();
      });
    };
    schedule();
    return () => {
      cancelled = true;
    };
  }, [running, speed, round, later, patch, resolve]);

  useEffect(() => () => timersRef.current.forEach((t) => window.clearTimeout(t)), []);

  const reset = () => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current.clear();
    setRows([]);
    setSelected(null);
    idxRef.current = 0;
    preventedRef.current = 0;
    resetClock();
    setClock(fmtClock());
    setRound(1);
    deckRef.current = createDeck(1);
    push("ok", "simulation reset", "deck re-seeded · audit ledger intentionally preserved");
  };

  /* guided-demo hook: inject a specific incident on cue (pm:inject) */
  useEffect(() => {
    const onInject = (e: Event) => {
      const caseId = (e as CustomEvent<{ caseId?: string }>).detail?.caseId;
      const c = CASES.find((x) => x.id === caseId) ?? ADVERSARIAL.find((x) => x.id === caseId);
      if (!c) return;
      const uid = `${c.id}·demo${Math.floor(Math.random() * 1e4)}`;
      const fresh: SimIncident = { uid, round: roundRef.current, c, arrivedAt: fmtClock(), status: "queued" };
      setRows((rs) => [fresh, ...rs].slice(0, 16));
      setSelected(uid);
      later(380, () => patch(uid, { status: "triaging" }));
      later(380 + TRIAGE_MS, () => resolve(uid));
      push("ok", `${c.id} injected on cue`, `${c.service} — ${c.title}`);
    };
    window.addEventListener("pm:inject", onInject);
    return () => window.removeEventListener("pm:inject", onInject);
  }, [later, patch, resolve, push]);

  const kpi = {
    auto: rows.filter((r) => r.status === "auto").length,
    gate: rows.filter((r) => r.status === "gate").length,
    paged: rows.filter((r) => r.status === "paged").length,
    prevented: preventedRef.current,
  };

  const selectedRow = rows.find((r) => r.uid === selected) ?? null;

  return (
    <section id="console" className="mx-auto max-w-7xl scroll-mt-20 px-4 md:px-8 pt-20 md:pt-24 pb-6">
      {/* control strip */}
      <div className="flex flex-wrap items-center gap-3 border border-line bg-ink-900/70 px-4 py-3">
        <span className="chip text-mint border-mint/40">SANDBOX-SIM</span>
        <span className="font-mono text-[12px] tabular-nums text-snow">{clock} sim</span>
        <span className="font-mono text-[10px] text-fog-2">round {round} · deck {Math.min(idxRef.current, 12)}/12</span>
        {chaos && (
          <span className="chip text-alarm border-alarm/50 flex items-center gap-1.5">
            <IconAlert size={11} /> STORAGE OFFLINE — TRIAGE RETRYING
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button className="btn py-1.5 px-3" onClick={() => setRunning((r) => !r)}>
            {running ? "pause feed" : "resume feed"}
          </button>
          <button className={`btn py-1.5 px-3 ${speed === 4 ? "text-amber border-amber" : ""}`} onClick={() => setSpeed((s) => (s === 1 ? 4 : 1))}>
            {speed}× speed
          </button>
          <button className="btn py-1.5 px-3" onClick={reset}>
            <IconReplay size={12} /> reset
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="auto-resolved" value={kpi.auto} tone="#31d48e" sub="pre-approved automation + audit note" />
        <Kpi label="awaiting human" value={kpi.gate} tone="#ffb224" sub="consequential — gated by design" />
        <Kpi label="pages fired" value={kpi.paged} tone="#ff5d5d" sub="only after reviewer approval" />
        <Kpi label="false pages prevented" value={kpi.prevented} tone="#5ab8ff" sub="baseline would have woken someone" />
      </div>

      {/* table + panel */}
      <div className="mt-4 grid gap-4 lg:grid-cols-12 items-start">
        <div className="lg:col-span-7 xl:col-span-8">
          <div className="panel-solid">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="font-mono text-[10px] tracking-[0.22em] text-fog-2 uppercase">incident queue · newest first</span>
              <span className="flex items-center gap-1.5 font-mono text-[10px] text-mint">
                <span className={`h-1.5 w-1.5 bg-mint ${running ? "pulse-dot" : ""}`} /> {running ? "streaming" : "paused"}
              </span>
            </div>
            {rows.length === 0 ? (
              <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 p-8 text-center">
                <IconGate size={28} className="text-fog-2" />
                <p className="font-mono text-[11px] text-fog-2">
                  {running ? "warming up — first alert inbound…" : "feed paused. resume when ready."}
                </p>
              </div>
            ) : (
              <ul>
                {rows.map((r) => {
                  const v = r.status === "queued" || r.status === "triaging" ? null : runAgent(r.c);
                  return (
                    <li key={r.uid}>
                      <button
                        onClick={() => setSelected(r.uid)}
                        className={`case-row feed-in flex w-full items-center gap-3 border-b border-line/60 px-4 py-2.5 text-left last:border-0 ${selected === r.uid ? "active" : ""}`}
                      >
                        <span className="font-mono text-[10.5px] tabular-nums text-fog-2 w-14 shrink-0">{r.arrivedAt}</span>
                        <span className="font-mono text-[10.5px] text-fog w-28 shrink-0 truncate">{r.uid}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12.5px] font-medium text-snow">
                            <span className="text-fog-2">{r.c.service}</span> — {r.c.title}
                          </span>
                        </span>
                        {v ? (
                          <span className="shrink-0">
                            <SevChip sev={v.severity} />
                          </span>
                        ) : (
                          <span className="chip shrink-0 text-sky border-sky/40">…</span>
                        )}
                        <span
                          className={`chip shrink-0 hidden sm:inline-block ${STATUS_META[r.status].cls}`}
                          style={r.status === "gate" ? { borderColor: `${sevColor["SEV2"]}88` } : undefined}
                        >
                          {STATUS_META[r.status].label}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
        <div className="lg:col-span-5 xl:col-span-4 lg:sticky lg:top-16">
          <DetailPanel
            row={selectedRow}
            session={session}
            onSession={setSession}
            onDecided={(uid, status) => patch(uid, { status })}
          />
        </div>
      </div>
    </section>
  );
}
