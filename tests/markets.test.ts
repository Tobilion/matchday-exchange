/**
 * New-markets test suite (Phase 3): settlement, matrix consistency, and the
 * mutual-exclusivity proof for TEAM_TOTAL_GOALS / CLEAN_SHEET / WIN_TO_NIL /
 * RESULT_BTTS / HT_FT. Run with: npx vitest run tests/markets.test.ts
 */
import { describe, it, expect } from "vitest";
import { didSelectionWin } from "../src/utils/betSettlement";
import { validateBetBuilderSelections } from "../src/utils/betBuilderUtils";
import { dedupeForAccumulator, marketGroupKey, validateSinglesNoArbitrage } from "../src/utils/betSlipUtils";
import { computeMatchOdds } from "../src/engine/oddsEngine";
import type { BetSelection, Fixture, Team } from "../src/types";

function fx(over: Partial<Fixture> = {}): Fixture {
  return {
    id: "f1", homeTeamId: "h", awayTeamId: "a", roundIndex: 0, status: "FT",
    homeScore: 1, awayScore: 1, currentMinute: 90, elapsedTicks: 0,
    events: [], odds: { exactScores: [] } as any, weather: "CLEAR" as any,
    stats: {
      home: { corners: 4, yellowCards: 1, redCards: 0, saves: 3, shots: 5, shotsOnTarget: 3, fouls: 5, possession: 50 },
      away: { corners: 3, yellowCards: 2, redCards: 1, saves: 2, shots: 4, shotsOnTarget: 2, fouls: 6, possession: 50 },
    } as any,
    ...over,
  } as Fixture;
}
function sel(marketType: string, selectionId: string, odds = 2): BetSelection {
  return { fixtureId: "f1", marketType: marketType as any, selectionId, odds, details: "", marketName: "" };
}
const goal = (minute: number, teamId: string, playerId = "p1") =>
  ({ minute, type: "GOAL", teamId, playerId, playerName: "P", commentary: "" } as any);

describe("new-market settlement", () => {
  it("team totals resolve per side", () => {
    const f = fx({ homeScore: 2, awayScore: 1 });
    expect(didSelectionWin(sel("TEAM_TOTAL_GOALS", "HOME_OVER_1.5"), f)).toBe(true);
    expect(didSelectionWin(sel("TEAM_TOTAL_GOALS", "HOME_OVER_2.5"), f)).toBe(false);
    expect(didSelectionWin(sel("TEAM_TOTAL_GOALS", "AWAY_UNDER_1.5"), f)).toBe(true);
    expect(didSelectionWin(sel("TEAM_TOTAL_GOALS", "AWAY_OVER_0.5"), f)).toBe(true);
  });

  it("clean sheets", () => {
    const f = fx({ homeScore: 2, awayScore: 0 });
    expect(didSelectionWin(sel("CLEAN_SHEET", "HOME_YES"), f)).toBe(true);
    expect(didSelectionWin(sel("CLEAN_SHEET", "HOME_NO"), f)).toBe(false);
    expect(didSelectionWin(sel("CLEAN_SHEET", "AWAY_YES"), f)).toBe(false);
    expect(didSelectionWin(sel("CLEAN_SHEET", "AWAY_NO"), f)).toBe(true);
  });

  it("win to nil", () => {
    expect(didSelectionWin(sel("WIN_TO_NIL", "HOME"), fx({ homeScore: 2, awayScore: 0 }))).toBe(true);
    expect(didSelectionWin(sel("WIN_TO_NIL", "HOME"), fx({ homeScore: 2, awayScore: 1 }))).toBe(false);
    expect(didSelectionWin(sel("WIN_TO_NIL", "AWAY"), fx({ homeScore: 0, awayScore: 1 }))).toBe(true);
    expect(didSelectionWin(sel("WIN_TO_NIL", "AWAY"), fx({ homeScore: 1, awayScore: 1 }))).toBe(false);
  });

  it("result + BTTS combos", () => {
    expect(didSelectionWin(sel("RESULT_BTTS", "HOME_YES"), fx({ homeScore: 2, awayScore: 1 }))).toBe(true);
    expect(didSelectionWin(sel("RESULT_BTTS", "HOME_NO"), fx({ homeScore: 2, awayScore: 0 }))).toBe(true);
    expect(didSelectionWin(sel("RESULT_BTTS", "HOME_YES"), fx({ homeScore: 2, awayScore: 0 }))).toBe(false);
    expect(didSelectionWin(sel("RESULT_BTTS", "DRAW_YES"), fx({ homeScore: 1, awayScore: 1 }))).toBe(true);
    expect(didSelectionWin(sel("RESULT_BTTS", "DRAW_NO"), fx({ homeScore: 0, awayScore: 0 }))).toBe(true);
    expect(didSelectionWin(sel("RESULT_BTTS", "AWAY_YES"), fx({ homeScore: 1, awayScore: 2 }))).toBe(true);
  });

  it("HT/FT uses half-time (min<=45) vs full-time sides", () => {
    const f = fx({
      homeScore: 2, awayScore: 1,
      events: [goal(10, "h"), goal(50, "h"), goal(80, "a")],
    });
    expect(didSelectionWin(sel("HT_FT", "HH"), f)).toBe(true);
    expect(didSelectionWin(sel("HT_FT", "DH"), f)).toBe(false);
    expect(didSelectionWin(sel("HT_FT", "HA"), f)).toBe(false);
    const f2 = fx({ homeScore: 1, awayScore: 0, events: [goal(60, "h")] });
    expect(didSelectionWin(sel("HT_FT", "DH"), f2)).toBe(true);
  });

  it("'any other' buckets catch unlisted scorelines only", () => {
    const listed = { exactScores: [{ score: "1-0", odds: 8 }, { score: "0-0", odds: 9 }] } as any;
    expect(didSelectionWin(sel("EXACT_SCORE", "ANY_HOME"), fx({ homeScore: 5, awayScore: 4, odds: listed }))).toBe(true);
    expect(didSelectionWin(sel("EXACT_SCORE", "ANY_HOME"), fx({ homeScore: 1, awayScore: 0, odds: listed }))).toBe(false);
    expect(didSelectionWin(sel("EXACT_SCORE", "ANY_DRAW"), fx({ homeScore: 3, awayScore: 3, odds: listed }))).toBe(true);
    expect(didSelectionWin(sel("EXACT_SCORE", "ANY_AWAY"), fx({ homeScore: 0, awayScore: 4, odds: listed }))).toBe(true);
  });
});

