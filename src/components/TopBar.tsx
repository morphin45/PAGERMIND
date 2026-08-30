import type { ViewMode } from "../App";
import { useUtcClock } from "./ui";
import { IconPulse } from "./icons";

const CONSOLE_LINKS = [
  ["#console", "Console"],
  ["#storm", "Storm"],
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

export default function TopBar({
  mode,
  onMode,
  onDemo,
}: {
  mode: ViewMode;
  onMode: (m: ViewMode) => void;
  onDemo: () => void;
}) {
  const clock = useUtcClock();
  const links = mode === "console" ? CONSOLE_LINKS : REPORT_LINKS;

  return (
    <header className="fixed top-0 inset-x-0 z-50 border-b border-line bg-ink-950/90 backdrop-blur-sm">
      <div className="mx-auto flex h-12 max-w-7xl items-center gap-5 px-4 md:px-8">
        <a href="#top" className="flex items-center gap-2.5 group" onClick={() => onMode("console")}>
          <span className="grid h-6 w-6 place-items-center border border-amber text-amber transition-colors group-hover:bg-amber group-hover:text-ink-950">
            <IconPulse size={13} />
          </span>
          <span className="font-display text-sm font-bold tracking-[0.18em] text-snow">PAGERMIND</span>
          <span className="chip hidden sm:inline text-mint border-mint/40">live</span>
        </a>

        <nav className="ml-6 hidden md:flex items-center gap-5">
          {links.map(([href, label]) => (
            <a key={href} href={href} className="anchor">
              {label}
            </a>
          ))}
        </nav>

        {/* guided demo */}
        <button
          onClick={onDemo}
          className="ml-auto md:ml-6 flex items-center gap-2 border border-amber/60 bg-amber/10 px-3 py-1.5 font-mono text-[10px] tracking-[0.14em] uppercase text-amber transition-all hover:bg-amber hover:text-ink-950"
        >
          <span className="inline-block h-0 w-0 border-y-[4px] border-l-[6px] border-y-transparent border-l-current" />
          demo
        </button>

        {/* mode switch */}
        <div className="ml-3 flex items-center border border-line-2">
          <button
            onClick={() => onMode("console")}
            className={`px-3 py-1.5 font-mono text-[10px] tracking-[0.14em] uppercase transition-colors ${
              mode === "console" ? "bg-amber text-ink-950 font-bold" : "text-fog hover:text-snow"
            }`}
          >
            console
          </button>
          <button
            onClick={() => onMode("report")}
            className={`px-3 py-1.5 font-mono text-[10px] tracking-[0.14em] uppercase transition-colors ${
              mode === "report" ? "bg-amber text-ink-950 font-bold" : "text-fog hover:text-snow"
            }`}
          >
            report
          </button>
        </div>

        <span className="hidden lg:block font-mono text-[11px] tabular-nums text-fog">{clock}</span>
      </div>
    </header>
  );
}
