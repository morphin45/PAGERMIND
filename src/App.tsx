import { useMemo, useState } from "react";
import { evaluateAll, aggregate } from "./engine/eval";
import TopBar from "./components/TopBar";
import Workstation from "./components/Workstation";
import CorrelationEngine from "./components/CorrelationEngine";
import PostmortemStudio from "./components/PostmortemStudio";
import TriageDesk from "./components/TriageDesk";
import OpsConsole from "./components/OpsConsole";
import Problem from "./components/Problem";
import Bench from "./components/Bench";
import EvalBoard from "./components/EvalBoard";
import RedTeam from "./components/RedTeam";
import Evidence from "./components/Evidence";
import Changelog from "./components/Changelog";
import Architecture from "./components/Architecture";
import { Repro, HotTake, Footer } from "./components/Closing";
import { ToastProvider } from "./components/ui";
import DemoTour from "./components/DemoTour";

export type ViewMode = "console" | "report";

export default function App() {
  const [mode, setMode] = useState<ViewMode>("console");
  const [tour, setTour] = useState<"manual" | "present" | null>(null);
  const agg = useMemo(() => aggregate(evaluateAll().cases), []);

  const startTour = () => {
    setMode("console"); // the tour walks console → report itself
    window.setTimeout(() => setTour("present"), 60); // narrated by default
  };

  return (
    <ToastProvider>
      <div className="bg-stage min-h-screen">
        <TopBar mode={mode} onMode={setMode} onDemo={startTour} />
        <DemoTour
          open={tour !== null}
          onClose={() => setTour(null)}
          mode={mode}
          setMode={setMode}
          preset={tour ?? "manual"}
        />
        <main>
          {mode === "console" ? (
            <>
              <Workstation />
              <TriageDesk />
              <OpsConsole />
              {/* compact submission summary inside the product */}
              <section className="mx-auto max-w-7xl px-4 md:px-8 py-14">
                <div className="panel flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-mono text-[10px] tracking-[0.22em] text-fog-2 uppercase">
                      hackathon submission AW-2201 · micro1 agentic workflows
                    </p>
                    <p className="font-display mt-2 text-2xl font-bold uppercase tracking-tight text-snow">
                      This console is the evaluation.
                    </p>
                    <p className="mt-2 max-w-xl text-[13.5px] leading-relaxed text-fog">
                      Everything you just watched — the triage, the gates, the ledger — runs on the same engine as the
                      scored baseline-vs-agent comparison: <span className="font-mono text-snow">rubric {agg.baselinePct}% → {agg.agentPct}%</span>,
                      false pages <span className="font-mono text-snow">{agg.baselineFalsePages} → {agg.agentFalsePages}</span>,
                      wrong-team <span className="font-mono text-snow">{agg.baselineWrongTeam} → {agg.agentWrongTeam}</span>.
                    </p>
                  </div>
                  <button className="btn-solid shrink-0" onClick={() => setMode("report")}>
                    open submission report →
                  </button>
                </div>
              </section>
            </>
          ) : (
            <>
              <ReportHero onBack={() => setMode("console")} agg={agg} />
              <Problem agg={agg} />
              <Bench />
              <EvalBoard />
              <Evidence />
              <RedTeam />
              <TriageDesk />
              <OpsConsole />
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

function ReportHero({ onBack, agg }: { onBack: () => void; agg: ReturnType<typeof aggregate> }) {
  return (
    <section className="mx-auto max-w-7xl px-4 md:px-8 pt-24 md:pt-28 pb-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] tracking-[0.28em] text-amber uppercase">
            submission report · AW-2201 · micro1 agentic workflows hackathon
          </p>
          <h1 className="font-display mt-3 text-4xl md:text-6xl font-bold uppercase leading-[1.0] tracking-tight text-snow">
            Pagermind<span className="text-amber">/</span>evidence
          </h1>
          <p className="mt-3 max-w-2xl text-[14.5px] leading-relaxed text-fog">
            The live product is one click away — this report is the scored story: the baseline, the agent, the
            changelog and the numbers, each tied to code you can run.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn" onClick={onBack}>
            ← back to live console
          </button>
          <span className="chip text-mint border-mint/40">
            {agg.baselinePct}% → {agg.agentPct}%
          </span>
        </div>
      </div>
    </section>
  );
}
