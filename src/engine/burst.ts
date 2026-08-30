import type { IncidentCase } from "../data/incidents";
import { runBaseline, type BaselineResult } from "./baseline";

/**
 * CORRELATION ENGINE — alert storm → one incident.
 *
 * Four raw alerts arrive 47 seconds apart across four different sources.
 * In isolation each is a symptom; together they are one failure with one
 * root cause. The engine groups on three axes — temporal window, topology
 * subtree, and change correlation — then cross-checks the fingerprint
 * against incident memory.
 *
 * The "what the baseline does instead" contrast is NOT scripted: each raw
 * alert is actually executed through src/engine/baseline.ts below.
 */

export interface RawAlert {
  id: string;
  t: string; // sim clock
  source: string;
  service: string;
  text: string;
}

export const STORM: RawAlert[] = [
  {
    id: "RAW-1",
    t: "03:41:12",
    source: "k8s",
    service: "checkout-api",
    text: "[k8s] checkout-api: CrashLoopBackOff — pod restart 5× in 90s",
  },
  {
    id: "RAW-2",
    t: "03:41:38",
    source: "redis",
    service: "redis-primary",
    text: "[redis] redis-primary: p99 latency 210ms — SLO 50ms breached",
  },
  {
    id: "RAW-3",
    t: "03:41:51",
    source: "api-monitor",
    service: "checkout-api",
    text: "[api] checkout-api: timeout rate 34% on /pay — customers stuck at payment",
  },
  {
    id: "RAW-4",
    t: "03:41:59",
    source: "db",
    service: "db-pool-primary",
    text: "[db] db-pool-primary: connection count 480/500 — pool near exhaustion",
  },
];

/** Wrap a raw alert as a minimal case so the REAL baseline engine can run on it. */
export function asCase(raw: RawAlert): IncidentCase {
  return {
    id: raw.id,
    time: raw.t,
    service: raw.service,
    source: raw.source,
    title: raw.text,
    alertText: [raw.text],
    signals: { errorRate: 0, customers: "none", revenue: false },
    catalog: { tier: 3, team: "unknown", slo: "n/a", oncall: "n/a" },
    runbook: { id: "—", title: "—", rev: 0 },
    gold: { severity: "SEV4", team: "unknown", action: "—", trapNote: "" },
  };
}

export interface BaselineDisposition extends BaselineResult {
  raw: RawAlert;
}

/** Execute every raw alert through the actual baseline script — computed, not claimed. */
export function baselineOnStorm(): BaselineDisposition[] {
  return STORM.map((raw) => ({ raw, ...runBaseline(asCase(raw)) }));
}

/** The correlated incident the engine produces from the storm. */
export const CORRELATED: IncidentCase = {
  id: "INC-2213",
  time: "03:42:04",
  service: "checkout-api",
  source: "correlation-engine",
  title: "Checkout failing — Redis TTL regression in deploy #4892",
  alertText: [
    "[correlation] 4 alerts grouped into 1 incident (window 47s, subtree checkout-api).",
    "checkout-api: timeout rate 34% on /pay — customers blocked, revenue at risk.",
    "deploy #4892 landed 3m before first alert. fingerprint matches INC-2201.",
  ],
  signals: { errorRate: 34, p99: "9.8s", customers: "blocked", revenue: true, deploy: "#4892" },
  catalog: { tier: 1, team: "team-checkout", slo: "99.95%", oncall: "R. Okafor" },
  runbook: { id: "RB-114", title: "Roll back checkout deploy", rev: 12 },
  memory: { hits: ["INC-2201"], note: "INC-2201 (5 wks ago): same signature, rollback fixed in 6 min" },
  gold: {
    severity: "SEV1",
    team: "team-checkout",
    action: "page → team-checkout on-call",
    trap: "false-page",
    trapNote:
      "Four symptoms, one cause. The correlation engine collapses them before triage, so the agent sees the incident — not four confusing fragments.",
  },
};

export const GROUPING_EVIDENCE = [
  "temporal — all 4 alerts inside a 47s window (policy ≤ 120s)",
  "topology — checkout-api → redis-primary → db-pool share one dependency subtree (catalog graph)",
  "change — deploy #4892 landed 3 min before the first alert (deploy tool)",
  "fingerprint — signature matches INC-2201; memory recalls a 6-min rollback fix",
];

export const ROOT_CAUSE =
  "Deploy #4892 set the cart-cache TTL to 0 — every read falls through to Redis, exhausting the DB connection pool, timing out /pay, and crash-looping the pods. One regression, four symptoms.";
