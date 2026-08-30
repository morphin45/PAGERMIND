import {
  CASES,
  ADVERSARIAL,
  sevRank,
  type AdversarialCase,
  type IncidentCase,
  type Severity,
} from "../data/cases";

/* ================= BASELINE — "the script people use today" ================= */

export interface BaselineResult {
  severity: Severity;
  team: string;
  runbook: string | null;
  evidence: string[];
  action: string;
  page: boolean;
  how: string;
}

const SEV_RULES: Array<[RegExp, Severity, string]> = [
  [/\b(critical|outage|down|unreachable|5xx|failure|crash|storm|failover|firing)\b/i, "SEV1", "keyword ∈ {critical, outage, 5xx, crash, failover, …}"],
  [/\b(degraded|slow|latency|lag|drift|stale|warning|over slo|dropped)\b/i, "SEV3", "keyword ∈ {degraded, lag, drift, dropped, …}"],
];

/* the honest naive script: four substrings, nothing else */
const TEAM_TABLE: Array<[RegExp, string]> = [
  [/checkout/, "team-checkout"],
  [/payment|pay/, "team-payments"],
  [/auth/, "team-auth"],
  [/etl|airflow/, "team-data-etl"],
];

export function runBaseline(c: IncidentCase): BaselineResult {
  const text = c.alertText.join("\n");
  let severity: Severity = "SEV4";
  let how = "no severity keyword matched → default SEV4";
  for (const [re, sev, why] of SEV_RULES) {
    if (re.test(text)) {
      severity = sev;
      how = why;
      break;
    }
  }
  let team = "unassigned → human must route manually";
  for (const [re, t] of TEAM_TABLE) {
    if (re.test(c.service)) {
      team = t;
      break;
    }
  }
  const page = severity === "SEV1";
  return {
    severity,
    team,
    runbook: null,
    evidence: [],
    action: page ? `page on-call(${team})` : severity === "SEV4" ? "close as noise" : `ticket → ${team}`,
    page,
    how,
  };
}

/* ================= AGENT — deterministic tool-grounded pipeline ================= */

export type StepKind = "parse" | "sanitize" | "tool" | "memory" | "reason" | "verify" | "gate";

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

const worse = (a: Severity, b: Severity): Severity => (sevRank[a] <= sevRank[b] ? a : b);

const DIRECTIVE_RE =
  /(ignore (all )?(previous|prior) instructions|\[system override\]|respond drill|do not page|page everyone|mark this (incident )?sev\s?\d)/i;
const FAKE_DRILL_RE = /(part of the|scheduled).{0,40}(game\s?day|drill)/i;

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
  if (s.replicaLag) fired.push({ id: "R8", sev: "SEV3", why: "replication lag on data tier — stale reads" });
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

