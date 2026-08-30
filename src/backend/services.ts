import { CASES } from "../data/incidents";
import { runAgent } from "../engine/agent";
import { db } from "./db";
import {
  ApiError,
  type AuditEntry,
  type GateProposal,
  type HealthReport,
  type LogEntry,
  type LogLevel,
  type Reviewer,
  type Session,
  type ValidationResult,
} from "./types";

/**
 * Domain services. Authorization is enforced HERE, not in the UI:
 * authenticated ≠ authorized. Every consequential act is audited.
 */

const startedAt = Date.now();

/* ---------------- reviewers (sandbox roster — no passwords by design) ---------------- */

export const REVIEWERS: Reviewer[] = [
  { id: "rev-priya", name: "Priya Natarajan", title: "SRE Lead · EMEA", role: "reviewer" },
  { id: "rev-marcus", name: "Marcus Webb", title: "On-call Engineer", role: "reviewer" },
  { id: "rev-guest", name: "Guest Observer", title: "Read-only", role: "viewer" },
];

/* ---------------- observability ---------------- */

const logs: LogEntry[] = [];
const metrics = { requests: 0, errors: 0, decisions: 0, latencyTotal: 0, latencyCount: 0 };
let lastError: string | null = null;

export const obs = {
  log(level: LogLevel, msg: string, requestId?: string): void {
    logs.push({ at: new Date().toISOString(), level, msg, requestId });
    if (logs.length > 250) logs.splice(0, logs.length - 250);
  },
  tail(n = 40): LogEntry[] {
    return logs.slice(-n);
  },
  countRequest(latencyMs: number): void {
    metrics.requests += 1;
    metrics.latencyTotal += latencyMs;
    metrics.latencyCount += 1;
  },
  countError(message: string): void {
    metrics.errors += 1;
    lastError = message;
  },
  countDecision(): void {
    metrics.decisions += 1;
  },
  health(): HealthReport {
    return {
      status: "ok",
      storageMode: db.mode(),
      schemaVersion: db.schemaVersion(),
      startedAt: new Date(startedAt).toISOString(),
      uptimeMs: Date.now() - startedAt,
      requests: metrics.requests,
      errors: metrics.errors,
      decisions: metrics.decisions,
      avgLatencyMs: metrics.latencyCount ? Math.round(metrics.latencyTotal / metrics.latencyCount) : 0,
      lastError,
    };
  },
  setDegraded(v: boolean): void {
    degraded = v;
  },
  isDegraded(): boolean {
    return degraded;
  },
};

let degraded = false;

/* ---------------- audit ledger (append-only) ---------------- */

export const audit = {
  append(entry: Omit<AuditEntry, "seq" | "id" | "at">): AuditEntry {
    return db.tx((s) => {
      const seq = s.audit.length + 1;
      const full: AuditEntry = {
        ...entry,
        seq,
        id: `aud_${String(seq).padStart(4, "0")}`,
        at: new Date().toISOString(),
      };
      s.audit.push(full);
      return full;
    });
  },
  list(): AuditEntry[] {
    return [...db.read().audit].reverse();
  },
  exportJson(): string {
    return JSON.stringify({ exportedAt: new Date().toISOString(), entries: db.read().audit }, null, 2);
  },
};

/* ---------------- sessions / auth ---------------- */

