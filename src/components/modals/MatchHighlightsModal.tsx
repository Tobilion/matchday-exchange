import { Fixture, Team } from "../../types";
import { buildHighlightsReel, HighlightMoment } from "../../utils/highlightsUtils";
import { calculateMOTM } from "../../utils/motmUtils";
import { TeamCrest } from "../TeamCrest";

interface MatchHighlightsModalProps {
  fixture: Fixture;
  teams: Team[];
  onClose: () => void;
}

const STRIPE_COLORS: Record<HighlightMoment["type"], string> = {
  GOAL: "border-emerald-400",
  PENALTY: "border-emerald-400",
  RED_CARD: "border-red-500",
  MOTM: "border-yellow-400",
};

const TYPE_ICONS: Record<HighlightMoment["type"], string> = {
  GOAL: "⚽",
  PENALTY: "🎯",
  RED_CARD: "🟥",
  MOTM: "⭐",
};

export function MatchHighlightsModal({ fixture, teams, onClose }: MatchHighlightsModalProps) {
  const home = teams.find((t) => t.id === fixture.homeTeamId);
  const away = teams.find((t) => t.id === fixture.awayTeamId);
  const moments = buildHighlightsReel(fixture);
  const motm = fixture.motm ?? calculateMOTM(fixture, teams);
  const motmTeam = motm ? teams.find((t) => t.id === motm.teamId) : undefined;

  return (
    <div
      className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-gradient-to-b from-[#131722] to-[#0b0e14] border th-border rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: final scoreline */}
        <div className="p-5 border-b th-border th-inset">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-black tracking-widest th-muted uppercase">
              📋 Match Highlights
            </p>
            <button
              onClick={onClose}
              className="th-muted hover:th-text text-lg font-bold px-2"
              aria-label="Close highlights"
            >
              ✕
            </button>
          </div>
          <div className="flex items-center justify-center gap-4 mt-2">
            <div className="flex items-center gap-2 flex-1 justify-end">
              <span className="text-sm font-bold th-text text-right">{home?.shortName ?? "HOME"}</span>
              {home && <TeamCrest team={home} size={32} />}
            </div>
            <div className="text-3xl font-black font-mono th-text tracking-tight">
              {Math.floor(fixture.homeScore)}–{Math.floor(fixture.awayScore)}
            </div>
            <div className="flex items-center gap-2 flex-1">
              {away && <TeamCrest team={away} size={32} />}
              <span className="text-sm font-bold th-text">{away?.shortName ?? "AWAY"}</span>
            </div>
          </div>
          {fixture.penaltyScore && (
            <p className="text-center text-[11px] text-amber-400 font-mono mt-1">
              Penalties: {fixture.penaltyScore}
            </p>
          )}
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {moments.length === 0 && (
            <p className="text-center text-sm th-muted py-8">
              No major moments in this match.
            </p>
          )}
          {moments.map((m, i) => (
            <div
              key={i}
              className={`flex items-start gap-3 border-l-4 ${STRIPE_COLORS[m.type]} th-wash rounded-r-lg px-3 py-2.5`}
            >
              <span className="shrink-0 th-inset border th-border rounded-md text-[10px] font-black font-mono th-sub px-1.5 py-0.5 mt-0.5">
                {m.minute}'
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold th-text">
                  {TYPE_ICONS[m.type]} {m.playerName}
                </p>
                <p className="text-[11px] th-muted mt-0.5 leading-snug">{m.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* MOTM card */}
        {motm && (
          <div className="p-4 border-t th-border th-inset">
            <div className="flex items-center justify-between bg-yellow-400/10 border border-yellow-400/30 rounded-xl px-4 py-3">
              <div>
                <p className="text-[9px] font-black tracking-widest text-yellow-400 uppercase">
                  ⭐ Man of the Match
                </p>
                <p className="text-sm font-black th-text">{motm.playerName}</p>
                <p className="text-[10px] text-yellow-300/70 font-mono">
                  {motmTeam?.shortName ?? motmTeam?.name ?? ""}
                </p>
                <p className="text-[10px] th-muted font-mono mt-0.5 capitalize">{motm.reason}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black text-yellow-400 font-mono">{motm.score.toFixed(1)}</p>
                <p className="text-[9px] th-muted font-mono uppercase">Rating</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

