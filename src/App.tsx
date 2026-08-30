import { useMemo } from "react";
import { evaluateAll, aggregate } from "./engine/eval";
import TopBar from "./components/TopBar";
import WarRoom from "./components/WarRoom";
import Problem from "./components/Problem";
import Bench from "./components/Bench";
import EvalBoard from "./components/EvalBoard";
import Evidence from "./components/Evidence";
import TriageDesk from "./components/TriageDesk";
import OpsConsole from "./components/OpsConsole";
import Changelog from "./components/Changelog";
import Architecture from "./components/Architecture";
import { Repro, HotTake, Footer } from "./components/Closing";
import { ToastProvider } from "./components/ui";

export default function App() {
  const agg = useMemo(() => aggregate(evaluateAll().cases), []);

  return (
    <ToastProvider>
      <div className="bg-stage min-h-screen">
        <TopBar />
        <main>
          <WarRoom agg={agg} />
          <Problem agg={agg} />
          <Bench />
          <EvalBoard />
          <Evidence />
          <TriageDesk />
          <OpsConsole />
          <Changelog />
          <Architecture />
          <Repro />
          <HotTake />
        </main>
        <Footer />
      </div>
    </ToastProvider>
  );
}
