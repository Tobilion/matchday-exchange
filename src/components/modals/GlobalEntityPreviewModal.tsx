import React, { useState } from "react";
import { TeamCrest } from "../TeamCrest";
import { Fixture, Team } from "../../types";
import { cleanPlayerName } from "../../utils/playerUtils";
import { getTeamForm } from "../../utils/formUtils";
import { calculatePlayerValue } from "../../engine/transferEngine";

interface GlobalEntityPreviewModalProps {
  globalEntity: { type: "team" | "player"; id: string };
  teams: Team[];
  fixtures?: Fixture[];
  onClose: () => void;
  onChangeEntity: (entity: { type: "team" | "player"; id: string }) => void;
  onNavigateToTeams: () => void;
}

// Sorare-style scarcity tiers by overall rating. Visual identity only —
// no gameplay effect.
const tierOf = (rating: number): "gold" | "emerald" | "sky" =>
  rating >= 85 ? "gold" : rating >= 75 ? "emerald" : "sky";
const TIER_STYLES: Record<string, { ring: string; text: string; glow: string; label: string }> = {
  gold: { ring: "bg-amber-500/10 border-amber-500/40", text: "text-amber-400", glow: "shadow-[0_0_15px_rgba(245,158,11,0.18)]", label: "GOLD" },
  emerald: { ring: "bg-emerald-500/10 border-emerald-500/30", text: "text-[#10b981]", glow: "shadow-[0_0_15px_rgba(16,185,129,0.12)]", label: "EMERALD" },
  sky: { ring: "bg-sky-500/10 border-sky-500/30", text: "text-sky-400", glow: "shadow-[0_0_15px_rgba(56,189,248,0.12)]", label: "STANDARD" },
};

