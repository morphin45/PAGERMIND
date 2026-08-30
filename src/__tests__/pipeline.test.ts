import { beforeEach, describe, expect, it } from "vitest";
import { CASES } from "../data/incidents";
import { runAgent } from "../engine/agent";
import { runBaseline } from "../engine/baseline";
import { ablation, aggregate, evaluateAll } from "../engine/eval";
import { db } from "../backend/db";
import { gates, sessions, validateDecision, REVIEWERS } from "../backend/services";
import { ApiError } from "../backend/types";

/* ---------------- engine ---------------- */

describe("triage engine", () => {
  it("is deterministic — identical traces on repeated runs", () => {
    for (const c of CASES) {
      const a = JSON.stringify(runAgent(c));
      const b = JSON.stringify(runAgent(c));
      expect(a).toBe(b);
    }
  });

  it("matches every gold answer (severity, team, runbook)", () => {
    for (const c of CASES) {
      const v = runAgent(c);
      expect(v.severity, `${c.id} severity`).toBe(c.gold.severity);
      expect(v.team, `${c.id} team`).toBe(c.gold.team);
      expect(v.runbook.id, `${c.id} runbook`).toBe(c.runbook.id);
    }
  });

  it("exposes a defensible evidence chain (≥3 citations) on every case", () => {
    for (const c of CASES) {
      expect(runAgent(c).evidence.length, c.id).toBeGreaterThanOrEqual(3);
    }
  });

  it("reproduces the baseline failure profile on the drill trap", () => {
    const drill = CASES.find((c) => c.id === "INC-2209")!;
    expect(runBaseline(drill).page).toBe(true); // keyword script wakes 6 people for GameDay
  });
});

describe("shared evaluation rubric", () => {
  it("scores baseline 30% and agent 100% on the fixed 12-case set", () => {
    const agg = aggregate(evaluateAll().cases);
    expect(agg.baselinePct).toBe(30);
    expect(agg.agentPct).toBe(100);
    expect(agg.baselineFalsePages).toBe(5);
    expect(agg.agentFalsePages).toBe(0);
    expect(agg.baselineWrongTeam).toBe(9);
    expect(agg.agentWrongTeam).toBe(0);
    expect(agg.baselineMissed).toBe(1); // INC-2208: silent corruption filed 2 levels quiet
    expect(agg.agentMissed).toBe(0);
  });
});

describe("attribution ablation", () => {
  it("reports the four stages in order, from baseline to full agent", () => {
    const stages = ablation();
    expect(stages.map((s) => s.id)).toEqual(["base", "tools", "critic", "memory"]);
  });

  it("anchors the base stage to the baseline aggregate (30%)", () => {
    const [base] = ablation();
    expect(base.pct).toBe(30);
    expect(base.falsePages).toBe(5);
    expect(base.wrongTeam).toBe(9);
  });

  it("shows grounding tools fixing team routing immediately (wrong-team → 0)", () => {
    const tools = ablation()[1];
    expect(tools.wrongTeam).toBe(0); // ownership is a catalog lookup, not a guess
  });

  it("is monotonically non-decreasing and reaches 100% with zero false pages", () => {
    const stages = ablation();
    for (let i = 1; i < stages.length; i++) {
      expect(stages[i].pct, `${stages[i].id} ≥ ${stages[i - 1].id}`).toBeGreaterThanOrEqual(stages[i - 1].pct);
    }
    const full = stages[stages.length - 1];
    expect(full.pct).toBe(100);
    expect(full.falsePages).toBe(0);
    expect(full.wrongTeam).toBe(0);
  });
});

/* ---------------- human gate state machine ---------------- */

describe("approval gates", () => {
  beforeEach(() => {
    db.reset();
  });

  const pendingGate = () => gates.list().find((g) => g.status === "pending")!;

  it("seeds one gate per consequential (page-worthy) proposal", () => {
    const list = gates.list();
    const pageWorthy = CASES.filter((c) => runAgent(c).page).length;
    expect(list.length).toBe(pageWorthy);
    expect(list.every((g) => g.status === "pending")).toBe(true);
  });

  it("401 — unauthenticated callers cannot decide", () => {
    expect(() => gates.decide(null, pendingGate().id, { decision: "approve", reason: "" }, "req_test")).toThrowError(
      ApiError
    );
    try {
      gates.decide(null, pendingGate().id, { decision: "approve", reason: "" }, "req_test");
    } catch (e) {
      expect((e as ApiError).status).toBe(401);
    }
  });

  it("403 — viewers are denied, and the denial is audited", () => {
    const viewer = sessions.start("rev-guest", "req_test");
    const id = pendingGate().id;
    try {
      gates.decide(viewer, id, { decision: "approve", reason: "" }, "req_test");
      expect.unreachable();
    } catch (e) {
      expect((e as ApiError).status).toBe(403);
      expect((e as ApiError).code).toBe("FORBIDDEN");
    }
    const denials = db.read().audit.filter((a) => a.outcome === "denied");
    expect(denials.length).toBe(1);
  });

  it("422 — rejections require a real reason", () => {
    const v = validateDecision({ decision: "reject", reason: "no" });
    expect(v.ok).toBe(false);
    expect(v.issues.join(" ")).toContain("≥ 4 characters");
  });

  it("happy path: approve settles the gate and writes the audit ledger", () => {
    const reviewer = sessions.start("rev-priya", "req_test");
    const id = pendingGate().id;
    const settled = gates.decide(reviewer, id, { decision: "approve", reason: "confirmed via catalog" }, "req_test");
    expect(settled.status).toBe("approved");
    expect(settled.decidedBy).toBe(reviewer.name);
    const entry = db.read().audit.find((a) => a.action === "gate.approve" && a.target.startsWith(id));
    expect(entry).toBeTruthy();
  });

  it("409 — decisions are immutable (idempotent endpoint)", () => {
    const reviewer = sessions.start("rev-marcus", "req_test");
    const id = pendingGate().id;
    gates.decide(reviewer, id, { decision: "reject", reason: "deploy rollback in progress" }, "req_test");
    try {
      gates.decide(reviewer, id, { decision: "approve", reason: "" }, "req_test");
      expect.unreachable();
    } catch (e) {
      expect((e as ApiError).status).toBe(409);
      expect((e as ApiError).code).toBe("ALREADY_DECIDED");
    }
  });

  it("unknown reviewer ids are rejected at sign-in", () => {
    expect(() => sessions.start("rev-nobody", "req_test")).toThrowError(ApiError);
    expect(REVIEWERS.length).toBeGreaterThanOrEqual(3);
  });
});
