import { useEffect, useState } from "react";
import { call, isChaos, setChaos } from "../backend/api";
import {
  ApiError,
  type AuditEntry,
  type HealthReport,
  type LogEntry,
} from "../backend/types";
import { Reveal, SectionHead, useToasts } from "./ui";
import { IconActivity, IconAlert, IconDownload, IconShield } from "./icons";

function fmtUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(Math.floor(s / 60))}:${p(s % 60)}`;
}

function HealthPanel({ health, chaos, onToggleChaos }: { health: HealthReport | null; chaos: boolean; onToggleChaos: () => void }) {
  return (
    <div className="panel-solid flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <span className="font-mono text-[10px] tracking-[0.22em] text-fog-2 uppercase">service health · /v1/health</span>
        <span
          className={`flex items-center gap-1.5 font-mono text-[10px] ${
            !health ? "text-fog-2" : health.status === "ok" ? "text-mint" : "text-alarm"
          }`}
        >
          <span className={`h-1.5 w-1.5 ${!health ? "bg-fog-2" : health.status === "ok" ? "bg-mint pulse-dot" : "bg-alarm pulse-amber"}`} />
          {health?.status.toUpperCase() ?? "…"}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-px bg-line flex-1">
        {health
          ? [
              ["storage", health.storageMode],
              ["schema", `v${health.schemaVersion}`],
              ["uptime", fmtUptime(health.uptimeMs)],
              ["avg latency", `${health.avgLatencyMs}ms`],
              ["requests", String(health.requests)],
              ["errors", String(health.errors)],
              ["decisions", String(health.decisions)],
              ["started", health.startedAt.slice(11, 19) + "Z"],
            ].map(([k, v]) => (
              <div key={k} className="bg-ink-900 px-3.5 py-3">
                <p className="font-mono text-[9px] tracking-[0.2em] text-fog-2 uppercase">{k}</p>
                <p className={`font-mono mt-1 text-[13px] tabular-nums ${k === "errors" && Number(v) > 0 ? "text-alarm" : "text-snow"}`}>{v}</p>
              </div>
            ))
          : Array.from({ length: 8 }).map((_, i) => <div key={i} className="skel h-[54px]" />)}
      </div>
      <div className="border-t border-line p-3.5">
        <button
          onClick={onToggleChaos}
          className={`flex w-full items-center justify-between border px-3.5 py-2.5 transition-colors ${
            chaos ? "border-alarm/50 bg-alarm/8" : "border-line bg-ink-900 hover:border-line-2"
          }`}
          aria-pressed={chaos}
        >
          <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-snow">
            <IconAlert size={13} className={chaos ? "text-alarm" : "text-fog-2"} /> chaos · storage offline
          </span>
          <span className={`font-mono text-[10px] ${chaos ? "text-alarm" : "text-fog-2"}`}>{chaos ? "ON" : "OFF"}</span>
        </button>
        <p className="mt-2 font-mono text-[9.5px] leading-relaxed text-fog-2">
          failure injection: mutating calls → 503 STORAGE_OFFLINE with request ids. use it to watch the desk degrade gracefully.
        </p>
      </div>
    </div>
  );
}

function LogStream({ logs }: { logs: LogEntry[] }) {
  return (
    <div className="panel-solid flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <span className="font-mono text-[10px] tracking-[0.22em] text-fog-2 uppercase">structured logs · /v1/logs</span>
        <span className="chip text-fog-2">{logs.length} buffered</span>
      </div>
      <div className="flex-1 overflow-y-auto p-3.5 max-h-[340px]" aria-live="off">
        {logs.length === 0 ? (
          <p className="p-4 text-center font-mono text-[11px] text-fog-2">no log lines yet — interact with the desk</p>
        ) : (
          <ul className="space-y-1 font-mono text-[10.5px] leading-relaxed">
            {logs.map((l, i) => (
              <li key={`${l.at}-${i}`} className="flex gap-2">
                <span className="shrink-0 text-fog-2 tabular-nums">{l.at.slice(11, 19)}</span>
                <span
                  className={`shrink-0 w-11 uppercase ${
                    l.level === "error" ? "text-alarm" : l.level === "warn" ? "text-lemon" : "text-fog-2"
                  }`}
                >
                  {l.level}
                </span>
                <span className="min-w-0 break-words text-snow">
                  {l.msg}
                  {l.requestId && <span className="text-fog-2"> · {l.requestId}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function AuditTrail({ entries, onExport }: { entries: AuditEntry[]; onExport: () => void }) {
  return (
    <div className="panel-solid">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <span className="font-mono text-[10px] tracking-[0.22em] text-fog-2 uppercase">audit ledger · append-only · /v1/audit</span>
        <button className="btn py-1.5 px-3" onClick={onExport}>
          <IconDownload size={12} /> export json
        </button>
      </div>
      {entries.length === 0 ? (
        <div className="grid place-items-center p-10 text-center">
          <IconShield size={24} className="text-fog-2" />
          <p className="mt-3 font-mono text-[11px] text-fog-2">
            ledger empty — sign in and act on a gate; every session, denial and decision lands here immutably.
          </p>
        </div>
      ) : (
        <div className="max-h-[300px] overflow-y-auto">
          <table className="w-full font-mono text-[10.5px]">
            <thead className="sticky top-0 bg-ink-850">
              <tr className="text-left text-[9px] tracking-[0.18em] uppercase text-fog-2">
                <th className="px-4 py-2 font-medium">seq</th>
                <th className="px-2 py-2 font-medium">time</th>
                <th className="px-2 py-2 font-medium">actor</th>
                <th className="px-2 py-2 font-medium">action</th>
                <th className="px-2 py-2 font-medium">outcome</th>
                <th className="px-2 py-2 font-medium">target · detail</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((a) => (
                <tr key={a.id} className="border-t border-line/60 align-top hover:bg-ink-800/60">
                  <td className="px-4 py-2 text-fog-2">#{String(a.seq).padStart(3, "0")}</td>
                  <td className="px-2 py-2 text-fog-2 tabular-nums">{a.at.slice(11, 19)}</td>
                  <td className="px-2 py-2 text-snow whitespace-nowrap">{a.actor}</td>
                  <td className="px-2 py-2 text-sky whitespace-nowrap">{a.action}</td>
                  <td className={`px-2 py-2 ${a.outcome === "ok" ? "text-mint" : a.outcome === "denied" ? "text-lemon" : "text-alarm"}`}>
                    {a.outcome}
                  </td>
                  <td className="px-2 py-2 text-fog">
                    {a.target}
                    {a.detail && <span className="text-fog-2"> — {a.detail}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function OpsConsole() {
  const [health, setHealth] = useState<HealthReport | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [chaos, setChaosState] = useState(isChaos());
  const { push } = useToasts();

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const [h, l, a] = await Promise.all([
          call<HealthReport>("GET", "/v1/health"),
          call<LogEntry[]>("GET", "/v1/logs"),
          call<AuditEntry[]>("GET", "/v1/audit"),
        ]);
        if (cancelled) return;
        setHealth(h.data);
        setLogs([...l.data].reverse().slice(0, 60));
        setAuditEntries(a.data);
      } catch {
        /* health polling is best-effort */
      }
    };
    void tick();
    const t = window.setInterval(tick, 2200);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, []);

  const toggleChaos = () => {
    const next = !chaos;
    setChaos(next);
    setChaosState(next);
    push(next ? "err" : "ok", next ? "Chaos enabled" : "Chaos disabled", next ? "persistence calls now return 503" : "service back to normal");
  };

  const exportAudit = async () => {
    try {
      const env = await call<AuditEntry[]>("GET", "/v1/audit");
      const blob = new Blob(
        [JSON.stringify({ exportedAt: new Date().toISOString(), entries: env.data }, null, 2)],
        { type: "application/json" }
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pagermind-audit-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      push("ok", "Audit ledger exported", `${env.data.length} entries · ${env.requestId}`);
    } catch (e) {
      push("err", "Export failed", e instanceof ApiError ? `${e.status} ${e.code} · ${e.requestId}` : "unknown");
    }
  };

  return (
    <section id="ops" className="mx-auto max-w-7xl scroll-mt-20 px-4 md:px-8 py-20 md:py-28">
      <SectionHead
        index="05"
        kicker="Observability & service internals"
        title={
          <>
            If it isn't observable,
            <br />
            <span className="text-amber">it isn't production.</span>
          </>
        }
        lede="The same service layer that powers the desk, watched from the operator's side: a health endpoint with storage mode and schema version, a structured log stream with request ids, and the append-only audit ledger — exportable as evidence for any post-incident review."
      />
      <div className="grid gap-5 lg:grid-cols-12">
        <Reveal className="lg:col-span-4">
          <HealthPanel health={health} chaos={chaos} onToggleChaos={toggleChaos} />
        </Reveal>
        <Reveal delay={80} className="lg:col-span-4">
          <LogStream logs={logs} />
        </Reveal>
        <Reveal delay={160} className="lg:col-span-4">
          <div className="panel-solid flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="font-mono text-[10px] tracking-[0.22em] text-fog-2 uppercase">operator notes</span>
              <IconActivity size={14} className="text-fog-2" />
            </div>
            <ul className="flex-1 space-y-3 p-4 text-[12.5px] leading-relaxed text-fog">
              <li>
                <span className="text-mint">▸</span> <strong className="text-snow">Everything degrades loudly.</strong> Chaos mode proves it: 503s carry request ids, the desk banners, nothing fails silently.
              </li>
              <li>
                <span className="text-mint">▸</span> <strong className="text-snow">Denials are audited too.</strong> Sign in as the guest viewer and try to approve a page — the 403 lands in the ledger as <span className="font-mono text-[11px]">outcome=denied</span>.
              </li>
              <li>
                <span className="text-mint">▸</span> <strong className="text-snow">Decisions are immutable.</strong> A settled gate returns 409 on any re-decision attempt — idempotency by state machine, not by hope.
              </li>
              <li>
                <span className="text-mint">▸</span> <strong className="text-snow">Storage survives refresh.</strong> Gates and the ledger persist in a versioned schema (localStorage, memory fallback in tests).
              </li>
            </ul>
          </div>
        </Reveal>
        <Reveal className="lg:col-span-12">
          <AuditTrail entries={auditEntries} onExport={() => void exportAudit()} />
        </Reveal>
      </div>
    </section>
  );
}
