import type { IncidentCase } from "../data/incidents";
import type { AgentResult } from "./agent";

/**
 * Handoff brief — the end-to-end artifact.
 * Plain text by design: pastable into an incident channel, reviewable in
 * five seconds at 3 a.m., and every claim traceable to the trace above it.
 */
export function buildBrief(c: IncidentCase, a: AgentResult): string {
  const lines = [
    `PAGERMIND HANDOFF · ${c.id} — ${c.title}`,
    `generated ${new Date().toISOString()} · trace seed 0x2201 (deterministic)`,
    ``,
    `VERDICT   ${a.severity} → ${a.team} · confidence ${a.confidence.toFixed(2)}`,
    `ACTION    ${a.action}`,
    `RUNBOOK   ${a.runbook.id} · ${a.runbook.title}`,
    `GATE      ${a.page ? "consequential — human approval REQUIRED before the page fires" : "non-consequential — pre-approved automation, audit note attached"}`,
    ``,
    `EVIDENCE CHAIN`,
    ...a.evidence.map((e, i) => `  ${i + 1}. ${e}`),
  ];

  if (a.adjustment) {
    lines.push(``, `CRITIC ADJUSTMENT  ${a.adjustment}`);
  }
  if (a.memoryNote) {
    lines.push(``, `MEMORY  ${a.memoryNote}`);
  }
  lines.push(
    ``,
    `TRACE   ${a.steps.length} steps · ${a.steps.filter((s) => s.kind === "tool").length} tool calls`,
    `REVIEW  verify evidence, approve or reject at the operations desk — the decision is audited and immutable`,
    ``,
    `— pagermind/agent v0.4 · same input, same trace, every machine`
  );
  return lines.join("\n");
}
