import type { CalendarResult, MemoryResult, RunbookInfo, ToolAdapters } from "./adapters";
import type { Catalog, Signals } from "../data/cases";

/**
 * A SECOND adapter implementation, deliberately unlike the sandbox set:
 * every service looks like a quiet tier-3 box, no calendar drill, no memory.
 * Used only by the adapter-boundary contract tests to prove the engine
 * consumes the SEAM, not the sandbox data — i.e. that "production is an
 * adapter swap" is a tested property, not a promise.
 */
export const stubAdapters: ToolAdapters = {
  catalog: {
    lookup: (service: string): Catalog => ({
      tier: 3,
      team: `team-${service.split("-")[0] || "unknown"}`,
      slo: "best-effort",
      oncall: "stub-oncall",
    }),
  },
  metrics: {
    query: (): Signals => ({ errorRate: 0, customers: "none", revenue: false }),
  },
  calendar: {
    check: (): CalendarResult => ({ drill: false }),
  },
  memory: {
    search: (): MemoryResult | null => null,
  },
  runbook: {
    match: (service: string): RunbookInfo => ({ id: "RB-STUB", title: `Stub runbook for ${service}`, rev: 1 }),
  },
};
