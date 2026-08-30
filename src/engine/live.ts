import type { IncidentCase } from "../data/cases";

/**
 * LIVE ADAPTER — the first production-shaped integration (ROADMAP phase 1).
 *
 * Reads the public GitHub Status API: keyless, CORS-enabled, read-only.
 * It proves the adapter seam survives a real external API; the mapping from
 * a live incident to engine input is a pure function, so the same snapshot
 * always produces the same deterministic triage.
 *
 * Trust model: this feed is ADVISORY. Live data never stages a gate and
 * never fires a page — it demonstrates the seam, not consequential action.
 */

export interface LiveComponent {
  id: string;
  name: string;
  status: string;
}

export interface LiveIncident {
  id: string;
  name: string;
  impact: string; // none | minor | major | critical
  status: string;
  created_at: string;
  components: LiveComponent[];
}

export interface LiveSnapshot {
  fetchedAt: string;
  indicator: string; // none | minor | major | critical
  description: string;
  components: LiveComponent[];
  incidents: LiveIncident[];
}

const BASE = "https://status.github.com/api";

export async function fetchLiveSnapshot(): Promise<LiveSnapshot> {
  const ctl = new AbortController();
  const t = window.setTimeout(() => ctl.abort(), 8000);
  try {
    const [statusRes, compRes, incRes] = await Promise.all([
      fetch(`${BASE}/status.json`, { signal: ctl.signal }),
      fetch(`${BASE}/components.json`, { signal: ctl.signal }),
      fetch(`${BASE}/incidents/unresolved.json`, { signal: ctl.signal }),
    ]);
    if (!statusRes.ok || !compRes.ok || !incRes.ok)
      throw new Error(`status API HTTP ${statusRes.status}/${compRes.status}/${incRes.status}`);
    const status = (await statusRes.json()) as { status?: { indicator?: string; description?: string } };
    const comps = (await compRes.json()) as { components?: Array<{ id: string; name: string; status: string }> };
    const incs = (await incRes.json()) as {
      incidents?: Array<{
        id: string;
        name: string;
        impact?: string;
        status?: string;
        created_at: string;
        components?: Array<{ id: string; name: string; status: string }>;
      }>;
    };
    return {
      fetchedAt: new Date().toISOString(),
      indicator: status.status?.indicator ?? "unknown",
      description: status.status?.description ?? "",
      components: (comps.components ?? []).map((c) => ({ id: c.id, name: c.name, status: c.status })),
      incidents: (incs.incidents ?? []).slice(0, 8).map((i) => ({
        id: i.id,
        name: i.name,
        impact: i.impact ?? "none",
        status: i.status ?? "investigating",
        created_at: i.created_at,
        components: (i.components ?? []).map((c) => ({ id: c.id, name: c.name, status: c.status })),
      })),
    };
  } finally {
    window.clearTimeout(t);
  }
}

/* -------- pure mapping: real incident → engine input (deterministic) -------- */

export const IMPACT_SIGNALS: Record<string, { errorRate: number; customers: "none" | "degraded" | "blocked"; revenue: boolean }> = {
  none: { errorRate: 0, customers: "none", revenue: false },
  minor: { errorRate: 2.5, customers: "degraded", revenue: false },
  major: { errorRate: 9.5, customers: "blocked", revenue: true },
  critical: { errorRate: 24, customers: "blocked", revenue: true },
};

export const LIVE_TIER: Record<string, 1 | 2 | 3> = { none: 3, minor: 3, major: 2, critical: 1 };

export const IMPACT_COLOR: Record<string, string> = {
  none: "#5e7694",
  minor: "#e9d75b",
  major: "#ffb224",
  critical: "#ff5d5d",
};

export const COMPONENT_STATUS_COLOR: Record<string, string> = {
  operational: "#31d48e",
  degraded_performance: "#e9d75b",
  partial_outage: "#ffb224",
  major_outage: "#ff5d5d",
};

export function mapToCase(inc: LiveIncident, snapshot: LiveSnapshot): IncidentCase {
  const impact = IMPACT_SIGNALS[inc.impact] ?? IMPACT_SIGNALS.none;
  const tier = LIVE_TIER[inc.impact] ?? 3;
  const compNames = inc.components.map((c) => c.name);
  const degraded = inc.components.filter((c) => c.status !== "operational").map((c) => `${c.name}=${c.status}`);
  const slug =
    (compNames[0] ?? "platform").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 18) ||
    "platform";
  return {
    id: `LIVE-${inc.id.slice(0, 8).toUpperCase()}`,
    time: new Date(inc.created_at).toISOString().slice(11, 19),
    service: `github/${slug}`,
    source: "status.github.com",
    title: inc.name,
    alertText: [
      `[live feed] ${inc.name}`,
      `impact: ${inc.impact} · status: ${inc.status} · opened ${inc.created_at}`,
      `components: ${degraded.length ? degraded.join(", ") : "none degraded"} (of ${compNames.length} attached)`,
      `platform indicator: ${snapshot.indicator} — ${snapshot.description}`,
      `(read-only live signal · mapped deterministically for triage)`,
    ],
    signals: { ...impact },
    catalog: {
      tier,
      team: `team-${slug}`,
      slo: tier === 1 ? "99.9%" : "best-effort",
      oncall: "live-observer",
    },
    runbook: {
      id: `RB-LIVE-${tier}`,
      title: tier === 1 ? "Major outage comms + vendor escalation" : "Watch component, subscribe to updates",
      rev: 1,
    },
    gold: {
      severity:
        impact.customers === "blocked"
          ? impact.revenue
            ? "SEV1"
            : "SEV2"
          : impact.customers === "degraded"
            ? "SEV3"
            : "SEV4",
      team: `team-${slug}`,
      action: "human adjudicates — live data carries no fixed gold",
      trapNote:
        "Live incident from status.github.com — no human-fixed gold answer; the verdict is advisory, visibly ungated, and never pages.",
    },
  };
}
