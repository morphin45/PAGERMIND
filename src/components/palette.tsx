import { useEffect, useMemo, useRef, useState } from "react";
import type { ViewMode } from "../App";

interface Action {
  id: string;
  label: string;
  hint: string;
  group: string;
  run: () => void;
}

export default function CommandPalette({
  open,
  onClose,
  setMode,
  startTour,
}: {
  open: boolean;
  onClose: () => void;
  setMode: (m: ViewMode) => void;
  startTour: () => void;
}) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setSel(0);
      window.setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const go = (mode: ViewMode, hash: string) => {
    setMode(mode);
    onClose();
    window.setTimeout(() => {
      window.location.hash = hash;
    }, 120);
  };
  const act = (fn: () => void) => {
    fn();
    onClose();
  };

  const actions = useMemo<Action[]>(
    () => [
      { id: "demo", label: "Run the guided demo", hint: "narrated tour", group: "actions", run: () => act(startTour) },
      { id: "pause", label: "Toggle feed pause", hint: "simulation", group: "actions", run: () => act(() => window.dispatchEvent(new Event("pm:pause-toggle"))) },
      { id: "storm", label: "Trigger the alert storm", hint: "4 → 1", group: "actions", run: () => act(() => window.dispatchEvent(new CustomEvent("pm:storm"))) },
      { id: "drill", label: "Inject the GameDay drill", hint: "INC-2209", group: "actions", run: () => act(() => window.dispatchEvent(new CustomEvent("pm:inject", { detail: { caseId: "INC-2209" } }))) },
      { id: "poison", label: "Inject the suppression attack", hint: "ADV-905", group: "actions", run: () => act(() => window.dispatchEvent(new CustomEvent("pm:inject", { detail: { caseId: "ADV-905" } }))) },
      { id: "feed", label: "Go to incident feed", hint: "console", group: "navigate", run: () => go("console", "#console") },
      { id: "live", label: "Go to live signals", hint: "real API", group: "navigate", run: () => go("console", "#live") },
      { id: "gates", label: "Go to approval gates", hint: "console", group: "navigate", run: () => go("console", "#desk") },
      { id: "post", label: "Go to postmortem studio", hint: "console", group: "navigate", run: () => go("console", "#postmortem") },
      { id: "ops", label: "Go to ops & audit", hint: "console", group: "navigate", run: () => go("console", "#ops") },
      { id: "bench", label: "Open the live bench", hint: "report", group: "navigate", run: () => go("report", "#bench") },
      { id: "evidence", label: "Open evidence & audit", hint: "report", group: "navigate", run: () => go("report", "#evidence") },
      { id: "redteam", label: "Open the red team", hint: "report", group: "navigate", run: () => go("report", "#redteam") },
      { id: "changelog", label: "Open the changelog", hint: "report", group: "navigate", run: () => go("report", "#changelog") },
      { id: "repro", label: "Open reproduction & trust", hint: "report", group: "navigate", run: () => go("report", "#repro") },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const filtered = actions.filter(
    (a) => a.label.toLowerCase().includes(q.toLowerCase()) || a.hint.toLowerCase().includes(q.toLowerCase())
  );

  useEffect(() => setSel(0), [q]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] grid justify-center bg-ink-950/82 px-4 pt-[16vh] backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="command palette"
    >
      <div className="feed-in panel-solid w-full max-w-lg border-line-2 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]">
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="text-fog-2" aria-hidden>
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="M15.5 15.5L21 21" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSel((s) => Math.min(s + 1, filtered.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSel((s) => Math.max(s - 1, 0));
              } else if (e.key === "Enter" && filtered[sel]) {
                filtered[sel].run();
              } else if (e.key === "Escape") {
                onClose();
              }
            }}
            placeholder="jump, inject, trigger…"
            className="w-full bg-transparent font-mono text-[13px] text-snow placeholder:text-fog-2 focus:outline-none"
            aria-label="command search"
          />
          <span className="kbd shrink-0">esc</span>
        </div>
        <ul className="max-h-72 overflow-y-auto py-1.5">
          {filtered.length === 0 && (
            <li className="px-4 py-6 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-fog-2">no match</li>
          )}
          {filtered.map((a, i) => (
            <li key={a.id}>
              <button
                onMouseEnter={() => setSel(i)}
                onClick={a.run}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  i === sel ? "border-l-2 border-amber bg-ink-700/70" : "border-l-2 border-transparent"
                }`}
              >
                <span className="w-24 shrink-0 font-mono text-[9px] uppercase tracking-[0.18em] text-fog-2">{a.group}</span>
                <span className="flex-1 text-[13px] text-snow">{a.label}</span>
                <span className="chip text-fog-2">{a.hint}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-3 border-t border-line px-4 py-2 font-mono text-[9.5px] uppercase tracking-[0.16em] text-fog-2">
          <span><span className="kbd">↑↓</span> navigate</span>
          <span><span className="kbd">↵</span> run</span>
          <span className="ml-auto">⌘K to open</span>
        </div>
      </div>
    </div>
  );
}