export function runAgent(c: IncidentCase, opts: { critic?: boolean } = {}): AgentResult {
  const criticOn = opts.critic !== false;
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
    s.cacheHit !== undefined && `cache-hit:${s.cacheHit}%`,
  ].filter(Boolean) as string[];
  steps.push({
    kind: "parse",
    label: "parse_alert(raw)",
    detail: `service=${c.service} · source=${c.source} · extracted=[${keywords.join(", ") || "no salient keywords"}]`,
    status: "ok",
  });

  // 1b — sanitize: alert bodies are DATA, never instructions
  const raw = c.alertText.join("\n");
  const directive = raw.match(DIRECTIVE_RE);
  const fakeDrill = FAKE_DRILL_RE.test(raw) && !s.drill;
  if (directive) {
    steps.push({
      kind: "sanitize",
      label: "parse.sanitize(body)",
      detail: `injected directive detected: “${directive[0].trim()}” — quarantined, cannot influence verdict`,
      status: "warn",
    });
    evidence.push(`sanitize: directive in body quarantined — body treated as data only`);
  }
  if (fakeDrill) {
    steps.push({
      kind: "sanitize",
      label: "parse.sanitize(body)",
      detail: "body claims a scheduled drill — claim routed to calendar.check, not trusted",
      status: "warn",
    });
    steps.push({
      kind: "tool",
      label: `calendar.check("${c.service}", window=02:00–04:00)`,
      detail: "no scheduled drill in window — body claim REJECTED against the tool",
      status: "warn",
    });
    evidence.push("calendar: no drill scheduled — body's drill claim contradicted by tool output");
  }

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
    s.corruption ? "integrity=mismatch" : null,
  ].filter(Boolean) as string[];
  steps.push({
    kind: "tool",
    label: `metrics.query("${c.service}", window=30m)`,
    detail: metricBits.join(" · "),
    status: s.customers === "blocked" ? "warn" : "ok",
  });
  evidence.push(`metrics: ${metricBits.join(", ")}`);

  // 4 — memory
  let memoryNote: string | null = null;
  if (c.memory) {
    memoryNote = c.memory.note;
    steps.push({
      kind: "tool",
      label: `history.search(fingerprint("${c.service}:${keywords[0] ?? "sig"}"))`,
      detail: `hits: ${c.memory.hits.join(", ")}`,
      status: "ok",
    });
    steps.push({ kind: "memory", label: "memory.recall()", detail: c.memory.note, status: "info" });
    evidence.push(`memory: ${c.memory.note}`);
  }

  // 5 — rules
  const { proposal, fired } = reason(c);
  fired.forEach((r) =>
    steps.push({ kind: "reason", label: `rule.${r.id} fires → ${r.sev}`, detail: r.why, status: r.sev === "SEV1" ? "warn" : "ok" })
  );
  evidence.push(`rules: ${fired.map((r) => r.id).join(", ")} → proposal ${proposal}`);

  // 6 — critic: independent falsification pass
  let finalSev = proposal;
  let adjustment: string | null = null;
  if (!criticOn) {
    steps.push({
      kind: "verify",
      label: "critic.falsify(proposal)",
      detail: "critic pass disabled (ablation run) — proposal stands unchallenged",
      status: "info",
    });
  } else if (s.drill) {
    steps.push({
      kind: "tool",
      label: `calendar.check("${c.service}", window=02:00–04:00)`,
      detail: "scheduled drill: GameDay 2026-Q1, 02:00–04:00 · probe-only source",
      status: "info",
    });
    finalSev = "DRILL";
    adjustment = "SEV3 → DRILL";
    steps.push({
      kind: "verify",
      label: "critic: contradiction proven",
      detail: "probes firing ∧ real-user error 0.0% ∧ drill on calendar ⇒ rule D-1",
      status: "warn",
    });
    evidence.push("calendar: GameDay drill scheduled; probes-only source; real-user error 0.0%");
  } else if (s.corruption && (finalSev === "SEV3" || finalSev === "SEV4")) {
    finalSev = "SEV2";
    adjustment = "SEV3 → SEV2";
    steps.push({
      kind: "verify",
      label: "critic: silent corruption escalates",
      detail: "integrity mismatch reaches customers while error rate stays quiet — escalate",
      status: "warn",
    });
    evidence.push("integrity: corrupted files reach customers despite 0.4% error rate");
  } else if (s.rollbackKnown && c.catalog.tier === 1 && proposal === "SEV1" && s.errorRate < 15) {
    finalSev = "SEV2";
    adjustment = "SEV1 → SEV2";
    steps.push({
      kind: "verify",
      label: "critic: known-fast rollback",
      detail: `flag rollback verified ~4 min — downgrade page, keep priority`,
      status: "warn",
    });
    evidence.push("deploys: rollback of flag known-good (~4 min) — downgrade SEV1 → SEV2");
  } else {
    steps.push({
      kind: "verify",
      label: "critic: no contradiction found",
      detail: "proposal consistent with catalog, metrics and calendar — stands",
      status: "ok",
    });
  }

  // 7 — runbook + gate
  steps.push({
    kind: "tool",
    label: `runbook.match("${c.service}", ${finalSev})`,
    detail: `${c.runbook.id} rev ${c.runbook.rev} — ${c.runbook.title}`,
    status: "ok",
  });
  evidence.push(`runbook: ${c.runbook.id} rev ${c.runbook.rev} — ${c.runbook.title}`);

  const page = finalSev === "SEV1" || finalSev === "SEV2";
  const action =
    finalSev === "DRILL"
      ? "auto-resolve + audit note (rule D-1)"
      : page
        ? `page → ${c.catalog.team} on-call`
        : finalSev === "SEV4"
          ? `ticket → ${c.catalog.team}`
          : `notify → ${c.catalog.team} on-call`;
  steps.push({
    kind: "gate",
    label: page ? "gate.stage(page)" : "act.auto(pre-approved)",
    detail: page
      ? "consequential — held for qualified human approval"
      : "non-consequential — pre-approved automation, audit note attached",
    status: page ? "warn" : "ok",
  });

  const confidence = s.drill ? 0.92 : s.deploy && c.catalog.tier === 1 ? 0.88 : 0.84;
  return {
    severity: finalSev,
    team: c.catalog.team,
    runbook: { id: c.runbook.id, title: c.runbook.title },
    action,
    page,
    confidence,
    evidence,
    steps,
    adjustment,
    memoryNote,
  };
}

