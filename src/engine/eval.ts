import { CASES, sevRank, type IncidentCase, type Severity } from "../data/incidents";
import { runBaseline, type BaselineResult } from "./baseline";
import { runAgent, type AgentResult } from "./agent";

/**
 * Shared rubric, applied identically to baseline and agent.
 * severity 40 (half credit one level off) · team 20 · runbook 15
 * evidence 15 · trap handling 10 (only on cases that contain a trap).
 */

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
  const g = sevRank[gold];
  const r = sevRank[got];
  if (g <= 4 && r <= 4 && Math.abs(g - r) === 1) return WEIGHTS.severity / 2;
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
  // Trap points are earned only on trap cases (symmetric for both arms);
  // non-trap cases are scored out of 90 so the denominator stays honest.
  const trap =
    c.gold.trap && got.severity === c.gold.severity && got.team === c.gold.team ? WEIGHTS.trap : 0;
  const max = 90 + (c.gold.trap ? WEIGHTS.trap : 0);
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
  baselineSevCorrect: number;
  agentSevCorrect: number;
}

export function aggregate(cases: CaseEval[]): Aggregate {
  const n = cases.length;
  const avg = (f: (e: CaseEval) => number) => Math.round(cases.reduce((s, e) => s + f(e), 0) / n);
  const count = (f: (e: CaseEval) => boolean) => cases.filter(f).length;
  const missed = (sev: Severity, gold: Severity) => {
    const g = sevRank[gold];
    const r = sevRank[sev];
    return g <= 2 && r >= g + 2; // gold is SEV1/2 but arm answered 2+ levels quieter
  };
  return {
    baselinePct: avg((e) => e.baseline.scores.pct),
    agentPct: avg((e) => e.agent.scores.pct),
    baselineFalsePages: count((e) => e.baseline.result.severity === "SEV1" && e.c.gold.severity !== "SEV1"),
    agentFalsePages: count((e) => e.agent.result.severity === "SEV1" && e.c.gold.severity !== "SEV1"),
    baselineWrongTeam: count((e) => e.baseline.result.team !== e.c.gold.team),
    agentWrongTeam: count((e) => e.agent.result.team !== e.c.gold.team),
    baselineMissed: count((e) => missed(e.baseline.result.severity, e.c.gold.severity)),
    agentMissed: count((e) => missed(e.agent.result.severity, e.c.gold.severity)),
    baselineSevCorrect: count((e) => e.baseline.result.severity === e.c.gold.severity),
    agentSevCorrect: count((e) => e.agent.result.severity === e.c.gold.severity),
  };
}
