import { useCallback, useEffect, useState } from "react";
import { call, onChaos } from "../backend/api";
import { REVIEWERS } from "../backend/services";
import { ApiError, type GateProposal, type Reviewer, type Session } from "../backend/types";
import { Reveal, SectionHead, SevChip, useToasts } from "./ui";
import { IconAlert, IconCheck, IconGate, IconUser, IconX } from "./icons";

const SESSION_KEY = "pagermind.session-id";

function errText(e: unknown): string {
  if (e instanceof ApiError) return `${e.status} ${e.code} · ${e.message} · ${e.requestId}`;
  return e instanceof Error ? e.message : "unknown error";
}

function GateCard({
  gate,
  session,
  onSettled,
  onError,
  onOk,
}: {
  gate: GateProposal;
  session: Session | null;
  onSettled: (g: GateProposal) => void;
  onError: (msg: string) => void;
  onOk: (msg: string) => void;
}) {
  const [busy, setBusy] = useState<null | "approve" | "reject">(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [issues, setIssues] = useState<string[]>([]);
  const canAct = session?.role === "reviewer" && gate.status === "pending";

  const decide = async (decision: "approve" | "reject") => {
    setBusy(decision);
    setIssues([]);
    try {
      const env = await call<GateProposal>("POST", `/v1/gates/${gate.id}/decisions`, {
        body: { decision, reason },
        session,
      });
      onSettled(env.data);
      onOk(
        decision === "approve"
          ? `${gate.caseId} approved — page will fire to ${gate.team}`
          : `${gate.caseId} rejected — stand-down recorded`
      );
      setRejecting(false);
      setReason("");
    } catch (e) {
      if (e instanceof ApiError && e.status === 422 && e.issues) setIssues(e.issues);
      onError(errText(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <article className="panel p-4 md:p-5 transition-colors hover:border-line-2">
      <div className="flex flex-wrap items-center gap-2">
        <SevChip sev={gate.severity} />
        <span className="font-mono text-[11px] text-amber">{gate.caseId}</span>
        <span className="font-mono text-[10px] text-fog-2">{gate.service}</span>
        <span className="ml-auto font-mono text-[10px] text-fog-2">conf {gate.confidence.toFixed(2)}</span>
      </div>
      <h4 className="font-display mt-2.5 text-lg font-bold uppercase tracking-wide text-snow">{gate.title}</h4>
      <p className="mt-1 font-mono text-[11px] text-fog">
        proposed: <span className="text-snow">{gate.action}</span> · runbook{" "}
        <span className="text-snow">
          {gate.runbookId} · {gate.runbookTitle}
        </span>
      </p>
      <ul className="mt-3 space-y-1 border-l border-line pl-3">
        {gate.evidence.slice(0, 3).map((e) => (
          <li key={e} className="text-[11.5px] leading-snug text-fog-2">
            ▸ {e}
          </li>
        ))}
      </ul>

      {gate.status === "pending" ? (
        <div className="mt-4">
          {rejecting ? (
            <div className="border border-alarm/30 bg-alarm/5 p-3">
              <label htmlFor={`reason-${gate.id}`} className="font-mono text-[10px] tracking-[0.2em] text-alarm uppercase">
                rejection reason — written to the audit ledger
              </label>
              <textarea
                id={`reason-${gate.id}`}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="e.g. rollback already in progress, see #deploys"
                className="mt-2 w-full resize-none border border-line bg-ink-900 p-2 font-mono text-[12px] text-snow placeholder:text-fog-2 focus:border-alarm focus:outline-none"
              />
              {issues.length > 0 && (
                <ul className="mt-2 space-y-1" role="alert">
                  {issues.map((i) => (
                    <li key={i} className="flex items-center gap-2 font-mono text-[11px] text-alarm">
                      <IconX size={11} /> {i}
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3 flex gap-2">
                <button className="btn" onClick={() => decide("reject")} disabled={busy !== null}>
                  {busy === "reject" ? "recording…" : "confirm reject"}
                </button>
                <button className="btn" onClick={() => setRejecting(false)} disabled={busy !== null}>
                  cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <button
                className="btn-solid"
                disabled={!canAct || busy !== null}
                onClick={() => decide("approve")}
                title={canAct ? `page ${gate.pageTarget}` : "requires reviewer role"}
              >
                <IconCheck size={13} /> {busy === "approve" ? "recording…" : "approve page"}
              </button>
              <button className="btn" disabled={!canAct || busy !== null} onClick={() => setRejecting(true)}>
                <IconX size={13} /> reject
              </button>
              {session?.role === "viewer" && (
                <span className="font-mono text-[10px] text-fog-2">viewer role — actions return 403</span>
              )}
              {!session && <span className="font-mono text-[10px] text-fog-2">sign in to act</span>}
            </div>
          )}
        </div>
      ) : (
        <div
          className={`mt-4 flex flex-wrap items-center gap-2 border px-3 py-2.5 ${
            gate.status === "approved" ? "border-mint/35 bg-mint/5" : "border-alarm/35 bg-alarm/5"
          }`}
        >
          {gate.status === "approved" ? <IconCheck size={14} className="text-mint" /> : <IconX size={14} className="text-alarm" />}
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-snow">
            {gate.status} by {gate.decidedBy}
          </span>
          <span className="font-mono text-[10px] text-fog-2">
            {gate.decidedAt ? new Date(gate.decidedAt).toISOString().slice(11, 19) : ""} UTC
          </span>
          {gate.reason && <span className="w-full font-mono text-[11px] text-fog">“{gate.reason}”</span>}
        </div>
      )}
    </article>
  );
}

export default function TriageDesk() {
  const [session, setSession] = useState<Session | null>(null);
  const [gateList, setGateList] = useState<GateProposal[] | null>(null);
  const [selectedReviewer, setSelectedReviewer] = useState<Reviewer>(REVIEWERS[0]);
  const [signingIn, setSigningIn] = useState(false);
  const [chaos, setChaosState] = useState(false);
  const { push } = useToasts();

  const loadGates = useCallback(async () => {
    try {
      const env = await call<GateProposal[]>("GET", "/v1/gates", { session });
      setGateList(env.data);
    } catch (e) {
      push("err", "Could not load gate queue", errText(e));
    }
  }, [session, push]);

  // rehydrate session + initial gate load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const id = localStorage.getItem(SESSION_KEY);
      if (id) {
        try {
          const env = await call<Session>("GET", `/v1/sessions/${id}`);
          if (!cancelled) setSession(env.data);
        } catch {
          localStorage.removeItem(SESSION_KEY);
        }
      }
      if (!cancelled) void loadGates();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => onChaos(setChaosState), []);

  /* stay live: the workstation stages/decides gates through the same service */
  useEffect(() => {
    const onChange = () => void loadGates();
    window.addEventListener("pm:gates-changed", onChange);
    return () => window.removeEventListener("pm:gates-changed", onChange);
  }, [loadGates]);

  const signIn = async () => {
    setSigningIn(true);
    try {
      const env = await call<Session>("POST", "/v1/sessions", { body: { reviewerId: selectedReviewer.id } });
      setSession(env.data);
      localStorage.setItem(SESSION_KEY, env.data.id);
      push("ok", `Signed in · ${env.data.name}`, `role=${env.data.role} · ${env.requestId}`);
    } catch (e) {
      push("err", "Sign-in failed", errText(e));
    } finally {
      setSigningIn(false);
    }
  };

  const signOut = async () => {
    if (!session) return;
    try {
      await call("DELETE", `/v1/sessions/${session.id}`, { session });
    } catch {
      /* session already gone */
    }
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
    push("ok", "Session ended", "audit ledger records the sign-out");
  };

  const onSettled = (g: GateProposal) => {
    setGateList((prev) => (prev ? prev.map((x) => (x.id === g.id ? g : x)) : prev));
  };

  const pending = gateList?.filter((g) => g.status === "pending").length ?? 0;

  return (
    <section id="desk" className="mx-auto max-w-7xl scroll-mt-20 px-4 md:px-8 py-20 md:py-28">
      <SectionHead
        index="05"
        kicker="Operations console — human-in-the-loop"
        title={
          <>
            The agent proposes.
            <br />
            <span className="text-amber">A human disposes.</span>
          </>
        }
        lede="Every consequential act — a page that wakes someone at 3 a.m. — waits at an approval gate (ground rule 04). Sign in as a reviewer, act on the queue, and watch every decision land in the append-only audit ledger. This is the live service layer: validated, authorized, idempotent."
      />

      {chaos && (
        <Reveal className="mb-6">
          <div className="flex items-center gap-3 border border-alarm/40 bg-alarm/8 px-4 py-3" role="alert">
            <IconAlert size={16} className="text-alarm" />
            <span className="font-mono text-[12px] text-snow">
              chaos mode: persistence layer offline — mutating calls will fail with <span className="text-alarm">503 STORAGE_OFFLINE</span>. Health and logs stay up.
            </span>
          </div>
        </Reveal>
      )}

      <div className="grid gap-6 lg:grid-cols-12">
        {/* left: identity */}
        <Reveal className="lg:col-span-4">
          <div className="panel-solid">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="font-mono text-[10px] tracking-[0.22em] text-fog-2 uppercase">reviewer identity</span>
              <IconUser size={14} className="text-fog-2" />
            </div>
            {session ? (
              <div className="p-4 md:p-5">
                <p className="font-display text-xl font-bold uppercase tracking-wide text-snow">{session.name}</p>
                <p className="mt-1 font-mono text-[11px] text-fog-2">
                  {REVIEWERS.find((r) => r.id === session.reviewerId)?.title}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className={`chip ${session.role === "reviewer" ? "border-mint/50 text-mint" : "border-lemon/50 text-lemon"}`}>
                    role · {session.role}
                  </span>
                  <span className="chip text-fog-2">{session.id.slice(0, 14)}…</span>
                </div>
                <p className="mt-4 border-t border-line pt-3 text-[12px] leading-relaxed text-fog">
                  {session.role === "reviewer"
                    ? "You can approve or reject pages. Every decision is immutable and audited."
                    : "Viewer role: read-only. Decision calls are rejected with 403 — and the denial itself is audited."}
                </p>
                <button className="btn mt-4" onClick={signOut}>
                  <IconX size={12} /> end session
                </button>
              </div>
            ) : (
              <div className="p-4 md:p-5">
                <p className="font-mono text-[10px] tracking-[0.2em] text-fog-2 uppercase">choose identity · sandbox roster</p>
                <div className="mt-3 space-y-2" role="radiogroup" aria-label="Reviewer identity">
                  {REVIEWERS.map((r) => (
                    <button
                      key={r.id}
                      role="radio"
                      aria-checked={selectedReviewer.id === r.id}
                      onClick={() => setSelectedReviewer(r)}
                      className={`w-full border px-3 py-2.5 text-left transition-all ${
                        selectedReviewer.id === r.id
                          ? "border-amber/60 bg-amber/8 -translate-y-px"
                          : "border-line bg-ink-900 hover:border-line-2"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className={`h-2 w-2 ${selectedReviewer.id === r.id ? "bg-amber" : "bg-line-2"}`} />
                        <span className="text-[13px] font-medium text-snow">{r.name}</span>
                        <span className={`chip ml-auto ${r.role === "reviewer" ? "text-mint border-mint/40" : "text-lemon border-lemon/40"}`}>
                          {r.role}
                        </span>
                      </span>
                      <span className="mt-0.5 block pl-4 font-mono text-[10.5px] text-fog-2">{r.title}</span>
                    </button>
                  ))}
                </div>
                <button className="btn-solid mt-4 w-full justify-center" onClick={signIn} disabled={signingIn}>
                  {signingIn ? "opening session…" : "start session"}
                </button>
                <p className="mt-3 text-[11px] leading-relaxed text-fog-2">
                  No passwords in the sandbox — identity is asserted, roles are enforced service-side. Swapping in a real IdP is a transport change, not an architecture change.
                </p>
              </div>
            )}
          </div>

          <Reveal delay={100} className="panel mt-4 p-4 md:p-5">
            <p className="font-mono text-[10px] tracking-[0.22em] text-fog-2 uppercase">authorization matrix</p>
            <table className="mt-3 w-full font-mono text-[11px]">
              <thead>
                <tr className="text-left text-[9.5px] tracking-[0.18em] uppercase text-fog-2">
                  <th className="pb-2 font-medium">action</th>
                  <th className="pb-2 font-medium">reviewer</th>
                  <th className="pb-2 font-medium">viewer</th>
                  <th className="pb-2 font-medium">anon</th>
                </tr>
              </thead>
              <tbody className="text-fog">
                {[
                  ["list gates", "✓", "✓", "✓"],
                  ["approve / reject", "✓", "403", "401"],
                  ["read audit trail", "✓", "✓", "✓"],
                  ["export audit json", "✓", "✓", "✓"],
                ].map(([a, r, v, n]) => (
                  <tr key={a} className="border-t border-line/60">
                    <td className="py-1.5">{a}</td>
                    <td className={`py-1.5 ${r === "✓" ? "text-mint" : "text-alarm"}`}>{r}</td>
                    <td className={`py-1.5 ${v === "✓" ? "text-mint" : "text-alarm"}`}>{v}</td>
                    <td className={`py-1.5 ${n === "✓" ? "text-mint" : "text-alarm"}`}>{n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Reveal>
        </Reveal>

        {/* right: gate queue */}
        <div className="lg:col-span-8">
          <Reveal className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <IconGate size={18} className="text-amber" />
              <h3 className="font-display text-xl font-bold uppercase tracking-wide text-snow">approval gate queue</h3>
              {gateList && (
                <span className="chip text-amber border-amber/40">
                  {pending} pending / {gateList.length}
                </span>
              )}
            </div>
            <button className="btn" onClick={() => void loadGates()}>
              refresh
            </button>
          </Reveal>

          {gateList === null ? (
            <div className="space-y-4" aria-label="loading gates">
              {[0, 1, 2].map((i) => (
                <div key={i} className="skel h-40" />
              ))}
            </div>
          ) : gateList.length === 0 ? (
            <div className="panel grid place-items-center p-12 text-center">
              <IconGate size={28} className="text-fog-2" />
              <p className="font-display mt-3 text-lg font-bold uppercase text-snow">no consequential acts proposed</p>
              <p className="mt-1 text-[13px] text-fog">the agent resolved everything inside its pre-approved authority.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {gateList.map((g) => (
                <GateCard
                  key={g.id}
                  gate={g}
                  session={session}
                  onSettled={onSettled}
                  onError={(m) => push("err", "Decision failed", m)}
                  onOk={(m) => push("ok", "Decision recorded", m)}
                />
              ))}
              {pending === 0 && (
                <div className="step-in flex items-center gap-3 border border-mint/35 bg-mint/6 px-4 py-3">
                  <IconCheck size={16} className="text-mint" />
                  <span className="font-mono text-[12px] text-snow">
                    queue clear — every consequential act has a human decision behind it.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