// Minimal sides for pricing probes (even strength).
function probeTeam(id: string): Team {
  const mk = (n: number, position: "GK" | "DEF" | "MID" | "ATT") => ({
    id: `${id}-p${n}`, name: `P${n}`, teamId: id, position, rating: 75, age: 25,
    fatigue: 0, injured: false, injuryRecoveryMatches: 0,
    seasonStats: { goalsScored: 0, assists: 0, yellowCards: 0, redCards: 0, matchesPlayed: 5, cleanSheets: 0 },
    goals: 0, assists: 0, saves: 0, yellowCards: 0, redCards: 0, matchesPlayed: 5,
  });
  const players = [mk(1, "GK"), mk(2, "DEF"), mk(3, "DEF"), mk(4, "DEF"), mk(5, "DEF"),
    mk(6, "MID"), mk(7, "MID"), mk(8, "MID"), mk(9, "ATT"), mk(10, "ATT"), mk(11, "ATT")];
  return {
    id, name: id, shortName: id, rating: 75, primaryColor: "#fff", secondaryColor: "#000",
    players, wonMatches: 0, drawnMatches: 0, lostMatches: 0,
    goalsScored: 0, goalsConceded: 0, morale: 50, rivalClubIds: [],
  } as unknown as Team;
}
const implied = (odds: number): number => 1 / (odds * 1.08);

describe("matrix consistency (one model, never disagrees)", () => {
  const o = computeMatchOdds(probeTeam("h"), probeTeam("a"), []);
  it("P(under 0.5) equals P(exact 0-0)", () => {
    const under05 = o.overUnder.under0_5;
    const nilNil = o.exactScores.find((s) => s.score === "0-0")!.odds;
    expect(under05).toBe(nilNil);
  });
  it("team-total over/under implies ~1.0 combined", () => {
    // Loose tolerance: over/under are priced from complementary probabilities,
    // so any gap is purely 2-decimal rounding (amplified at long odds).
    for (const t of o.teamTotals!) {
      expect(Math.abs(implied(t.over) + implied(t.under) - 1)).toBeLessThan(0.06);
    }
  });
  it("result+BTTS and HT/FT cells tile ~1.0", () => {
    const rb = o.resultBtts!.reduce((s, r) => s + implied(r.odds), 0);
    expect(Math.abs(rb - 1)).toBeLessThan(0.06);
    const hf = o.htFt!.reduce((s, r) => s + implied(r.odds), 0);
    expect(Math.abs(hf - 1)).toBeLessThan(0.08);
  });
  it("expanded lines + any-other buckets exist", () => {
    const scores = o.exactScores.map((s) => s.score);
    for (const s of ["4-0", "0-4", "3-3", "4-3", "ANY_HOME", "ANY_DRAW", "ANY_AWAY"]) {
      expect(scores).toContain(s);
    }
  });
});

