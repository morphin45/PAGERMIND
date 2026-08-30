import { useCallback, useEffect, useRef, useState } from "react";
import type { ViewMode } from "../App";
import { IconPulse, IconX } from "./icons";

interface TourStep {
  id: string;
  target?: string; // css selector — spotlight follows it live
  title: string;
  body: string;
  /** side-effects executed when the step becomes active */
  action?: (ctx: { setMode: (m: ViewMode) => void }) => void;
}

const inject = (caseId: string) =>
  window.dispatchEvent(new CustomEvent("pm:inject", { detail: { caseId } }));

const STEPS: TourStep[] = [
  {
    id: "intro",
    title: "This is a live console, not a slideshow.",
    body: "Synthetic incidents stream in. A deterministic agent triages each one with a visible tool-grounded trace. Page-worthy calls wait for a qualified human — you. Every act, agent or human, lands in an append-only ledger. Follow along; everything it touches is real.",
  },
  {
    id: "feed",
    target: "#console",
    title: "The feed is live",
    body: "Incidents arrive on a sandbox clock — pause, speed up or reset from this strip. Each row moves QUEUED → AGENT TRIAGING → its disposition. The right panel replays the exact trace the engine computed.",
  },
  {
    id: "drill",
    target: "#console",
    action: () => inject("INC-2209"),
    title: "The hardest case arrives first",
    body: "“Failover probes FIRING — primary unreachable.” The baseline regex script pages six people for this. Watch the agent instead: probes firing but real-user impact is zero, and GameDay is on the calendar. The critic proves the contradiction and auto-resolves under pre-approved rule D-1 — with an audit note. Nobody is woken.",
  },
  {
    id: "memory",
    target: "#console",
    action: () => inject("INC-2201"),
    title: "Memory carries the past forward",
    body: "This checkout deploy is failing again — and the agent has seen it before. The purple mem line recalls INC-2144 from five weeks ago: same signature, rollback fixed it in 6 minutes. That prior decision reshapes the recommendation and the runbook it cites. Without memory, every 3 a.m. page starts from zero.",
  },
  {
    id: "corruption",
    target: "#console",
    action: () => inject("INC-2208"),
    title: "Silent corruption — the case keywords miss",
    body: "Error rate 0.4%, exports “succeed” but arrive garbled. No scary words, so keyword triage shrugs. The agent sees the corruption signal, escalates to SEV2 and stages the page at a human gate. Nothing fires without you.",
  },
  {
    id: "gate",
    target: "#desk",
    title: "Now you're the qualified human",
    body: "In the detail panel above, sign in as Priya Natarajan (reviewer) and approve the INC-2208 page — it fires and is written to the ledger, immutable (a second attempt gets 409 ALREADY_DECIDED). Want to watch authorization get enforced? Sign in as Guest Observer and take the audited 403.",
  },
  {
    id: "ops",
    target: "#ops",
    title: "The ledger never forgets",
    body: "Every decision carries a request ID you can trace through the structured logs. Export the audit ledger as JSON. Flip chaos on and the whole service degrades to 503 STORAGE_OFFLINE — triage retries, gates stay closed, health stays honest.",
  },
  {
    id: "bench",
    target: "#bench",
    action: ({ setMode }) => setMode("report"),
    title: "Same engine, scored against the baseline",
    body: "Report mode runs the hackathon evaluation on the same 12 cases: the 40-line regex script vs. the agent, identical rubric. Rubric 30% → 100%, false pages 5 → 0, wrong-team routes 9 → 0 — recomputed live, never typed in.",
  },
  {
    id: "evidence",
    target: "#evidence",
    title: "Prove it",
    body: "The attribution ladder shows what each design choice bought (tools, critic, memory — one ablated at a time). Run the acceptance audit: the exact assertions from the test suite, re-executed in your browser. Then download the trajectory set — submission deliverable №4, 24 runs with every tool call and checkpoint.",
  },
  {
    id: "outro",
    title: "That's the demo.",
    body: "To record the 5-minute submission video, follow VIDEO_SCRIPT.md — this tour hits every beat, and because the engine is deterministic, retakes are free. Deploy for judges: npm run build, serve dist/ anywhere static. Clean-env reproduction: npm install && npx vitest run.",
  },
];

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export default function DemoTour({
  open,
  onClose,
  mode,
  setMode,
}: {
  open: boolean;
  onClose: () => void;
  mode: ViewMode;
  setMode: (m: ViewMode) => void;
}) {
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [auto, setAuto] = useState(false);
  const measureTimer = useRef<number | null>(null);

  const step = STEPS[idx];
  const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  /* measure + follow the target element (scroll, resize, late mounts) */
  const measure = useCallback(() => {
    const sel = STEPS[idx]?.target;
    if (!sel) {
      setRect(null);
      return;
    }
    const el = document.querySelector(sel);
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [idx]);

  /* entering a step: run its action, scroll to target, start tracking */
  useEffect(() => {
    if (!open) return;
    const s = STEPS[idx];
    s.action?.({ setMode });

    const settle = () => {
      const el = s.target ? document.querySelector(s.target) : null;
      if (s.target) {
        if (el) el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
        else {
          // element mounts after a mode switch — retry briefly
          let tries = 0;
          const retry = window.setInterval(() => {
            const late = document.querySelector(s.target!);
            if (late || ++tries > 12) {
              window.clearInterval(retry);
              late?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
              measure();
            }
          }, 160);
          return;
        }
      }
      measure();
    };
    const t = window.setTimeout(settle, s.action ? 260 : 60);

    const onScroll = () => {
      if (measureTimer.current) window.cancelAnimationFrame(measureTimer.current);
      measureTimer.current = requestAnimationFrame(measure);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (measureTimer.current) window.cancelAnimationFrame(measureTimer.current);
    };
  }, [open, idx, measure, setMode, reduced]);

  /* reset when the tour re-opens */
  useEffect(() => {
    if (open) {
      setIdx(0);
      setAuto(false);
    }
  }, [open]);

  /* optional auto-advance */
  useEffect(() => {
    if (!open || !auto || idx >= STEPS.length - 1) return;
    const t = window.setTimeout(() => setIdx((i) => Math.min(i + 1, STEPS.length - 1)), 9000);
    return () => window.clearTimeout(t);
  }, [open, auto, idx]);

  /* keyboard */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIdx((i) => Math.min(i + 1, STEPS.length - 1));
      if (e.key === "ArrowLeft") setIdx((i) => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const pad = 10;
  const last = idx === STEPS.length - 1;

  return (
    <>
      {/* dim layer with a live hole */}
      <div className="fixed inset-0 z-[80]" aria-hidden="true">
        {rect ? (
          <div
            className="absolute border border-amber/80 transition-all duration-300 ease-out"
            style={{
              top: rect.top - pad,
              left: rect.left - pad,
              width: rect.width + pad * 2,
              height: rect.height + pad * 2,
              boxShadow: "0 0 0 9999px rgba(5, 9, 15, 0.8)",
            }}
          >
            <span className="absolute -top-6 left-0 font-mono text-[10px] tracking-[0.24em] text-amber uppercase">
              ▸ focus
            </span>
          </div>
        ) : (
          <div className="absolute inset-0 bg-ink-950/80" />
        )}
      </div>

      {/* narration card */}
      <div className="fixed bottom-5 right-5 z-[90] w-[min(430px,calc(100vw-2.5rem))]">
        <div className="panel-solid border-amber/40 shadow-[0_24px_70px_-20px_rgba(0,0,0,0.85)]">
          <div className="flex items-center gap-3 border-b border-line px-4 py-2.5">
            <span className="grid h-6 w-6 place-items-center border border-amber/60 text-amber">
              <IconPulse size={12} />
            </span>
            <span className="font-mono text-[10px] tracking-[0.24em] text-fog-2 uppercase">
              guided demo · {idx + 1}/{STEPS.length}
            </span>
            <div className="ml-auto flex items-center gap-1.5">
              {STEPS.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => setIdx(i)}
                  aria-label={`step ${i + 1}`}
                  className={`h-1.5 transition-all duration-300 ${
                    i === idx ? "w-5 bg-amber" : i < idx ? "w-2.5 bg-amber/45" : "w-2.5 bg-line-2"
                  }`}
                />
              ))}
            </div>
            <button onClick={onClose} aria-label="close tour" className="font-mono text-[13px] text-fog-2 hover:text-alarm">
              <IconX size={13} />
            </button>
          </div>
          <div className="px-5 py-4">
            <h3 className="font-display text-lg font-bold uppercase tracking-wide leading-tight text-snow">
              {step.title}
            </h3>
            <p className="mt-2 text-[13px] leading-relaxed text-fog">{step.body}</p>
          </div>
          <div className="flex items-center gap-2 border-t border-line px-4 py-3">
            <button className="btn py-1.5 px-3" onClick={() => setIdx((i) => Math.max(i - 1, 0))} disabled={idx === 0}>
              ← prev
            </button>
            {!last ? (
              <button className="btn-solid py-1.5 px-4" onClick={() => setIdx((i) => Math.min(i + 1, STEPS.length - 1))}>
                next →
              </button>
            ) : (
              <button className="btn-solid py-1.5 px-4" onClick={onClose}>
                finish tour
              </button>
            )}
            <button
              className={`btn ml-auto py-1.5 px-3 ${auto ? "text-mint border-mint/50" : ""}`}
              onClick={() => setAuto((a) => !a)}
              disabled={last}
            >
              {auto ? "auto · on" : "auto"}
            </button>
          </div>
        </div>
        <p className="mt-2 text-right font-mono text-[9.5px] tracking-[0.18em] text-fog-2 uppercase">
          ← → to navigate · esc to exit {mode === "report" ? "· report mode" : "· console mode"}
        </p>
      </div>
    </>
  );
}
