import { useEffect, useMemo, useState } from "react";
import { aggregate, evaluateAll, adversarialSuite } from "./engine/engine";
import { isChaos, onChaos, setChaos } from "./backend/backend";
import Workstation from "./components/Workstation";
import { CorrelationEngine, OpsConsole, PostmortemStudio, TriageDesk } from "./components/operations";
import LiveSignals from "./components/live";
import CommandPalette from "./components/palette";
import { Problem, Bench, EvalBoard, Evidence, RedTeam, Changelog, Architecture, Repro, HotTake, Footer } from "./components/report";
import DemoTour from "./components/tour";
import { IconPulse, ToastProvider, useCountUp, useUtcClock } from "./components/ui";

export type ViewMode = "console" | "report";

const CONSOLE_LINKS = [
  ["#console", "Feed"],
  ["#storm", "Storm"],
  ["#live", "Live"],
  ["#desk", "Gates"],
  ["#postmortem", "Postmortem"],
  ["#ops", "Ops"],
] as const;

const REPORT_LINKS = [
  ["#problem", "Problem"],
  ["#bench", "Bench"],
  ["#eval", "Eval"],
  ["#evidence", "Evidence"],
  ["#redteam", "Red Team"],
  ["#changelog", "Changelog"],
  ["#arch", "Arch"],
  ["#repro", "Repro"],
  ["#take", "Take"],
] as const;

function TopBar({
  mode,
  onMode,
  onDemo,
  onPalette,
}: {
  mode: ViewMode;
  onMode: (m: ViewMode) => void;
  onDemo: () => void;
  onPalette: () => void;
}) {
  const clock = useUtcClock();
  const links = mode === "console" ? CONSOLE_LINKS : REPORT_LINKS;
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-line bg-ink-950/88 backdrop-blur-sm">
      <div className="mx-auto flex h-12 max-w-7xl items-center gap-5 px-4 md:px-8">
        <a href="#top" className="group flex items-center gap-2.5">
          <span className="grid h-6 w-6 place-items-center border border-amber text-amber transition-colors group-hover:bg-amber group-hover:text-ink-950">
            <IconPulse size={13} />
          </span>
          <span className="font-display text-sm font-bold tracking-[0.18em] text-snow">PAGERMIND</span>
          <span className="chip hidden text-fog-2 sm:inline">AW-2201</span>
        </a>
        <nav className="ml-2 hidden items-center gap-4 lg:flex">
          {links.map(([href, label]) => (
            <a key={href} href={href} className="anchor">{label}</a>
          ))}
        </nav>
        <button
          onClick={onPalette}
          title="command palette"
          className="ml-auto hidden items-center gap-1.5 border border-line-2 px-2.5 py-1.5 font-mono text-[10px] text-fog-2 transition-colors hover:border-amber/50 hover:text-amber md:flex"
        >
          ⌘K
        </button>
        <button
          onClick={onDemo}
          className="ml-3 flex items-center gap-2 border border-amber/60 bg-amber/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-amber transition-all hover:bg-amber hover:text-ink-950"
        >
          <span className="inline-block h-0 w-0 border-y-[4px] border-l-[6px] border-y-transparent border-l-current" />
          demo
        </button>
        <div className="flex items-center border border-line-2">
          <button onClick={() => onMode("console")} className={`px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors ${mode === "console" ? "bg-amber text-ink-950" : "text-fog-2 hover:text-fog"}`}>
            console
          </button>
          <button onClick={() => onMode("report")} className={`px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors ${mode === "report" ? "bg-amber text-ink-950" : "text-fog-2 hover:text-fog"}`}>
            report
          </button>
        </div>
        <span className="hidden font-mono text-[11px] tabular-nums text-fog md:block">{clock}</span>
      </div>
    </header>
  );
}

