import { useCallback, useEffect, useMemo, useState } from "react";
import {
  COMPONENT_STATUS_COLOR,
  IMPACT_COLOR,
  fetchLiveSnapshot,
  mapToCase,
  type LiveSnapshot,
} from "../engine/live";
import { runAgent } from "../engine/engine";
import { Reveal, SectionHead, SevChip, usePlayer, IconActivity, IconAlert, IconReplay, IconTerminal } from "./ui";

function ago(iso: string, tick: number): string {
  void tick;
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  return `${Math.floor(s / 60)}m ${s % 60}s ago`;
}

const INDICATOR_COLOR: Record<string, string> = {
  none: "#31d48e",
  minor: "#e9d75b",
  major: "#ffb224",
  critical: "#ff5d5d",
};

function TriagePanel({ snapshot, incidentId }: { snapshot: LiveSnapshot; incidentId: string }) {
  const inc = snapshot.incidents.find((i) => i.id === incidentId) ?? null;
  const triaged = useMemo(() => {
    if (!inc) return null;
    const c = mapToCase(inc, snapshot);
    return { c, a: runAgent(c) };
  }, [inc, snapshot]);
  const { visible, done } = usePlayer(triaged?.a.steps.length ?? 0, incidentId, 240);

  if (!triaged) return null;
  const { c, a } = triaged;
  return (
    <div className="step-in mt-3 border border-line-2 bg-ink-950/70 p-4">
      <p className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-fog-2">
        deterministic triage of the live input · same engine, same rules
      </p>
      <ol className="mt-2.5 space-y-1 font-mono text-[10.5px] leading-relaxed">
        {a.steps.slice(0, visible).map((s, i) => (
          <li key={i} className="step-in flex gap-2">
            <span className="text-fog-2 shrink-0">{s.kind === "tool" ? "▸" : s.kind === "verify" ? "◆" : "·"}</span>
            <span className="min-w-0">
              <span className="text-snow">{s.label}</span>
              <span className="block truncate text-fog-2">{s.detail}</span>
            </span>
          </li>
        ))}
      </ol>
      {done && (
        <div className="step-in mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <SevChip sev={a.severity} />
          <span className="chip text-fog-2">{a.team}</span>
          <span className="chip text-fog-2">
            {a.runbook.id} · {a.runbook.title}
          </span>
          <span className="chip text-fog-2">conf {a.confidence.toFixed(2)}</span>
          <span className="ml-auto font-mono text-[9.5px] uppercase tracking-[0.16em] text-mint">
            advisory — never gated, never paged
          </span>
        </div>
      )}
      {!done && (
        <p className="mt-2 flex items-center gap-2 font-mono text-[9.5px] uppercase tracking-[0.18em] text-fog-2">
          <span className="cursor-blink inline-block h-3 w-1.5 bg-mint" /> working…
        </p>
      )}
    </div>
  );
}

