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
