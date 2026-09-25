import React, { useState, useRef } from "react";
import { Team, Player, Fixture } from "../types";
import { TeamCrest } from "./TeamCrest";
import { PitchFormation } from "./PitchFormation";
import { calculateTeamRating } from "../engine/matchEngine";
import { cleanPlayerName, isReservePlayer } from "../utils/playerUtils";

interface TeamsListProps {
  teams: Team[];
  fixtures: Fixture[];
}

export const TeamsList: React.FC<TeamsListProps> = ({ teams, fixtures }) => {
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  
  const triggerGlobalEntity = (type: "team" | "player", id: string) => {
    const evt = new CustomEvent("open-global-entity", {
      detail: { type, id }
    });
    window.dispatchEvent(evt);
  };
  
  // Ref to the detail panel so we can scroll it into viewport when clicked on mobile
  const detailPanelRef = useRef<HTMLDivElement>(null);
  
  // Right detail panel tabs: "roster" (13 players) or "history" (stats and matches)
  const [activeRightTab, setActiveRightTab] = useState<"roster" | "history">("roster");
  
  // Player cards detail model overlay
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [inspectedMatch, setInspectedMatch] = useState<Fixture | null>(null);

  // Filter teams based on search letters
  const filteredTeams = teams.filter(t =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.shortName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedTeam = teams.find(t => t.id === selectedTeamId);

  const getPositionOrder = (pos: string) => {
    switch (pos) {
      case "GK": return 1;
      case "DEF": return 2;
      case "MID": return 3;
      case "ATT": return 4;
      default: return 5;
    }
  };

  const sortedPlayers = selectedTeam
    ? [...selectedTeam.players].sort((a, b) => getPositionOrder(a.position) - getPositionOrder(b.position))
    : [];

  // Retrieve past matches (FT status) for selected team
  const pastMatches = selectedTeam
    ? fixtures.filter(f => f.status === "FT" && (f.homeTeamId === selectedTeam.id || f.awayTeamId === selectedTeam.id))
    : [];

  // Calculate aggregated team stats from completed matches
  const calculateAggregateStats = () => {
    if (!selectedTeam || pastMatches.length === 0) return null;
    
    let totalShots = 0;
    let totalShotsOnTarget = 0;
    let totalPasses = 0;
    let totalCorners = 0;
    let totalFouls = 0;
    let totalSaves = 0;
    let totalYellows = 0;
    let totalReds = 0;

    pastMatches.forEach(f => {
      const side = f.homeTeamId === selectedTeam.id ? "home" : "away";
      totalShots += f.stats[side].shots;
      totalShotsOnTarget += f.stats[side].shotsOnTarget;
      totalPasses += f.stats[side].passes;
      totalCorners += f.stats[side].corners;
      totalFouls += f.stats[side].fouls;
      totalSaves += f.stats[side].saves;
      totalYellows += f.stats[side].yellowCards;
      totalReds += f.stats[side].redCards;
    });

    return {
      totalShots,
      totalShotsOnTarget,
      totalPasses,
      totalCorners,
      totalFouls,
      totalSaves,
      totalYellows,
      totalReds,
      matchCount: pastMatches.length
    };
  };

  const teamAggStats = calculateAggregateStats();

  const getTeamNameById = (id: string) => {
    const t = teams.find(team => team.id === id);
    return t ? t.name : "Unknown";
  };

  const getTeamCrestById = (id: string) => {
    const t = teams.find(team => team.id === id);
    return t || { id, name: "Unknown Club", shortName: "??", primaryColor: "#333", secondaryColor: "#444" };
  };

  return (
    <div className="flex-1 min-height-0 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-6 no-scrollbar max-h-none">
      
      {/* Title */}
      <div className="border-b th-border pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 select-none">
        <div>
          <span className="text-[10px] th-muted font-mono tracking-widest block uppercase font-bold">
            CHAMPIONSHIP SQUADS & TEAM RECORDS
          </span>
          <h2 className="text-sm font-bold th-text font-sans tracking-tight mt-1">
            Browse the 13-Player rosters, past historic match stats & attributes
          </h2>
        </div>
        
        {/* Search Input bar */}
        <div className="th-inset border th-border rounded-xl px-3 py-1.5 flex items-center gap-2 max-w-[240px]">
          <span className="text-xs">🔍</span>
          <input
            type="text"
            placeholder="Search team name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-transparent border-none text-xs th-text focus:outline-none placeholder:th-muted"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Teams Directory Cards Grid (Col-Span 7) */}
        <div className="lg:col-span-6 xl:col-span-7 grid grid-cols-2 md:grid-cols-3 gap-3">
          {filteredTeams.map(team => {
            const isSelected = team.id === selectedTeamId;
            const starStr = "⭐".repeat(Math.round(team.rating));

            return (
              <div
                key={team.id}
                onClick={() => {
                  setSelectedTeamId(team.id);
                  setActiveRightTab("roster");
                  setTimeout(() => {
                    detailPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }, 80);
                }}
                className={`glass-card rounded-2xl p-4 flex flex-col items-center text-center transition-all duration-150 cursor-pointer border ${
                  isSelected
                    ? "th-border-acc th-acc-soft shadow-[0_0_15px_rgba(16,185,129,0.1)] scale-[1.01]"
                    : "th-border hover:th-border2 hover:th-wash"
                }`}
              >
                <TeamCrest team={team} size={48} />
                <h3 className="text-xs font-bold th-text truncate mt-2.5 w-full select-none">
                  {team.name}
                </h3>
                <span className="text-[9px] th-muted font-mono font-bold tracking-widest block mt-0.5 select-none font-sans">
                  {team.shortName} • STARS ({team.rating.toFixed(1)})
                </span>
                
                <div className="text-[8px] text-yellow-500 mt-1.5 select-none">
                  {starStr}
                </div>

                <div className="flex gap-4 mt-3 text-[9px] th-muted font-mono select-none">
                  <span>W: {team.wonMatches}</span>
                  <span>L: {team.lostMatches}</span>
                  <span>G: {team.goalsScored}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Team Profile Portfolio Detail (Col-Span 5) */}
        <div ref={detailPanelRef} className="lg:col-span-6 xl:col-span-5 glass-panel-heavy rounded-2xl border th-border overflow-hidden self-stretch flex flex-col justify-between">
          {selectedTeam ? (
            <div className="flex flex-col h-full min-h-[560px]">
              {/* Profile Header */}
              <div className="th-wash p-4 text-center border-b th-border">
                <TeamCrest team={selectedTeam} size={64} />
                <h3 className="text-sm font-black th-text mt-2">
                  {selectedTeam.name}
                </h3>
                <span className="text-[10px] th-muted font-mono block uppercase tracking-wider mt-0.5 font-sans">
                  Global Club Rating: {calculateTeamRating(selectedTeam)} / 100
                </span>
                
                {/* Visual Accent Badge */}
                <div className="flex items-center justify-center gap-1.5 mt-2.5 select-none">
                  <span className="text-[10px] th-muted font-mono">CLUB COLORS:</span>
                  <span
                    className="h-3 w-5 rounded border th-border2 inline-block"
                    style={{ backgroundColor: selectedTeam.primaryColor }}
                    title={`Primary: ${selectedTeam.primaryColor}`}
                  ></span>
                  <span
                    className="h-3 w-5 rounded border th-border2 inline-block"
                    style={{ backgroundColor: selectedTeam.secondaryColor }}
                    title={`Secondary: ${selectedTeam.secondaryColor}`}
                  ></span>
                </div>
              </div>

              {/* Sub tabs selector inside right info frame */}
              <div className="flex border-b th-border divide-x divide-white/5 th-inset">
                <button
                  onClick={() => setActiveRightTab("roster")}
                  className={`flex-1 py-2 text-xs font-bold tracking-widest uppercase cursor-pointer ${
                    activeRightTab === "roster"
                      ? "th-wash th-acc font-extrabold border-b-2 th-border-acc"
                      : "th-muted hover:th-text"
                  }`}
                >
                  👥 SQUAD ({selectedTeam.players.length})
                </button>
                <button
                  onClick={() => setActiveRightTab("history")}
                  className={`flex-1 py-2 text-xs font-bold tracking-widest uppercase cursor-pointer ${
                    activeRightTab === "history"
                      ? "th-wash th-acc font-extrabold border-b-2 th-border-acc"
                      : "th-muted hover:th-text"
                  }`}
                >
                  📜 RECORD / STATS
                </button>
              </div>

              {/* TAB 1: SQUAD ROSTER LISTS */}
              {activeRightTab === "roster" && (
                <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar max-h-[500px] glass-scrollbar">
                  
                  <div className="mb-4">
                    <span className="text-[10px] font-mono font-bold tracking-widest th-muted uppercase block mb-2">
                      Starting XI Formation
                    </span>
                    <PitchFormation players={sortedPlayers} teamId={selectedTeam.id} />
                  </div>

                  <span className="text-[10px] font-mono font-bold tracking-widest th-muted uppercase block mb-3 border-b th-border pb-2">
                    Squad Roster Directory
                  </span>

                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                    {sortedPlayers.map(p => {
                      return (
                        <div
                          key={p.id}
                          onClick={() => triggerGlobalEntity("player", p.id)}
                          className="th-inset border th-border hover:th-border-acc hover:th-acc-soft rounded-xl p-3 flex flex-col justify-between text-xs cursor-pointer transition-all duration-200 shadow-sm min-h-[90px]"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase ${
                              p.position === "GK" ? "bg-red-500/15 th-danger" :
                              p.position === "DEF" ? "bg-blue-500/15 th-info" :
                              p.position === "MID" ? "th-acc-soft th-acc" : "bg-purple-500/15 th-purple"
                            }`}>
                              {p.position}
                            </span>
                            <div className="th-inset border th-border h-8 w-11 flex flex-col items-center justify-center rounded-lg">
                              <span className="text-[11px] font-black font-mono th-acc leading-none">
                                {p.rating}
                              </span>
                            </div>
                          </div>
                          
                          <div className="flex flex-col gap-0.5 mt-auto">
                            <span className="font-bold th-text truncate">
                              {cleanPlayerName(p.name)}
                              {isReservePlayer(p) && <span className="ml-1 text-[7px] font-bold th-amber px-1 bg-amber-500/10 rounded border border-amber-500/20 align-middle">RES</span>}
                            </span>
                            <span className="text-[8px] th-muted font-mono tracking-tighter truncate leading-tight">
                              Pld: {p.matchesPlayed} • Gls: {p.goals} • Ast: {p.assists}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 2: HISTORICAL RECORD & STATS */}
              {activeRightTab === "history" && (
                <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar max-h-[420px] glass-scrollbar">

                  {/* Season-by-season history (persists across seasons) */}
                  {(selectedTeam.seasonHistory?.length ?? 0) > 0 && (
                    <div className="th-inset border th-border rounded-2xl p-3.5 space-y-2">
                      <span className="text-[9px] font-mono font-bold tracking-widest th-amber uppercase block">
                        SEASON HISTORY ({selectedTeam.seasonHistory!.length})
                      </span>
                      <div className="overflow-x-auto">
                        <table className="w-full text-[10px] font-mono">
                          <thead>
                            <tr className="th-muted uppercase text-[8px]">
                              <th className="text-left py-1">Season</th>
                              <th className="text-center">Pos</th>
                              <th className="text-center">W</th>
                              <th className="text-center">D</th>
                              <th className="text-center">L</th>
                              <th className="text-center">GF</th>
                              <th className="text-center">GA</th>
                              <th className="text-center">Title</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[...selectedTeam.seasonHistory!].reverse().map((s) => (
                              <tr key={s.seasonNumber} className="border-t th-border th-sub">
                                <td className="text-left py-1">S{s.seasonNumber}</td>
                                <td className="text-center">{s.position || "-"}</td>
                                <td className="text-center th-acc">{s.won}</td>
                                <td className="text-center">{s.drawn}</td>
                                <td className="text-center th-danger">{s.lost}</td>
                                <td className="text-center">{s.goalsScored}</td>
                                <td className="text-center">{s.goalsConceded}</td>
                                <td className="text-center">{s.title ? "🏆" : "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Aggregated totals */}
                  {teamAggStats ? (
                    <div className="th-inset border th-border rounded-2xl p-3.5 space-y-3">
                      <span className="text-[9px] font-mono font-bold tracking-widest th-muted uppercase block">
                        TOURNAMENT AGGREGATE METRICS
                      </span>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                        <div className="th-wash p-2 rounded-xl border th-border">
                          <span className="text-[8px] th-muted uppercase block font-bold leading-none">SHOTS</span>
                          <span className="text-xs font-black th-text mt-1 block font-mono">
                            {teamAggStats.totalShots} <span className="text-[8px] th-muted font-normal">({teamAggStats.totalShotsOnTarget} SOT)</span>
                          </span>
                        </div>
                        <div className="th-wash p-2 rounded-xl border th-border">
                          <span className="text-[8px] th-muted uppercase block font-bold leading-none">PASSES</span>
                          <span className="text-xs font-black th-text mt-1 block font-mono">
                            {teamAggStats.totalPasses.toLocaleString()}
                          </span>
                        </div>
                        <div className="th-wash p-2 rounded-xl border th-border">
                          <span className="text-[8px] th-muted uppercase block font-bold leading-none">SAVES</span>
                          <span className="text-xs font-black th-text mt-1 block font-mono">
                            {teamAggStats.totalSaves}
                          </span>
                        </div>
                        <div className="th-wash p-2 rounded-xl border th-border">
                          <span className="text-[8px] th-muted uppercase block font-bold leading-none">CORNERS</span>
                          <span className="text-xs font-black th-text mt-1 block font-mono">
                            {teamAggStats.totalCorners}
                          </span>
                        </div>
                      </div>

                      {/* Discipline details */}
                      <div className="flex justify-between items-center th-wash p-2 rounded-xl border th-border text-[10px] th-muted px-3 select-none">
                        <span>FOULS COMMITTED: <strong className="font-mono">{teamAggStats.totalFouls}</strong></span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-yellow-500/80">🟨 {teamAggStats.totalYellows}</span>
                          <span className="font-bold text-red-500/80">🟥 {teamAggStats.totalReds}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="th-wash border th-border rounded-2xl p-4 text-center th-muted text-[11px] font-mono select-none italic">
                      🛡️ No matches simulated yet. Play games in the 'Live' section to populate stats histories!
                    </div>
                  )}

                  {/* Matches List completed */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-mono font-bold tracking-widest th-muted uppercase block mb-1">
                      MATCH-BY-MATCH SPREAD ({pastMatches.length} PLD)
                    </span>

                    {pastMatches.map(match => {
                      const isHome = match.homeTeamId === selectedTeam.id;
                      const oppId = isHome ? match.awayTeamId : match.homeTeamId;
                      const oppTeam = getTeamCrestById(oppId);
                      
                      const scored = isHome ? Math.floor(match.homeScore) : Math.floor(match.awayScore);
                      const conceded = isHome ? Math.floor(match.awayScore) : Math.floor(match.homeScore);
                      
                      const sideStats = isHome ? match.stats.home : match.stats.away;
                      const oppSideStats = isHome ? match.stats.away : match.stats.home;
                      const isWin = scored > conceded || (isHome && match.homeScore > match.awayScore && match.homeScore % 1 !== 0) || (!isHome && match.awayScore > match.homeScore && match.awayScore % 1 !== 0);
                      const isShootout = match.homeScore % 1 !== 0 || match.awayScore % 1 !== 0;

                      return (
                        <div
                          key={match.id}
                          onClick={() => setInspectedMatch(match)}
                          className="th-inset hover:th-solid border th-border hover:th-border rounded-xl p-3 text-xs space-y-2.5 cursor-pointer transition-all hover:scale-[1.005]"
                          title="Click to inspect Match Details & both rosters"
                        >
                          <div className="flex items-center justify-between border-b th-border pb-1.5">
                            <div className="flex items-center gap-2">
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-black ${
                                isWin ? "th-acc-soft th-acc" : "bg-red-500/15 th-danger"
                              }`}>
                                {isWin ? "WIN" : "LOSS"}
                              </span>
                              <span 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  triggerGlobalEntity("team", oppTeam.id);
                                }}
                                className="flex items-center gap-1.5 font-bold th-sub hover:th-acc cursor-pointer select-none transition-colors"
                                title="Click to view club dossier"
                              >
                                <TeamCrest team={oppTeam as any} size={16} />
                                <span>vs {oppTeam.name}</span>
                              </span>
                            </div>
                            
                            <span className="font-mono font-bold text-[11px]">
                              {scored} - {conceded} {isShootout && <span className="text-[8px] th-acc uppercase tracking-widest">(PENS)</span>}
                            </span>
                          </div>

                          {/* Match individual stats breakdown */}
                          <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-mono th-muted select-none">
                            <div>
                              <span className="text-[8px] th-muted block uppercase">Shots (SOT)</span>
                              <span className="th-text font-bold block mt-0.5">
                                {sideStats.shots} ({sideStats.shotsOnTarget}) vs {oppSideStats.shots} ({oppSideStats.shotsOnTarget})
                              </span>
                            </div>
                            <div>
                              <span className="text-[8px] th-muted block uppercase">Passes</span>
                              <span className="th-text font-bold block mt-0.5">
                                {sideStats.passes} vs {oppSideStats.passes}
                              </span>
                            </div>
                            <div>
                              <span className="text-[8px] th-muted block uppercase">Saves • Fouls</span>
                              <span className="th-text font-bold block mt-0.5">
                                {sideStats.saves} / {sideStats.fouls}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center th-muted p-8 py-16">
              <span className="text-5xl mb-3 opacity-40">👥</span>
              <p className="text-xs font-bold">No Team Selected</p>
              <p className="text-[11px] th-faint mt-1 max-w-[200px]">
                Explore the register cards on the left side and choose a team to unfold detail profile histories.
              </p>
            </div>
          )}
        </div>
      </div>

       {/* PLAYER ATTRIBUTED CARDS MODAL OVERLAY */}
      {selectedPlayer && (() => {
        const [dossierTab, setDossierTab] = useState<"stats" | "qualities">("stats");
        
        let statusBadge = (
          <span className="px-2 py-0.5 th-acc-soft border th-border-acc rounded-md text-[9px] font-mono th-acc font-bold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            ACTIVE
          </span>
        );
        if (selectedPlayer.suspendedRounds && selectedPlayer.suspendedRounds > 0) {
          statusBadge = (
            <span className="px-2 py-0.5 bg-red-500/15 border border-red-500/30 rounded-md text-[9px] font-mono th-danger font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
              SUSPENDED
            </span>
          );
        } else if (selectedPlayer.injuredRounds && selectedPlayer.injuredRounds > 0) {
          statusBadge = (
            <span className="px-2 py-0.5 bg-amber-500/15 border border-amber-500/30 rounded-md text-[9px] font-mono text-amber-500 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-505 animate-bounce"></span>
              INJURED
            </span>
          );
        }

        return (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="relative th-solid border th-border rounded-2xl p-6 max-w-sm w-full mx-auto space-y-4 shadow-2xl text-center flex flex-col items-center">
              
              {/* Close trigger button */}
              <button
                onClick={() => setSelectedPlayer(null)}
                className="absolute top-4 right-4 th-wash hover:th-wash2 th-muted hover:th-text h-8 w-8 rounded-full flex items-center justify-center cursor-pointer text-xs transition-colors"
              >
                ✕
              </button>

              {/* FUT/Card inspired header */}
              <div className="w-full flex flex-col items-center select-none pt-2">
                <div className="h-10 w-10 th-acc-soft border th-border-acc rounded-xl flex items-center justify-center text-lg mb-2">
                  🏃
                </div>
                <p className="text-[9px] font-mono tracking-widest th-muted font-bold uppercase leading-none">
                  CHAMPIONSHIP PLAYER CARD
                </p>
                <h3 className="text-base font-black th-text mt-1 leading-tight truncate max-w-full">
                  {cleanPlayerName(selectedPlayer.name)}
                </h3>
                <div className="flex items-center gap-1.5 mt-2 flex-wrap justify-center">
                  <span className="px-1.5 py-0.5 th-wash border th-border rounded text-[9px] font-mono th-sub font-bold">
                    {selectedPlayer.position}
                  </span>
                  <span className="th-faint font-mono text-[9px]">•</span>
                  <span className="th-muted font-mono text-[9px] font-bold truncate max-w-[140px]">
                    {getTeamNameById(selectedPlayer.teamId)}
                  </span>
                  <span className="th-faint font-mono text-[9px]">•</span>
                  {statusBadge}
                </div>
              </div>

              {/* Selector Tabs */}
              <div className="w-full grid grid-cols-2 border-b th-border text-xs font-bold leading-none select-none">
                <button
                  type="button"
                  onClick={() => setDossierTab("stats")}
                  className={`py-2 border-b-2 text-center transition-all cursor-pointer font-bold ${
                    dossierTab === "stats"
                      ? "th-border-acc th-acc font-black"
                      : "border-transparent th-muted hover:th-text font-medium"
                  }`}
                >
                  SEASON STATS
                </button>
                <button
                  type="button"
                  onClick={() => setDossierTab("qualities")}
                  className={`py-2 border-b-2 text-center transition-all cursor-pointer ${
                    dossierTab === "qualities"
                      ? "th-border-acc th-acc font-black"
                      : "border-transparent th-muted hover:th-text font-medium"
                  }`}
                >
                  TECHNICAL QUALITIES
                </button>
              </div>

              {/* Tab render content */}
              {dossierTab === "stats" ? (
                <div className="w-full space-y-3 animate-fade-in block">
                  {/* Rating / Plays */}
                  <div className="th-inset rounded-xl border th-border p-3 flex justify-between items-center text-xs font-mono">
                    <div className="text-left">
                      <span className="text-[9px] th-muted block uppercase">OVERALL SCALE</span>
                      <span className="th-acc font-black text-sm">{selectedPlayer.rating} OVR</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] th-muted block uppercase">MATCHES</span>
                      <span className="th-sub font-bold">{selectedPlayer.matchesPlayed} games</span>
                    </div>
                  </div>

                  {/* High performance box */}
                  <div className="grid grid-cols-3 divide-x divide-white/5 border th-border th-inset py-2.5 rounded-xl text-center text-xs font-mono th-sub">
                    <div>
                      <span className="text-[8px] th-muted uppercase block">GOALS</span>
                      <span className="th-acc font-black mt-0.5 block">{selectedPlayer.goals}</span>
                    </div>
                    <div>
                      <span className="text-[8px] th-muted uppercase block">{selectedPlayer.position === "GK" ? "SAVES" : "ASSISTS"}</span>
                      <span className="th-text font-bold mt-0.5 block">
                        {selectedPlayer.position === "GK" ? (selectedPlayer.saves || 0) : (selectedPlayer.assists || 0)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[8px] th-muted uppercase block">BOOKINGS</span>
                      <span className="th-text font-bold mt-0.5 block text-[10px] whitespace-nowrap">
                        🟨 {selectedPlayer.yellowCards || 0} • 🟥 {selectedPlayer.redCards || 0}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="w-full space-y-3 text-left animate-fade-in block">
                  {/* Technical Abilities Core specs list */}
                  <span className="text-[9px] font-mono font-bold th-muted tracking-widest uppercase block border-b th-border pb-1 select-none">
                    TECHNICAL CHARACTERISTICS
                  </span>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    {selectedPlayer.position === "GK" ? (
                      <>
                        <SkillBar label="DIVING" value={selectedPlayer.abilities?.diving || 75} />
                        <SkillBar label="HANDLING" value={selectedPlayer.abilities?.handling || 70} />
                        <SkillBar label="KICKING" value={selectedPlayer.abilities?.kicking || 65} />
                        <SkillBar label="REFLEXES" value={selectedPlayer.abilities?.reflexes || 78} />
                        <SkillBar label="SPEED" value={selectedPlayer.abilities?.speed || 50} />
                        <SkillBar label="POSITIONING" value={selectedPlayer.abilities?.positioning || 75} />
                      </>
                    ) : (
                      <>
                        <SkillBar label="PACE" value={selectedPlayer.abilities?.pace || 75} />
                        <SkillBar label="SHOOTING" value={selectedPlayer.abilities?.shooting || 68} />
                        <SkillBar label="PASSING" value={selectedPlayer.abilities?.passing || 72} />
                        <SkillBar label="DRIBBLING" value={selectedPlayer.abilities?.dribbling || 74} />
                        <SkillBar label="DEFENDING" value={selectedPlayer.abilities?.defending || 55} />
                        <SkillBar label="PHYSICAL" value={selectedPlayer.abilities?.physical || 70} />
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {inspectedMatch && (() => {
        const homeTeam = teams.find(t => t.id === inspectedMatch.homeTeamId) || teams[0];
        const awayTeam = teams.find(t => t.id === inspectedMatch.awayTeamId) || teams[1];
        const homeGoals = Math.floor(inspectedMatch.homeScore);
        const awayGoals = Math.floor(inspectedMatch.awayScore);
        const goalEvents = inspectedMatch.events?.filter(e => e.type === "GOAL") || [];

        return (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[110] flex items-center justify-center p-4 animate-fade-in">
            <div className="relative th-solid border th-border rounded-3xl p-6 max-w-sm w-full mx-auto my-auto shadow-2xl space-y-5 flex flex-col select-none">
              
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setInspectedMatch(null)}
                className="absolute top-4 right-4 th-wash hover:th-wash2 th-muted hover:th-text h-8 w-8 rounded-full flex items-center justify-center cursor-pointer text-xs transition-colors border th-border"
              >
                ✕
              </button>

              <div className="text-center">
                <span className="text-[9px] font-mono tracking-widest th-muted font-extrabold uppercase">
                  COMPLETED REPORT
                </span>
                <h3 className="text-sm font-black th-text uppercase tracking-widest mt-1">
                  Match Details
                </h3>
              </div>

              {/* Scoreboard line */}
              <div className="th-inset border th-border rounded-2xl p-4 flex items-center justify-between">
                {/* Home Team */}
                <div 
                  onClick={() => {
                    triggerGlobalEntity("team", homeTeam.id);
                    setInspectedMatch(null);
                  }}
                  className="flex flex-col items-center gap-1.5 w-[38%] text-center cursor-pointer hover:scale-105 transition-all group"
                >
                  <TeamCrest team={homeTeam as any} size={36} className="group-hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.15)]" />
                  <span className="text-[11px] font-bold th-sub group-hover:text-emerald-450 line-clamp-2 leading-tight">
                    {homeTeam.name}
                  </span>
                </div>

                {/* Score */}
                <div className="flex flex-col items-center justify-center w-[24%]">
                  <span className="text-xl font-black font-mono th-text">
                    {homeGoals} - {awayGoals}
                  </span>
                  {inspectedMatch.homeScore % 1 !== 0 && (
                    <span className="text-[8px] font-mono th-acc uppercase font-black mt-1">PENS WIN</span>
                  )}
                </div>

                {/* Away Team */}
                <div 
                  onClick={() => {
                    triggerGlobalEntity("team", awayTeam.id);
                    setInspectedMatch(null);
                  }}
                  className="flex flex-col items-center gap-1.5 w-[38%] text-center cursor-pointer hover:scale-105 transition-all group"
                >
                  <TeamCrest team={awayTeam as any} size={36} className="group-hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.15)]" />
                  <span className="text-[11px] font-bold th-sub group-hover:th-acc line-clamp-2 leading-tight">
                    {awayTeam.name}
                  </span>
                </div>
              </div>

              {/* Dynamic Goal Scorer logs list */}
              <div className="space-y-1.5">
                <span className="text-[8px] font-mono font-bold th-muted uppercase tracking-widest block text-left">
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

              {/* Match detailed statistics comparison */}
              <div className="space-y-2 border-t th-border pt-3 select-none">
                <span className="text-[8px] font-mono font-bold th-muted uppercase tracking-widest block text-left">
                  TEAM STATS COMPARISON
                </span>
                <div className="grid grid-cols-3 text-center text-[11px] font-mono th-sub">
                  <div>
                    <span className="text-[12px] font-bold th-text block">{inspectedMatch.stats.home.shots} ({inspectedMatch.stats.home.shotsOnTarget})</span>
                    <span className="text-[8px] th-muted block uppercase mt-0.5">Shots(SOT)</span>
                  </div>
                  <div>
                    <span className="text-[12px] font-bold th-text block">{inspectedMatch.stats.home.passes} vs {inspectedMatch.stats.away.passes}</span>
                    <span className="text-[8px] th-muted block uppercase mt-0.5">Passes</span>
                  </div>
                  <div>
                    <span className="text-[12px] font-bold th-text block">{inspectedMatch.stats.away.shots} ({inspectedMatch.stats.away.shotsOnTarget})</span>
                    <span className="text-[8px] th-muted block uppercase mt-0.5">Shots(SOT)</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        );
      })()}
    </div>
  );
};

// Internal mini-component for rendering skill parameters beautifully
const SkillBar: React.FC<{ label: string; value: number }> = ({ label, value }) => {
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center text-[9px] font-mono th-muted leading-none">
        <span className="font-bold">{label}</span>
        <span className="font-extrabold th-text">{value}</span>
      </div>
      <div className="h-1.5 th-inset border th-border rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-emerald-500"
          style={{ width: `${value}%` }}
        ></div>
      </div>
    </div>
  );
};

