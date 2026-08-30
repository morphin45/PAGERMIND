import { useUtcClock } from "./ui";
import { IconPulse } from "./icons";

const LINKS = [
  ["#problem", "Problem"],
  ["#bench", "Bench"],
  ["#eval", "Eval"],
  ["#evidence", "Evidence"],
  ["#desk", "Desk"],
  ["#ops", "Ops"],
  ["#changelog", "Changelog"],
  ["#arch", "Arch"],
  ["#repro", "Repro"],
  ["#take", "Take"],
] as const;

export default function TopBar() {
  const clock = useUtcClock();
  return (
    <header className="fixed top-0 inset-x-0 z-50 border-b border-line bg-ink-950/88 backdrop-blur-sm">
      <div className="mx-auto flex h-12 max-w-7xl items-center gap-5 px-4 md:px-8">
        <a href="#top" className="flex items-center gap-2.5 group">
          <span className="grid h-6 w-6 place-items-center border border-amber text-amber transition-colors group-hover:bg-amber group-hover:text-ink-950">
            <IconPulse size={13} />
          </span>
          <span className="font-display text-sm font-bold tracking-[0.18em] text-snow">PAGERMIND</span>
          <span className="chip hidden sm:inline text-fog-2">AW-2201</span>
        </a>
        <nav className="ml-auto hidden md:flex items-center gap-5">
          {LINKS.map(([href, label]) => (
            <a key={href} href={href} className="anchor">
              {label}
            </a>
          ))}
        </nav>
        <div className="ml-auto md:ml-6 flex items-center gap-4">
          <span className="hidden sm:flex items-center gap-2 font-mono text-[11px] text-fog">
            <span className="h-1.5 w-1.5 bg-mint pulse-dot" />
            EVAL&nbsp;LIVE
          </span>
          <span className="font-mono text-[11px] tabular-nums text-fog">{clock}</span>
        </div>
      </div>
    </header>
  );
}