function Ticker({ items }: { items: string[] }) {
  return (
    <div className="mt-8 overflow-hidden border-y border-line py-2.5">
      <div className="ticker-track font-mono text-[11px] uppercase tracking-[0.14em] text-fog">
        {[0, 1].map((dup) => (
          <div key={dup} className="flex shrink-0 items-center">
            {items.map((t) => (
              <span key={t} className="flex items-center">
                <span className="px-6">{t}</span>
                <span className="text-amber">◆</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function Summary({ agg, red, onReport }: { agg: ReturnType<typeof aggregate>; red: ReturnType<typeof adversarialSuite>; onReport: () => void }) {
  const [active, setActive] = useState(false);
  const score = useCountUp(agg.agentPct, active);
  return (
    <section
      ref={(el) => {
        if (el && !active) {
          const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setActive(true); io.disconnect(); } }, { threshold: 0.25 });
          io.observe(el);
        }
      }}
      className="mx-auto max-w-7xl px-4 py-14 md:px-8"
    >
      <div className="panel relative overflow-hidden p-6 md:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 border border-amber/15" />
        <div className="pointer-events-none absolute -right-8 -top-8 h-56 w-56 border border-amber/10" />
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-fog-2">
              hackathon submission AW-2201 · micro1 agentic workflows
            </p>
            <p className="font-display mt-2 text-2xl font-bold uppercase tracking-tight text-snow md:text-3xl">
              This console is the evaluation.
            </p>
            <p className="mt-2 max-w-xl text-[13.5px] leading-relaxed text-fog">
              Everything you just watched runs on the same engine as the scored baseline comparison: rubric{" "}
              <span className="font-mono text-snow">{agg.baselinePct}% → <span className="text-mint">{score}%</span></span>, false pages{" "}
              <span className="font-mono text-snow">{agg.baselineFalsePages} → {agg.agentFalsePages}</span>, wrong-team{" "}
              <span className="font-mono text-snow">{agg.baselineWrongTeam} → {agg.agentWrongTeam}</span>, poisoned alerts resisted{" "}
              <span className="font-mono text-snow">{red.agentResisted}/{red.total}</span> vs {red.baselineResisted}/{red.total}.
            </p>
          </div>
          <button className="btn-solid shrink-0" onClick={onReport}>
            open submission report →
          </button>
        </div>
        <Ticker
          items={[
            `rubric ${agg.baselinePct}% → ${agg.agentPct}%`,
            `false pages ${agg.baselineFalsePages} → ${agg.agentFalsePages}`,
            "12 cases · 9 traps · 6 poisoned alerts",
            "human gate on every page",
            "baseline = one regex script",
            "runtime < 1s · cost $0.00",
            "same trace on every machine",
            "no prose-to-action channel",
          ]}
        />
      </div>
    </section>
  );
}

/* ---------------- first-run shift briefing ---------------- */

function Onboarding({ onDemo }: { onDemo: () => void }) {
  const [seen, setSeen] = useState(() => {
    try {
      return window.localStorage.getItem("pm.onboarded.v1") === "1";
    } catch {
      return true;
    }
  });
  const dismiss = (demo: boolean) => {
    try {
      window.localStorage.setItem("pm.onboarded.v1", "1");
    } catch {
      /* memory mode — fine */
    }
    setSeen(true);
    if (demo) onDemo();
  };
  if (seen) return null;
  return (
    <div className="fixed inset-0 z-[75] grid place-items-center bg-ink-950/88 px-4 backdrop-blur-sm">
      <div className="panel scanlines feed-in relative w-full max-w-xl border-l-4 border-l-amber p-7 md:p-9">
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-amber">shift briefing · 03:00 UTC</p>
        <h2 className="font-display mt-3 text-4xl font-bold uppercase leading-[0.98] tracking-tight text-snow md:text-5xl">
          You're on-call
          <br />
          now.
        </h2>
        <ol className="mt-6 space-y-3.5">
          {[
            ["01", "The feed is live", "Synthetic incidents stream in; a deterministic agent triages each with a visible trace. The space bar pauses the clock."],
            ["02", "Pages wait for you", "SEV1/SEV2 calls stage at the human gate. Nothing fires without a reviewer — sign in at the desk as Priya."],
            ["03", "Nothing here is real — except the audit", "All data is synthetic; every act lands in the append-only ledger. Reproduce every number: npx vitest run."],
          ].map(([n, t, d]) => (
            <li key={n} className="flex gap-4">
              <span className="font-display text-lg font-bold text-amber">{n}</span>
              <span>
                <span className="block font-mono text-[12px] font-semibold uppercase tracking-[0.12em] text-snow">{t}</span>
                <span className="block text-[13px] leading-relaxed text-fog">{d}</span>
              </span>
            </li>
          ))}
        </ol>
        <div className="mt-7 flex flex-wrap gap-3">
          <button className="btn-solid" onClick={() => dismiss(true)}>
            ▶ run the guided demo
          </button>
          <button className="btn" onClick={() => dismiss(false)}>
            explore on my own
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- degraded-mode banner ---------------- */

function DegradedBanner() {
  const [degraded, setDegraded] = useState(isChaos());
  useEffect(() => onChaos(setDegraded), []);
  if (!degraded) return null;
  return (
    <div className="fixed inset-x-0 top-12 z-40 border-b border-alarm/40 bg-alarm/12 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 md:px-8">
        <span className="h-1.5 w-1.5 shrink-0 bg-alarm pulse-amber" />
        <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-alarm">
          storage offline — chaos mode · triage unaffected · decisions fail 503
        </p>
        <div className="ml-auto flex items-center gap-2">
          <a href="#ops" className="font-mono text-[10px] uppercase tracking-[0.14em] text-fog underline decoration-line-2 underline-offset-4 hover:text-snow">
            inspect in ops
          </a>
          <button onClick={() => setChaos(false)} className="font-mono text-[10px] uppercase tracking-[0.14em] text-mint hover:underline">
            restore
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [mode, setMode] = useState<ViewMode>("console");
  const [tour, setTour] = useState<"manual" | "present" | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const agg = useMemo(() => aggregate(evaluateAll().cases), []);
  const red = useMemo(() => adversarialSuite(), []);

  const startTour = () => {
    setMode("console");
    window.setTimeout(() => setTour("present"), 60);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <ToastProvider>
      <div className="bg-stage min-h-screen">
        <TopBar mode={mode} onMode={setMode} onDemo={startTour} onPalette={() => setPaletteOpen(true)} />
        <DegradedBanner />
        <DemoTour open={tour !== null} onClose={() => setTour(null)} mode={mode} setMode={setMode} preset={tour ?? "manual"} />
        <Onboarding onDemo={startTour} />
        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} setMode={setMode} startTour={startTour} />
        <main>
          {mode === "console" ? (
            <>
              <Workstation />
              <CorrelationEngine />
              <LiveSignals />
              <TriageDesk />
              <PostmortemStudio />
              <OpsConsole />
              <Summary agg={agg} red={red} onReport={() => setMode("report")} />
            </>
          ) : (
            <>
              <section className="mx-auto max-w-7xl px-4 pb-4 pt-24 md:px-8 md:pt-28">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-amber">
                      submission report · AW-2201 · micro1 agentic workflows hackathon
                    </p>
                    <h1 className="font-display mt-3 text-4xl font-bold uppercase leading-[1.0] tracking-tight text-snow md:text-6xl">
                      Pagermind<span className="text-amber">/</span>evidence
                    </h1>
                    <p className="mt-3 max-w-2xl text-[14.5px] leading-relaxed text-fog">
                      The live product is one click away — this report is the scored story: the baseline, the agent, the
                      changelog and the numbers, each tied to code you can run.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button className="btn" onClick={() => setMode("console")}>← back to live console</button>
                    <span className="chip border-mint/40 text-mint">{agg.baselinePct}% → {agg.agentPct}%</span>
                  </div>
                </div>
              </section>
              <Problem agg={agg} />
              <Bench />
              <EvalBoard />
              <Evidence />
              <RedTeam />
              <Changelog />
              <Architecture />
              <Repro />
              <HotTake />
            </>
          )}
        </main>
        <Footer />
      </div>
    </ToastProvider>
  );
}