export const GlobalEntityPreviewModal: React.FC<GlobalEntityPreviewModalProps> = ({
  globalEntity,
  teams,
  fixtures = [],
  onClose,
  onChangeEntity,
  onNavigateToTeams
}) => {
  const [globalPlayerTab, setGlobalPlayerTab] = useState<"stats" | "qualities">("stats");
  const [expandGlobalEntity, setExpandGlobalEntity] = useState<boolean>(false);

  const foundPlayer = globalEntity.type === "player"
    ? teams.flatMap(t => t.players).find(p => p.id === globalEntity.id)
    : null;
  const foundPlayerTeam = foundPlayer
    ? teams.find(t => t.id === foundPlayer.teamId)
    : null;
  const foundTeam = globalEntity.type === "team"
    ? teams.find(t => t.id === globalEntity.id)
    : null;

  if (globalEntity.type === "player" && !foundPlayer) return null;
  if (globalEntity.type === "team" && !foundTeam) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-fade-in overflow-y-auto cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative glass-panel-heavy border border-white/10 rounded-3xl p-6 max-w-sm w-full mx-auto my-auto shadow-2xl space-y-6 flex flex-col items-center select-none text-center cursor-default"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white h-9 w-9 rounded-full flex items-center justify-center cursor-pointer text-xs transition-all border border-white/5"
        >
          ✕
        </button>

        {foundPlayer && (() => {
          const tier = TIER_STYLES[tierOf(foundPlayer.rating)];
          const marketValue = foundPlayerTeam ? calculatePlayerValue(foundPlayer, foundPlayerTeam) : null;
          const apps = Math.max(1, foundPlayer.matchesPlayed || 0);
          const involvement = ((foundPlayer.goals || 0) + (foundPlayer.assists || 0)) / apps;
          const isProspect = (foundPlayer.potential ?? 0) > foundPlayer.rating + 5;
          const motmCount = fixtures.filter((f) => f.motm?.playerId === foundPlayer.id).length;
          return (
          <div className="w-full flex flex-col items-center space-y-4">
            {/* Player card header — tier identity (gold/emerald/standard) */}
            <div className="flex flex-col items-center">
              <div className={`h-11 w-11 ${tier.ring} border rounded-2xl flex items-center justify-center text-xl mb-1 shadow-md animate-pulse`}>
                🏃
              </div>
              <p className={`text-[10px] font-mono tracking-widest ${tier.text} font-extrabold uppercase`}>
                {tier.label} · CHAMPIONSHIP PLAYER CARD
              </p>
              <h3 className="text-lg font-black text-slate-100 tracking-tight leading-tight mt-1 truncate max-w-[240px]">
                {cleanPlayerName(foundPlayer.name)}
              </h3>
              <div className="flex items-center gap-1.5 mt-1.5 justify-center flex-wrap">
                <span className="px-2 py-0.5 bg-white/5 border border-white/10 rounded text-[9px] font-mono text-[#10b981] font-bold">
                  {foundPlayer.position}
                </span>
                <span className="px-2 py-0.5 bg-white/5 border border-white/10 rounded text-[9px] font-mono text-slate-300 font-bold">
                  AGE {foundPlayer.age}
                </span>
                {foundPlayer.injured && (
                  <span className="px-2 py-0.5 bg-red-500/15 border border-red-500/40 rounded text-[9px] font-mono text-red-400 font-bold">
                    INJ
                  </span>
                )}
                {(foundPlayer.suspendedRounds ?? 0) > 0 && (
                  <span className="px-2 py-0.5 bg-red-500/15 border border-red-500/40 rounded text-[9px] font-mono text-red-400 font-bold">
                    SUSP
                  </span>
                )}
                {foundPlayer.isReserve && (
                  <span className="px-2 py-0.5 bg-white/5 border border-white/10 rounded text-[9px] font-mono text-slate-400 font-bold">
                    RES
                  </span>
                )}
                {isProspect && (
                  <span className="px-2 py-0.5 bg-amber-500/15 border border-amber-500/40 rounded text-[9px] font-mono text-amber-300 font-bold">
                    🌟 PROSPECT
                  </span>
                )}
                {motmCount > 0 && (
                  <span className="px-2 py-0.5 bg-emerald-500/15 border border-emerald-500/40 rounded text-[9px] font-mono text-emerald-300 font-bold">
                    🏆 MOTM ×{motmCount}
                  </span>
                )}
                {foundPlayerTeam && (
                  <>
                    <span className="text-slate-600">•</span>
                    <span className="text-slate-300 font-bold text-xs flex items-center gap-1">
                      <TeamCrest team={foundPlayerTeam} size={16} />
                      {foundPlayerTeam.name}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Selector Tabs */}
            <div className="w-full grid grid-cols-2 border-b border-white/5 text-xs font-bold leading-none select-none">
              <button
                type="button"
                onClick={() => setGlobalPlayerTab("stats")}
                className={`py-2 border-b-2 text-center transition-all cursor-pointer font-bold ${
                  globalPlayerTab === "stats"
                    ? "border-emerald-500 text-emerald-400 font-black"
                    : "border-transparent text-slate-400 hover:text-white font-medium"
                }`}
              >
                SEASON STATS
              </button>
              <button
                type="button"
                onClick={() => setGlobalPlayerTab("qualities")}
                className={`py-2 border-b-2 text-center transition-all cursor-pointer ${
                  globalPlayerTab === "qualities"
                    ? "border-emerald-500 text-emerald-400 font-black"
                    : "border-transparent text-slate-400 hover:text-white font-medium"
                }`}
              >
                TECHNICAL QUALITIES
              </button>
            </div>

            {/* Render content */}
            {globalPlayerTab === "stats" ? (
              <div className="w-full space-y-3 animate-fade-in block">
                {/* Overall badge — tier identity */}
                <div className={`h-16 w-16 mx-auto rounded-full border ${tier.ring} ${tier.glow} flex flex-col items-center justify-center`}>
                  <span className="text-slate-500 font-mono text-[7px] font-bold uppercase leading-none">OVR</span>
                  <span className={`text-xl font-black font-mono ${tier.text} leading-none mt-0.5`}>
                    {foundPlayer.rating}
                  </span>
                </div>

                {/* Performance stats grid */}
                <div className="w-full bg-black/40 border border-white/5 rounded-xl p-3 grid grid-cols-4 gap-2 text-center text-xs font-mono text-slate-350">
                  <div>
                    <span className="font-black text-slate-205 block">{foundPlayer.matchesPlayed}</span>
                    <span className="text-[8px] text-slate-500 font-bold uppercase block mt-0.5">Played</span>
                  </div>
                  <div>
                    <span className="font-black text-emerald-400 block">{foundPlayer.goals}</span>
                    <span className="text-[8px] text-slate-500 font-bold uppercase block mt-0.5">Goals</span>
                  </div>
                  <div>
                    <span className="font-black text-slate-205 block">
                      {foundPlayer.position === "GK" ? (foundPlayer.saves || 0) : (foundPlayer.assists || 0)}
                    </span>
                    <span className="text-[8px] text-slate-500 font-bold uppercase block mt-0.5">
                      {foundPlayer.position === "GK" ? "Saves" : "Assists"}
                    </span>
                  </div>
                  <div>
                    <span className="font-black text-slate-205 block text-[10px] whitespace-nowrap">
                      🟨{foundPlayer.yellowCards || 0} 🟥{foundPlayer.redCards || 0}
                    </span>
                    <span className="text-[8px] text-slate-500 font-bold uppercase block mt-0.5">Cards</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-full space-y-3 bg-black/20 p-4 rounded-2xl border border-white/5 animate-fade-in text-left block">
                <p className="text-[9px] font-mono tracking-widest text-slate-550 font-black uppercase text-center border-b border-white/5 pb-1.5 mb-2">
                  TECHNICAL CHARACTERISTICS GAUGES
                </p>
                {foundPlayer.abilities ? (
                  Object.entries(foundPlayer.abilities).map(([abilKey, abilVal]) => {
                    const value = abilVal as number;
                    const color = value >= 85 ? "bg-emerald-500" : value >= 75 ? "bg-yellow-500" : "bg-sky-500";
                    const label = abilKey.toUpperCase();
                    return (
                      <div key={abilKey} className="space-y-0.5">
                        <div className="flex justify-between text-[10px] font-mono text-slate-300 leading-none">
                          <span className="font-bold uppercase tracking-wider">{label}</span>
                          <span className="font-extrabold text-slate-105">{value}</span>
                        </div>
                        <div className="h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/5 relative">
                          <div
                            className={`h-full ${color} rounded-full transition-all duration-300`}
                            style={{ width: `${value}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs font-mono text-slate-550 text-center py-2">
                    No specific abilities declared for player.
                  </p>
                )}
              </div>
            )}
            {/* Valuation + output rate strip */}
            <div className="w-full grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-black/40 border border-white/5 px-3 py-2 text-center">
                <p className="text-[8px] font-mono uppercase tracking-widest text-slate-500 font-bold">Market value</p>
                <p className="text-sm font-mono font-black text-emerald-400">
                  {marketValue !== null ? `$${Math.round(marketValue).toLocaleString()}` : "—"}
                </p>
              </div>
              <div className="rounded-xl bg-black/40 border border-white/5 px-3 py-2 text-center">
                <p className="text-[8px] font-mono uppercase tracking-widest text-slate-500 font-bold">Goal involv. / match</p>
                <p className="text-sm font-mono font-black text-slate-100">{involvement.toFixed(2)}</p>
              </div>
            </div>
          </div>
          );})()}

        {foundTeam && (
          <div className="w-full flex flex-col items-center space-y-4">
            {/* Team Profile Header */}
            <div className="flex flex-col items-center">
              <TeamCrest team={foundTeam} size={56} className="mb-1" />
              <p className="text-[10px] font-mono tracking-widest text-emerald-400 font-extrabold uppercase mt-1">
                CHAMPIONSHIP CLUB DOSSIER
              </p>
              <h3 className="text-lg font-black text-slate-100 tracking-tight leading-tight mt-1.5 truncate max-w-[240px]">
                {foundTeam.name}
              </h3>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[10px] text-slate-400 font-mono uppercase font-bold tracking-widest">
                  RATING: {foundTeam.rating.toFixed(1)} Stars
                </span>
              </div>
              {/* Recent form (last 5, most recent last) + locale + last season */}
              {(() => {
                const form = fixtures.length > 0 ? getTeamForm(foundTeam.id, fixtures, 5) : [];
                const lastSeason = foundTeam.seasonHistory?.[foundTeam.seasonHistory.length - 1];
                const locale = [foundTeam.city, foundTeam.country].filter(Boolean).join(", ");
                return (
                  <div className="flex flex-col items-center gap-1.5 mt-2">
                    {form.length > 0 && (
                      <div className="flex items-center gap-1">
                        <span className="text-[8px] font-mono uppercase tracking-widest text-slate-500 font-bold mr-1">Form</span>
                        {form.map((r, i) => (
                          <span key={i} title={r === "W" ? "Win" : r === "D" ? "Draw" : "Loss"}
                            className={`h-4 w-4 rounded-full text-[8px] font-black font-mono flex items-center justify-center ${r === "W" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40" : r === "D" ? "bg-slate-500/20 text-slate-300 border border-white/15" : "bg-red-500/15 text-red-400 border border-red-500/40"}`}>
                            {r}
                          </span>
                        ))}
                      </div>
                    )}
                    {(locale || foundTeam.stadiumName) && (
                      <span className="text-[9px] font-mono text-slate-500">
                        {[foundTeam.stadiumName, locale].filter(Boolean).join(" · ")}
                      </span>
                    )}
                    {lastSeason && (
                      <span className="text-[9px] font-mono text-slate-400">
                        Last season: <span className="text-slate-200 font-bold">P{lastSeason.position}</span>
                        <span className="text-slate-500"> {lastSeason.won}W {lastSeason.drawn}D {lastSeason.lost}L{lastSeason.title ? " 🏆" : ""}</span>
                      </span>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Team Color chips */}
            <div className="flex items-center gap-2 select-none">
              <span className="text-[9px] text-slate-500 uppercase font-mono font-bold">Colors:</span>
              <div className="h-4 w-4 rounded-full border border-white/20" style={{ backgroundColor: foundTeam.primaryColor }} title="Primary Color"></div>
              <div className="h-4 w-4 rounded-full border border-white/20" style={{ backgroundColor: foundTeam.secondaryColor }} title="Secondary Color"></div>
            </div>

            {/* Stats Summary Grid */}
            <div className="w-full bg-black/40 border border-white/5 rounded-xl p-3 grid grid-cols-4 gap-2 text-center text-xs">
              <div>
                <span className="text-xs font-black text-slate-200 font-mono block">
                  {foundTeam.wonMatches}
                </span>
                <span className="text-[9px] text-emerald-450 font-mono font-bold uppercase block mt-0.5">
                  Won
                </span>
              </div>
              <div>
                <span className="text-xs font-black text-slate-200 font-mono block">
                  {foundTeam.drawnMatches || 0}
                </span>
                <span className="text-[9px] text-slate-500 font-mono font-bold uppercase block mt-0.5">
                  Drawn
                </span>
              </div>
              <div>
                <span className="text-xs font-black text-slate-200 font-mono block">
                  {foundTeam.lostMatches}
                </span>
                <span className="text-[9px] text-rose-400 font-mono font-bold uppercase block mt-0.5">
                  Lost
                </span>
              </div>
              <div>
                <span className="text-xs font-black text-slate-200 font-mono block">
                  {foundTeam.goalsScored}
                </span>
                <span className="text-[9px] text-sky-450 font-mono font-bold uppercase block mt-0.5">
                  Goals
                </span>
              </div>
            </div>

            {expandGlobalEntity ? (
              <div className="w-full max-h-[180px] overflow-y-auto space-y-2 bg-black/20 p-2.5 rounded-2xl border border-white/5 text-left no-scrollbar">
                <p className="text-[10px] font-mono tracking-widest text-slate-555 font-black uppercase text-center border-b border-white/5 pb-1 select-none">
                  ACTIVE CLUB SQUAD LISTING ({foundTeam.players.length})
                </p>
                <div className="space-y-1 text-[11px] font-mono">
                  {foundTeam.players.map(p => (
                    <div 
                      key={p.id}
                      onClick={() => {
                        onChangeEntity({ type: "player", id: p.id });
                        setExpandGlobalEntity(false);
                      }}
                      className="flex justify-between items-center py-1.5 px-2 hover:bg-white/5 border border-transparent hover:border-white/5 rounded-lg transition-all cursor-pointer"
                    >
                      <span className="font-semibold text-slate-300 truncate block max-w-[150px]">
                        {cleanPlayerName(p.name)}
                      </span>
                      <div className="flex gap-2 items-center">
                        <span className="text-[8px] bg-slate-800 text-slate-400 font-bold px-1 rounded uppercase">
                          {p.position}
                        </span>
                        <span className="font-extrabold text-emerald-450">
                          {p.rating}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setExpandGlobalEntity(true)}
                className="w-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold font-sans text-xs py-2 px-4 rounded-xl border border-emerald-500/20 transition-all cursor-pointer flex items-center justify-center gap-1 hover:scale-[1.01]"
              >
                👥 EXPAND FULL CLUB ROSTER & RATINGS
              </button>
            )}

            <button
              type="button"
              onClick={onNavigateToTeams}
              className="w-full bg-white/5 hover:bg-white/10 text-slate-300 font-medium font-sans text-xs py-1.5 px-4 rounded-xl border border-white/5 transition-all cursor-pointer hover:scale-[1.01]"
            >
              Stadium 🏟️ OPEN DIRECTLY IN FULL SQUAD COMPARATOR
            </button>
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full bg-emerald-500 text-slate-950 font-black font-sans text-xs py-2 px-4 rounded-xl hover:scale-105 active:scale-100 transition-all cursor-pointer mt-2"
        >
          Close Preview
        </button>
      </div>
    </div>
  );
};
