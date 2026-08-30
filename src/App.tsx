import { useMemo } from "react";
import { evaluateAll, aggregate } from "./engine/eval";
import TopBar from "./components/TopBar";
import WarRoom from "./components/WarRoom";
import Problem from "./components/Problem";
import Bench from "./components/Bench";
import EvalBoard from "./components/EvalBoard";
import Changelog from "./components/Changelog";
import Architecture from "./components/Architecture";
import { Repro, HotTake, Footer } from "./components/Closing";

export default function App() {
  const agg = useMemo(() => aggregate(evaluateAll().cases), []);

  return (
    <div className="bg-stage min-h-screen">
      <TopBar />
      <main>
        <WarRoom agg={agg} />
        <Problem agg={agg} />
        <Bench />
        <EvalBoard />
        <Changelog />
        <Architecture />
        <Repro />
        <HotTake />
      </main>
      <Footer />
    </div>
  );
}