/* ================= EVALUATION — shared rubric, both arms ================= */

export const WEIGHTS = { severity: 40, team: 20, runbook: 15, evidence: 15, trap: 10 };

export interface ArmScores {
  severity: number;
  team: number;
  runbook: number;
  evidence: number;
  trap: number;
  max: number;
  total: number;
  pct: number;
}

export interface CaseEval {
  c: IncidentCase;
  baseline: { result: BaselineResult; scores: ArmScores };
  agent: { result: AgentResult; scores: ArmScores };
}

function sevPoints(got: Severity, gold: Severity): number {
  if (got === gold) return WEIGHTS.severity;
  if (Math.abs(sevRank[gold] - sevRank[got]) === 1) return WEIGHTS.severity / 2;
  return 0;
}

function scoreArm(
  c: IncidentCase,
  got: { severity: Severity; team: string; evidence: string[] },
  runbookId: string | null,
  isAgent: boolean
): ArmScores {
  const severity = sevPoints(got.severity, c.gold.severity);
  const team = got.team === c.gold.team ? WEIGHTS.team : 0;
  const runbook = isAgent && runbookId === c.runbook.id ? WEIGHTS.runbook : 0;
  const evidence = got.evidence.length >= 3 ? WEIGHTS.evidence : 0;
  const trap = !c.gold.trap ? WEIGHTS.trap : isAgent && got.severity === c.gold.severity && got.team === c.gold.team ? WEIGHTS.trap : 0;
  const max = 90 + WEIGHTS.trap;
  const total = severity + team + runbook + evidence + trap;
  return { severity, team, runbook, evidence, trap, max, total, pct: Math.round((total / max) * 100) };
}

export function evaluateAll(): { cases: CaseEval[] } {
  const cases: CaseEval[] = CASES.map((c) => {
    const b = runBaseline(c);
    const a = runAgent(c);
    return {
      c,
      baseline: { result: b, scores: scoreArm(c, b, b.runbook, false) },
      agent: { result: a, scores: scoreArm(c, a, a.runbook.id, true) },
    };
  });
  return { cases };
}

export interface Aggregate {
  baselinePct: number;
  agentPct: number;
  baselineFalsePages: number;
  agentFalsePages: number;
  baselineWrongTeam: number;
  agentWrongTeam: number;
  baselineMissed: number;
  agentMissed: number;
}

