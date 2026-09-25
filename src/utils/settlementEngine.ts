import { Fixture, MarketType } from "../types";

export type LegResult = "WON" | "LOST" | "PENDING";

export interface SelectionLike {
  marketType: MarketType | string;
  selectionId: string;
}

/**
 * Canonical Over/Under selection-id parser.
 * Accepts both historical shapes: "OVER_2_5" (goals) and "OVER_2.5" (corners/cards/saves).
 * Prefer emitting the dot form ("OVER_2.5") going forward.
 */
export function parseOverUnder(selectionId: string): { mode: "OVER" | "UNDER"; line: number } | null {
  const mode = selectionId.startsWith("OVER_") ? "OVER" : selectionId.startsWith("UNDER_") ? "UNDER" : null;
  if (!mode) return null;
  const line = parseFloat(selectionId.replace(/^(OVER|UNDER)_/, "").replace("_", "."));
  return Number.isFinite(line) ? { mode, line } : null;
}

function overUnderResult(selectionId: string, total: number): LegResult {
  const parsed = parseOverUnder(selectionId);
  if (!parsed) return "LOST";
  if (parsed.mode === "OVER") return total > parsed.line ? "WON" : "LOST";
  return total < parsed.line ? "WON" : "LOST";
}

/**
 * SINGLE SOURCE OF TRUTH for settling one selection against a fixture.
 * Returns PENDING while the fixture has not finished.
 */
export function resolveSelection(sel: SelectionLike, fixture: Fixture): LegResult {
  if (fixture.status !== "FT") return "PENDING";
  const h = Math.floor(fixture.homeScore);
  const a = Math.floor(fixture.awayScore);

  switch (sel.marketType) {
    case "MATCH_WINNER": {
      const outcome = h > a ? "HOME" : a > h ? "AWAY" : "DRAW";
      return sel.selectionId === outcome ? "WON" : "LOST";
    }
    case "DOUBLE_CHANCE": {
      const outcome = h > a ? "HOME" : a > h ? "AWAY" : "DRAW";
      if (sel.selectionId === "HOME_OR_DRAW") return outcome !== "AWAY" ? "WON" : "LOST";
      if (sel.selectionId === "HOME_OR_AWAY") return outcome !== "DRAW" ? "WON" : "LOST";
      if (sel.selectionId === "DRAW_OR_AWAY") return outcome !== "HOME" ? "WON" : "LOST";
      return "LOST";
    }
    case "BOTH_TEAMS_TO_SCORE": {
      const both = h > 0 && a > 0;
      return (sel.selectionId === "YES") === both ? "WON" : "LOST";
    }
    case "OVER_UNDER_GOALS":
      return overUnderResult(sel.selectionId, h + a);
    case "OVER_UNDER_CORNERS":
      return overUnderResult(
        sel.selectionId,
        (fixture.stats?.home.corners ?? 0) + (fixture.stats?.away.corners ?? 0),
      );
    case "OVER_UNDER_CARDS":
      return overUnderResult(
        sel.selectionId,
        (fixture.stats?.home.yellowCards ?? 0) + (fixture.stats?.home.redCards ?? 0) +
        (fixture.stats?.away.yellowCards ?? 0) + (fixture.stats?.away.redCards ?? 0),
      );
    case "OVER_UNDER_SAVES":
      return overUnderResult(
        sel.selectionId,
        (fixture.stats?.home.saves ?? 0) + (fixture.stats?.away.saves ?? 0),
      );
    case "EXACT_SCORE": {
      if (sel.selectionId === `${h}-${a}`) return "WON";
      // "Any other" buckets: the winning margin class hit, but the exact
      // score is not one of the listed lines in the fixture's stored odds.
      if (sel.selectionId === "ANY_HOME" || sel.selectionId === "ANY_DRAW" || sel.selectionId === "ANY_AWAY") {
        const listed = new Set((fixture.odds?.exactScores ?? []).map((s) => s.score));
        if (listed.has(`${h}-${a}`)) return "LOST";
        const cls = h > a ? "ANY_HOME" : h === a ? "ANY_DRAW" : "ANY_AWAY";
        return sel.selectionId === cls ? "WON" : "LOST";
      }
      return "LOST";
    }
    case "TEAM_TOTAL_GOALS": {
      // selectionId: "HOME_OVER_1.5" | "AWAY_UNDER_2.5"
      const side = sel.selectionId.startsWith("HOME_") ? "HOME" : sel.selectionId.startsWith("AWAY_") ? "AWAY" : null;
      if (!side) return "LOST";
      const parsed = parseOverUnder(sel.selectionId.replace(/^(HOME|AWAY)_/, ""));
      if (!parsed) return "LOST";
      const total = side === "HOME" ? h : a;
      if (parsed.mode === "OVER") return total > parsed.line ? "WON" : "LOST";
      return total < parsed.line ? "WON" : "LOST";
    }
    case "CLEAN_SHEET": {
      // selectionId: "HOME_YES" | "HOME_NO" | "AWAY_YES" | "AWAY_NO"
      const homeClean = a === 0;
      const awayClean = h === 0;
      if (sel.selectionId === "HOME_YES") return homeClean ? "WON" : "LOST";
      if (sel.selectionId === "HOME_NO") return homeClean ? "LOST" : "WON";
      if (sel.selectionId === "AWAY_YES") return awayClean ? "WON" : "LOST";
      if (sel.selectionId === "AWAY_NO") return awayClean ? "LOST" : "WON";
      return "LOST";
    }
    case "WIN_TO_NIL": {
      if (sel.selectionId === "HOME") return h > a && a === 0 ? "WON" : "LOST";
      if (sel.selectionId === "AWAY") return a > h && h === 0 ? "WON" : "LOST";
      return "LOST";
    }
    case "RESULT_BTTS": {
      // selectionId: "HOME_YES" | "HOME_NO" | "DRAW_YES" | ...
      const outcome = h > a ? "HOME" : a > h ? "AWAY" : "DRAW";
      const btts = h > 0 && a > 0 ? "YES" : "NO";
      return sel.selectionId === `${outcome}_${btts}` ? "WON" : "LOST";
    }
    case "HT_FT": {
      // selectionId: "HH" | "HD" | ... FT side = regulation outcome (same as
      // MATCH_WINNER, ET counts); HT side = goals with minute <= 45.
      const htH = fixture.events.filter((ev) => ev.type === "GOAL" && ev.minute <= 45 && ev.teamId === fixture.homeTeamId).length;
      const htA = fixture.events.filter((ev) => ev.type === "GOAL" && ev.minute <= 45 && ev.teamId === fixture.awayTeamId).length;
      const side = (x: number, y: number): string => (x > y ? "H" : x === y ? "D" : "A");
      return sel.selectionId === `${side(htH, htA)}${side(h, a)}` ? "WON" : "LOST";
    }
    case "ANYTIME_GOALSCORER":
      return fixture.events.some((ev) => ev.type === "GOAL" && ev.playerId === sel.selectionId)
        ? "WON" : "LOST";
    default:
      return "LOST";
  }
}
