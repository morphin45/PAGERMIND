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
