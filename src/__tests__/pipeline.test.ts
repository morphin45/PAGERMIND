import { describe, expect, it, beforeEach } from "vitest";
import { ADVERSARIAL, CASES, CORRELATED } from "../data/cases";
import {
  ablation,
  adversarialSuite,
  aggregate,
  buildPostmortem,
  evaluateAll,
  runAgent,
  runBaseline,
} from "../engine/engine";
import { ApiError, audit, db, gates, sessions, validateDecision } from "../backend/backend";

/* ---------------- engine determinism ---------------- */

describe("engine determinism", () => {
  it("produces byte-identical traces on repeat runs (all 12 cases)", () => {
    for (const c of CASES) {
      expect(JSON.stringify(runAgent(c).steps)).toBe(JSON.stringify(runAgent(c).steps));
    }
  });

  it("agent matches the human-fixed gold answer on every case", () => {
    for (const c of CASES) {
      const a = runAgent(c);
      expect(a.severity, `${c.id} severity`).toBe(c.gold.severity);
      expect(a.team, `${c.id} team`).toBe(c.gold.team);
      expect(a.runbook.id, `${c.id} runbook`).toBe(c.runbook.id);
      expect(a.evidence.length, `${c.id} evidence`).toBeGreaterThanOrEqual(3);
    }
  });
});

/* ---------------- scored evaluation ---------------- */

describe("scored evaluation", () => {
  const { cases } = evaluateAll();
  const agg = aggregate(cases);

  it("computes the headline aggregates", () => {
    expect(agg.baselinePct).toBe(23);
    expect(agg.agentPct).toBe(100);
    expect(agg.baselineFalsePages).toBe(5);
    expect(agg.agentFalsePages).toBe(0);
    expect(agg.baselineWrongTeam).toBe(9);
    expect(agg.agentWrongTeam).toBe(0);
    expect(agg.baselineMissed).toBe(1); // INC-2208: silent corruption filed 2 levels quiet
    expect(agg.agentMissed).toBe(0);
  });

  it("attribution ladder is exactly [23, 89, 100, 100]", () => {
    const lad = ablation().map((s) => s.pct);
    expect(lad).toEqual([23, 89, 100, 100]);
  });
});

/* ---------------- red team suite ---------------- */

describe("red team suite", () => {
  const report = adversarialSuite();

  it("agent resists all 6 poisoned alerts; baseline resists none", () => {
    expect(report.agentResisted).toBe(6);
    expect(report.baselineResisted).toBe(0);
  });

  it("quarantines injected directives in parse.sanitize", () => {
    const suppressed = report.rows.find((r) => r.c.id === "ADV-905")!;
    expect(suppressed.agent.quarantined).toBe(true);
    expect(suppressed.agent.severity).toBe("SEV1"); // the page survives the attack
    const override = report.rows.find((r) => r.c.id === "ADV-901")!;
    expect(override.agent.quarantined).toBe(true);
  });
});

/* ---------------- storm & postmortem ---------------- */

describe("storm & postmortem", () => {
  it("the correlated storm triages to its gold with memory recall", () => {
    const v = runAgent(CORRELATED);
    expect(v.severity).toBe("SEV1");
    expect(v.team).toBe("team-checkout");
    expect(v.memoryNote).toContain("INC-2201");
    // every raw storm alert, run through the baseline, misbehaves
    for (const line of CORRELATED.alertText) {
      const b = runBaseline({ ...CORRELATED, alertText: [line] });
      expect(b.evidence.length).toBe(0); // baseline cites nothing, ever
    }
  });

  it("postmortem regeneration is byte-identical for the same evidence", () => {
    const v = runAgent(CORRELATED);
    const at = "2026-02-15T03:50:00.000Z";
    expect(buildPostmortem(CORRELATED, v, at)).toBe(buildPostmortem(CORRELATED, v, at));
  });
});

/* ---------------- gate state machine (401 / 403 / 409 / 422) ---------------- */

describe("gate state machine", () => {
  beforeEach(() => db.reset());

  const pendingGate = () => gates.list().find((g) => g.status === "pending")!;

  it("anonymous decision → 401 AUTH_REQUIRED", () => {
    const g = pendingGate();
    expect(() => gates.decide(null, g.id, { decision: "approve", reason: "ok" }, "req_t")).toThrowError(ApiError);
    try {
      gates.decide(null, g.id, { decision: "approve", reason: "ok" }, "req_t");
    } catch (e) {
      expect((e as ApiError).status).toBe(401);
    }
  });

  it("viewer decision → 403 FORBIDDEN and the denial is audited", () => {
    const viewer = sessions.start("rev-guest", "req_t");
    const g = pendingGate();
    try {
      gates.decide(viewer, g.id, { decision: "approve", reason: "ok" }, "req_t");
      expect.unreachable("should have thrown");
    } catch (e) {
      expect((e as ApiError).status).toBe(403);
    }
    expect(audit.list().some((a) => a.outcome === "denied")).toBe(true);
  });

  it("reviewer approve settles the gate; retry → 409 ALREADY_DECIDED", () => {
    const reviewer = sessions.start("rev-priya", "req_t");
    const g = pendingGate();
    const settled = gates.decide(reviewer, g.id, { decision: "approve", reason: "verified" }, "req_t");
    expect(settled.status).toBe("approved");
    try {
      gates.decide(reviewer, g.id, { decision: "reject", reason: "changed my mind" }, "req_t");
      expect.unreachable("should have thrown");
    } catch (e) {
      expect((e as ApiError).status).toBe(409);
    }
  });

  it("boundary validation rejects bad input (422 territory)", () => {
    expect(validateDecision({ decision: "maybe", reason: "" }).ok).toBe(false);
    expect(validateDecision({ decision: "reject", reason: "no" }).ok).toBe(false);
    expect(validateDecision({ decision: "approve", reason: "verified against RB-114" }).ok).toBe(true);
  });

  it("red team data is wired: 6 poisoned cases exist", () => {
    expect(ADVERSARIAL.length).toBe(6);
  });
});