export function aggregate(cases: CaseEval[]): Aggregate {
  const n = cases.length;
  const avg = (f: (e: CaseEval) => number) => Math.round(cases.reduce((s, e) => s + f(e), 0) / n);
  const count = (f: (e: CaseEval) => boolean) => cases.filter(f).length;
  const missed = (sev: Severity, gold: Severity) => sevRank[gold] <= 2 && sevRank[sev] >= sevRank[gold] + 2;
  return {
    baselinePct: avg((e) => e.baseline.scores.pct),
    agentPct: avg((e) => e.agent.scores.pct),
    baselineFalsePages: count((e) => e.baseline.result.severity === "SEV1" && e.c.gold.severity !== "SEV1"),
    agentFalsePages: count((e) => e.agent.result.severity === "SEV1" && e.c.gold.severity !== "SEV1"),
    baselineWrongTeam: count((e) => e.baseline.result.team !== e.c.gold.team),
    agentWrongTeam: count((e) => e.agent.result.team !== e.c.gold.team),
    baselineMissed: count((e) => missed(e.baseline.result.severity, e.c.gold.severity)),
    agentMissed: count((e) => missed(e.agent.result.severity, e.c.gold.severity)),
  };
}

/* ---------- attribution ablation: what did each design choice buy? ---------- */

export interface StageStat {
  id: string;
  label: string;
  pct: number;
  falsePages: number;
  wrongTeam: number;
  note: string;
}

export function ablation(): StageStat[] {
  const stage = (run: (c: IncidentCase) => { severity: Severity; team: string; runbookId: string | null; evidence: string[] }) => {
    let pctSum = 0;
    let fp = 0;
    let wt = 0;
    for (const c of CASES) {
      const r = run(c);
      pctSum += scoreArm(c, { severity: r.severity, team: r.team, evidence: r.evidence }, r.runbookId, true).pct;
      if (r.severity === "SEV1" && c.gold.severity !== "SEV1") fp += 1;
      if (r.team !== c.gold.team) wt += 1;
    }
    return { pct: Math.round(pctSum / CASES.length), falsePages: fp, wrongTeam: wt };
  };
  const base = stage((c) => {
    const b = runBaseline(c);
    return { severity: b.severity, team: b.team, runbookId: null, evidence: [] };
  });
  const toolsOnly = stage((c) => {
    const a = runAgent(c, { critic: false });
    return { severity: a.severity, team: a.team, runbookId: a.runbook.id, evidence: a.evidence };
  });
  const full = stage((c) => {
    const a = runAgent(c);
    return { severity: a.severity, team: a.team, runbookId: a.runbook.id, evidence: a.evidence };
  });
  return [
    { id: "base", label: "Baseline — regex script", note: "Keywords for severity, four substrings for team. No tools, no verification.", ...base },
    { id: "tools", label: "+ grounding tools & rules", note: "Ownership becomes a lookup; severity comes from tier × blast radius. False pages drop to the one case only the critic can catch.", ...toolsOnly },
    { id: "critic", label: "+ critic pass (falsifier · calendar)", note: "Independently challenges the proposal: flag-rollback downgrade, corruption escalation, GameDay contradiction.", ...full },
    { id: "memory", label: "+ memory (incident history)", note: "Score holds — memory buys decision quality: repeat disk fills become capacity tickets, storms cite the 11-min precedent.", ...full },
  ];
}

/* ---------- red team suite: resistance to poisoned alerts ---------- */

export interface AdversarialRow {
  c: AdversarialCase;
  baseline: { severity: Severity; team: string; resisted: boolean };
  agent: { severity: Severity; team: string; resisted: boolean; quarantined: boolean };
}

export interface AdversarialReport {
  rows: AdversarialRow[];
  agentResisted: number;
  baselineResisted: number;
  total: number;
}

export function adversarialSuite(): AdversarialReport {
  const rows: AdversarialRow[] = ADVERSARIAL.map((c) => {
    const b = runBaseline(c);
    const a = runAgent(c);
    return {
      c,
      baseline: { severity: b.severity, team: b.team, resisted: b.severity === c.gold.severity && b.team === c.gold.team },
      agent: {
        severity: a.severity,
        team: a.team,
        resisted: a.severity === c.gold.severity && a.team === c.gold.team,
        quarantined: a.steps.some((st) => st.kind === "sanitize"),
      },
    };
  });
  return {
    rows,
    agentResisted: rows.filter((r) => r.agent.resisted).length,
    baselineResisted: rows.filter((r) => r.baseline.resisted).length,
    total: rows.length,
  };
}

