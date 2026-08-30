import type { Aggregate } from "../engine/eval";
import { Reveal, SectionHead } from "./ui";
import { IconUser, IconLayers, IconClock, IconEye } from "./icons";

const QUESTIONS = [
  {
    n: "01",
    icon: IconUser,
    q: "Who has this problem?",
    a: "On-call engineers and SRE teams at any product company running alerting. The person paged at 03:12 doesn't own every service, doesn't remember last month's incident, and reads the alert on a phone with four tabs of context missing.",
  },
  {
    n: "02",
    icon: IconLayers,
    q: "What bottleneck makes it worth solving?",
    a: "Context is scattered: ownership lives in a service catalog, truth lives in metrics, precedent lives in the incident history, and the drill schedule lives in a calendar. Triage means re-assembling all four by hand — at 3 a.m., under pressure, with a keyword script paging the wrong team in the background.",
  },
  {
    n: "03",
    icon: IconEye,
    q: "Does the agent solve it well?",
    a: "On the shared 12-case eval it resolves every severity, routes every team correctly and cites a runbook — while the baseline false-pages on 5 of 12 alerts. Crucially it shows its work: every verdict traces to a tool output and a fired rule, so a human can agree or override in seconds.",
  },
  {
    n: "04",
    icon: IconClock,
    q: "Can another person reproduce the result?",
    a: "Yes — the entire eval is deterministic TypeScript with a fixed seed. npm run eval re-derives every number on this page in under a second, from a clean checkout, at zero API cost.",
  },
];

export default function Problem({ agg }: { agg: Aggregate }) {
  const stats = [
    { v: `${agg.baselineFalsePages}/12`, k: "baseline alerts end in a false page" },
    { v: `${agg.baselineWrongTeam}/12`, k: "baseline routes to the wrong team" },
    { v: "4 tabs", k: "of context a human re-assembles per page" },
    { v: "$0.00", k: "to re-run this entire evaluation" },
  ];

  return (
    <section id="problem" className="mx-auto max-w-7xl scroll-mt-20 px-4 md:px-8 py-20 md:py-28">
      <SectionHead
        index="06"
        kicker="Problem & user value"
        title={
          <>
            Nobody is paged for the fun of it.
            <br />
            <span className="text-fog-2">They're paged to re-assemble context.</span>
          </>
        }
      />
      <div className="grid gap-10 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <div className="lg:sticky lg:top-24 space-y-6">
            <Reveal className="panel p-6">
              <p className="font-mono text-[10px] tracking-[0.22em] text-fog-2 uppercase">field note · persona</p>
              <p className="mt-4 text-[17px] leading-relaxed text-snow">
                “The alert tells me <em className="text-amber not-italic font-medium">something</em> is on fire. Then I
                spend eleven minutes finding out whose fire it is, whether it's already known, and whether it's even
                real — before I do a single useful thing.”
              </p>
              <p className="mt-4 font-mono text-[11px] text-fog">
                — R. OKAFOR · ON-CALL, CHECKOUT PLATFORM · 03:12 UTC
              </p>
            </Reveal>
            <Reveal delay={90} className="grid grid-cols-2 gap-px border border-line bg-line">
              {stats.map((s) => (
                <div key={s.k} className="bg-ink-900 p-5">
                  <p className="font-display text-3xl font-bold text-amber tabular-nums">{s.v}</p>
                  <p className="mt-1.5 text-[12.5px] leading-snug text-fog">{s.k}</p>
                </div>
              ))}
            </Reveal>
          </div>
        </div>
        <div className="lg:col-span-7 space-y-4">
          {QUESTIONS.map((q, i) => (
            <Reveal key={q.n} delay={i * 70} className="panel group p-6 md:p-7 transition-colors hover:border-line-2">
              <div className="flex items-start gap-5">
                <span className="font-display text-2xl md:text-3xl font-bold text-line-2 transition-colors group-hover:text-amber">
                  {q.n}
                </span>
                <div>
                  <h3 className="flex items-center gap-2.5 font-display text-lg md:text-xl font-bold uppercase tracking-wide text-snow">
                    <q.icon size={17} className="text-amber" />
                    {q.q}
                  </h3>
                  <p className="mt-2.5 text-[14.5px] leading-relaxed text-fog">{q.a}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
