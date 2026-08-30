import { useEffect, useRef, useState, type ReactNode } from "react";
import { sevColor, type Severity } from "../data/incidents";

/* ---------- scroll reveal ---------- */
export function Reveal({
  children,
  className = "",
  delay = 0,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "section" | "li" | "tr";
}) {
  const ref = useRef<HTMLElement | null>(null);
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
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      // @ts-expect-error polymorphic ref
      ref={ref}
      className={`reveal ${inView ? "is-in" : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </Tag>
  );
}

/* ---------- section header ---------- */
export function SectionHead({
  index,
  kicker,
  title,
  lede,
}: {
  index: string;
  kicker: string;
  title: ReactNode;
  lede?: ReactNode;
}) {
  return (
    <Reveal className="mb-10 md:mb-14">
      <div className="flex items-baseline gap-4">
        <span className="font-mono text-[11px] tracking-[0.25em] text-amber">{index}</span>
        <span className="font-mono text-[11px] tracking-[0.25em] text-fog-2 uppercase">{kicker}</span>
        <span className="h-px flex-1 bg-line" />
      </div>
      <h2 className="font-display mt-4 text-3xl md:text-5xl font-bold uppercase leading-[1.02] tracking-tight text-snow max-w-3xl">
        {title}
      </h2>
      {lede && <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-fog">{lede}</p>}
    </Reveal>
  );
}

/* ---------- severity chip ---------- */
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

/* ---------- verdict mark ---------- */
export function Mark({ ok, half }: { ok: boolean; half?: boolean }) {
  if (half)
    return (
      <span className="font-mono text-[11px] text-lemon" title="partial credit">
        ½
      </span>
    );
  return ok ? (
    <span className="font-mono text-[12px] text-mint">✓</span>
  ) : (
    <span className="font-mono text-[12px] text-alarm">✗</span>
  );
}

/* ---------- trace step player hook ---------- */
export function usePlayer(total: number, runId: number, interval = 430) {
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

/* ---------- live UTC clock ---------- */
export function useUtcClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(now.getUTCHours())}:${p(now.getUTCMinutes())}:${p(now.getUTCSeconds())} UTC`;
}

/* ---------- toasts ---------- */
export interface Toast {
  id: number;
  kind: "ok" | "err";
  title: string;
  detail?: string;
}

let toastSeq = 0;

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = (id: number) => setToasts((t) => t.filter((x) => x.id !== id));
  const push = (kind: Toast["kind"], title: string, detail?: string) => {
    toastSeq += 1;
    const id = toastSeq;
    setToasts((t) => [...t.slice(-3), { id, kind, title, detail }]);
    window.setTimeout(() => dismiss(id), 4600);
  };
  return { toasts, push, dismiss };
}

export function ToastShelf({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: number) => void }) {
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex w-[min(360px,90vw)] flex-col gap-2" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast-in pointer-events-auto border px-4 py-3 ${
            t.kind === "ok" ? "border-mint/40 bg-ink-850" : "border-alarm/45 bg-ink-850"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <p className={`font-mono text-[11px] font-bold uppercase tracking-[0.14em] ${t.kind === "ok" ? "text-mint" : "text-alarm"}`}>
              {t.kind === "ok" ? "✓ " : "✗ "}
              {t.title}
            </p>
            <button onClick={() => dismiss(t.id)} className="font-mono text-[12px] text-fog-2 hover:text-snow" aria-label="dismiss">
              ×
            </button>
          </div>
          {t.detail && <p className="mt-1 font-mono text-[10.5px] leading-relaxed text-fog">{t.detail}</p>}
        </div>
      ))}
    </div>
  );
}
