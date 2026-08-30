/**
 * Pagermind evaluation set — 12 synthetic incidents.
 * All data is synthetic and deterministic. Gold answers were fixed
 * BEFORE the agent rules were written (see CHANGELOG in the site).
 */

export type Severity = "SEV1" | "SEV2" | "SEV3" | "SEV4" | "DRILL";

export interface IncidentCase {
  id: string;
  service: string;
  source: string;
  time: string;
  title: string;
  alertText: string[];
  signals: {
    errorRate: number; // %
    p99?: string;
    customers: "none" | "degraded" | "blocked";
    revenue: boolean;
    deploy?: string;
    flag?: string;
    dependency?: string;
    corruption?: boolean;
    drill?: boolean;
    jobFailed?: boolean;
    replicaLag?: boolean;
    cacheHit?: number;
    drift?: number; // % vs baseline
  };
  catalog: { tier: 1 | 2 | 3; team: string; slo: string; oncall: string };
  runbook: { id: string; title: string; rev: number };
  memory?: { hits: string[]; note: string };
  calendar?: string;
  gold: {
    severity: Severity;
    team: string;
    action: string;
    trap?: "inflate" | "under" | "wrong-team" | "false-page" | "silent";
    trapNote: string;
  };
}

export const CASES: IncidentCase[] = [
  {
    id: "INC-2201",
    service: "checkout-api",
    source: "datadog",
    time: "03:12 UTC",
    title: "5xx spike after deploy #4821",
    alertText: [
      "[datadog] checkout-api: HTTP 5xx rate 12.4% (threshold 2%)",
      "[deploy] release #4821 rolled out 03:04 UTC (8 min before onset)",
      "[synthetics] checkout funnel failing from 3 regions — customers blocked",
    ],
    signals: { errorRate: 12.4, p99: "2.6s", customers: "blocked", revenue: true, deploy: "#4821" },
    catalog: { tier: 1, team: "team-checkout", slo: "99.95%", oncall: "R. Okafor" },
    runbook: { id: "RB-114", title: "Roll back checkout deploy", rev: 12 },
    memory: { hits: ["INC-2144"], note: "INC-2144 (5 wks ago): same signature, rollback fixed in 6 min" },
    gold: {
      severity: "SEV1",
      team: "team-checkout",
      action: "Page on-call + open bridge + hold deploy pipeline",
      trapNote: "Clean case — even the baseline keywords land here. Sets the floor.",
    },
  },
  {
    id: "INC-2202",
    service: "nightly-etl",
    source: "airflow",
    time: "04:47 UTC",
    title: "Nightly ETL job exited CRITICAL",
    alertText: [
      "[airflow] dag nightly-etl / task extract_orders: status CRITICAL, exit code 3",
      "[airflow] retries exhausted (3/3). Next scheduled run 04:00 UTC tomorrow.",
      "[impact] internal dashboards will be ~24h stale. No customer surface.",
    ],
    signals: { errorRate: 0, customers: "none", revenue: false, jobFailed: true },
    catalog: { tier: 3, team: "team-data-platform", slo: "best-effort", oncall: "M. Duarte" },
    runbook: { id: "RB-231", title: "Re-run ETL with backfill window", rev: 4 },
    gold: {
      severity: "SEV3",
      team: "team-data-platform",
      action: "Ticket + re-run in morning window — no page",
      trap: "inflate",
      trapNote: "The word CRITICAL is in the log line. Keyword matching pages a human at 04:47 for a batch job with no customer surface.",
    },
  },
  {
    id: "INC-2203",
    service: "payments-sandbox",
    source: "sentry",
    time: "11:05 UTC",
    title: "Webhook failures in payments sandbox",
    alertText: [
      "[sentry] payments-sandbox: webhook delivery failure rate 41%",
      "[env] environment=sandbox (test keys only, no live merchants)",
      "[note] sandbox gateway cert expired — known maintenance item.",
    ],
    signals: { errorRate: 41, customers: "none", revenue: false },
    catalog: { tier: 3, team: "team-payments-infra", slo: "best-effort", oncall: "S. Lindqvist" },
    runbook: { id: "RB-078", title: "Rotate sandbox gateway certs", rev: 7 },
    gold: {
      severity: "SEV4",
      team: "team-payments-infra",
      action: "Ticket only — sandbox, no production customers",
      trap: "inflate",
      trapNote: "'payments' + 'failure' is the scariest string in the building — and here it means nothing. Baseline pages the payments on-call for a sandbox cert.",
    },
  },
  {
    id: "INC-2204",
    service: "auth-gateway",
    source: "pagerduty",
    time: "09:31 UTC",
    title: "Token refresh storm, keycloak degraded",
    alertText: [
      "[pagerduty] auth-gateway: token refresh storm 8.1k req/s (baseline 900)",
      "[upstream] keycloak p99 4.2s — dependency degraded since 09:22 UTC",
      "[impact] ~9% of logins failing; customers degraded, not blocked",
    ],
    signals: { errorRate: 3.2, p99: "4.2s", customers: "degraded", revenue: false, dependency: "keycloak" },
    catalog: { tier: 1, team: "team-platform-identity", slo: "99.9%", oncall: "A. Petrov" },
    runbook: { id: "RB-152", title: "Keycloak degradation — shed refresh traffic", rev: 9 },
    memory: { hits: ["INC-2187"], note: "INC-2187 (3 wks ago): same keycloak storm, shed rule fixed in 11 min" },
    gold: {
      severity: "SEV2",
      team: "team-platform-identity",
      action: "Page on-call (platform-identity), apply shed rule",
      trap: "wrong-team",
      trapNote: "The alert says 'auth', so substring routing sends it to team-auth. The actual owner — and the keycloak runbook — sit with platform-identity.",
    },
  },
  {
    id: "INC-2205",
    service: "analytics-db",
    source: "datadog",
    time: "13:58 UTC",
    title: "Replica lag 90s on read replica",
    alertText: [
      "[datadog] analytics-db replica-2: replication lag 90s and climbing",
      "[impact] internal BI dashboards stale. No customer-facing queries.",
      "[context] large backfill job running on primary since 13:10 UTC",
    ],
    signals: { errorRate: 0, customers: "none", revenue: false, replicaLag: true },
    catalog: { tier: 2, team: "team-data-infra", slo: "99.5%", oncall: "K. Yamada" },
    runbook: { id: "RB-190", title: "Throttle backfill during replica lag", rev: 3 },
    gold: {
      severity: "SEV3",
      team: "team-data-infra",
      action: "Notify + throttle backfill — ticket, no page",
      trap: "wrong-team",
      trapNote: "'db' routes to team-dba in the baseline table. The replica fleet is owned by data-infra; team-dba gets paged for a system they can't touch.",
    },
  },
  {
    id: "INC-2206",
    service: "cart-service",
    source: "kubernetes",
    time: "16:20 UTC",
    title: "OOM crash-loop after flag cart_v2 flip",
    alertText: [
      "[k8s] cart-service: OOMKilled crash-loop on 14/20 pods",
      "[flags] feature flag cart_v2 enabled 16:11 UTC (9 min before onset)",
      "[impact] add-to-cart failing for ~8% of sessions — degraded, not down",
    ],
    signals: { errorRate: 8.0, customers: "degraded", revenue: true, flag: "cart_v2" },
    catalog: { tier: 1, team: "team-cart", slo: "99.9%", oncall: "J. Moreau" },
    runbook: { id: "RB-207", title: "Flip cart_v2 off — verified 4-min recovery", rev: 6 },
    memory: { hits: ["INC-2163"], note: "INC-2163 (3 wks ago): identical flag, flip-off recovered in 4 min" },
    gold: {
      severity: "SEV2",
      team: "team-cart",
      action: "Page on-call + pre-stage flag flip (human approves)",
      trap: "inflate",
      trapNote: "'crash-loop' screams SEV1. But the runbook shows a 4-minute flag-off fix and no data loss — the verifier downgrades SEV1 → SEV2.",
    },
  },
  {
    id: "INC-2207",
    service: "cdn-edge",
    source: "grafana",
    time: "07:42 UTC",
    title: "Cache hit rate dropped to 61%",
    alertText: [
      "[grafana] cdn-edge: cache hit ratio 61% (30-day baseline 94%)",
      "[impact] origin load +2.3x. No user-visible errors yet.",
      "[context] new cache-key schema shipped yesterday evening.",
    ],
    signals: { errorRate: 0, cacheHit: 61, customers: "none", revenue: false },
    catalog: { tier: 2, team: "team-edge-platform", slo: "99.9%", oncall: "L. Ferreira" },
    runbook: { id: "RB-166", title: "Purge + re-warm after cache-key change", rev: 5 },
    gold: {
      severity: "SEV3",
      team: "team-edge-platform",
      action: "Notify edge on-call + re-warm playbook",
      trap: "silent",
      trapNote: "No scary words at all — no 'error', no 'down'. Keyword baseline files it as SEV4 noise while origin burn quietly doubles.",
    },
  },
  {
    id: "INC-2208",
    service: "orders-export",
    source: "sentry",
    time: "02:26 UTC",
    title: "CSV exports garbled for 3 merchants",
    alertText: [
      "[sentry] orders-export: 3 merchants report garbled CSV columns since 02:00",
      "[check] error rate 0.4% — exports 'succeed' with corrupted encoding",
      "[risk] merchants reconcile billing from these files tonight",
    ],
    signals: { errorRate: 0.4, customers: "degraded", revenue: false, corruption: true },
    catalog: { tier: 2, team: "team-orders-data", slo: "99.5%", oncall: "T. Nguyen" },
    runbook: { id: "RB-242", title: "Hold exports + replay with pinned codec", rev: 2 },
    gold: {
      severity: "SEV2",
      team: "team-orders-data",
      action: "Page on-call + HOLD downstream exports (corruption protocol)",
      trap: "under",
      trapNote: "Error rate is 0.4% and there's no 'failure' string — pure metrics would shrug. Data corruption is an escalation trigger on its own.",
    },
  },
  {
    id: "INC-2209",
    service: "eu-west-failover",
    source: "synthetics",
    time: "02:05 UTC",
    title: "Region failover probes firing",
    alertText: [
      "[synthetics] eu-west: failover probes FIRING — primary unreachable",
      "[probes] source=synthetic mesh (internal), 100% packet loss reported",
      "[note] real-user traffic metrics show NO impact in eu-west",
    ],
    signals: { errorRate: 0, customers: "none", revenue: false, drill: true },
    catalog: { tier: 1, team: "team-sre-core", slo: "99.99%", oncall: "D. Castellanos" },
    runbook: { id: "RB-301", title: "GameDay drill — synthetic probe handling", rev: 11 },
    calendar: "GameDay 2026-Q1 failover drill scheduled 02:00–04:00 UTC (owner: sre-core)",
    gold: {
      severity: "DRILL",
      team: "team-sre-core",
      action: "Auto-resolve + audit note under pre-approved rule D-1 — NO page",
      trap: "false-page",
      trapNote: "The hard case. 'failover' + 'unreachable' pages six people under the baseline. The calendar tool plus the real-user-metric contradiction proves it's the scheduled GameDay drill.",
    },
  },
  {
    id: "INC-2210",
    service: "reco-ranking",
    source: "ml-monitor",
    time: "18:14 UTC",
    title: "Model CTR drift −18% vs baseline",
    alertText: [
      "[ml-monitor] reco-ranking: click-through drift −18% vs 14-day baseline",
      "[ml-monitor] no application errors logged; serving latency nominal",
      "[impact] homepage relevance degraded for ~all users, silently",
    ],
    signals: { errorRate: 0, drift: -18, customers: "degraded", revenue: false },
    catalog: { tier: 2, team: "team-ml-platform", slo: "99.5%", oncall: "P. Adeyemi" },
    runbook: { id: "RB-330", title: "Model rollback + feature drift triage", rev: 8 },
    gold: {
      severity: "SEV3",
      team: "team-ml-platform",
      action: "Notify ML on-call + open drift investigation",
      trap: "silent",
      trapNote: "Zero error strings, everything 'green' on dashboards. Keyword triage returns SEV4-ignore; the drift signal is only visible if the agent queries model metrics.",
    },
  },
  {
    id: "INC-2211",
    service: "log-aggregator",
    source: "prometheus",
    time: "05:33 UTC",
    title: "Disk 92% on logs-3",
    alertText: [
      "[prometheus] log-aggregator node logs-3: disk usage 92%",
      "[impact] none yet — aggregator can shed load if disk fills",
      "[trend] +6%/day since Monday",
    ],
    signals: { errorRate: 0, customers: "none", revenue: false },
    catalog: { tier: 3, team: "team-logging", slo: "best-effort", oncall: "H. Bergström" },
    runbook: { id: "RB-119", title: "Rotate + compress aggregator volumes", rev: 15 },
    memory: {
      hits: ["INC-2196", "INC-2189", "INC-2178"],
      note: "3 recurrences on logs-3 in 7 days — rotation is a band-aid; needs capacity ticket",
    },
    gold: {
      severity: "SEV4",
      team: "team-logging",
      action: "Ticket + capacity-planning item (recurrence detected)",
      trapNote: "Baseline scores the ticket correctly — and learns nothing. The agent's memory turns the 4th recurrence into a capacity decision.",
    },
  },
  {
    id: "INC-2212",
    service: "search-index",
    source: "datadog",
    time: "10:49 UTC",
    title: "Index rebuild over SLO, p99 degraded",
    alertText: [
      "[datadog] search-index: rebuild at 40 min (SLO 25); query p99 1.9s vs SLO 1.2s",
      "[impact] search results degraded for end users, no failures",
      "[context] corpus grew 22% after catalog import last night",
    ],
    signals: { errorRate: 0.2, p99: "1.9s", customers: "degraded", revenue: false },
    catalog: { tier: 2, team: "team-search-infra", slo: "99.5%", oncall: "V. Iyer" },
    runbook: { id: "RB-287", title: "Incremental rebuild + shard rebalance", rev: 6 },
    gold: {
      severity: "SEV3",
      team: "team-search-infra",
      action: "Notify + incremental rebuild playbook",
      trapNote: "Baseline gets lucky: 'degraded' is in the text. Correct-by-keyword is not the same as correct-by-evidence — the team routing is still wrong.",
    },
  },
];

export const sevRank: Record<Severity, number> = {
  SEV1: 1,
  SEV2: 2,
  SEV3: 3,
  SEV4: 4,
  DRILL: 5,
};

export const sevColor: Record<Severity, string> = {
  SEV1: "#ff5d5d",
  SEV2: "#ffb224",
  SEV3: "#e9d75b",
  SEV4: "#5ab8ff",
  DRILL: "#31d48e",
};