export default function LiveSignals() {
  const [snap, setSnap] = useState<LiveSnapshot | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      setSnap(await fetchLiveSnapshot());
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "adapter unreachable");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const refresh = window.setInterval(() => void load(true), 60_000);
    const ticker = window.setInterval(() => setTick((x) => x + 1), 1000);
    return () => {
      window.clearInterval(refresh);
      window.clearInterval(ticker);
    };
  }, [load]);

  const degradedCount = snap?.components.filter((c) => c.status !== "operational").length ?? 0;

  return (
    <section id="live" className="mx-auto max-w-7xl scroll-mt-20 px-4 md:px-8 py-16 md:py-24">
      <SectionHead
        index="03"
        kicker="Adapter boundary · phase 1 preview · status.github.com"
        title={
          <>
            Real signals,
            <br />
            <span className="text-amber">same engine.</span>
          </>
        }
        lede="The first production-shaped adapter: a keyless, read-only feed from GitHub's public Status API, mapped deterministically into the engine's input contract. Live data is advisory — it never stages a gate and never fires a page. When Prometheus, a CMDB and PagerDuty land, only this seam changes."
      />

      <div className="panel-solid">
        {/* header strip */}
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
          <IconActivity size={14} className="text-mint" />
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-fog-2">live feed · auto-refresh 60s</span>
          {snap && (
            <span
              className="chip font-bold"
              style={{
                color: INDICATOR_COLOR[snap.indicator] ?? "#8ca3bf",
                borderColor: `${INDICATOR_COLOR[snap.indicator] ?? "#8ca3bf"}55`,
                background: `${INDICATOR_COLOR[snap.indicator] ?? "#8ca3bf"}12`,
              }}
            >
              platform {snap.indicator}
            </span>
          )}
          <span className="font-mono text-[10.5px] tabular-nums text-fog-2">
            {loading ? "fetching…" : snap ? `updated ${ago(snap.fetchedAt, tick)}` : "—"}
            {err && snap && <span className="ml-2 text-lemon">(stale)</span>}
          </span>
          <button className="btn ml-auto py-1.5 px-3" onClick={() => void load()} disabled={loading}>
            <IconReplay size={12} /> {loading ? "fetching" : "refresh"}
          </button>
        </div>

        {/* error state — the adapter boundary, observed */}
        {err && (
          <div className="flex flex-wrap items-center gap-3 border-b border-alarm/30 bg-alarm/8 px-4 py-3">
            <IconAlert size={14} className="text-alarm" />
            <p className="font-mono text-[11px] text-alarm">
              live adapter unreachable — {err}. The console continues on synthetic data; retries every 60s.
            </p>
          </div>
        )}

        {/* loading skeleton */}
        {!snap && loading && (
          <div className="space-y-2 p-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skel h-12" style={{ animationDelay: `${i * 110}ms` }} />
            ))}
          </div>
        )}

        {snap && (
          <>
            {/* component health — living dots */}
            <div className="border-b border-line px-4 py-3.5">
              <p className="mb-2.5 font-mono text-[9.5px] uppercase tracking-[0.2em] text-fog-2">
                components · {snap.components.length} tracked · {degradedCount} not operational
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {snap.components.slice(0, 14).map((c) => (
                  <span
                    key={c.id}
                    className="group flex cursor-default items-center gap-1.5 font-mono text-[10.5px] text-fog transition-colors hover:text-snow"
                    title={`${c.name}: ${c.status.replace(/_/g, " ")}`}
                  >
                    <span
                      className="h-1.5 w-1.5 shrink-0"
                      style={{
                        background: COMPONENT_STATUS_COLOR[c.status] ?? "#5e7694",
                        boxShadow: c.status !== "operational" ? `0 0 8px ${COMPONENT_STATUS_COLOR[c.status]}` : "none",
                      }}
                    />
                    {c.name}
                  </span>
                ))}
              </div>
            </div>

            {/* unresolved incidents — triage the real thing */}
            <div className="px-4 py-4">
              <p className="mb-2.5 font-mono text-[9.5px] uppercase tracking-[0.2em] text-fog-2">
                open incidents · triage one with the agent
              </p>
              {snap.incidents.length === 0 && (
                <div className="border border-line bg-ink-900/60 px-4 py-6 text-center">
                  <p className="font-mono text-[12px] text-mint">no unresolved incidents — platform quiet.</p>
                  <p className="mt-1 font-mono text-[10.5px] text-fog-2">
                    the adapter re-checks every 60s; when GitHub opens an incident it appears here, live.
                  </p>
                </div>
              )}
              <ul className="space-y-2">
                {snap.incidents.map((inc) => {
                  const open = openId === inc.id;
                  return (
                    <li key={inc.id} className={`border transition-colors ${open ? "border-amber/50 bg-ink-900/80" : "border-line bg-ink-900/50 hover:border-line-2"}`}>
                      <button className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left" onClick={() => setOpenId(open ? null : inc.id)}>
                        <span
                          className="chip font-bold"
                          style={{ color: IMPACT_COLOR[inc.impact] ?? "#8ca3bf", borderColor: `${IMPACT_COLOR[inc.impact] ?? "#8ca3bf"}55`, background: `${IMPACT_COLOR[inc.impact] ?? "#8ca3bf"}12` }}
                        >
                          {inc.impact}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium text-snow">{inc.name}</span>
                          <span className="font-mono text-[10px] text-fog-2">
                            {inc.status} · opened {new Date(inc.created_at).toISOString().slice(5, 16).replace("T", " ")} · {inc.components.length} components
                          </span>
                        </span>
                        <span className={`btn py-1.5 px-3 ${open ? "text-amber border-amber/60" : ""}`}>
                          <IconTerminal size={12} /> {open ? "close trace" : "triage with agent"}
                        </span>
                      </button>
                      {open && <TriagePanel snapshot={snap} incidentId={inc.id} />}
                    </li>
                  );
                })}
              </ul>
            </div>
          </>
        )}

        <div className="border-t border-line px-4 py-3">
          <p className="font-mono text-[10px] leading-relaxed text-fog-2">
            read-only by contract — this panel performs GETs only, maps through `src/engine/live.ts#mapToCase` (pure
            function), and renders advisory verdicts. The scored evaluation stays synthetic and deterministic; this
            feed demonstrates the seam.
          </p>
        </div>
      </div>
    </section>
  );
}
