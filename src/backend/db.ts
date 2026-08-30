import type { AuditEntry, GateProposal, Session } from "./types";

/**
 * Persistence layer.
 *
 * Single-document store (one JSON blob) keyed by schema version, so every
 * write is atomic from the reader's point of view. Ships at schema v1 with a
 * migration registry: legacy payloads written by the pre-release prototype
 * (unversioned flat arrays) are migrated on first read, exactly like a
 * database migration at boot.
 *
 * Falls back to an in-memory store when localStorage is unavailable
 * (private browsing quotas, SSR, vitest) and reports the mode via health().
 */

export interface SchemaV1 {
  v: 1;
  createdAt: string;
  migratedFrom?: number;
  sessions: Session[];
  gates: GateProposal[];
  audit: AuditEntry[];
  meta: Record<string, string>;
}

const KEY = "pagermind.db";
export const SCHEMA_VERSION = 1;

let memoryBlob: string | null = null;
let storageMode: "localStorage" | "memory" = "localStorage";

function canUseLocalStorage(): boolean {
  try {
    const probe = "__pm_probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

function fresh(): SchemaV1 {
  return {
    v: 1,
    createdAt: new Date().toISOString(),
    sessions: [],
    gates: [],
    audit: [],
    meta: {},
  };
}

/** Migration registry: migrateFromVersion → transform. */
const MIGRATIONS: Record<number, (raw: unknown) => SchemaV1> = {
  // v0: prototype shape — { gates: [...], audit: [...] } without version tag.
  0: (raw) => {
    const legacy = (raw ?? {}) as { gates?: GateProposal[]; audit?: AuditEntry[] };
    const next = fresh();
    next.migratedFrom = 0;
    next.gates = Array.isArray(legacy.gates) ? legacy.gates : [];
    next.audit = Array.isArray(legacy.audit) ? legacy.audit.map((a, i) => ({ ...a, seq: i + 1 })) : [];
    return next;
  },
};

function normalize(raw: unknown): SchemaV1 {
  if (raw === null || raw === undefined) return fresh();
  if (typeof raw !== "object") return fresh();
  const obj = raw as { v?: number };
  if (obj.v === SCHEMA_VERSION) return raw as SchemaV1;
  const from = typeof obj.v === "number" ? obj.v : 0;
  const migrate = MIGRATIONS[from];
  if (!migrate) return fresh(); // unknown/future schema: fail closed, reseed
  return migrate(raw);
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
  /** Read-modify-write in one critical section. */
  tx<T>(mutate: (schema: SchemaV1) => T): T {
    let schema: SchemaV1;
    try {
      schema = normalize(JSON.parse(readRaw() ?? "null"));
    } catch {
      schema = fresh(); // corrupted payload: reseed rather than crash
    }
    const result = mutate(schema);
    writeRaw(JSON.stringify(schema));
    return result;
  },

  read(): SchemaV1 {
    return this.tx((s) => s);
  },

  /** Test/debug hook — wipes the store. Never callable from the UI. */
  reset(): void {
    writeRaw(JSON.stringify(fresh()));
  },

  mode(): "localStorage" | "memory" {
    return storageMode;
  },

  schemaVersion(): number {
    return SCHEMA_VERSION;
  },
};
