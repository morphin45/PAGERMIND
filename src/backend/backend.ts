import { CASES, ADVERSARIAL, CORRELATED } from "../data/cases";
import { runAgent } from "../engine/engine";
import { sandboxIdentity } from "../engine/adapters";

/**
 * SERVICE LAYER — validation, authorization, idempotency, audit,
 * observability, chaos injection — behind a transport-agnostic facade.
 * Authorization is enforced HERE, never in the UI: authenticated ≠ authorized.
 */

/* ---------------- errors & envelope ---------------- */

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public requestId: string,
    public issues?: string[]
  ) {
    super(message);
  }
}

export interface Envelope<T> {
  requestId: string;
  latencyMs: number;
  data: T;
}

/* ---------------- domain types ---------------- */

export interface Session {
  id: string;
  reviewerId: string;
  name: string;
  role: "reviewer" | "viewer";
  createdAt: string;
}

export interface GateProposal {
  id: string;
  caseId: string;
  uid?: string;
  title: string;
  service: string;
  severity: "SEV1" | "SEV2";
  team: string;
  runbookId: string;
  runbookTitle: string;
  action: string;
  confidence: number;
  evidence: string[];
  status: "pending" | "approved" | "rejected";
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

export interface LogEntry {
  at: string;
  level: "info" | "warn" | "error";
  msg: string;
  requestId?: string;
}

export interface HealthReport {
  status: "ok" | "degraded";
  storageMode: string;
  schemaVersion: number;
  uptimeMs: number;
  requests: number;
  errors: number;
  decisions: number;
  avgLatencyMs: number;
  lastError: string | null;
}

export interface Reviewer {
  id: string;
  name: string;
  title: string;
  role: "reviewer" | "viewer";
}

export const REVIEWERS: Reviewer[] = [
  { id: "rev-priya", name: "Priya Natarajan", title: "SRE Lead · EMEA", role: "reviewer" },
  { id: "rev-marcus", name: "Marcus Webb", title: "On-call Engineer", role: "reviewer" },
  { id: "rev-guest", name: "Guest Observer", title: "Read-only", role: "viewer" },
];

/* ---------------- storage (versioned, migrations, memory fallback) ---------------- */

interface SchemaV1 {
  v: 1;
  sessions: Session[];
  gates: GateProposal[];
  audit: AuditEntry[];
  meta: Record<string, string>;
}

const KEY = "pagermind.db";
const SCHEMA_VERSION = 1;
let memoryBlob: string | null = null;
let storageMode: "localStorage" | "memory" = "memory";

function canUseLocalStorage(): boolean {
  try {
    const p = "__pm_probe__";
    window.localStorage.setItem(p, "1");
    window.localStorage.removeItem(p);
    return true;
  } catch {
    return false;
  }
}

const fresh = (): SchemaV1 => ({ v: 1, sessions: [], gates: [], audit: [], meta: {} });

/** migration registry — legacy unversioned prototype payloads upgrade on first read */
const MIGRATIONS: Record<number, (raw: unknown) => SchemaV1> = {
  0: (raw) => {
    const legacy = (raw ?? {}) as { gates?: GateProposal[]; audit?: AuditEntry[] };
    const next = fresh();
    next.meta.migratedFrom = "0";
    next.gates = Array.isArray(legacy.gates) ? legacy.gates : [];
    next.audit = Array.isArray(legacy.audit) ? legacy.audit.map((a, i) => ({ ...a, seq: i + 1 })) : [];
    return next;
  },
};

function normalize(raw: unknown): SchemaV1 {
  if (raw === null || raw === undefined || typeof raw !== "object") return fresh();
  const obj = raw as { v?: number };
  if (obj.v === SCHEMA_VERSION) return raw as SchemaV1;
  const migrate = MIGRATIONS[typeof obj.v === "number" ? obj.v : 0];
  return migrate ? migrate(raw) : fresh();
}

function readRaw(): string | null {
  if (typeof window !== "undefined" && canUseLocalStorage()) {
    storageMode = "localStorage";
    return window.localStorage.getItem(KEY);
  }
  storageMode = "memory";
  return memoryBlob;
}

function writeRaw(blob: string): void {
  if (typeof window !== "undefined" && canUseLocalStorage()) {
    storageMode = "localStorage";
    window.localStorage.setItem(KEY, blob);
    return;
  }
  storageMode = "memory";
  memoryBlob = blob;
}

export const db = {
  tx<T>(mutate: (s: SchemaV1) => T): T {
    let schema: SchemaV1;
    try {
      schema = normalize(JSON.parse(readRaw() ?? "null"));
    } catch {
      schema = fresh(); // corrupted payload: fail closed, reseed
    }
    const result = mutate(schema);
    writeRaw(JSON.stringify(schema));
    return result;
  },
  read(): SchemaV1 {
    return this.tx((s) => s);
  },
  reset(): void {
    writeRaw(JSON.stringify(fresh()));
  },
  mode: () => storageMode,
};

/* ---------------- observability ---------------- */

const startedAt = Date.now();
const logs: LogEntry[] = [];
const metrics = { requests: 0, errors: 0, decisions: 0, latencyTotal: 0, latencyCount: 0 };
let lastError: string | null = null;
let degraded = false;
const chaosListeners = new Set<(on: boolean) => void>();
const gatesListeners = new Set<() => void>();

export const obs = {
  log(level: LogEntry["level"], msg: string, requestId?: string): void {
    logs.push({ at: new Date().toISOString(), level, msg, requestId });
    if (logs.length > 250) logs.splice(0, logs.length - 250);
  },
  tail(n = 60): LogEntry[] {
    return logs.slice(-n);
  },
  countRequest(ms: number): void {
    metrics.requests += 1;
    metrics.latencyTotal += ms;
    metrics.latencyCount += 1;
  },
  countError(msg: string): void {
    metrics.errors += 1;
    lastError = msg;
  },
  countDecision(): void {
    metrics.decisions += 1;
  },
  health(): HealthReport {
    return {
      status: degraded ? "degraded" : "ok",
      storageMode: db.mode(),
      schemaVersion: SCHEMA_VERSION,
      uptimeMs: Date.now() - startedAt,
      requests: metrics.requests,
      errors: metrics.errors,
      decisions: metrics.decisions,
      avgLatencyMs: metrics.latencyCount ? Math.round(metrics.latencyTotal / metrics.latencyCount) : 0,
      lastError,
    };
  },
};

export function setChaos(on: boolean): void {
  degraded = on;
  obs.log(on ? "warn" : "info", on ? "chaos enabled — storage calls will fail with 503" : "chaos disabled");
  chaosListeners.forEach((fn) => fn(on));
}
export const isChaos = () => degraded;
export function onChaos(fn: (on: boolean) => void): () => void {
  chaosListeners.add(fn);
  return () => void chaosListeners.delete(fn);
}
export function onGatesChanged(fn: () => void): () => void {
  gatesListeners.add(fn);
  return () => void gatesListeners.delete(fn);
}
const notifyGates = () => gatesListeners.forEach((fn) => fn());

/* ---------------- audit (append-only) ---------------- */

export const audit = {
  append(entry: Omit<AuditEntry, "seq" | "id" | "at">): AuditEntry {
    return db.tx((s) => {
      const seq = s.audit.length + 1;
      const full: AuditEntry = { ...entry, seq, id: `aud_${String(seq).padStart(4, "0")}`, at: new Date().toISOString() };
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

/* ---------------- sessions ---------------- */

function randomId(prefix: string): string {
  const bytes = new Uint8Array(8);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < 8; i++) bytes[i] = Math.floor(Math.random() * 256);
  return `${prefix}_${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

const sessionListeners = new Set<() => void>();
const notifySession = () => sessionListeners.forEach((fn) => fn());

export const sessions = {
  current(): Session | null {
    const id = db.read().meta.currentSessionId;
    if (!id) return null;
    return db.read().sessions.find((s) => s.id === id) ?? null;
  },
  setCurrent(id: string | null): void {
    db.tx((s) => {
      if (id) s.meta.currentSessionId = id;
      else delete s.meta.currentSessionId;
    });
    notifySession();
  },
  onChange(fn: () => void): () => void {
    sessionListeners.add(fn);
    return () => void sessionListeners.delete(fn);
  },
  start(reviewerId: string, requestId: string): Session {
    // identity resolves through the adapter seam — swap sandboxIdentity for an IdP later
    const reviewer = sandboxIdentity(REVIEWERS).resolve(reviewerId);
    if (!reviewer) throw new ApiError(404, "REVIEWER_NOT_FOUND", "Unknown reviewer id.", requestId);
    const session: Session = { id: randomId("sess"), reviewerId, name: reviewer.name, role: reviewer.role, createdAt: new Date().toISOString() };
    db.tx((s) => {
      s.sessions.push(session);
      if (s.sessions.length > 25) s.sessions.splice(0, s.sessions.length - 25);
      s.meta.currentSessionId = session.id;
    });
    audit.append({ actor: reviewer.name, action: "session.start", target: session.id, outcome: "ok", detail: `role=${reviewer.role}`, requestId });
    obs.log("info", `session started · ${reviewer.name} (${reviewer.role})`, requestId);
    notifySession();
    return session;
  },
  end(sessionId: string, requestId: string): void {
    const s = db.read().sessions.find((x) => x.id === sessionId);
    db.tx((st) => {
      st.sessions = st.sessions.filter((x) => x.id !== sessionId);
      if (st.meta.currentSessionId === sessionId) delete st.meta.currentSessionId;
    });
    audit.append({ actor: s?.name ?? "unknown", action: "session.end", target: sessionId, outcome: "ok", detail: "", requestId });
    notifySession();
  },
};

/* ---------------- triage ---------------- */

const ALL_CASES = [...CASES, ...ADVERSARIAL, CORRELATED];

export const triage = {
  propose(caseId: string, requestId: string) {
    const c = ALL_CASES.find((x) => x.id === caseId);
    if (!c) throw new ApiError(404, "CASE_NOT_FOUND", `No incident ${caseId}.`, requestId);
    const verdict = runAgent(c);
    obs.log("info", `triage.propose ${caseId} → ${verdict.severity} · ${verdict.team}`, requestId);
    return { caseId, verdict };
  },
};

/* ---------------- gates ---------------- */

function seedGates(): GateProposal[] {
  return CASES.filter((c) => runAgent(c).page).map((c) => {
    const v = runAgent(c);
    return {
      id: `gate-${c.id}`,
      caseId: c.id,
      title: c.title,
      service: c.service,
      severity: v.severity as "SEV1" | "SEV2",
      team: v.team,
      runbookId: v.runbook.id,
      runbookTitle: v.runbook.title,
      action: v.action,
      confidence: v.confidence,
      evidence: v.evidence,
      status: "pending" as const,
    };
  });
}

export interface GateDecisionInput {
  decision: "approve" | "reject";
  reason: string;
}

export function validateDecision(body: unknown): { ok: boolean; issues: string[]; value?: GateDecisionInput } {
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
  propose(input: {
    caseId: string;
    uid: string;
    title: string;
    service: string;
    severity: "SEV1" | "SEV2";
    team: string;
    runbookId: string;
    runbookTitle: string;
    action: string;
    confidence: number;
    evidence: string[];
  }): GateProposal {
    return db.tx((s) => {
      const seq = s.meta.gateSeq ? Number(s.meta.gateSeq) + 1 : s.gates.length + 1;
      s.meta.gateSeq = String(seq);
      const g: GateProposal = {
        id: `gate-${input.caseId}-${seq}`,
        caseId: input.caseId,
        uid: input.uid,
        title: input.title,
        service: input.service,
        severity: input.severity,
        team: input.team,
        runbookId: input.runbookId,
        runbookTitle: input.runbookTitle,
        action: input.action,
        confidence: input.confidence,
        evidence: input.evidence,
        status: "pending",
      };
      s.gates.push(g);
      return g;
    });
  },
  decide(session: Session | null, gateId: string, input: GateDecisionInput, requestId: string): GateProposal {
    if (!session) throw new ApiError(401, "AUTH_REQUIRED", "Sign in to act on a gate.", requestId);
    if (session.role !== "reviewer") {
      audit.append({ actor: session.name, action: "gate.decide", target: gateId, outcome: "denied", detail: `role=${session.role} lacks 'reviewer'`, requestId });
      obs.log("warn", `403 denied · ${session.name} (${session.role}) tried gate.decide`, requestId);
      throw new ApiError(403, "FORBIDDEN", "Viewer role cannot approve or reject pages.", requestId);
    }
    const gate = db.read().gates.find((g) => g.id === gateId);
    if (!gate) throw new ApiError(404, "GATE_NOT_FOUND", `No gate ${gateId}.`, requestId);
    if (gate.status !== "pending")
      throw new ApiError(409, "ALREADY_DECIDED", `Gate settled ${gate.status} by ${gate.decidedBy} — decisions are immutable.`, requestId);

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
      target: `${gateId} → oncall(${updated.team})`,
      outcome: "ok",
      detail: input.reason.trim() || "approved without comment",
      requestId,
    });
    obs.countDecision();
    obs.log("info", `${input.decision === "approve" ? "approved" : "rejected"} ${gateId} · ${session.name}`, requestId);
    notifyGates();
    return updated;
  },
};

/* ---------------- transport facade (api/v1) ---------------- */

let chaos = String((import.meta as { env?: Record<string, string> }).env?.VITE_CHAOS_DEFAULT ?? "false") === "true";
if (chaos) degraded = true;
let counter = 0;

const READ_ONLY_UNDER_CHAOS = new Set(["GET /v1/health", "GET /v1/logs"]);
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export interface CallOpts {
  body?: unknown;
  session?: Session | null;
}

export async function call<T>(method: string, path: string, opts: CallOpts = {}): Promise<Envelope<T>> {
  counter += 1;
  const requestId = `req_${String(counter).padStart(4, "0")}_${Math.random().toString(36).slice(2, 7)}`;
  const started = performance.now();
  const route = `${method} ${path}`;

  await sleep(90 + Math.random() * 200);
  obs.countRequest(performance.now() - started);
  obs.log("info", `→ ${route}`, requestId);

  if (chaos && !READ_ONLY_UNDER_CHAOS.has(route)) {
    const err = new ApiError(503, "STORAGE_OFFLINE", "Persistence layer unreachable (chaos mode).", requestId);
    obs.countError(err.message);
    obs.log("error", `✗ ${route} → 503 ${err.code}`, requestId);
    throw err;
  }

  try {
    const data = handle(method, path, opts, requestId) as T;
    obs.log("info", `✓ ${route} → 200 (${Math.round(performance.now() - started)}ms)`, requestId);
    return { requestId, latencyMs: Math.round(performance.now() - started), data };
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.status >= 500) obs.countError(e.message);
      obs.log("error", `✗ ${route} → ${e.status} ${e.code}`, requestId);
      throw e;
    }
    const wrapped = new ApiError(500, "INTERNAL", "Unexpected server error.", requestId);
    obs.countError("INTERNAL");
    obs.log("error", `✗ ${route} → 500 INTERNAL`, requestId);
    throw wrapped;
  }
}

function handle(method: string, path: string, opts: CallOpts, requestId: string): unknown {
  const route = `${method} ${path}`;
  const session = opts.session ?? null;

  if (route === "GET /v1/health") return obs.health();
  if (route === "GET /v1/logs") return obs.tail(60);

  const triageMatch = path.match(/^\/v1\/triage\/([\w-]+)$/);
  if (method === "GET" && triageMatch) return triage.propose(triageMatch[1], requestId);

  if (route === "GET /v1/gates") return gates.list();
  const decisionMatch = path.match(/^\/v1\/gates\/([\w-]+)\/decisions$/);
  if (method === "POST" && decisionMatch) {
    const v = validateDecision(opts.body);
    if (!v.ok) throw new ApiError(422, "VALIDATION_FAILED", "Decision rejected by validation.", requestId, v.issues);
    return gates.decide(session, decisionMatch[1], v.value!, requestId);
  }

  if (route === "GET /v1/audit") return audit.list();

  if (route === "POST /v1/sessions") {
    const b = (opts.body ?? {}) as { reviewerId?: string };
    if (typeof b.reviewerId !== "string" || !b.reviewerId)
      throw new ApiError(422, "VALIDATION_FAILED", "reviewerId is required.", requestId, ["reviewerId must be a non-empty string"]);
    return sessions.start(b.reviewerId, requestId);
  }
  const sessionMatch = path.match(/^\/v1\/sessions\/([\w-]+)$/);
  if (method === "GET" && sessionMatch) {
    const s = db.read().sessions.find((x) => x.id === sessionMatch[1]);
    if (!s) throw new ApiError(401, "SESSION_EXPIRED", "Session not found — sign in again.", requestId);
    return s;
  }
  if (method === "DELETE" && sessionMatch) {
    sessions.end(sessionMatch[1], requestId);
    return { ended: true };
  }

  throw new ApiError(404, "ROUTE_NOT_FOUND", `No route for ${route}.`, requestId);
}