function randomId(prefix: string): string {
  const bytes = new Uint8Array(8);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < 8; i++) bytes[i] = Math.floor(Math.random() * 256);
  return `${prefix}_${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

export const sessions = {
  start(reviewerId: string, requestId: string): Session {
    const reviewer = REVIEWERS.find((r) => r.id === reviewerId);
    if (!reviewer) throw new ApiError(404, "REVIEWER_NOT_FOUND", "Unknown reviewer id.", requestId);
    const session: Session = {
      id: randomId("sess"),
      reviewerId: reviewer.id,
      name: reviewer.name,
      role: reviewer.role,
      createdAt: new Date().toISOString(),
    };
    db.tx((s) => {
      s.sessions.push(session);
      if (s.sessions.length > 25) s.sessions.splice(0, s.sessions.length - 25);
    });
    audit.append({
      actor: reviewer.name,
      action: "session.start",
      target: session.id,
      outcome: "ok",
      detail: `role=${reviewer.role}`,
      requestId,
    });
    obs.log("info", `session started · ${reviewer.name} (${reviewer.role})`, requestId);
    return session;
  },

  get(sessionId: string, requestId: string): Session {
    const s = db.read().sessions.find((x) => x.id === sessionId);
    if (!s) throw new ApiError(401, "SESSION_EXPIRED", "Session not found — sign in again.", requestId);
    return s;
  },

  end(sessionId: string, requestId: string): void {
    const s = db.read().sessions.find((x) => x.id === sessionId);
    db.tx((st) => {
      st.sessions = st.sessions.filter((x) => x.id !== sessionId);
    });
    audit.append({
      actor: s?.name ?? "unknown",
      action: "session.end",
      target: sessionId,
      outcome: "ok",
      detail: "",
      requestId,
    });
  },
};

/* ---------------- triage (agent orchestration) ---------------- */

export const triage = {
  propose(caseId: string, requestId: string) {
    const c = CASES.find((x) => x.id === caseId);
    if (!c) throw new ApiError(404, "CASE_NOT_FOUND", `No incident ${caseId}.`, requestId);
    const verdict = runAgent(c);
    obs.log("info", `triage.propose ${caseId} → ${verdict.severity} · ${verdict.team}`, requestId);
    return { caseId, verdict };
  },
};

/* ---------------- human approval gates ---------------- */

function seedGates(): GateProposal[] {
  return CASES.filter((c) => runAgent(c).page).map((c) => {
    const v = runAgent(c);
    return {
      id: `gate-${c.id}`,
      caseId: c.id,
      title: c.title,
      service: c.service,
      severity: v.severity,
      team: v.team,
      runbookId: v.runbook.id,
      runbookTitle: v.runbook.title,
      action: v.action,
      pageTarget: `oncall(${v.team})`,
      confidence: v.confidence,
      evidence: v.evidence,
      status: "pending",
    };
  });
}

export interface GateDecisionInput {
  decision: "approve" | "reject";
  reason: string;
}

export function validateDecision(body: unknown): ValidationResult<GateDecisionInput> {
  const issues: string[] = [];
  const b = (body ?? {}) as Partial<GateDecisionInput>;
  if (b.decision !== "approve" && b.decision !== "reject") issues.push("decision must be 'approve' or 'reject'");
  if (typeof b.reason !== "string") issues.push("reason must be a string");
  else if (b.decision === "reject" && b.reason.trim().length < 4)
    issues.push("a rejection needs a reason of ≥ 4 characters — it goes to the audit ledger");
  return issues.length ? { ok: false, issues } : { ok: true, value: b as GateDecisionInput, issues: [] };
}

export const gates = {
  list(): GateProposal[] {
    return db.tx((s) => {
      if (s.gates.length === 0) s.gates = seedGates();
      return [...s.gates];
    });
  },

  /** Live simulation / triage endpoint stages a consequential act here. */
  propose(input: {
    caseId: string;
    uid: string;
    title: string;
    service: string;
    severity: GateProposal["severity"];
    team: string;
    runbookId: string;
    runbookTitle: string;
    action: string;
    confidence: number;
    evidence: string[];
  }): GateProposal {
    const gate = db.tx((s) => {
      const seq = s.meta.gateSeq ? Number(s.meta.gateSeq) + 1 : s.gates.length + 1;
      s.meta.gateSeq = String(seq);
      const g: GateProposal = {
        id: `gate-${input.caseId}-${seq}`,
        caseId: input.caseId,
        title: input.title,
        service: input.service,
        severity: input.severity,
        team: input.team,
        runbookId: input.runbookId,
        runbookTitle: input.runbookTitle,
        action: input.action,
        pageTarget: `oncall(${input.team})`,
        confidence: input.confidence,
        evidence: input.evidence,
        status: "pending",
        uid: input.uid,
      };
      s.gates.push(g);
      return { ...g };
    });
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("pm:gates-changed"));
    obs.log("warn", `gate.propose ${gate.id} · ${input.severity} ${input.service} — awaiting human`, "sim");
    return gate;
  },

  decide(
    session: Session | null,
    gateId: string,
    input: GateDecisionInput,
    requestId: string
  ): GateProposal {
    // 401 — authentication
    if (!session) throw new ApiError(401, "AUTH_REQUIRED", "Sign in to act on a gate.", requestId);

    // 403 — authorization (denials are audited too)
    if (session.role !== "reviewer") {
      audit.append({
        actor: session.name,
        action: "gate.decide",
        target: gateId,
        outcome: "denied",
        detail: `role=${session.role} lacks 'reviewer'`,
        requestId,
      });
      obs.log("warn", `403 denied · ${session.name} (${session.role}) tried gate.decide`, requestId);
      throw new ApiError(403, "FORBIDDEN", "Viewer role cannot approve or reject pages.", requestId);
    }

    const gate = db.read().gates.find((g) => g.id === gateId);
    if (!gate) throw new ApiError(404, "GATE_NOT_FOUND", `No gate ${gateId}.`, requestId);

    // 409 — idempotency: a decided gate is decided forever
    if (gate.status !== "pending") {
      throw new ApiError(
        409,
        "ALREADY_DECIDED",
        `Gate settled ${gate.status} by ${gate.decidedBy} — decisions are immutable.`,
        requestId
      );
    }

    const updated = db.tx((s) => {
      const g = s.gates.find((x) => x.id === gateId)!;
      g.status = input.decision === "approve" ? "approved" : "rejected";
      g.decision = input.decision;
      g.decidedBy = session.name;
      g.decidedAt = new Date().toISOString();
      g.reason = input.reason.trim();
      return { ...g };
    });

    audit.append({
      actor: session.name,
      action: input.decision === "approve" ? "gate.approve" : "gate.reject",
      target: `${gateId} → ${updated.pageTarget}`,
      outcome: "ok",
      detail: input.reason.trim() || "approved without comment",
      requestId,
    });
    obs.countDecision();
    obs.log(
      "info",
      `${input.decision === "approve" ? "approved" : "rejected"} ${gateId} · ${session.name}`,
      requestId
    );
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("pm:gates-changed"));
    return updated;
  },
};
