import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CASES, CORRELATED, STORM, sevColor, type IncidentCase } from "../data/cases";
import { buildPostmortem, runAgent, runBaseline } from "../engine/engine";
import {
  ApiError,
  audit,
  call,
  gates,
  isChaos,
  obs,
  onChaos,
  onGatesChanged,
  REVIEWERS,
  sessions,
  setChaos,
  validateDecision,
  type GateProposal,
  type Session,
} from "../backend/backend";
import { copyText, downloadFile, Reveal, SectionHead, SevChip, useToasts, IconActivity, IconAlert, IconBolt, IconBook, IconCheck, IconDownload, IconGate, IconShield, IconUser, IconX } from "./ui";

function errText(e: unknown): string {
  if (e instanceof ApiError) return `${e.status} ${e.code} · ${e.message} · ${e.requestId}`;
  return e instanceof Error ? e.message : "unknown error";
}

/* ================= STORM — correlation engine ================= */

type StormPhase = "idle" | "storm" | "correlating" | "done";

export function CorrelationEngine() {
  const { push } = useToasts();
  const [phase, setPhase] = useState<StormPhase>("idle");
  const [alertsIn, setAlertsIn] = useState(0);
  const timers = useRef<Set<number>>(new Set());
  const stagedRef = useRef(false);
  const verdict = useMemo(() => runAgent(CORRELATED), []);
  const baselineRows = useMemo(() => STORM.map((a) => ({ a, b: runBaseline({ ...CORRELATED, alertText: [a.text], service: a.source, id: a.id }) })), []);

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
      if (!stagedRef.current) {
        const existing = gates.list().some((g) => g.caseId === CORRELATED.id);
        if (!existing) {
          gates.propose({
            caseId: CORRELATED.id,
            uid: `${CORRELATED.id}·storm`,
            title: CORRELATED.title,
            service: CORRELATED.service,
            severity: verdict.severity as "SEV1" | "SEV2",
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
            detail: "temporal + topology + change correlation · fingerprint ≈ INC-2201",
            requestId: "storm",
          });
          push("ok", "storm correlated → 1 incident", "the SEV1 page is waiting at your gate");
        }
        stagedRef.current = true;
      }
    });
  }, [later, push, verdict]);

  useEffect(() => {
    const onStorm = () => replay();
    window.addEventListener("pm:storm", onStorm);
    return () => window.removeEventListener("pm:storm", onStorm);
  }, [replay]);

  const baselinePages = baselineRows.filter((r) => r.b.page).length;

  return (
    <section id="storm" className="mx-auto max-w-7xl scroll-mt-20 px-4 md:px-8 py-16 md:py-24">
      <SectionHead
        index="02"
        kicker="Correlation engine — alert storm → one incident"
        title={
          <>
            One broken deploy.
            <br />
            <span className="text-amber">Four alerts. One decision.</span>
          </>
        }
        lede="Deploy #5011 breaks checkout and the monitoring stack shouts about it four times in 39 seconds. The baseline fires four independent actions. The correlation engine groups on temporal, topology and change evidence — and pages once."
      />
      <div className="grid gap-4 lg:grid-cols-12">
        <Reveal className="lg:col-span-5">
          <div className="panel-solid h-full">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="font-mono text-[10px] tracking-[0.22em] text-fog-2 uppercase">raw alert stream · 03:41</span>
              <button className="btn-solid py-1.5 px-3.5" onClick={replay} disabled={phase === "storm" || phase === "correlating"}>
                <IconBolt size={12} /> {phase === "idle" ? "play the storm" : "replay"}
              </button>
            </div>
            <ul className="space-y-2 p-4">
              {STORM.map((a, i) => (
                <li
                  key={a.id}
                  className={`border px-3 py-2.5 font-mono text-[11px] transition-all duration-300 ${
                    i < alertsIn ? "feed-in border-alarm/40 bg-alarm/5" : "border-line bg-ink-900/40 opacity-30"
                  }`}
                >
                  <span className="text-fog-2">{a.at}</span> <span className="text-sky">[{a.source}]</span>{" "}
                  <span className="text-snow">{a.text}</span>
                </li>
              ))}
              {phase === "correlating" && (
                <li className="feed-in flex items-center gap-2 border border-sky/40 bg-sky/5 px-3 py-2.5 font-mono text-[11px] text-sky">
                  <span className="cursor-blink inline-block h-3 w-1.5 bg-sky" /> correlating: temporal window · service graph · deploy #5011…
                </li>
              )}
              {phase === "done" && (
                <li className="feed-in border border-mint/40 bg-mint/5 px-3 py-3">
                  <p className="font-mono text-[11px] font-bold text-mint">→ {CORRELATED.id}: {CORRELATED.title}</p>
                  <ul className="mt-2 space-y-1 font-mono text-[10.5px] text-fog">
                    <li><span className="text-mint">▸</span> temporal: 4 alerts within 39s (&lt; 60s window)</li>
                    <li><span className="text-mint">▸</span> topology: all downstream of checkout-api</li>
                    <li><span className="text-mint">▸</span> change: deploy #5011 at T−3m (strongest signal)</li>
                    <li><span className="text-orchid">▸</span> fingerprint ≈ INC-2201 — memory cites the 6-min rollback fix</li>
                  </ul>
                </li>
              )}
            </ul>
          </div>
        </Reveal>

        <Reveal delay={80} className="lg:col-span-7">
          <div className="panel-solid h-full">
            <div className="flex items-center gap-2 border-b border-line px-4 py-3">
              <span className="font-mono text-[10px] tracking-[0.22em] text-fog-2 uppercase">what each arm does with the same storm</span>
              <IconShield size={13} className="ml-auto text-amber" />
            </div>
            <div className="grid gap-0 md:grid-cols-2">
              <div className="border-b border-line p-4 md:border-b-0 md:border-r">
                <p className="font-mono text-[10px] tracking-[0.2em] text-fog-2 uppercase">baseline · regex script</p>
                <ul className="mt-2.5 space-y-1.5">
                  {baselineRows.map(({ a, b }) => (
                    <li key={a.id} className="flex items-center gap-2 font-mono text-[10.5px]">
                      <span className="text-fog-2">{a.source}</span>
                      <span className="ml-auto flex items-center gap-1.5">
                        <SevChip sev={b.severity} />
                        <span className={b.page ? "text-alarm" : "text-fog-2"}>{b.page ? "pages" : b.action.split("→")[0]}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 border-t border-line pt-2.5 font-mono text-[10.5px] text-alarm">
                  {baselinePages} pages · {4 - baselinePages} misroutes — four wakes, one real problem
                </p>
              </div>
              <div className="p-4">
                <p className="font-mono text-[10px] tracking-[0.2em] text-mint uppercase">pagermind · correlated</p>
                {phase !== "done" ? (
                  <p className="mt-2.5 font-mono text-[11px] text-fog-2">play the storm to see the grouped verdict.</p>
                ) : (
                  <div className="step-in space-y-2">
                    <p className="flex items-center gap-2">
                      <SevChip sev={verdict.severity} />
                      <span className="font-mono text-[11.5px] text-snow">{verdict.team}</span>
                      <span className="ml-auto font-mono text-[10px] text-fog-2">conf {verdict.confidence.toFixed(2)}</span>
                    </p>
                    <p className="font-mono text-[11px] text-mint">{verdict.action}</p>
                    <p className="font-mono text-[10.5px] text-orchid">memory: {verdict.memoryNote}</p>
                    <p className="border-t border-line pt-2 font-mono text-[10.5px] text-fog">
                      1 page · 1 incident · staged at the real gate — approve it at the desk below.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ================= POSTMORTEM STUDIO ================= */

function DocView({ md }: { md: string }) {
  return (
    <div className="space-y-1.5">
      {md.split("\n").map((l, i) => {
        if (l.startsWith("# "))
          return (
            <h4 key={i} className="font-display pt-2 text-lg font-bold uppercase leading-tight tracking-wide text-snow">
              {l.slice(2)}
            </h4>
          );
        if (l.startsWith("## "))
          return (
            <p key={i} className="mt-4 border-b border-line pb-1 font-mono text-[10px] uppercase tracking-[0.24em] text-amber">
              {l.slice(3)}
            </p>
          );
        if (l.startsWith("| ")) {
          if (l.startsWith("|---")) return null;
          const [, k, v] = l.split("|").map((x) => x.trim());
          return (
            <p key={i} className="flex gap-2 font-mono text-[11.5px] leading-relaxed">
              <span className="w-32 shrink-0 text-fog-2">{k.replace(/\*\*/g, "")}</span>
              <span className="text-snow">{v.replace(/\*\*/g, "")}</span>
            </p>
          );
        }
        if (l.startsWith("- [ ] "))
          return (
            <p key={i} className="flex gap-2.5 font-mono text-[11.5px] leading-relaxed text-fog">
              <span className="mt-0.5 inline-block h-3 w-3 shrink-0 border border-line-2" /> {l.slice(6)}
            </p>
          );
        if (l.startsWith("- "))
          return (
            <p key={i} className="flex gap-2.5 font-mono text-[11.5px] leading-relaxed text-fog">
              <span className="shrink-0 text-mint">▸</span> {l.slice(2)}
            </p>
          );
        if (/^\d+\./.test(l))
          return (
            <p key={i} className="flex gap-2.5 pl-1 font-mono text-[11.5px] leading-relaxed text-fog">
              <span className="shrink-0 text-sky">{l.match(/^\d+/)![0]}.</span> {l.replace(/^\d+\.\s*/, "")}
            </p>
          );
        if (l.startsWith("---")) return <div key={i} className="my-3 h-px bg-line" />;
        if (l.startsWith("_") && l.endsWith("_"))
          return (
            <p key={i} className="pt-1 font-mono text-[10.5px] italic leading-relaxed text-fog-2">
              {l.slice(1, -1)}
            </p>
          );
        if (l.trim() === "") return null;
        return (
          <p key={i} className="text-[13px] leading-relaxed text-fog">
            {l}
          </p>
        );
      })}
    </div>
  );
}

export function PostmortemStudio() {
  const incidents = useMemo(() => [CORRELATED, ...CASES], []);
  const [selectedId, setSelectedId] = useState(CORRELATED.id);
  const [tick, setTick] = useState(0);
  const { push } = useToasts();

  useEffect(() => onGatesChanged(() => setTick((t) => t + 1)), []);

  const c = useMemo(() => incidents.find((x) => x.id === selectedId) as IncidentCase, [incidents, selectedId]);
  const verdict = useMemo(() => runAgent(c), [c]);
  const doc = useMemo(() => {
    void tick;
    const gate = gates.list().find((g) => g.caseId === c.id && g.status !== "pending");
    return buildPostmortem(
      c,
      verdict,
      new Date().toISOString(),
      gate ? { decidedBy: gate.decidedBy ?? "?", decision: gate.decision ?? "?", reason: gate.reason ?? "" } : null
    );
  }, [c, verdict, tick]);

  return (
    <section id="postmortem" className="mx-auto max-w-7xl scroll-mt-20 px-4 md:px-8 py-16 md:py-24">
      <SectionHead
        index="04"
        kicker="Postmortem studio — the evidence chain writes the document"
        title={
          <>
            When it's over,
            <br />
            <span className="text-amber">the paperwork writes itself.</span>
          </>
        }
        lede="Every postmortem is assembled from the same artifacts that triaged the incident — the trace, the fired rules, the memory recall and the ledger's human decision. No invented fields: if the engine can't ground a fact, the document says so."
      />
      <div className="grid gap-4 lg:grid-cols-12">
        <Reveal className="lg:col-span-4">
          <div className="panel-solid">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="font-mono text-[10px] tracking-[0.22em] text-fog-2 uppercase">resolved incidents</span>
              <IconBook size={13} className="text-amber" />
            </div>
            <ul className="max-h-[460px] overflow-y-auto">
              {incidents.map((x) => {
                const v = runAgent(x);
                const active = x.id === selectedId;
                return (
                  <li key={x.id}>
                    <button onClick={() => setSelectedId(x.id)} className={`case-row w-full px-4 py-2.5 text-left ${active ? "active" : ""}`}>
                      <span className="flex items-center gap-2">
                        <span className={`font-mono text-[10.5px] ${active ? "text-amber" : "text-fog-2"}`}>{x.id}</span>
                        <SevChip sev={v.severity} />
                        {x.id === CORRELATED.id && <span className="chip ml-auto border-mint/40 text-[9px] text-mint">storm</span>}
                      </span>
                      <span className="mt-0.5 block truncate text-[12.5px] font-medium text-snow">{x.title}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </Reveal>
        <Reveal delay={80} className="lg:col-span-8">
          <div className="panel-solid">
            <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
              <span className="font-mono text-[11px] text-amber">{c.id}-postmortem.md</span>
              <span className="chip text-fog-2">deterministic</span>
              <span className="chip text-fog-2">{verdict.evidence.length} evidence items</span>
              <div className="ml-auto flex items-center gap-2">
                <button className="btn py-1.5 px-3" onClick={async () => (await copyText(doc)) ? push("ok", "postmortem copied", "markdown · every field evidence-traced") : push("err", "clipboard unavailable")}>
                  <IconCheck size={12} /> copy
                </button>
                <button className="btn-solid py-1.5 px-3" onClick={() => { downloadFile(`${c.id}-postmortem.md`, doc, "text/markdown"); push("ok", `${c.id}-postmortem.md downloaded`); }}>
                  <IconDownload size={12} /> download
                </button>
              </div>
            </div>
            <div className="max-h-[560px] overflow-y-auto p-5 md:p-6">
              <DocView md={doc} />
            </div>
            <div className="border-t border-line px-5 py-3">
              <p className="font-mono text-[10px] leading-relaxed text-fog-2">
                Gate decisions are read live from the ledger — approve a page at the desk and the timeline updates with the
                reviewer's name and note.
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ================= TRIAGE DESK — gates & auth ================= */

export function TriageDesk() {
  const { push } = useToasts();
  const [list, setList] = useState<GateProposal[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(sessions.current());
  const [reason, setReason] = useState("");
  const [issues, setIssues] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [chaos, setChaosState] = useState(isChaos());
  const [tick, setTick] = useState(0);

  const loadGates = useCallback(async () => {
    try {
      const env = await call<GateProposal[]>("GET", "/v1/gates");
      setList(env.data);
    } catch (e) {
      push("err", "could not load gates", errText(e));
    }
  }, [push]);

  useEffect(() => void loadGates(), [loadGates]);
  useEffect(() => onGatesChanged(() => setTick((t) => t + 1)), []);
  useEffect(() => {
    void tick;
    void loadGates();
  }, [tick, loadGates]);
  useEffect(() => onChaos(setChaosState), []);
  useEffect(() => sessions.onChange(() => setSession(sessions.current())), []);

  const signIn = async (reviewerId: string) => {
    try {
      const env = await call<Session>("POST", "/v1/sessions", { body: { reviewerId } });
      push("ok", `signed in as ${env.data.name}`, `role: ${env.data.role}`);
    } catch (e) {
      push("err", "sign-in failed", errText(e));
    }
  };

  const signOut = async () => {
    const s = sessions.current();
    if (s) await call("DELETE", `/v1/sessions/${s.id}`).catch(() => {});
    push("ok", "signed out");
  };

  const decide = async (gate: GateProposal, decision: "approve" | "reject") => {
    const v = validateDecision({ decision, reason });
    setIssues(v.issues);
    if (!v.ok) return;
    setBusy(true);
    try {
      const env = await call<GateProposal>("POST", `/v1/gates/${gate.id}/decisions`, { body: { decision, reason }, session });
      push(decision === "approve" ? "ok" : "warn", `${gate.caseId} ${decision === "approve" ? "approved — page fired" : "rejected"}`, `by ${env.data.decidedBy} · immutable`);
      setReason("");
      setIssues([]);
      void loadGates();
    } catch (e) {
      push("err", "decision rejected", errText(e));
    } finally {
      setBusy(false);
    }
  };

  const selected = list.find((g) => g.id === selectedId) ?? list.find((g) => g.status === "pending") ?? list[0] ?? null;
  const pending = list.filter((g) => g.status === "pending").length;

  return (
    <section id="desk" className="mx-auto max-w-7xl scroll-mt-20 px-4 md:px-8 py-16 md:py-24">
      <SectionHead
        index="03"
        kicker="Operations console — human-in-the-loop"
        title={
          <>
            The agent proposes.
            <br />
            <span className="text-amber">You dispose.</span>
          </>
        }
        lede="Every page-worthy verdict stages here. Decisions require the reviewer role, are written to the append-only ledger, and are immutable once made. Sign in as Guest Observer and take the audited 403."
      />
      <div className="grid gap-4 lg:grid-cols-12">
        {/* sign-in + roster */}
        <Reveal className="lg:col-span-4">
          <div className="panel-solid h-full">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="font-mono text-[10px] tracking-[0.22em] text-fog-2 uppercase">sandbox roster</span>
              <IconUser size={13} className="text-amber" />
            </div>
            <div className="p-4">
              {session ? (
                <div className="border border-mint/35 bg-mint/5 p-3">
                  <p className="font-mono text-[12px] font-semibold text-snow">{session.name}</p>
                  <p className="font-mono text-[10.5px] text-fog-2">role: {session.role} · {session.id}</p>
                  <button className="btn mt-3 w-full justify-center py-1.5" onClick={() => void signOut()}>
                    sign out
                  </button>
                </div>
              ) : (
                <ul className="space-y-2">
                  {REVIEWERS.map((r) => (
                    <li key={r.id}>
                      <button onClick={() => void signIn(r.id)} className="group flex w-full items-center gap-3 border border-line bg-ink-900/60 px-3 py-2.5 text-left transition-all hover:border-line-2 hover:bg-ink-800">
                        <span className={`grid h-8 w-8 place-items-center border font-display text-xs font-bold ${r.role === "reviewer" ? "border-mint/50 text-mint" : "border-line-2 text-fog-2"}`}>
                          {r.name.split(" ").map((w) => w[0]).join("")}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-mono text-[12px] text-snow">{r.name}</span>
                          <span className="block font-mono text-[10px] text-fog-2">{r.title}</span>
                        </span>
                        <span className={`chip ml-auto ${r.role === "reviewer" ? "border-mint/40 text-mint" : "text-fog-2"}`}>{r.role}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-4 border-t border-line pt-3">
                <p className="font-mono text-[9.5px] tracking-[0.2em] text-fog-2 uppercase">authorization matrix</p>
                <ul className="mt-2 space-y-1 font-mono text-[10.5px]">
                  <li className="flex justify-between"><span className="text-fog">approve / reject pages</span><span className="text-mint">reviewer ✓</span></li>
                  <li className="flex justify-between"><span className="text-fog">view queue & evidence</span><span className="text-mint">any role ✓</span></li>
                  <li className="flex justify-between"><span className="text-fog">anonymous decision</span><span className="text-alarm">401 ✗</span></li>
                  <li className="flex justify-between"><span className="text-fog">viewer decision</span><span className="text-alarm">403 ✗ audited</span></li>
                  <li className="flex justify-between"><span className="text-fog">re-decide settled gate</span><span className="text-alarm">409 ✗ immutable</span></li>
                </ul>
              </div>
              {chaos && (
                <p className="mt-3 flex items-center gap-2 border border-alarm/40 bg-alarm/5 px-3 py-2 font-mono text-[10px] text-alarm">
                  <IconAlert size={12} /> chaos mode — decisions will fail with 503
                </p>
              )}
            </div>
          </div>
        </Reveal>

        {/* gate queue + detail */}
        <Reveal delay={80} className="lg:col-span-8">
          <div className="panel-solid">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="font-mono text-[10px] tracking-[0.22em] text-fog-2 uppercase">approval gates</span>
              <span className="chip border-amber/50 text-amber">{pending} pending</span>
            </div>
            <div className="grid md:grid-cols-5">
              <ul className="max-h-[430px] overflow-y-auto border-b border-line md:col-span-2 md:border-b-0 md:border-r">
                {list.length === 0 && <li className="px-4 py-8 text-center font-mono text-[11px] text-fog-2">{chaos ? "503 — storage offline" : "loading gates…"}</li>}
                {list.map((g) => (
                  <li key={g.id}>
                    <button onClick={() => setSelectedId(g.id)} className={`case-row w-full px-4 py-2.5 text-left ${selected?.id === g.id ? "active" : ""}`}>
                      <span className="flex items-center gap-2">
                        <SevChip sev={g.severity} />
                        <span className="font-mono text-[10px] text-fog-2">{g.caseId}</span>
                        <span
                          className={`chip ml-auto text-[9px] ${
                            g.status === "pending" ? "border-amber/50 text-amber" : g.status === "approved" ? "border-mint/40 text-mint" : "border-lemon/40 text-lemon"
                          }`}
                        >
                          {g.status}
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate text-[12px] font-medium text-snow">{g.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="p-4 md:col-span-3">
                {!selected ? (
                  <p className="font-mono text-[11px] text-fog-2">no gates staged yet — page-worthy verdicts will appear here.</p>
                ) : (
                  <div className="space-y-3">
                    <p className="font-mono text-[13px] font-semibold text-snow">{selected.title}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <SevChip sev={selected.severity} />
                      <span className="font-mono text-[11px] text-snow">{selected.team}</span>
                      <span className="chip text-fog-2">{selected.runbookId}</span>
                      <span className="ml-auto font-mono text-[10px] text-fog-2">conf {selected.confidence.toFixed(2)}</span>
                    </div>
                    <ul className="space-y-1 border-t border-line pt-2.5">
                      {selected.evidence.map((e) => (
                        <li key={e} className="flex gap-2 font-mono text-[10.5px] text-fog">
                          <span className="text-mint">▸</span> {e}
                        </li>
                      ))}
                    </ul>
                    {selected.status === "pending" ? (
                      <div className="space-y-2 border-t border-line pt-3">
                        <label htmlFor={`reason-${selected.id}`} className="font-mono text-[10px] tracking-[0.2em] text-alarm uppercase">
                          rejection reason — written to the audit ledger
                        </label>
                        <textarea
                          id={`reason-${selected.id}`}
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          rows={2}
                          placeholder="e.g. rollback already in progress, see #deploys"
                          className="w-full resize-none border border-line bg-ink-900 p-2 font-mono text-[12px] text-snow placeholder:text-fog-2 focus:border-alarm focus:outline-none"
                        />
                        {issues.length > 0 && (
                          <ul className="space-y-1" role="alert">
                            {issues.map((i) => (
                              <li key={i} className="font-mono text-[10.5px] text-alarm">✗ {i}</li>
                            ))}
                          </ul>
                        )}
                        <div className="flex flex-wrap gap-2">
                          <button className="btn-solid py-1.5 px-3.5" disabled={busy} onClick={() => void decide(selected, "approve")}>
                            <IconGate size={12} /> approve page
                          </button>
                          <button className="btn py-1.5 px-3.5" disabled={busy} onClick={() => void decide(selected, "reject")}>
                            <IconX size={12} /> reject
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="border-t border-line pt-3 font-mono text-[11px] text-fog">
                        settled: <span className={selected.status === "approved" ? "text-mint" : "text-lemon"}>{selected.status}</span> by{" "}
                        <span className="text-snow">{selected.decidedBy}</span> — “{selected.reason || "no comment"}” · immutable (409 on retry)
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ================= OPS CONSOLE ================= */

export function OpsConsole() {
  const { push } = useToasts();
  const [health, setHealth] = useState<ReturnType<typeof obs.health> | null>(null);
  const [logTick, setLogTick] = useState(0);
  const [chaos, setChaosState] = useState(isChaos());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    const poll = () => {
      call<ReturnType<typeof obs.health>>("GET", "/v1/health")
        .then((env) => {
          if (live) setHealth(env.data);
        })
        .catch(() => {})
        .finally(() => live && setLoading(false));
    };
    poll();
    const t = window.setInterval(poll, 1500);
    const lt = window.setInterval(() => setLogTick((x) => x + 1), 1200);
    return () => {
      live = false;
      window.clearInterval(t);
      window.clearInterval(lt);
    };
  }, []);

  useEffect(() => onChaos(setChaosState), []);

  const logs = useMemo(() => {
    void logTick;
    return obs.tail(14).reverse();
  }, [logTick]);
  const ledger = useMemo(() => audit.list().slice(0, 8), [logTick]);

  const uptime = health ? `${Math.floor(health.uptimeMs / 60000)}m ${Math.floor((health.uptimeMs % 60000) / 1000)}s` : "—";

  return (
    <section id="ops" className="mx-auto max-w-7xl scroll-mt-20 px-4 md:px-8 py-16 md:py-24">
      <SectionHead
        index="05"
        kicker="Observability & service internals"
        title={
          <>
            Everything leaves
            <br />
            <span className="text-amber">a receipt.</span>
          </>
        }
        lede="Health, structured logs with request ids, and the append-only audit ledger. Flip chaos on: mutating calls fail with 503 STORAGE_OFFLINE while health and logs stay honest — failure is a designed state."
      />
      <div className="grid gap-4 lg:grid-cols-12">
        <Reveal className="lg:col-span-4">
          <div className="panel-solid h-full">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="font-mono text-[10px] tracking-[0.22em] text-fog-2 uppercase">GET /v1/health</span>
              <IconActivity size={13} className={chaos ? "text-alarm" : "text-mint"} />
            </div>
            <div className="space-y-2 p-4">
              {loading || !health
                ? Array.from({ length: 6 }).map((_, i) => <div key={i} className="skel h-8" />)
                : (
                  <>
                    {[
                      ["status", health.status, health.status === "ok" ? "#31d48e" : "#ff5d5d"],
                      ["storage", health.storageMode, "#8ca3bf"],
                      ["schema", `v${health.schemaVersion}`, "#8ca3bf"],
                      ["uptime", uptime, "#8ca3bf"],
                      ["requests", String(health.requests), "#5ab8ff"],
                      ["decisions", String(health.decisions), "#ffb224"],
                      ["errors", String(health.errors), health.errors ? "#ff5d5d" : "#8ca3bf"],
                      ["avg latency", `${health.avgLatencyMs}ms`, "#8ca3bf"],
                    ].map(([k, v, c]) => (
                      <p key={k} className="flex items-center justify-between border border-line bg-ink-900/60 px-3 py-1.5 font-mono text-[11px]">
                        <span className="text-fog-2 uppercase tracking-[0.16em] text-[9.5px]">{k}</span>
                        <span className="tabular-nums" style={{ color: c as string }}>{v}</span>
                      </p>
                    ))}
                    <button
                      className={`mt-2 w-full justify-center py-2 ${chaos ? "btn-solid" : "btn"}`}
                      style={chaos ? { background: "#ff5d5d", borderColor: "#ff5d5d" } : {}}
                      onClick={() => {
                        setChaos(!chaos);
                        push(chaos ? "ok" : "warn", chaos ? "chaos disabled" : "chaos enabled", chaos ? "storage restored" : "mutating calls → 503 STORAGE_OFFLINE");
                      }}
                    >
                      <IconAlert size={12} /> {chaos ? "restore storage" : "inject chaos"}
                    </button>
                  </>
                )}
            </div>
          </div>
        </Reveal>

        <Reveal delay={80} className="lg:col-span-4">
          <div className="panel-solid h-full">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="font-mono text-[10px] tracking-[0.22em] text-fog-2 uppercase">structured logs</span>
              <span className="chip text-fog-2">request-id traced</span>
            </div>
            <ul className="max-h-[380px] space-y-1 overflow-y-auto p-3 font-mono text-[10px] leading-relaxed">
              {logs.map((l, i) => (
                <li key={`${l.at}-${i}`} className="feed-in break-words">
                  <span className="text-fog-2">{l.at.slice(11, 19)}</span>{" "}
                  <span className={l.level === "error" ? "text-alarm" : l.level === "warn" ? "text-amber" : "text-sky"}>{l.level.toUpperCase()}</span>{" "}
                  <span className="text-fog">{l.msg}</span>{" "}
                  {l.requestId && <span className="text-fog-2">[{l.requestId}]</span>}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>

        <Reveal delay={160} className="lg:col-span-4">
          <div className="panel-solid flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="font-mono text-[10px] tracking-[0.22em] text-fog-2 uppercase">audit ledger · append-only</span>
              <button
                className="btn py-1 px-2.5"
                onClick={() => {
                  downloadFile("pagermind-audit.json", audit.exportJson());
                  push("ok", "audit ledger exported", `${audit.list().length} entries`);
                }}
              >
                <IconDownload size={11} /> export
              </button>
            </div>
            <ul className="max-h-[340px] flex-1 space-y-1.5 overflow-y-auto p-3">
              {ledger.length === 0 && <li className="px-2 py-6 text-center font-mono text-[10.5px] text-fog-2">no entries yet — act on something</li>}
              {ledger.map((a) => (
                <li key={a.id} className="border border-line bg-ink-900/60 px-2.5 py-2">
                  <p className="flex items-center gap-2 font-mono text-[10px]">
                    <span className="text-fog-2">#{String(a.seq).padStart(3, "0")}</span>
                    <span className={a.outcome === "denied" ? "text-alarm" : a.action.includes("approve") ? "text-mint" : "text-sky"}>{a.action}</span>
                    <span className="ml-auto text-fog-2">{a.at.slice(11, 19)}</span>
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] text-fog">
                    <span className="text-snow">{a.actor}</span> → {a.target}
                  </p>
                  {a.detail && <p className="font-mono text-[9.5px] text-fog-2">{a.detail}</p>}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
