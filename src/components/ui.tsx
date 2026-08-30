import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { sevColor, type Severity } from "../data/cases";

/* ---------------- icons (hand-drawn inline SVG) ---------------- */

type P = { size?: number; className?: string };
const base = ({ size = 16, className = "" }: P) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className,
  "aria-hidden": true,
});

export const IconPulse = (p: P) => (
  <svg {...base(p)}>
    <path d="M2.5 12h4l2.5-6.5 3.5 13 3-6.5h6" />
  </svg>
);
export const IconTerminal = (p: P) => (
  <svg {...base(p)}>
    <rect x="2.5" y="4" width="19" height="16" />
    <path d="M6.5 9l3.5 3-3.5 3M12.5 15.5H17" />
  </svg>
);
export const IconReplay = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 5v5h5" />
    <path d="M4.5 10a8 8 0 1 1 1.6 5.5" />
  </svg>
);
export const IconCheck = (p: P) => (
  <svg {...base(p)}>
    <path d="M4.5 12.5l5 5 10-11" />
  </svg>
);
export const IconX = (p: P) => (
  <svg {...base(p)}>
    <path d="M5.5 5.5l13 13M18.5 5.5l-13 13" />
  </svg>
);
export const IconBook = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 4.5h11a2.5 2.5 0 0 1 2.5 2.5v12.5H6.5A2.5 2.5 0 0 1 4 17z" />
    <path d="M4 17a2.5 2.5 0 0 1 2.5-2.5H17.5" />
  </svg>
);
export const IconGate = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" />
    <path d="M9 11.5l2.2 2.2L15.5 9" />
  </svg>
);
export const IconMemory = (p: P) => (
  <svg {...base(p)}>
    <ellipse cx="12" cy="6" rx="7" ry="3" />
    <path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6" />
    <path d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" />
  </svg>
);
export const IconAlert = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3L2.5 20h19L12 3z" />
    <path d="M12 9.5v5M12 17.4v.6" />
  </svg>
);
export const IconDownload = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3.5v11M7.5 10.5l4.5 4.5 4.5-4.5" />
    <path d="M4 20.5h16" />
  </svg>
);
export const IconActivity = (p: P) => (
  <svg {...base(p)}>
    <rect x="2.5" y="3.5" width="19" height="17" />
    <path d="M2.5 15h4l2-6 3 8 2.5-5h7.5" />
  </svg>
);
export const IconBranch = (p: P) => (
  <svg {...base(p)}>
    <circle cx="6" cy="5" r="2.2" />
    <circle cx="6" cy="19" r="2.2" />
    <circle cx="18" cy="8" r="2.2" />
    <path d="M6 7.2v9.6M18 10.2c0 3.5-4 4-7 4.6-2 .4-4 1-4.6 2.4" />
  </svg>
);
export const IconFlame = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 2.5c1 3-4.5 5.5-4.5 10a4.5 4.5 0 0 0 9 0c0-2-1-3.5-2-4.5 0 1.5-1 2-2 2 .5-2-.5-5.5-.5-7.5z" />
    <path d="M12 21.5c-4 0-7-2.5-7-6" />
  </svg>
);
export const IconUser = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M4.5 20c1.2-3.5 4-5 7.5-5s6.3 1.5 7.5 5" />
  </svg>
);
export const IconShield = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" />
    <path d="M12 8v5M9.5 10.5h5" />
  </svg>
);
export const IconBolt = (p: P) => (
  <svg {...base(p)}>
    <path d="M13 2.5L4.5 13.5H11L10 21.5l8.5-11H12z" />
  </svg>
);

/* ---------------- scroll reveal ---------------- */

export function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -30px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`reveal ${inView ? "is-in" : ""} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

/* ---------------- section header ---------------- */

export function SectionHead({ index, kicker, title, lede }: { index: string; kicker: string; title: ReactNode; lede?: ReactNode }) {
  return (
    <Reveal className="mb-10 md:mb-14">
      <div className="flex items-baseline gap-4">
        <span className="font-mono text-[11px] tracking-[0.25em] text-amber">{index}</span>
        <span className="font-mono text-[11px] tracking-[0.25em] text-fog-2 uppercase">{kicker}</span>
        <span className="h-px flex-1 bg-line" />
      </div>
      <h2 className="font-display mt-4 text-3xl md:text-5xl font-bold uppercase leading-[1.02] tracking-tight text-snow max-w-3xl">{title}</h2>
      {lede && <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-fog">{lede}</p>}
    </Reveal>
  );
}

/* ---------------- chips & marks ---------------- */

export function SevChip({ sev, dim }: { sev: Severity; dim?: boolean }) {
  const c = sevColor[sev];
  return (
    <span
      className="chip font-bold"
      style={{
        color: dim ? "#5e7694" : c,
        borderColor: dim ? "#1c2b42" : `${c}66`,
        background: dim ? "transparent" : `${c}14`,
      }}
    >
      {sev}
    </span>
  );
}

export function Mark({ ok, half }: { ok: boolean; half?: boolean }) {
  if (half) return <span className="font-mono text-[11px] text-lemon" title="partial credit">½</span>;
  return ok ? <span className="font-mono text-[12px] text-mint">✓</span> : <span className="font-mono text-[12px] text-alarm">✗</span>;
}

/* ---------------- trace step player ---------------- */

export function usePlayer(total: number, runId: number | string, interval = 430) {
  const [visible, setVisible] = useState(0);
  const [done, setDone] = useState(false);
  useEffect(() => {
    setVisible(0);
    setDone(false);
    if (total === 0) return;
    let v = 0;
    const t = window.setInterval(() => {
      v += 1;
      setVisible(v);
      if (v >= total) {
        window.clearInterval(t);
        setDone(true);
      }
    }, interval);
    return () => window.clearInterval(t);
  }, [runId, total, interval]);
  return { visible, done };
}

/* ---------------- clocks & counters ---------------- */

export function useUtcClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(now.getUTCHours())}:${p(now.getUTCMinutes())}:${p(now.getUTCSeconds())} UTC`;
}

export function useCountUp(target: number, active: boolean, duration = 1200): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - k, 3);
      setValue(Math.round(target * eased));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, active, duration]);
  return value;
}

/* ---------------- toasts ---------------- */

export type ToastKind = "ok" | "warn" | "err";
interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  detail?: string;
}

const ToastCtx = createContext<{ push: (kind: ToastKind, title: string, detail?: string) => void }>({ push: () => {} });
export const useToasts = () => useContext(ToastCtx);

const TOAST_COLOR: Record<ToastKind, string> = { ok: "#31d48e", warn: "#ffb224", err: "#ff5d5d" };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(1);
  const push = useCallback((kind: ToastKind, title: string, detail?: string) => {
    const id = idRef.current++;
    setToasts((ts) => [...ts.slice(-3), { id, kind, title, detail }]);
    window.setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== id)), 4200);
  }, []);
  const value = useMemo(() => ({ push }), [push]);
  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-[70] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast-in panel-solid px-4 py-3" style={{ borderLeft: `3px solid ${TOAST_COLOR[t.kind]}` }}>
            <p className="font-mono text-[11.5px] font-semibold text-snow">{t.title}</p>
            {t.detail && <p className="mt-0.5 font-mono text-[10.5px] text-fog-2 break-words">{t.detail}</p>}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------------- helpers ---------------- */

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export function downloadFile(name: string, content: string, type = "application/json"): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
