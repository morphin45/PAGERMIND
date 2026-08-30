import { CASES, type IncidentCase } from "../data/incidents";

/**
 * Live incident simulator — the product's heartbeat.
 * Replays the same 12-case evaluation set as a continuous alert stream so the
 * workstation behaves like a real on-call console. Deterministic deck order
 * per round (seeded shuffle), only arrival jitter varies.
 */

export interface SimIncident {
  uid: string; // INC-2201·r2
  round: number;
  c: IncidentCase;
  arrivedAt: string; // sim clock, HH:MM:SS
  status: "queued" | "triaging" | "auto" | "gate" | "paged" | "rejected";
  gateId?: string;
}

/** Seedable PRNG so the deck order is reproducible. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createDeck(round: number): IncidentCase[] {
  const rand = mulberry32(0x2201 + round);
  const deck = [...CASES];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export const nextArrivalDelay = (speed: 1 | 4) => (5200 + Math.random() * 2600) / speed;
export const TRIAGE_MS = 1400;

let simClock = 3 * 3600 + 7 * 60 + 41; // start at 03:07:41 — the witching hour

export function tickClock(seconds: number): string {
  simClock = (simClock + seconds) % 86400;
  const p = (n: number) => String(n).padStart(2, "0");
  const h = Math.floor(simClock / 3600);
  const m = Math.floor((simClock % 3600) / 60);
  return `${p(h)}:${p(m)}:${p(simClock % 60)}`;
}

export function resetClock(): void {
  simClock = 3 * 3600 + 7 * 60 + 41;
}

export function fmtClock(): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(Math.floor(simClock / 3600))}:${p(Math.floor((simClock % 3600) / 60))}:${p(simClock % 60)}`;
}

/* ---------- on-call roster (synthetic) — a fired page must land on a person ---------- */

export interface OnCallEngineer {
  name: string;
  handle: string;
  tz: string;
  shiftEnds: string;
}

const ROSTER: Record<string, OnCallEngineer> = {
  "team-payments": { name: "Dana Reyes", handle: "@dana.reyes", tz: "UTC-5", shiftEnds: "07:00" },
  "team-sre-core": { name: "Omar Haddad", handle: "@omar.h", tz: "UTC+1", shiftEnds: "08:00" },
  "team-sre": { name: "Omar Haddad", handle: "@omar.h", tz: "UTC+1", shiftEnds: "08:00" },
  "team-dba": { name: "Lena Fischer", handle: "@lena.f", tz: "UTC+1", shiftEnds: "06:00" },
  "team-data-etl": { name: "Tomasz Krol", handle: "@tomek.k", tz: "UTC+1", shiftEnds: "07:00" },
  "team-cart": { name: "Priya Natarajan", handle: "@priya.n", tz: "UTC+5:30", shiftEnds: "09:00" },
  "team-search": { name: "Jonas Berg", handle: "@jonas.b", tz: "UTC+1", shiftEnds: "06:00" },
  "team-recsys": { name: "Mina Park", handle: "@mina.p", tz: "UTC+9", shiftEnds: "05:00" },
};

export function onCallFor(team: string): OnCallEngineer {
  return ROSTER[team] ?? { name: "Rotation fallback", handle: "@oncall-fallback", tz: "UTC", shiftEnds: "06:00" };
}
