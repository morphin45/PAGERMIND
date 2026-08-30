import type { IncidentCase, Severity } from "../data/incidents";

/**
 * BASELINE — "the script people use today".
 * One direct pass: regex keyword matching on the raw alert text plus a
 * substring team table. No tools, no memory, no verification, no evidence.
 * Deliberately the kind of 40-line triage bot every org has written once.
 */

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

const TEAM_TABLE: Array<[RegExp, string]> = [
  [/checkout/, "team-checkout"],
  [/payment|pay/, "team-payments"],
  [/auth/, "team-auth"],
  [/etl|airflow/, "team-data-etl"],
  [/-db|postgres/, "team-dba"],
  [/cart/, "team-cart"],
  [/cdn/, "team-cdn-ops"],
  [/order/, "team-orders"],
  [/failover|eu-/, "team-sre"],
  [/reco/, "team-recsys"],
  [/log/, "team-logging"],
  [/search/, "team-search"],
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
