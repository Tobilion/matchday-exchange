import type { FootysimMatch } from "./footysimBridge";

// Per-fixture 2D session cache (in-memory, this page load only).
//
// Why a module-level Map and not React state: the viewer's playback index
// advances several times per second, and pushing that through context would
// re-render the whole dashboard. The cache is written when a sim completes
// and when the viewer unmounts (modal closed), and read on open — reopening a
// fixture replays the SAME match instead of simulating a fresh random one.
//
// The cached result is authoritative: when the viewer runs in "official" mode
// (fixture not yet FT), reaching full time applies this exact cached match via
// applyFootysimResult. A new sim is only produced by an explicit user
// re-simulate (which bumps the seed and clears the entry).
export interface FootysimSession {
  seed: number;
  match: FootysimMatch | null;
  idx: number;
  speed: number;
  finished: boolean;
}

const sessions = new Map<string, FootysimSession>();

export const getFootysimSession = (fixtureId: string): FootysimSession | undefined =>
  sessions.get(fixtureId);

export const setFootysimSession = (fixtureId: string, session: FootysimSession): void => {
  sessions.set(fixtureId, session);
};

export const clearFootysimSession = (fixtureId: string): void => {
  sessions.delete(fixtureId);
};

/**
 * Fixture ids (`r0-f0`, `l-r1-f3`) are identical across save slots, so the
 * cache MUST be dropped on slot/mode switch — otherwise a 2D replay cached
 * in slot 1 would play back as slot 2's "same" fixture. Same-class bug as
 * the 2D score drift: two states claiming to be one fact.
 */
export const clearAllFootysimSessions = (): void => {
  sessions.clear();
};

/** Stable per-fixture seed (no rotating session salt): same fixture, same 2D match. */
export const stableFootysimSeed = (fixtureId: string, roundIndex: number): number => {
  let h = 0;
  for (let i = 0; i < fixtureId.length; i++) h = (h * 31 + fixtureId.charCodeAt(i)) >>> 0;
  return ((h + roundIndex * 31) ^ 0x5f3a29) >>> 0;
};
