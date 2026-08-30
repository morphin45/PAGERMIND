import { useMemo, useState } from "react";
import { CASES, type IncidentCase } from "../data/incidents";
import { CORRELATED } from "../engine/burst";
import { runAgent } from "../engine/agent";
import { buildPostmortem } from "../engine/postmortem";
import { Reveal, SectionHead, SevChip, useToasts } from "./ui";
import { IconBook, IconCheck, IconDownload } from "./icons";

/** Minimal, intentional markdown renderer — the document, not a blob of text. */
function DocView({ md }: { md: string }) {
  const lines = md.split("\n");
  return (
    <div className="space-y-1.5">
      {lines.map((l, i) => {
        if (l.startsWith("# "))
          return (
            <h4 key={i} className="font-display pt-2 text-lg font-bold uppercase leading-tight tracking-wide text-snow">
              {l.slice(2)}
            </h4>
          );
        if (l.startsWith("## "))
          return (
            <p key={i} className="mt-4 border-b border-line pb-1 font-mono text-[10px] uppercase tracking-[0.24em] text-amber">
              {l.slice(3)}
            </p>
          );
        if (l.startsWith("| ")) {
          if (l.startsWith("|---") || l.startsWith("| |")) return null;
          const [, k, v] = l.split("|").map((x) => x.trim());
          return (
            <p key={i} className="flex gap-2 font-mono text-[11.5px] leading-relaxed">
              <span className="w-32 shrink-0 text-fog-2">{k.replace(/\*\*/g, "")}</span>
              <span className="text-snow">{v.replace(/\*\*/g, "")}</span>
            </p>
          );
        }
        if (l.startsWith("- [ ] "))
          return (
            <p key={i} className="flex gap-2.5 font-mono text-[11.5px] leading-relaxed text-fog">
              <span className="mt-0.5 inline-block h-3 w-3 shrink-0 border border-line-2" /> {l.slice(6)}
            </p>
          );
        if (l.startsWith("- "))
          return (
            <p key={i} className="flex gap-2.5 font-mono text-[11.5px] leading-relaxed text-fog">
              <span className="text-mint shrink-0">▸</span> {l.slice(2)}
            </p>
          );
        if (/^\d+\./.test(l))
          return (
            <p key={i} className="flex gap-2.5 pl-1 font-mono text-[11.5px] leading-relaxed text-fog">
              <span className="text-sky shrink-0">{l.match(/^\d+/)![0]}.</span> {l.replace(/^\d+\.\s*/, "")}
            </p>
          );
        if (l.startsWith("---")) return <div key={i} className="my-3 h-px bg-line" />;
        if (l.startsWith("_") && l.endsWith("_"))
          return (
            <p key={i} className="pt-1 font-mono text-[10.5px] italic leading-relaxed text-fog-2">
              {l.slice(1, -1)}
            </p>
          );
        if (l.trim() === "") return null;
        return (
          <p key={i} className="text-[13px] leading-relaxed text-fog">
            {l}
          </p>
        );
      })}
    </div>
  );
}

export default function PostmortemStudio() {
  const incidents = useMemo(() => [CORRELATED, ...CASES], []);
  const [selectedId, setSelectedId] = useState(CORRELATED.id);
  const { push } = useToasts();

  const c = useMemo(() => incidents.find((x) => x.id === selectedId) as IncidentCase, [incidents, selectedId]);
  const verdict = useMemo(() => runAgent(c), [c]);
  const doc = useMemo(() => buildPostmortem(c, verdict), [c, verdict]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(doc);
      push("ok", "postmortem copied", "markdown · every field evidence-traced");
    } catch {
      push("err", "clipboard unavailable", "use download instead");
    }
  };

  const download = () => {
    const blob = new Blob([doc], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${c.id}-postmortem.md`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    push("ok", `${c.id}-postmortem.md downloaded`);
  };

  return (
    <section id="postmortem" className="mx-auto max-w-7xl scroll-mt-20 px-4 md:px-8 py-16 md:py-24">
      <SectionHead
        index="03"
        kicker="Postmortem studio — the evidence chain writes the document"
        title={
          <>
            When it's over,
            <br />
            <span className="text-amber">the paperwork writes itself.</span>
          </>
        }
        lede="Every postmortem is assembled from the same artifacts that triaged the incident — the trace, the fired rules, the memory recall and the ledger's human decision. No invented fields: if the engine can't ground a fact, the document says so. Same incident → same document."
      />

      <div className="grid gap-4 lg:grid-cols-12">
        <Reveal className="lg:col-span-4">
          <div className="panel-solid">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="font-mono text-[10px] tracking-[0.22em] text-fog-2 uppercase">resolved incidents</span>
              <IconBook size={13} className="text-amber" />
            </div>
            <ul className="max-h-[460px] overflow-y-auto">
              {incidents.map((x) => {
                const v = runAgent(x);
                const active = x.id === selectedId;
                return (
                  <li key={x.id}>
                    <button
                      onClick={() => setSelectedId(x.id)}
                      className={`case-row w-full px-4 py-2.5 text-left ${active ? "active" : ""}`}
                    >
                      <span className="flex items-center gap-2">
                        <span className={`font-mono text-[10.5px] ${active ? "text-amber" : "text-fog-2"}`}>{x.id}</span>
                        <SevChip sev={v.severity} />
                        {x.id === CORRELATED.id && <span className="chip ml-auto text-[9px] text-mint border-mint/40">storm</span>}
                      </span>
                      <span className="mt-0.5 block truncate text-[12.5px] font-medium text-snow">{x.title}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </Reveal>

        <Reveal delay={80} className="lg:col-span-8">
          <div className="panel-solid">
            <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
              <span className="font-mono text-[11px] text-amber">{c.id}-postmortem.md</span>
              <span className="chip text-fog-2">deterministic</span>
              <span className="chip text-fog-2">{verdict.evidence.length} evidence items</span>
              <div className="ml-auto flex items-center gap-2">
                <button className="btn py-1.5 px-3" onClick={copy}>
                  <IconCheck size={12} /> copy
                </button>
                <button className="btn-solid py-1.5 px-3" onClick={download}>
                  <IconDownload size={12} /> download
                </button>
              </div>
            </div>
            <div className="max-h-[560px] overflow-y-auto p-5 md:p-6">
              <DocView md={doc} />
            </div>
            <div className="border-t border-line px-5 py-3">
              <p className="font-mono text-[10px] leading-relaxed text-fog-2">
                Gate decisions are read live from the ledger — approve the {c.id} page at the desk above and the
                timeline updates with the reviewer's name and note. Regenerating always yields a byte-identical
                document for the same evidence.
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
