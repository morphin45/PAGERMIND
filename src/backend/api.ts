import { audit, gates, obs, sessions, triage, validateDecision } from "./services";
import { ApiError, type Envelope, type Session } from "./types";

/**
 * Transport facade for api/v1.
 *
 * Responsibilities: request ids, simulated network latency, chaos/failure
 * injection (for exercising error states), input validation at the boundary,
 * structured errors (never stack traces), request logging + metrics.
 *
 * Route map (documented in docs/ARCHITECTURE.md):
 *   GET    /v1/health
 *   GET    /v1/logs
 *   GET    /v1/gates
 *   POST   /v1/gates/:id/decisions
 *   GET    /v1/audit
 *   POST   /v1/sessions
 *   GET    /v1/sessions/:id
 *   DELETE /v1/sessions/:id
 *   GET    /v1/triage/:caseId
 */

let chaos = String((import.meta as { env?: Record<string, string> }).env?.VITE_CHAOS_DEFAULT ?? "false") === "true";
const chaosListeners = new Set<(on: boolean) => void>();
let counter = 0;

export function setChaos(on: boolean): void {
  chaos = on;
  obs.setDegraded(on);
  obs.log(on ? "warn" : "info", on ? "chaos enabled — storage calls will fail" : "chaos disabled");
  chaosListeners.forEach((fn) => fn(on));
}

export function isChaos(): boolean {
  return chaos;
}

export function onChaos(fn: (on: boolean) => void): () => void {
  chaosListeners.add(fn);
  return () => chaosListeners.delete(fn);
}

const READ_ONLY_UNDER_CHAOS = new Set(["GET /v1/health", "GET /v1/logs"]);

function newRequestId(): string {
  counter += 1;
  return `req_${String(counter).padStart(4, "0")}_${Math.random().toString(36).slice(2, 7)}`;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export interface CallOpts {
  body?: unknown;
  session?: Session | null;
}

export async function call<T>(method: string, path: string, opts: CallOpts = {}): Promise<Envelope<T>> {
  const requestId = newRequestId();
  const started = performance.now();
  const route = `${method} ${path}`;

  await sleep(110 + Math.random() * 260); // simulated network + handler time

  obs.countRequest(performance.now() - started);
  obs.log("info", `→ ${route}`, requestId);

  // Failure injection: everything except health/logs degrades to 503.
  if (chaos && !READ_ONLY_UNDER_CHAOS.has(route)) {
    const err = new ApiError(503, "STORAGE_OFFLINE", "Persistence layer unreachable (chaos mode).", requestId, {
      retryAfterMs: 800,
    });
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
    // Never leak internals across the boundary.
    const wrapped = new ApiError(500, "INTERNAL", "Unexpected server error.", requestId);
    obs.countError("INTERNAL");
    obs.log("error", `✗ ${route} → 500 INTERNAL`, requestId);
    throw wrapped;
  }
}

function handle(method: string, path: string, opts: CallOpts, requestId: string): unknown {
  const route = `${method} ${path}`;
  const session = opts.session ?? null;

  // ---- health & observability (public)
  if (route === "GET /v1/health") {
    const h = obs.health();
    return { ...h, status: chaos ? "degraded" : h.status };
  }
  if (route === "GET /v1/logs") return obs.tail(60);

  // ---- triage (public read of the deterministic agent)
  const triageMatch = path.match(/^\/v1\/triage\/([\w-]+)$/);
  if (method === "GET" && triageMatch) return triage.propose(triageMatch[1], requestId);

  // ---- gates
  if (route === "GET /v1/gates") return gates.list();
  const decisionMatch = path.match(/^\/v1\/gates\/([\w-]+)\/decisions$/);
  if (method === "POST" && decisionMatch) {
    const v = validateDecision(opts.body);
    if (!v.ok) {
      throw new ApiError(422, "VALIDATION_FAILED", "Decision rejected by validation.", requestId, {
        issues: v.issues,
      });
    }
    return gates.decide(session, decisionMatch[1], v.value!, requestId);
  }

  // ---- audit
  if (route === "GET /v1/audit") return audit.list();

  // ---- sessions
  if (route === "POST /v1/sessions") {
    const b = (opts.body ?? {}) as { reviewerId?: string };
    if (typeof b.reviewerId !== "string" || !b.reviewerId) {
      throw new ApiError(422, "VALIDATION_FAILED", "reviewerId is required.", requestId, {
        issues: ["reviewerId must be a non-empty string"],
      });
    }
    return sessions.start(b.reviewerId, requestId);
  }
  const sessionMatch = path.match(/^\/v1\/sessions\/([\w-]+)$/);
  if (method === "GET" && sessionMatch) return sessions.get(sessionMatch[1], requestId);
  if (method === "DELETE" && sessionMatch) {
    sessions.end(sessionMatch[1], requestId);
    return { ended: true };
  }

  throw new ApiError(404, "ROUTE_NOT_FOUND", `No route for ${route}.`, requestId);
}
