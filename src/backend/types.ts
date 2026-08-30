import type { Severity } from "../data/incidents";

/**
 * API contract types for the Pagermind service layer (api/v1).
 * The contract is transport-agnostic: today it is served in-browser by
 * src/backend/api.ts, and maps 1:1 to the REST endpoints documented in
 * docs/ARCHITECTURE.md for future extraction to a Node/Fastify process.
 */

export type Role = "reviewer" | "viewer";

export interface Reviewer {
  id: string;
  name: string;
  title: string;
  role: Role;
}

export interface Session {
  id: string;
  reviewerId: string;
  name: string;
  role: Role;
  createdAt: string;
}

export type GateStatus = "pending" | "approved" | "rejected";

export interface GateProposal {
  id: string;
  caseId: string;
  title: string;
  service: string;
  severity: Severity;
  team: string;
  runbookId: string;
  runbookTitle: string;
  action: string;
  pageTarget: string;
  confidence: number;
  evidence: string[];
  status: GateStatus;
  decision?: "approve" | "reject";
  decidedBy?: string;
  decidedAt?: string;
  reason?: string;
}

export interface AuditEntry {
  seq: number;
  id: string;
  at: string;
  actor: string;
  action: string;
  target: string;
  outcome: "ok" | "denied" | "error";
  detail: string;
  requestId: string;
}

export type LogLevel = "info" | "warn" | "error";

export interface LogEntry {
  at: string;
  level: LogLevel;
  msg: string;
  requestId?: string;
}

export interface HealthReport {
  status: "ok" | "degraded";
  storageMode: "localStorage" | "memory";
  schemaVersion: number;
  startedAt: string;
  uptimeMs: number;
  requests: number;
  errors: number;
  decisions: number;
  avgLatencyMs: number;
  lastError: string | null;
}

/** Structured error — never carries stack traces across the boundary. */
export class ApiError extends Error {
  status: number;
  code: string;
  requestId: string;
  retryAfterMs?: number;
  issues?: string[];

  constructor(
    status: number,
    code: string,
    message: string,
    requestId: string,
    opts?: { retryAfterMs?: number; issues?: string[] }
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.retryAfterMs = opts?.retryAfterMs;
    this.issues = opts?.issues;
  }
}

export interface Envelope<T> {
  requestId: string;
  latencyMs: number;
  data: T;
}

export interface ValidationResult<T> {
  ok: boolean;
  value?: T;
  issues: string[];
}
