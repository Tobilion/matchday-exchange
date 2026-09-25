import React, { useState } from "react";
import { Team, Fixture } from "../types";
import { getTeamForm } from "../utils/formUtils";
import { TeamCrest } from "./TeamCrest";
import { ChevronLeft, ChevronRight, Award, Calendar, CheckCircle, HelpCircle } from "lucide-react";

interface LeagueStandingsProps {
  teams: Team[];
  fixtures: Fixture[];
  currentRoundIndex: number;
}

export const LeagueStandings: React.FC<LeagueStandingsProps> = ({
  teams,
  fixtures,
  currentRoundIndex
}) => {
  const [selectedMatchday, setSelectedMatchday] = useState<number>(currentRoundIndex);
  const [inspectedMatch, setInspectedMatch] = useState<Fixture | null>(null);

  React.useEffect(() => {
    setSelectedMatchday(currentRoundIndex);
  }, [currentRoundIndex]);

  // 1. Calculate standing records for all 16 teams
  // Each team has wonMatches, drawnMatches, lostMatches, goalsScored, goalsConceded
  // Let's compute their played, GD, and Points on the fly
  const standings = teams.map((team) => {
    const P = team.wonMatches + team.drawnMatches + team.lostMatches;
    const GD = team.goalsScored - team.goalsConceded;
    const PTS = team.wonMatches * 3 + team.drawnMatches;
    return {
      ...team,
      played: P,
      gd: GD,
      pts: PTS
    };
  });

  // Sort by Points, then Goal Difference, then Goals Scored, then Name
  standings.sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.gd !== a.gd) return b.gd - a.gd;
    if (b.goalsScored !== a.goalsScored) return b.goalsScored - a.goalsScored;
    return a.name.localeCompare(b.name);
  });

  // Filter fixtures for selected matchday
  const matchdayFixtures = fixtures.filter(f => f.roundIndex === selectedMatchday);

  // Helper to trigger global entity modal (handled on window level in existing codebase)
  const triggerEntity = (type: "team" | "player", id: string) => {
    window.dispatchEvent(new CustomEvent("open-global-entity", { detail: { type, id } }));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in flex-1 overflow-y-auto no-scrollbar p-1 pb-16" id="league-standings-section">
      {/* 1. Standings Table Part */}
      <div className="lg:col-span-2 glass-panel border th-border rounded-2xl p-5 flex flex-col space-y-4 shadow-xl select-none">
        <div className="flex items-center justify-between pb-2 border-b th-border">
          <div>
            <h3 className="text-lg font-sans font-medium th-text flex items-center gap-2">
              <Award className="text-emerald-400" size={18} />
              Elite Super League Standings
            </h3>
            <p className="text-xs th-muted mt-1">Real-time standings based on played matchday outcomes</p>
          </div>
          <div className="text-xs font-mono th-acc-soft border th-border-acc text-emerald-400 px-2.5 py-1 rounded-full">
            Matchday {currentRoundIndex + 1} of 15
          </div>
        </div>

        {/* Standings List Table */}
        <div className="overflow-x-auto font-sans">
          <table className="w-full text-left text-sm select-none">
            <thead>
              <tr className="th-muted text-xs font-mono uppercase th-wash border-b th-border">
                <th className="py-2.5 px-3 text-center w-12">Pos</th>
                <th className="py-2.5 px-2">Club</th>
                <th className="py-2.5 px-2 text-center w-12">P</th>
                <th className="py-2.5 px-2 text-center w-10">W</th>
                <th className="py-2.5 px-2 text-center w-10">D</th>
                <th className="py-2.5 px-2 text-center w-10">L</th>
                <th className="py-2.5 px-2 text-center w-16">GD</th>
                <th className="py-2.5 px-3 text-center w-16 text-emerald-400 font-bold">Pts</th>
                <th className="py-2.5 px-3 text-center w-28 th-muted">Form</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {standings.map((team, idx) => {
                const n = standings.length;
                const isCLSpot = idx < 4; // Top 4 → Champions League
                const isELSpot = idx >= 4 && idx < 6; // Next 2 → Europa League
                const isRelegation = idx >= n - 3; // Bottom 3 → relegated

                let rankStyle = "th-solid2 th-sub";
                if (isCLSpot) rankStyle = "bg-blue-500/20 text-blue-300 border border-blue-500/30 shadow-[0_0_8px_rgba(59,130,246,0.1)]";
                else if (isELSpot) rankStyle = "bg-orange-500/10 text-orange-300 border border-orange-500/20";
                else if (isRelegation) rankStyle = "bg-red-500/10 text-red-300 border border-red-500/20";

                return (
                  <tr 
                    key={team.id} 
                    className="hover:th-wash transition-colors duration-150 group cursor-pointer"
                    onClick={() => triggerEntity("team", team.id)}
                  >
                    {/* Rank Badge */}
                    <td className="py-3 px-3 text-center">
                      <div className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold mx-auto ${rankStyle}`}>
                        {idx + 1}
                      </div>
                    </td>

                    {/* Team Info */}
                    <td className="py-3 px-2 font-medium">
                      <div className="flex items-center gap-2.5 font-sans">
                        <TeamCrest team={team} size={20} />
                        <span className="th-text group-hover:th-text transition-colors">
                          {team.name}
                        </span>
                        {idx === 0 && currentRoundIndex === 14 && (
                          <span className="text-[10px] bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-1.5 py-0.5 rounded font-bold ml-1 uppercase tracking-wider animate-pulse">
                            🏆 Champ
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Stats */}
                    <td className="py-3 px-2 text-center th-sub font-mono">{team.played}</td>
                    <td className="py-3 px-2 text-center th-muted font-mono">{team.wonMatches}</td>
                    <td className="py-3 px-2 text-center th-muted font-mono">{team.drawnMatches}</td>
                    <td className="py-3 px-2 text-center th-muted font-mono">{team.lostMatches}</td>
                    <td className={`py-3 px-2 text-center font-mono ${team.gd > 0 ? "text-emerald-400" : team.gd < 0 ? "text-rose-400" : "th-muted"}`}>
                      {team.gd > 0 ? `+${team.gd}` : team.gd}
                    </td>

                    {/* Points */}
                    <td className="py-3 px-3 text-center text-emerald-400 font-mono font-bold">{team.pts}</td>
                    {/* Form */}
                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center gap-0.5">
                        {getTeamForm(team.id, fixtures, 5).map((result, i) => (
                          <span
                            key={i}
                            title={result === "W" ? "Win" : result === "D" ? "Draw" : "Loss"}
                            className={`w-3.5 h-3.5 rounded-full inline-block ${
                              result === "W" ? "bg-emerald-500" : result === "D" ? "bg-yellow-400" : "bg-rose-500"
                            }`}
                          />
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-x-4 gap-y-2 pt-3 border-t th-border text-[11px] th-muted select-none">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-blue-500/20 border border-blue-500/30"></span>
            Champions League (Spots 1-4)
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-orange-500/20 border border-orange-500/30"></span>
            Europa League (Spots 5-6)
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-red-500/20 border border-red-500/30"></span>
            Relegation Zone (Bottom 3 → Div 2)
          </div>
        </div>
      </div>

      {/* 2. Matchdays Fixture List Part */}
      <div className="glass-panel border th-border rounded-2xl p-5 flex flex-col space-y-4 shadow-xl select-none">
        <div className="flex items-center justify-between pb-2 border-b th-border">
          <h3 className="text-sm font-sans font-medium th-text flex items-center gap-1.5">
            <Calendar className="th-muted" size={16} />
            Matchday Fixtures
          </h3>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSelectedMatchday(m => Math.max(0, m - 1))}
              disabled={selectedMatchday === 0}
              className="p-1 rounded th-wash border th-border th-muted hover:th-text hover:th-wash2 disabled:opacity-30 disabled:pointer-events-none transition"
              title="Previous Matchday"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-mono th-sub min-w-20 text-center">
              Day {selectedMatchday + 1} of 15
            </span>
            <button
              onClick={() => setSelectedMatchday(m => Math.min(14, m + 1))}
              disabled={selectedMatchday === 14}
              className="p-1 rounded th-wash border th-border th-muted hover:th-text hover:th-wash2 disabled:opacity-30 disabled:pointer-events-none transition"
              title="Next Matchday"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Fixtures roster for selected Matchday */}
        <div className="flex flex-col space-y-2.5 overflow-y-auto max-h-[420px] pr-1">
          {matchdayFixtures.map((fixture) => {
            const home = teams.find(t => t.id === fixture.homeTeamId)!;
            const away = teams.find(t => t.id === fixture.awayTeamId)!;

            if (!home || !away) return null;

            return (
              <div 
                key={fixture.id} 
                className={`p-3 rounded-xl border transition-all duration-150 flex flex-col space-y-2 cursor-pointer ${
                  fixture.roundIndex === currentRoundIndex
                    ? "th-acc-soft th-border-acc hover:th-border-acc"
                    : "th-wash th-border hover:th-border"
                }`}
                onClick={() => {
                  setInspectedMatch(fixture);
                }}
                title="Click to view match statistics and lineups"
              >
                {/* Match Status Header */}
                <div className="flex justify-between items-center text-[10px] font-mono select-none">
                  <span className={`${
                    fixture.status === "LIVE"
                      ? "text-rose-500 animate-pulse font-bold"
                      : fixture.status === "FT"
                        ? "th-muted"
                        : "text-emerald-400"
                  }`}>
                    {fixture.status === "LIVE" 
                      ? "● LIVE IN PROGRESS" 
                      : fixture.status === "FT" 
                        ? "FINISHED" 
                        : "SCHEDULED"
                    }
                  </span>
                  {fixture.roundIndex === currentRoundIndex && (
                    <span className="th-acc-soft text-emerald-400 border th-border-acc px-1.5 py-0.5 rounded-full uppercase text-[9px] font-bold">
                      Current Day
                    </span>
                  )}
                </div>

                {/* Scoreline */}
                <div className="flex items-center justify-between">
                  {/* Home Team */}
                  <div className="flex items-center gap-2 w-[42%]">
                    <TeamCrest team={home} size={18} />
                    <span className="th-text text-xs truncate max-w-[80px]" title={home.name}>
                      {home.shortName}
                    </span>
                  </div>

                  {/* Score */}
                  <div className="flex-1 text-center font-mono text-xs font-bold th-text flex items-center justify-center gap-1.5 min-w-16">
                    {fixture.status !== "SCHEDULED" ? (
                      <span className="th-wash border th-border px-2 py-0.5 rounded th-text">
                        {fixture.homeScore} - {fixture.awayScore}
                      </span>
                    ) : (
                      <span className="th-muted text-[10px] font-normal uppercase th-wash border th-border px-2 py-0.5 rounded">
                        vs
                      </span>
                    )}
                  </div>

                  {/* Away Team */}
                  <div className="flex items-center gap-2 w-[42%] justify-end">
                    <span className="th-text text-xs truncate max-w-[80px] text-right" title={away.name}>
                      {away.shortName}
                    </span>
                    <TeamCrest team={away} size={18} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* INSPECTED MATCH DETAILS MODAL OVERLAY */}
      {inspectedMatch && (() => {
        const homeTeam = teams.find(t => t.id === inspectedMatch.homeTeamId) || teams[0];
        const awayTeam = teams.find(t => t.id === inspectedMatch.awayTeamId) || teams[1];
        const homeGoals = Math.floor(inspectedMatch.homeScore);
        const awayGoals = Math.floor(inspectedMatch.awayScore);
        const goalEvents = inspectedMatch.events?.filter(e => e.type === "GOAL") || [];

        return (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[110] flex items-center justify-center p-4 animate-fade-in text-center select-none font-sans">
            <div className="relative th-solid border th-border rounded-3xl p-6 max-w-sm w-full mx-auto my-auto shadow-2xl space-y-5 flex flex-col th-text">
              
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setInspectedMatch(null)}
                className="absolute top-4 right-4 th-wash hover:th-wash2 th-muted hover:th-text h-8 w-8 rounded-full flex items-center justify-center cursor-pointer text-xs transition-colors border th-border"
              >
                ✕
              </button>

              <div className="text-center font-sans">
                <span className="text-[9px] font-mono tracking-widest th-muted font-extrabold uppercase">
                  {inspectedMatch.status === "SCHEDULED" ? "UPCOMING LINEUPS" : "COMPLETED REPORT"}
                </span>
                <h3 className="text-sm font-black th-text uppercase tracking-widest mt-1">
                  Match Details
                </h3>
              </div>

              {/* Scoreboard line */}
              <div className="th-inset border th-border rounded-2xl p-4 flex items-center justify-between">
                {/* Home Team (Click to Dossier) */}
                <div 
                  onClick={() => {
                    triggerEntity("team", homeTeam.id);
                    setInspectedMatch(null);
                  }}
                  className="flex flex-col items-center gap-1.5 w-[38%] text-center cursor-pointer hover:scale-105 transition-all group"
                  title={`View ${homeTeam.name} dossier`}
                >
                  <TeamCrest team={homeTeam as any} size={36} className="group-hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.15)]" />
                  <span className="text-[11px] font-bold th-sub group-hover:text-emerald-450 line-clamp-2 leading-tight">
                    {homeTeam.name}
                  </span>
                </div>

                {/* Score */}
                <div className="flex flex-col items-center justify-center w-[24%]">
                  <span className="text-xl font-black font-mono th-text">
                    {inspectedMatch.status === "SCHEDULED" ? "VS" : `${homeGoals} - ${awayGoals}`}
                  </span>
                  {inspectedMatch.homeScore % 1 !== 0 && inspectedMatch.status !== "SCHEDULED" && (
                    <span className="text-[8px] font-mono text-emerald-400 uppercase font-black mt-1">PENS WIN</span>
                  )}
                </div>

                {/* Away Team (Click to Dossier) */}
                <div 
                  onClick={() => {
                    triggerEntity("team", awayTeam.id);
                    setInspectedMatch(null);
                  }}
                  className="flex flex-col items-center gap-1.5 w-[38%] text-center cursor-pointer hover:scale-105 transition-all group"
                  title={`View ${awayTeam.name} dossier`}
                >
                  <TeamCrest team={awayTeam as any} size={36} className="group-hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.15)]" />
                  <span className="text-[11px] font-bold th-sub group-hover:text-emerald-450 line-clamp-2 leading-tight">
                    {awayTeam.name}
                  </span>
                </div>
              </div>

              {/* Dynamic Goal Scorer logs list */}
              {inspectedMatch.status !== "SCHEDULED" && (
                <div className="space-y-1.5 text-left">
                  <span className="text-[8px] font-mono font-bold th-muted uppercase tracking-widest block">
                    GOAL EVENT LOG & TIMELINE
                  </span>
                  
                  <div className="max-h-[110px] overflow-y-auto no-scrollbar space-y-1 text-xs font-mono">
                    {goalEvents.length === 0 ? (
                      <div className="text-center th-faint text-[10px] py-3 italic">
                        No goals were scored. Goalless match.
                      </div>
                    ) : (
                      goalEvents.map((evt, eIdx) => {
                        const isHomeScorer = evt.teamId === homeTeam.id;
                        return (
                          <div 
                            key={eIdx}
                            className={`flex items-center gap-1.5 text-[11px] ${isHomeScorer ? "justify-start text-left th-sub" : "justify-end text-right th-sub"}`}
                          >
                            <span className="th-muted font-bold">[{evt.minute}']</span>
                            <span className="truncate">⚽ {evt.commentary.split(" scored")[0].split(" - ")[0]}</span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* Match detailed statistics comparison */}
              {inspectedMatch.status !== "SCHEDULED" && (
                <div className="space-y-2 border-t th-border pt-3 select-none text-left font-mono">
                  <span className="text-[8px] font-mono font-bold th-muted uppercase tracking-widest block">
                    TEAM STATS COMPARISON
                  </span>
                  <div className="grid grid-cols-3 text-center text-[11px] font-mono th-sub">
                    <div>
                      <span className="text-[12px] font-bold th-text block">{inspectedMatch.stats?.home?.shots || 0} ({inspectedMatch.stats?.home?.shotsOnTarget || 0})</span>
                      <span className="text-[8px] th-muted block uppercase mt-0.5">Shots(SOT)</span>
                    </div>
                    <div>
                      <span className="text-[12px] font-bold th-text block">{inspectedMatch.stats?.home?.passes || 0} vs {inspectedMatch.stats?.away?.passes || 0}</span>
                      <span className="text-[8px] th-muted block uppercase mt-0.5 font-sans">Passes</span>
                    </div>
                    <div>
                      <span className="text-[12px] font-bold th-text block">{inspectedMatch.stats?.away?.shots || 0} ({inspectedMatch.stats?.away?.shotsOnTarget || 0})</span>
                      <span className="text-[8px] th-muted block uppercase mt-0.5">Shots(SOT)</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      })()}
    </div>
  );
};

