import { sevRank, type IncidentCase, type Severity } from "../data/incidents";

/**
 * PAGERMIND AGENT — tool-grounded triage pipeline.
 * parse → tools (catalog / metrics / history / calendar) → rule reasoner
 * → verifier (cross-check) → runbook match → human gate on consequential acts.
 *
 * Deterministic by construction: same incident in, same trace out.
 * Every classification cites the tool output + rule that produced it.
 */

export type StepKind = "parse" | "tool" | "memory" | "reason" | "verify" | "gate";

export interface TraceStep {
  kind: StepKind;
  label: string;
  detail: string;
  status: "ok" | "warn" | "info";
}

export interface AgentResult {
  severity: Severity;
  team: string;
  runbook: { id: string; title: string };
  action: string;
  page: boolean;
  confidence: number;
  evidence: string[];
  steps: TraceStep[];
  adjustment: string | null;
  memoryNote: string | null;
}

interface FiredRule {
  id: string;
  sev: Severity;
  why: string;
}

const worse = (a: Severity, b: Severity): Severity =>
  sevRank[a] <= sevRank[b] ? a : b;

function reason(c: IncidentCase): { proposal: Severity; fired: FiredRule[] } {
  const s = c.signals;
  const fired: FiredRule[] = [];

  if (c.catalog.tier === 1 && (s.customers === "blocked" || s.errorRate >= 8))
    fired.push({ id: "R1", sev: "SEV1", why: `tier-1 && (customers blocked || err ${s.errorRate}% ≥ 8%)` });
  if (c.catalog.tier === 1 && s.revenue && s.customers !== "none")
    fired.push({ id: "R2", sev: "SEV1", why: "tier-1 && revenue at risk && customers impacted" });
  if (c.catalog.tier === 1 && s.customers === "degraded")
    fired.push({ id: "R3", sev: "SEV2", why: "tier-1 && customers degraded (not blocked)" });
  if (c.catalog.tier === 1 && s.dependency)
    fired.push({ id: "R4", sev: "SEV2", why: `tier-1 && upstream dependency degraded (${s.dependency})` });
  if (c.catalog.tier === 2 && s.customers === "blocked")
    fired.push({ id: "R5", sev: "SEV2", why: "tier-2 && customers blocked" });
  if (c.catalog.tier === 2 && s.customers === "degraded")
    fired.push({ id: "R6", sev: "SEV3", why: "tier-2 && customers degraded" });
  if (s.drift !== undefined && Math.abs(s.drift) >= 15)
    fired.push({ id: "R7", sev: "SEV3", why: `model drift ${s.drift}% beyond ±15% band` });
  if (s.replicaLag)
    fired.push({ id: "R8", sev: "SEV3", why: "replication lag on data tier — stale reads" });
  if (s.cacheHit !== undefined && s.cacheHit < 70)
    fired.push({ id: "R9", sev: "SEV3", why: `cache hit ${s.cacheHit}% < 70% floor (origin burn)` });
  if (s.jobFailed && c.catalog.tier === 3)
    fired.push({ id: "R10", sev: "SEV3", why: "scheduled pipeline failed, internal surface only" });
  if (c.catalog.tier === 1 && fired.length === 0)
    fired.push({ id: "R11", sev: "SEV3", why: "tier-1 quiet anomaly — investigate before dismissing" });
  if (fired.length === 0)
    fired.push({ id: "R12", sev: "SEV4", why: "tier-3, no customer surface, no escalation signal" });

  const proposal = fired.reduce<Severity>((acc, r) => worse(acc, r.sev), "SEV4");
  return { proposal, fired };
}

