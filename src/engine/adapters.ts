import { onCallFor, type Catalog, type IncidentCase, type OnCallEng, type Signals } from "../data/cases";

/**
 * ADAPTER BOUNDARY — the single place where the sandbox meets the world.
 *
 * The triage engine only ever talks to these interfaces. Today every
 * implementation is a deterministic sandbox adapter bound to the synthetic
 * case set; in production each one is replaced by a real integration
 * (Prometheus, a CMDB, a change-management API, an incident store, a
 * runbook registry, an IdP, PagerDuty/Twilio) WITHOUT touching the engine,
 * the rules or the rubric — see ROADMAP.md, phase 1.
 *
 * Trust rule baked into the boundary: adapters return DATA. None of them
 * returns instructions, and the engine never interprets their payloads as
 * directives — the same property that makes prompt injection a non-category.
 */

export interface CalendarResult {
  drill: boolean;
  note?: string;
}

export interface MemoryResult {
  hits: string[];
  note: string;
}

export interface RunbookInfo {
  id: string;
  title: string;
  rev: number;
}

/* ---------------- decision-path tools (consumed by the agent) ---------------- */

export interface ToolAdapters {
  catalog: { lookup(service: string): Catalog };
  metrics: { query(service: string): Signals };
  calendar: { check(service: string): CalendarResult };
  memory: { search(fingerprint: string): MemoryResult | null };
  runbook: { match(service: string, severity: string): RunbookInfo };
}

/** Sandbox tools: each one is a pure, deterministic projection of the case. */
export function sandboxAdapters(c: IncidentCase): ToolAdapters {
  return {
    catalog: { lookup: () => c.catalog },
    metrics: { query: () => c.signals },
    calendar: { check: () => ({ drill: !!c.signals.drill, note: c.signals.drill ? "scheduled drill in window" : undefined }) },
    memory: { search: () => (c.memory ? { hits: c.memory.hits, note: c.memory.note } : null) },
    runbook: { match: () => c.runbook },
  };
}

/* ---------------- platform seams (identity, paging transport) ---------------- */

export interface ReviewerLike {
  id: string;
  name: string;
  title: string;
  role: "reviewer" | "viewer";
}

export interface IdentityAdapter {
  resolve(reviewerId: string): ReviewerLike | null;
}

/** Sandbox IdP: asserts identity from the in-repo roster (no passwords by design). */
export function sandboxIdentity(roster: ReviewerLike[]): IdentityAdapter {
  return { resolve: (id) => roster.find((r) => r.id === id) ?? null };
}

export interface PageTransport {
  /** Deliver a page to the on-call engineer for a team. Sandbox: simulated delivery. */
  page(team: string): OnCallEng;
}

/** Sandbox transport: resolves the roster engineer; "delivery" is rendered by the console. */
export const sandboxTransport: PageTransport = {
  page: (team) => onCallFor(team),
};