describe("mutual exclusivity stays airtight", () => {
  it("result-family shares one group key; totals/sheets split by side+line", () => {
    const home = sel("MATCH_WINNER", "HOME");
    const away = sel("MATCH_WINNER", "AWAY");
    expect(marketGroupKey(home)).toBe(marketGroupKey(away));
    expect(marketGroupKey(home)).toBe(marketGroupKey(sel("HT_FT", "HH")));
    expect(marketGroupKey(home)).toBe(marketGroupKey(sel("WIN_TO_NIL", "HOME")));
    expect(marketGroupKey(home)).toBe(marketGroupKey(sel("RESULT_BTTS", "HOME_YES")));
    expect(marketGroupKey(home)).not.toBe(marketGroupKey(sel("TEAM_TOTAL_GOALS", "HOME_OVER_1.5")));
    expect(marketGroupKey(sel("TEAM_TOTAL_GOALS", "HOME_OVER_1.5")))
      .toBe(marketGroupKey(sel("TEAM_TOTAL_GOALS", "HOME_UNDER_1.5")));
    expect(marketGroupKey(sel("TEAM_TOTAL_GOALS", "HOME_OVER_1.5")))
      .not.toBe(marketGroupKey(sel("TEAM_TOTAL_GOALS", "HOME_OVER_2.5")));
    expect(marketGroupKey(sel("TEAM_TOTAL_GOALS", "HOME_OVER_1.5")))
      .not.toBe(marketGroupKey(sel("TEAM_TOTAL_GOALS", "AWAY_OVER_1.5")));
    expect(marketGroupKey(sel("CLEAN_SHEET", "HOME_YES")))
      .toBe(marketGroupKey(sel("CLEAN_SHEET", "HOME_NO")));
    expect(marketGroupKey(sel("CLEAN_SHEET", "HOME_YES")))
      .not.toBe(marketGroupKey(sel("CLEAN_SHEET", "AWAY_YES")));
  });

  it("acca dedupe drops same-match conflicts but keeps compatible same-game legs", () => {
    const { kept, dropped } = dedupeForAccumulator([
      sel("MATCH_WINNER", "HOME"), sel("MATCH_WINNER", "AWAY"),
      sel("TEAM_TOTAL_GOALS", "HOME_OVER_1.5"), sel("CLEAN_SHEET", "AWAY_NO"),
    ]);
    expect(kept.length).toBe(3);
    expect(dropped.length).toBe(1);
    expect(dropped[0].selectionId).toBe("HOME");
  });

  it("singles arbitrage guard covers the new result markets", () => {
    expect(validateSinglesNoArbitrage([sel("MATCH_WINNER", "HOME"), sel("HT_FT", "HH")])).not.toBeNull();
    expect(validateSinglesNoArbitrage([sel("MATCH_WINNER", "HOME"), sel("TEAM_TOTAL_GOALS", "HOME_OVER_1.5")])).toBeNull();
  });

  it("builder validation: one outcome, one per team-total line, one sheet per side", () => {
    const b = (m: string, s: string) => ({ marketType: m, selectionId: s, odds: 2, label: s }) as any;
    expect(validateBetBuilderSelections([b("MATCH_WINNER", "HOME"), b("HT_FT", "HH")])).not.toBeNull();
    expect(validateBetBuilderSelections([b("TEAM_TOTAL_GOALS", "HOME_OVER_1.5"), b("TEAM_TOTAL_GOALS", "HOME_UNDER_1.5")])).not.toBeNull();
    expect(validateBetBuilderSelections([b("TEAM_TOTAL_GOALS", "HOME_OVER_1.5"), b("TEAM_TOTAL_GOALS", "HOME_OVER_2.5")])).toBeNull();
    expect(validateBetBuilderSelections([b("CLEAN_SHEET", "HOME_YES"), b("CLEAN_SHEET", "HOME_NO")])).not.toBeNull();
    expect(validateBetBuilderSelections([b("CLEAN_SHEET", "HOME_YES"), b("CLEAN_SHEET", "AWAY_YES")])).toBeNull();
    expect(validateBetBuilderSelections([b("MATCH_WINNER", "HOME"), b("TEAM_TOTAL_GOALS", "HOME_OVER_1.5")])).toBeNull();
  });
});