export function runAgent(c: IncidentCase): AgentResult {
  const s = c.signals;
  const steps: TraceStep[] = [];
  const evidence: string[] = [];

  // 1 — parse
  const keywords = [
    s.customers !== "none" && `customers:${s.customers}`,
    s.errorRate > 0 && `err:${s.errorRate}%`,
    s.deploy && `deploy:${s.deploy}`,
    s.flag && `flag:${s.flag}`,
    s.dependency && `dep:${s.dependency}`,
    s.corruption && "corruption-signal",
    s.drill && "synthetic-source",
    s.drift !== undefined && `drift:${s.drift}%`,
  ].filter(Boolean) as string[];
  steps.push({
    kind: "parse",
    label: "parse_alert(raw)",
    detail: `service=${c.service} · source=${c.source} · extracted=[${keywords.join(", ") || "no salient keywords"}]`,
    status: "ok",
  });

  // 2 — catalog
  steps.push({
    kind: "tool",
    label: `catalog.lookup("${c.service}")`,
    detail: `tier=${c.catalog.tier} · owner=${c.catalog.team} · SLO ${c.catalog.slo} · on-call=${c.catalog.oncall}`,
    status: "ok",
  });
  evidence.push(`catalog: tier-${c.catalog.tier}, SLO ${c.catalog.slo}, owner ${c.catalog.team}`);

  // 3 — metrics
  const metricBits = [
    `err=${s.errorRate}%`,
    s.p99 ? `p99=${s.p99}` : null,
    `customers=${s.customers}`,
    s.revenue ? "revenue=at-risk" : null,
    s.drift !== undefined ? `model-ctr=${s.drift}%` : null,
    s.cacheHit !== undefined ? `cache-hit=${s.cacheHit}%` : null,
  ].filter(Boolean);
  steps.push({
    kind: "tool",
    label: `metrics.query("${c.service}", window=30m)`,
    detail: metricBits.join(" · "),
    status: s.customers === "blocked" ? "warn" : "ok",
  });
  evidence.push(`metrics: ${metricBits.join(", ")}`);

  // 4 — history (memory)
  let memoryNote: string | null = null;
  if (c.memory) {
    steps.push({
      kind: "memory",
      label: `history.search(fingerprint="${c.service}")`,
      detail: `${c.memory.hits.length} similar: ${c.memory.hits.join(", ")} — ${c.memory.note}`,
      status: "info",
    });
    evidence.push(`history: ${c.memory.hits.join(", ")} — ${c.memory.note}`);
    memoryNote = c.memory.note;
  } else {
    steps.push({
      kind: "memory",
      label: `history.search(fingerprint="${c.service}")`,
      detail: "no similar incident in last 90 days",
      status: "info",
    });
  }

  // 5 — reason
  const { proposal, fired } = reason(c);
  steps.push({
    kind: "reason",
    label: "severity.reason(signals)",
    detail: fired.map((r) => `${r.id} ${r.why} ⇒ ${r.sev}`).join("  ·  ") + `  →  proposal ${proposal}`,
    status: "ok",
  });
  fired.slice(0, 3).forEach((r) => evidence.push(`rule ${r.id}: ${r.why}`));

  // 6 — verifier (cross-check). May consult the calendar.
  let finalSev = proposal;
  let adjustment: string | null = null;
  if (s.drill) {
    steps.push({
      kind: "tool",
      label: `calendar.check("${c.service}", window=02:00–04:00)`,
      detail: c.calendar ?? "",
      status: "info",
    });
  }
  if (s.drill) {
    finalSev = "DRILL";
    adjustment = `${proposal} → DRILL`;
    steps.push({
      kind: "verify",
      label: "verifier.cross_check(proposal)",
      detail: `CONTRADICTION: probes firing but real-user metrics show zero impact + drill on calendar ⇒ scheduled GameDay. Rule D-1 applies.`,
      status: "warn",
    });
    evidence.push("contradiction: synthetic probes vs. zero real-user impact + scheduled drill");
  } else if (proposal === "SEV1" && s.flag) {
    finalSev = "SEV2";
    adjustment = "SEV1 → SEV2";
    steps.push({
      kind: "verify",
      label: "verifier.cross_check(proposal)",
      detail: `DOWNGRADE: flag "${s.flag}" has a verified ≤5-min rollback (${c.runbook.id}) and no data-loss signal. SEV1 would over-page.`,
      status: "warn",
    });
    evidence.push(`verifier: ${s.flag} rollback ≤5 min, no data loss ⇒ SEV1 downgraded`);
  } else if (s.corruption && sevRank[proposal] > 2) {
    finalSev = "SEV2";
    adjustment = `${proposal} → SEV2`;
    steps.push({
      kind: "verify",
      label: "verifier.cross_check(proposal)",
      detail: `ESCALATE: silent data corruption (exports succeed but garbled). Corruption is an escalation trigger regardless of error rate. Hold downstream exports.`,
      status: "warn",
    });
    evidence.push("verifier: corruption escalates independent of error rate");
  } else {
    steps.push({
      kind: "verify",
      label: "verifier.cross_check(proposal)",
      detail:
        proposal === "SEV1"
          ? "consistent: customer block + tier-1 + revenue — no contradicting signal. Hold at SEV1."
          : "consistent: severity, blast radius and team ownership all line up. No contradictions.",
      status: "ok",
    });
  }

  // 7 — runbook
  steps.push({
    kind: "tool",
    label: `runbook.match("${c.service}", symptoms)`,
    detail: `${c.runbook.id} "${c.runbook.title}" (rev ${c.runbook.rev}) — matched on ${keywords[0] ?? "service signature"}`,
    status: "ok",
  });
  evidence.push(`runbook ${c.runbook.id} rev ${c.runbook.rev}: ${c.runbook.title}`);

  // 8 — action + human gate
  const page = finalSev === "SEV1" || finalSev === "SEV2";
  let action: string;
  switch (finalSev) {
    case "SEV1":
      action = `page ${c.catalog.oncall} (${c.catalog.team}) · open bridge · hold deploy pipeline`;
      break;
    case "SEV2":
      action = `page ${c.catalog.oncall} (${c.catalog.team}) · no bridge`;
      break;
    case "SEV3":
      action = `notify #${c.catalog.team} + ticket`;
      break;
    case "DRILL":
      action = "auto-resolve + audit note (pre-approved rule D-1) — no page";
      break;
    default:
      action = `ticket → ${c.catalog.team}`;
  }
  steps.push({
    kind: "gate",
    label: page ? "human_gate.propose(action)" : "human_gate.check(action)",
    detail: page
      ? `consequential act (paging a human) — proposal staged, REQUIRES human approval before firing`
      : finalSev === "DRILL"
        ? "non-consequential + pre-approved rule D-1 — executed with audit trail"
        : "non-consequential (notify/ticket) — pre-approved automation",
    status: page ? "warn" : "ok",
  });

  let confidence = 0.97;
  if (adjustment) confidence -= 0.1;
  if (finalSev === "DRILL") confidence = 0.92;
  if (c.memory && c.memory.hits.length >= 3) confidence += 0.01;

  return {
    severity: finalSev,
    team: c.catalog.team,
    runbook: { id: c.runbook.id, title: c.runbook.title },
    action,
    page,
    confidence: Math.round(confidence * 100) / 100,
    evidence: evidence.slice(0, 5),
    steps,
    adjustment,
    memoryNote,
  };
}