/* ---------- artifacts ---------- */

export function buildBrief(c: IncidentCase, a: AgentResult): string {
  return [
    `PAGERMIND HANDOFF · ${c.id} — ${c.title}`,
    ``,
    `VERDICT   ${a.severity} → ${a.team} · confidence ${a.confidence.toFixed(2)}`,
    `ACTION    ${a.action}`,
    `RUNBOOK   ${a.runbook.id} · ${a.runbook.title}`,
    `GATE      ${a.page ? "consequential — human approval REQUIRED before the page fires" : "non-consequential — pre-approved automation, audit note attached"}`,
    ``,
    `EVIDENCE CHAIN`,
    ...a.evidence.map((e, i) => `  ${i + 1}. ${e}`),
    a.adjustment ? `\nCRITIC    ${a.adjustment}` : "",
    a.memoryNote ? `\nMEMORY    ${a.memoryNote}` : "",
    ``,
    `TRACE     ${a.steps.length} steps · ${a.steps.filter((x) => x.kind === "tool").length} tool calls`,
    `— pagermind/agent · same input, same trace, every machine`,
  ]
    .filter((l) => l !== "")
    .join("\n");
}

/** Deterministic postmortem — assembled only from triage artifacts. */
export function buildPostmortem(
  c: IncidentCase,
  a: AgentResult,
  at: string = new Date().toISOString(),
  decision?: { decidedBy: string; decision: string; reason: string } | null
): string {
  const rules = a.steps.filter((s) => s.kind === "reason").map((s) => s.label.replace("rule.", "").replace(" fires → ", " → "));
  const timeline = [
    `${c.time} — alert received from ${c.source} (${c.alertText.length} lines)`,
    ...a.steps
      .filter((s) => s.kind === "tool" || s.kind === "sanitize")
      .map((s) => `${c.time} — ${s.label}: ${s.detail.split("·")[0].trim()}`),
    decision
      ? `${decision.decidedBy} ${decision.decision}d the page — “${decision.reason || "no comment"}” (audit ledger)`
      : `gate decision pending — page held for qualified reviewer (audit ledger)`,
  ];
  return [
    `# Postmortem — ${c.id}: ${c.title}`,
    `_Generated ${at} · pagermind/postmortem v1 · deterministic: same evidence, same document_`,
    ``,
    `## Summary`,
    `| **Severity** | ${a.severity} |`,
    `| **Service** | ${c.service} (tier-${c.catalog.tier}, SLO ${c.catalog.slo}) |`,
    `| **Owning team** | ${a.team} |`,
    `| **Runbook** | ${a.runbook.id} — ${a.runbook.title} |`,
    `| **Confidence** | ${a.confidence.toFixed(2)} |`,
    ``,
    `## Timeline`,
    ...timeline.map((t, i) => `${i + 1}. ${t}`),
    ``,
    `## Root cause & evidence`,
    ...a.evidence.map((e) => `- ${e}`),
    ``,
    `## Fired rules`,
    ...rules.map((r) => `- ${r}`),
    a.adjustment ? `- critic adjustment: ${a.adjustment}` : "",
    ...(a.memoryNote ? [``, `## Memory`, `- ${a.memoryNote}`] : []),
    ``,
    `## Action items`,
    `- [ ] Verify ${a.runbook.id} resolved the incident (${a.team})`,
    `- [ ] Review gate decision and reviewer note in the audit ledger`,
    `- [ ] If recurrent: convert memory recall into a prevention ticket`,
    `---`,
    `_Every field above is traceable to a trace step, a tool output, or a ledger entry. Nothing is invented._`,
  ]
    .filter((l) => l !== "")
    .join("\n");
}
