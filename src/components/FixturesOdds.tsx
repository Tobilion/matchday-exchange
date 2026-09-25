import React, { useState } from "react";
import { Fixture, Team, BetSelection, MarketType } from "../types";
import { TeamCrest } from "./TeamCrest";
import { Info, X } from "lucide-react";
import { InfoButton } from "./ui/InfoButton";
import { getLiveInPlayOdds } from "../utils";
import { getTeamForm, getHeadToHead, getTeamGoalAvg } from "../utils/formUtils";
import { GlowOrb } from "./ui/GlowOrb";

interface FixturesOddsProps {
  fixtures: Fixture[];
  teams: Team[];
  roundIndex: number;
  currentRoundLabel: string;
  selectedBets: BetSelection[];
  onAddBetSelection: (selection: BetSelection) => void;
  onRemoveSelection: (fixtureId: string, marketType: MarketType, selectionId: string) => void;
  ownedTeamId?: string;
  onOpenBetBuilder?: (fixtureId: string) => void;
}

export const FixturesOdds: React.FC<FixturesOddsProps> = ({
  fixtures,
  teams,
  roundIndex,
  currentRoundLabel,
  selectedBets,
  onAddBetSelection,
  onRemoveSelection,
  ownedTeamId,
  onOpenBetBuilder,
}) => {
  const applyOwnerBoost = (odds: number | null, isOwnerMatch: boolean): number | null => {
    if (!odds || !isOwnerMatch) return odds;
    return Math.round(odds * 1.05 * 100) / 100;
  };

  const triggerOpenHighlights = (fixtureId: string) => {
    window.dispatchEvent(new CustomEvent("open-highlights", { detail: { fixtureId } }));
  };
  // Filter scheduled fixtures of current round
  const roundFixtures = fixtures.filter(f => f.roundIndex === roundIndex);
  
  // Track which fixture's modal is currently open
  const [activeModalFixtureId, setActiveModalFixtureId] = useState<string | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<"ALL" | "MAIN" | "GOALS" | "HALF" | "CORNERS" | "CARDS">("ALL");
  const [expandedFormFixtureId, setExpandedFormFixtureId] = useState<string | null>(null);

  const getTeam = (id: string): Team => {
    return teams.find(t => t.id === id) || teams[0];
  };

  const activeFixture = fixtures.find(f => f.id === activeModalFixtureId);
  const activeFixtureHomeTeam = activeFixture ? getTeam(activeFixture.homeTeamId) : null;
  const activeFixtureAwayTeam = activeFixture ? getTeam(activeFixture.awayTeamId) : null;

  // Helper to check if a specific prediction is already selected in the slip
  const isSelected = (fixtureId: string, marketType: MarketType, selectionId: string) => {
    return selectedBets.some(
      b => b.fixtureId === fixtureId && b.marketType === marketType && b.selectionId === selectionId
    );
  };

  // Helper to calculate modal dynamic in-play odds
  const getModalLiveOdds = (marketType: MarketType, selId: string, base: number): number | null => {
    if (!activeFixture) return base;
    return getLiveInPlayOdds(activeFixture, marketType, selId, base);
  };

  // Helper to toggle a selection
  const handleMarketClick = (
    fixture: Fixture,
    marketType: MarketType,
    selectionId: string,
    odds: number | null,
    details: string,
    marketName: string
  ) => {
    if (odds === null) return;
    const active = isSelected(fixture.id, marketType, selectionId);
    if (active) {
      onRemoveSelection(fixture.id, marketType, selectionId);
    } else {
      onAddBetSelection({
        fixtureId: fixture.id,
        marketType,
        selectionId,
        odds,
        details,
        marketName
      });
    }
  };

  return (
    <div className="flex-1 min-height-0 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-6 no-scrollbar max-h-none relative overflow-hidden">
      <GlowOrb className="-top-32 -left-32 opacity-10" size="450px" color="var(--accent)" />
      <GlowOrb className="bottom-12 -right-32 opacity-10" size="450px" color="var(--accent-2)" />
      
      {/* Title Header */}
      <div className="border-b th-border pb-3 flex items-center justify-between">
        <div>
          <span className="text-[10px] th-muted font-mono tracking-widest block uppercase font-bold">
            AVAILABLE BETTING LINES
          </span>
          <h2 className="text-sm font-bold th-text font-sans tracking-tight mt-1">
            {currentRoundLabel} matches & odds selections
          </h2>
        </div>
        <div className="text-right text-[10px] th-muted font-mono">
          Select odds prediction to load ticket slip
        </div>
      </div>

      {roundFixtures.length === 0 ? (
        <div className="text-center th-muted py-12">
          🏆 No fixtures found. Press Reset inside settings to restart.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {roundFixtures.map(fixture => {
            const homeTeam = getTeam(fixture.homeTeamId);
            const awayTeam = getTeam(fixture.awayTeamId);
            const isFT = fixture.status === "FT";
            const isHalfTimePause = fixture.status === "LIVE" && fixture.elapsedTicks >= 7 && sessionStorage.getItem(`ht_resume_${fixture.id}`) !== "true";
            const isLive = fixture.status === "LIVE" && !isHalfTimePause;
            const isBettingDisabled = isFT;
            const isOwnerMatch = ownedTeamId
              ? fixture.homeTeamId === ownedTeamId || fixture.awayTeamId === ownedTeamId
              : false;
            const ownedTeamObj = isOwnerMatch ? teams.find(t => t.id === ownedTeamId) : null;
            const getLiveOdds = (mType: MarketType, selId: string, base: number): number | null => {
              const raw = getLiveInPlayOdds(fixture, mType, selId, base);
              return applyOwnerBoost(raw, isOwnerMatch);
            };

            return (
              <div
                key={fixture.id}
                className={`glass-card rounded-2xl overflow-hidden flex flex-col justify-between transition-all duration-250 border ${
                  isOwnerMatch
                    ? "border-yellow-500/40 shadow-[0_0_18px_rgba(234,179,8,0.12)]"
                    : isFT
                    ? "th-border opacity-55"
                    : isLive
                    ? "border-red-500/30 shadow-sm"
                    : isHalfTimePause
                    ? "th-border-acc shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                    : "th-border hover:th-border2 hover:th-wash"
                }`}
              >
                {/* Owner Insider Banner */}
                {isOwnerMatch && ownedTeamObj && (
                  <div className="bg-yellow-500/10 border-b border-yellow-500/20 px-3 py-1.5 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="th-amber text-[10px]">&#x1F451;</span>
                      <span className="text-[9px] font-black th-amber uppercase tracking-widest font-mono">
                        YOUR CLUB · OWNER&apos;S VIEW
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[9px] font-mono">
                      <span className="th-muted">
                        Morale:{" "}
                        <span className={`font-bold ${(ownedTeamObj.morale ?? 60) >= 70 ? "th-acc" : (ownedTeamObj.morale ?? 60) >= 45 ? "th-amber" : "th-danger"}`}>
                          {(ownedTeamObj.morale ?? 60) >= 70 ? "HIGH" : (ownedTeamObj.morale ?? 60) >= 45 ? "MID" : "LOW"}
                        </span>
                      </span>
                      <span className="text-yellow-500/60 font-bold">+5% ODDS</span>
                    </div>
                  </div>
                )}

                {/* Match Card Header */}
                <div className="th-wash p-2 px-3 border-b th-border flex items-center justify-between text-[11px] th-muted select-none">
                  {/* Team strength difference / star ratings */}
                  <div className="flex gap-1 text-yellow-500">
                    {"⭐".repeat(Math.round(homeTeam.rating))}
                    <span className="th-muted font-mono text-[9px] ml-1">
                      ({homeTeam.rating.toFixed(1)})
                    </span>
                  </div>
                  
                  <span className="font-mono text-[9px] tracking-widest font-black uppercase th-muted">
                    {isFT ? "FT - LOCKED" : isLive ? "LIVE IN PROGRESS" : "1X2 MATCH WINNER"}
                  </span>

                  <div className="flex gap-1 text-yellow-500">
                    <span className="th-muted font-mono text-[9px] mr-1">
                      ({awayTeam.rating.toFixed(1)})
                    </span>
                    {"⭐".repeat(Math.round(awayTeam.rating))}
                  </div>
                </div>

                {/* Main Matchup section */}
                <div className="p-3.5 flex items-center justify-between select-none">
                  <div
                    onClick={() => window.dispatchEvent(new CustomEvent("open-global-entity", { detail: { type: "team", id: homeTeam.id } }))}
                    className="flex items-center gap-3 w-[40%] cursor-pointer hover:opacity-85 transition-opacity"
                    title={`View ${homeTeam.name} dossier`}
                  >
                    <TeamCrest team={homeTeam} size={36} />
                    <div className="overflow-hidden">
                      <span className="text-xs font-bold th-text truncate block hover:underline">
                        {homeTeam.name}
                      </span>
                      <span className="text-[10px] th-muted block">
                        Home
                      </span>
                    </div>
                  </div>

                  <div className="text-center font-bold px-2 shrink-0 flex flex-col items-center">
                    {fixture.status !== "SCHEDULED" ? (
                      <>
                        <span className="text-sm font-black font-mono th-acc">
                          {Math.floor(fixture.homeScore)} - {Math.floor(fixture.awayScore)}
                        </span>
                        {fixture.penaltyScore && (
                          <span className="text-[10px] th-muted font-mono">
                            ({fixture.penaltyScore} pens)
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-xs th-muted tracking-wider">VS</span>
                    )}
                  </div>

                  <div
                    onClick={() => window.dispatchEvent(new CustomEvent("open-global-entity", { detail: { type: "team", id: awayTeam.id } }))}
                    className="flex items-center gap-3 w-[40%] flex-row-reverse text-right cursor-pointer hover:opacity-85 transition-opacity"
                    title={`View ${awayTeam.name} dossier`}
                  >
                    <TeamCrest team={awayTeam} size={36} />
                    <div className="overflow-hidden">
                      <span className="text-xs font-bold th-text truncate block hover:underline">
                        {awayTeam.name}
                      </span>
                      <span className="text-[10px] th-muted block">
                        Away
                      </span>
                    </div>
                  </div>
                </div>

                {/* Form & H2H strip */}
                {(() => {
                  const homeForm = getTeamForm(homeTeam.id, fixtures);
                  const awayForm = getTeamForm(awayTeam.id, fixtures);
                  const h2h = getHeadToHead(homeTeam.id, awayTeam.id, fixtures);
                  const homeAvg = getTeamGoalAvg(homeTeam.id, fixtures);
                  const awayAvg = getTeamGoalAvg(awayTeam.id, fixtures);
                  const isExpanded = expandedFormFixtureId === fixture.id;
                  const formDot = (r: "W"|"D"|"L") => (
                    <span key={Math.random()} className={`inline-block w-4 h-4 rounded-full text-[8px] font-black flex items-center justify-center ${r==="W"?"bg-emerald-500/30 th-acc border th-border-acc":r==="D"?"bg-yellow-500/30 th-amber border border-yellow-500/50":"bg-red-500/30 th-danger border border-red-500/50"}`}>{r}</span>
                  );
                  const toggleExpand = () => setExpandedFormFixtureId(isExpanded ? null : fixture.id);
                  return (
                    <div className="border-b th-border">
                      {/* Collapsed row — always visible */}
                      <button
                        type="button"
                        onClick={toggleExpand}
                        className="w-full px-3 py-1.5 flex items-center justify-between gap-2 hover:th-wash transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-1 min-w-0">
                          <span className="text-[9px] th-muted font-mono font-bold uppercase shrink-0">{homeTeam.shortName}</span>
                          <div className="flex gap-0.5">{homeForm.length ? homeForm.map((r,i) => <span key={i} className={`w-3.5 h-3.5 rounded-full text-[7px] font-black flex items-center justify-center ${r==="W"?"bg-emerald-500 th-text":r==="D"?"bg-yellow-500 th-text":"bg-red-500 th-text"}`}>{r}</span>) : <span className="text-[9px] th-faint">—</span>}</div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[9px] font-mono font-bold th-muted">{h2h.played > 0 ? `${h2h.homeWins}-${h2h.draws}-${h2h.awayWins}` : "No H2H"}</span>
                          <span className="text-[9px] th-faint font-mono">H2H</span>
                          <span className={`text-[9px] th-muted ml-1 transition-transform ${isExpanded?"rotate-180":""}`}>▾</span>
                        </div>
                        <div className="flex items-center gap-1 min-w-0">
                          <div className="flex gap-0.5 flex-row-reverse">{awayForm.length ? awayForm.map((r,i) => <span key={i} className={`w-3.5 h-3.5 rounded-full text-[7px] font-black flex items-center justify-center ${r==="W"?"bg-emerald-500 th-text":r==="D"?"bg-yellow-500 th-text":"bg-red-500 th-text"}`}>{r}</span>) : <span className="text-[9px] th-faint">—</span>}</div>
                          <span className="text-[9px] th-muted font-mono font-bold uppercase shrink-0">{awayTeam.shortName}</span>
                        </div>
                      </button>
                      {/* Expanded detail */}
                      {isExpanded && (
                        <div className="px-3 pb-2.5 space-y-2 th-wash">
                          {h2h.lastMeeting && (
                            <p className="text-[9px] th-muted font-mono text-center">Last meeting: <span className="th-text font-bold">{h2h.lastMeeting.scoreline}</span> · Round {h2h.lastMeeting.roundIndex + 1}</p>
                          )}
                          {/* H2H win% bar */}
                          {h2h.played > 0 && (
                            <div className="flex items-center gap-1.5 text-[9px] font-mono">
                              <span className="th-acc font-bold w-8 text-right">{Math.round((h2h.homeWins/h2h.played)*100)}%</span>
                              <div className="flex-1 h-1.5 rounded-full overflow-hidden flex th-wash">
                                <div className="bg-emerald-500 h-full transition-all" style={{width:`${(h2h.homeWins/h2h.played)*100}%`}}></div>
                                <div className="bg-yellow-500 h-full transition-all" style={{width:`${(h2h.draws/h2h.played)*100}%`}}></div>
                                <div className="bg-red-500 h-full flex-1 transition-all"></div>
                              </div>
                              <span className="th-danger font-bold w-8">{Math.round((h2h.awayWins/h2h.played)*100)}%</span>
                            </div>
                          )}
                          {/* Goal avgs */}
                          <div className="grid grid-cols-2 gap-2 text-[9px] font-mono">
                            <div className="th-wash rounded-lg p-1.5 text-center">
                              <p className="th-muted uppercase">Avg scored/conceded</p>
                              <p className="th-text font-bold">{homeAvg.scored} / <span className="th-danger">{homeAvg.conceded}</span></p>
                              <p className="th-muted text-[8px]">{homeTeam.shortName} last 5</p>
                            </div>
                            <div className="th-wash rounded-lg p-1.5 text-center">
                              <p className="th-muted uppercase">Avg scored/conceded</p>
                              <p className="th-text font-bold">{awayAvg.scored} / <span className="th-danger">{awayAvg.conceded}</span></p>
                              <p className="th-muted text-[8px]">{awayTeam.shortName} last 5</p>
                            </div>
                          </div>
                          {/* Full form dots */}
                          <div className="flex items-center justify-between">
                            <div className="flex gap-0.5">{homeForm.map((r,i) => <span key={i}>{formDot(r)}</span>)}</div>
                            <span className="text-[8px] th-faint font-mono">LAST 5</span>
                            <div className="flex gap-0.5 flex-row-reverse">{awayForm.map((r,i) => <span key={i}>{formDot(r)}</span>)}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* 1X2 market Betting buttons (Locked if FT or suspended) */}
                {(() => {
                  const homeOdds = getLiveOdds("MATCH_WINNER", "HOME", fixture.odds.homeWin);
                  const drawOdds = getLiveOdds("MATCH_WINNER", "DRAW", fixture.odds.draw);
                  const awayOdds = getLiveOdds("MATCH_WINNER", "AWAY", fixture.odds.awayWin);
                  
                  return (
                    <div className="px-3 pb-3 grid grid-cols-3 gap-2 border-b th-border">
                      <button
                        disabled={isBettingDisabled || homeOdds === null}
                        onClick={() =>
                          handleMarketClick(
                            fixture,
                            "MATCH_WINNER",
                            "HOME",
                            homeOdds,
                            `${homeTeam.shortName} to Win`,
                            "Match Winner"
                          )
                        }
                        className={`py-2 rounded-xl flex flex-col items-center justify-center border transition-all cursor-pointer ${
                          isBettingDisabled || homeOdds === null
                            ? "th-inset border-transparent th-faint cursor-not-allowed opacity-50"
                            : isSelected(fixture.id, "MATCH_WINNER", "HOME")
                            ? "th-acc-soft th-border-acc th-acc font-bold"
                            : "th-inset th-border th-sub hover:th-border2 hover:th-wash"
                        }`}
                      >
                        <span className="text-[9px] th-muted font-bold block leading-none">HOME</span>
                        <span className="text-[11px] font-mono font-black tracking-tight leading-none mt-1 th-text">
                          {homeOdds !== null ? `@${homeOdds.toFixed(2)}` : "🔒 SUSP"}
                        </span>
                      </button>

                      <button
                        disabled={isBettingDisabled || drawOdds === null}
                        onClick={() =>
                          handleMarketClick(
                            fixture,
                            "MATCH_WINNER",
                            "DRAW",
                            drawOdds,
                            `Draw: ${homeTeam.shortName} vs ${awayTeam.shortName}`,
                            "Match Winner"
                          )
                        }
                        className={`py-2 rounded-xl flex flex-col items-center justify-center border transition-all cursor-pointer ${
                          isBettingDisabled || drawOdds === null
                            ? "th-inset border-transparent th-faint cursor-not-allowed opacity-50"
                            : isSelected(fixture.id, "MATCH_WINNER", "DRAW")
                            ? "th-acc-soft th-border-acc th-acc font-bold"
                            : "th-inset th-border th-sub hover:th-border2 hover:th-wash"
                        }`}
                      >
                        <span className="text-[9px] th-muted font-bold block leading-none">DRAW</span>
                        <span className="text-[11px] font-mono font-black tracking-tight leading-none mt-1 th-text">
                          {drawOdds !== null ? `@${drawOdds.toFixed(2)}` : "🔒 SUSP"}
                        </span>
                      </button>

                      <button
                        disabled={isBettingDisabled || awayOdds === null}
                        onClick={() =>
                          handleMarketClick(
                            fixture,
                            "MATCH_WINNER",
                            "AWAY",
                            awayOdds,
                            `${awayTeam.shortName} to Win`,
                            "Match Winner"
                          )
                        }
                        className={`py-2 rounded-xl flex flex-col items-center justify-center border transition-all cursor-pointer ${
                          isBettingDisabled || awayOdds === null
                            ? "th-inset border-transparent th-faint cursor-not-allowed opacity-50"
                            : isSelected(fixture.id, "MATCH_WINNER", "AWAY")
                            ? "th-acc-soft th-border-acc th-acc font-bold"
                            : "th-inset th-border th-sub hover:th-border2 hover:th-wash"
                        }`}
                      >
                        <span className="text-[9px] th-muted font-bold block leading-none">AWAY</span>
                        <span className="text-[11px] font-mono font-black tracking-tight leading-none mt-1 th-text">
                          {awayOdds !== null ? `@${awayOdds.toFixed(2)}` : "🔒 SUSP"}
                        </span>
                      </button>
                    </div>
                  );
                })()}

                {/* Expand sub markets trigger (Odds details draw) */}
                <div className="th-wash px-3 py-1.5 flex items-center justify-between">
                  {isFT ? (
                    <span className="text-[9px] th-muted font-mono font-bold uppercase select-none flex items-center gap-2">
                      🔒 Match Finished • Bets Blocked
                      <button
                        type="button"
                        onClick={() => triggerOpenHighlights(fixture.id)}
                        className="text-[9px] th-amber hover:th-amber font-black tracking-widest uppercase cursor-pointer"
                      >
                        📋 HIGHLIGHTS
                      </button>
                    </span>
                  ) : isLive ? (
                    <span className="text-[9px] th-danger font-mono font-bold uppercase select-none flex items-center gap-1 animate-pulse">
                      ⚡ In-Play Live • Betting Open
                    </span>
                  ) : isHalfTimePause ? (
                    <span className="text-[9px] th-muted font-mono font-bold uppercase select-none animate-pulse">
                      ⏳ Half-Time • In-Play Betting Open
                    </span>
                  ) : (
                    <span className="text-[9px] th-muted font-mono font-bold uppercase select-none">
                      ✅ Kickoff Tbl • Wagering Active
                    </span>
                  )}
                  
                  <button
                    disabled={isBettingDisabled}
                    onClick={() => setActiveModalFixtureId(fixture.id)}
                    className="text-[10px] th-acc hover:th-acc font-bold font-sans tracking-wide cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                  >
                    <span>▶️ ALL MARKETS ({Object.keys(fixture.odds).length}+)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenBetBuilder?.(fixture.id)}
                    disabled={isFT}
                    className="text-[10px] th-amber hover:th-amber font-bold font-sans tracking-wide cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
                  >
                    ⚡ BET BUILDER
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {/* Modals & Popups */}
      {activeModalFixtureId && activeFixture && activeFixtureHomeTeam && activeFixtureAwayTeam && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="th-solid border th-border rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl relative overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b th-border flex items-center justify-between shrink-0 sticky top-0 th-solid z-10">
              <div className="flex flex-col">
                <span className="text-[10px] th-muted font-mono tracking-widest uppercase font-bold mb-1">Live Betting Detailed Markets</span>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <TeamCrest team={activeFixtureHomeTeam} size={24} />
                    <span className="text-sm font-bold th-text">{activeFixtureHomeTeam.name}</span>
                  </div>
                  <span className="text-xs th-muted font-bold">vs</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold th-text">{activeFixtureAwayTeam.name}</span>
                    <TeamCrest team={activeFixtureAwayTeam} size={24} />
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setActiveModalFixtureId(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full th-wash hover:th-wash2 th-muted hover:th-text transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex items-center overflow-x-auto no-scrollbar border-b th-border shrink-0 th-solid">
              {["ALL", "MAIN", "GOALS", "HALF", "CORNERS", "CARDS"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveModalTab(tab as any)}
                  className={`px-5 py-3 text-xs font-bold whitespace-nowrap transition-colors tracking-wide ${
                    activeModalTab === tab 
                      ? "th-acc border-b-2 th-border-acc th-acc-soft" 
                      : "th-muted hover:th-text"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              
              {/* Main 1X2 - Shows in ALL and MAIN */}
              {(activeModalTab === "ALL" || activeModalTab === "MAIN") && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs th-text font-bold">1X2 Match Winner</span>
                    <InfoButton text="Predict the final outcome of the match: Home Win, Draw, or Away Win" />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "HOME", t: activeFixtureHomeTeam.name, o: getModalLiveOdds("MATCH_WINNER", "HOME", activeFixture.odds.homeWin), n: `${activeFixtureHomeTeam.shortName} to Win` },
                      { id: "DRAW", t: "Draw", o: getModalLiveOdds("MATCH_WINNER", "DRAW", activeFixture.odds.draw), n: `Draw` },
                      { id: "AWAY", t: activeFixtureAwayTeam.name, o: getModalLiveOdds("MATCH_WINNER", "AWAY", activeFixture.odds.awayWin), n: `${activeFixtureAwayTeam.shortName} to Win` },
                    ].map(b => (
                      <button
                        key={b.id}
                        disabled={b.o === null}
                        onClick={() => handleMarketClick(activeFixture, "MATCH_WINNER", b.id, b.o, b.n, "Match Winner")}
                        className={`py-3 px-3 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between border cursor-pointer transition-all ${
                          b.o === null
                            ? "th-inset border-transparent th-faint cursor-not-allowed opacity-50"
                            : isSelected(activeFixture.id, "MATCH_WINNER", b.id)
                            ? "th-acc-soft th-border-acc th-acc font-bold"
                            : "th-solid2 th-border hover:th-wash th-sub"
                        }`}
                      >
                        <span className="text-[10px] sm:text-xs font-semibold">{b.t}</span>
                        <span className="text-xs font-black font-mono">{b.o !== null ? `@${b.o.toFixed(2)}` : "🔒 SUSP"}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Double Chance */}
              {activeFixture.odds.doubleChance && (activeModalTab === "ALL" || activeModalTab === "MAIN") && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs th-text font-bold">Double Chance</span>
                    <InfoButton text="Bet on two of three possible outcomes (e.g., Home or Draw)" />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "HOME_OR_DRAW", t: "Home/Draw", o: getModalLiveOdds("DOUBLE_CHANCE", "1X", activeFixture.odds.doubleChance.homeOrDraw), n: `Home or Draw` },
                      { id: "HOME_OR_AWAY", t: "Home/Away", o: getModalLiveOdds("DOUBLE_CHANCE", "12", activeFixture.odds.doubleChance.homeOrAway), n: `Home or Away` },
                      { id: "DRAW_OR_AWAY", t: "Draw/Away", o: getModalLiveOdds("DOUBLE_CHANCE", "X2", activeFixture.odds.doubleChance.drawOrAway), n: `Draw or Away` },
                    ].map(b => (
                      <button
                        key={b.id}
                        disabled={b.o === null}
                        onClick={() => handleMarketClick(activeFixture, "DOUBLE_CHANCE", b.id, b.o, b.n, "Double Chance")}
                        className={`py-3 px-3 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between border cursor-pointer transition-all ${
                          b.o === null
                            ? "th-inset border-transparent th-faint cursor-not-allowed opacity-50"
                            : isSelected(activeFixture.id, "DOUBLE_CHANCE", b.id)
                            ? "th-acc-soft th-border-acc th-acc font-bold"
                            : "th-solid2 th-border hover:th-wash th-sub"
                        }`}
                      >
                        <span className="text-[10px] sm:text-xs font-semibold">{b.t}</span>
                        <span className="text-xs font-black font-mono">{b.o !== null ? `@${b.o.toFixed(2)}` : "🔒 SUSP"}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Result + BTTS combos */}
              {activeFixture.odds.resultBtts && (activeModalTab === "ALL" || activeModalTab === "MAIN") && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs th-text font-bold">Result + BTTS Combo</span>
                    <InfoButton text="Combine the match result with whether both teams score — one pick, bigger price." />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {activeFixture.odds.resultBtts.map((r) => {
                      const live = getModalLiveOdds("RESULT_BTTS", r.selectionId, r.odds);
                      return (
                        <button
                          key={r.selectionId}
                          disabled={live === null}
                          onClick={() => handleMarketClick(activeFixture, "RESULT_BTTS", r.selectionId, live, r.label, "Result + BTTS")}
                          className={`py-2 px-3 rounded-lg flex items-center justify-between border cursor-pointer transition-all ${live === null ? "th-inset border-transparent th-faint cursor-not-allowed opacity-50" : isSelected(activeFixture.id, "RESULT_BTTS", r.selectionId) ? "th-acc-soft th-border-acc th-acc font-bold" : "th-solid2 th-border hover:th-wash th-sub"}`}
                        >
                          <span className="text-[10px] sm:text-xs font-semibold">{r.label}</span>
                          <span className="text-xs font-black font-mono">{live !== null ? `@${live.toFixed(2)}` : "🔒 SUSP"}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Win to nil */}
              {activeFixture.odds.winToNil && (activeModalTab === "ALL" || activeModalTab === "MAIN") && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs th-text font-bold">Win to Nil</span>
                    <InfoButton text="A team wins without conceding a single goal." />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {activeFixture.odds.winToNil.map((r) => {
                      const live = getModalLiveOdds("WIN_TO_NIL", r.selectionId, r.odds);
                      return (
                        <button
                          key={r.selectionId}
                          disabled={live === null}
                          onClick={() => handleMarketClick(activeFixture, "WIN_TO_NIL", r.selectionId, live, r.label, "Win to Nil")}
                          className={`py-2 px-3 rounded-lg flex items-center justify-between border cursor-pointer transition-all ${live === null ? "th-inset border-transparent th-faint cursor-not-allowed opacity-50" : isSelected(activeFixture.id, "WIN_TO_NIL", r.selectionId) ? "th-acc-soft th-border-acc th-acc font-bold" : "th-solid2 th-border hover:th-wash th-sub"}`}
                        >
                          <span className="text-[10px] sm:text-xs font-semibold">{r.label}</span>
                          <span className="text-xs font-black font-mono">{live !== null ? `@${live.toFixed(2)}` : "🔒 SUSP"}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Goal Markets */}
              {(activeModalTab === "ALL" || activeModalTab === "GOALS") && (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs th-text font-bold">Over/Under Goals</span>
                      <InfoButton text="Predict if the total goals scored will be over or under the line" />
                    </div>
                    {activeFixture.odds.overUnder && (
                      <div className="space-y-2">
                        {["0.5", "1.5", "2.5", "3.5", "4.5"].map((line) => {
                          const ou = activeFixture.odds.overUnder as any;
                          const tLine = line.replace(".", "_");
                          const liveOverOdds = getModalLiveOdds("OVER_UNDER_GOALS", `OVER_${line}`, ou[`over${tLine}`]);
                          const liveUnderOdds = getModalLiveOdds("OVER_UNDER_GOALS", `UNDER_${line}`, ou[`under${tLine}`]);
                          return (
                            <div key={line} className="grid grid-cols-2 gap-2">
                              <button
                                disabled={liveOverOdds === null}
                                onClick={() => handleMarketClick(activeFixture, "OVER_UNDER_GOALS", `OVER_${line}`, liveOverOdds, `Over ${line} Goals`, `Over/Under`)}
                                className={`py-3 px-4 rounded-lg flex items-center justify-between border cursor-pointer transition-all ${
                                  liveOverOdds === null
                                    ? "th-inset border-transparent th-faint cursor-not-allowed opacity-50"
                                    : isSelected(activeFixture.id, "OVER_UNDER_GOALS", `OVER_${line}`)
                                    ? "th-acc-soft th-border-acc th-acc font-bold"
                                    : "th-solid2 th-border hover:th-wash th-sub"
                                }`}
                              >
                                <span className="text-[10px] sm:text-xs font-semibold">Over {line}</span>
                                <span className="text-xs font-black font-mono">{liveOverOdds !== null ? `@${liveOverOdds.toFixed(2)}` : "🔒 SUSP"}</span>
                              </button>
                              <button
                                disabled={liveUnderOdds === null}
                                onClick={() => handleMarketClick(activeFixture, "OVER_UNDER_GOALS", `UNDER_${line}`, liveUnderOdds, `Under ${line} Goals`, `Over/Under`)}
                                className={`py-3 px-4 rounded-lg flex items-center justify-between border cursor-pointer transition-all ${
                                  liveUnderOdds === null
                                    ? "th-inset border-transparent th-faint cursor-not-allowed opacity-50"
                                    : isSelected(activeFixture.id, "OVER_UNDER_GOALS", `UNDER_${line}`)
                                    ? "th-acc-soft th-border-acc th-acc font-bold"
                                    : "th-solid2 th-border hover:th-wash th-sub"
                                }`}
                              >
                                <span className="text-[10px] sm:text-xs font-semibold">Under {line}</span>
                                <span className="text-xs font-black font-mono">{liveUnderOdds !== null ? `@${liveUnderOdds.toFixed(2)}` : "🔒 SUSP"}</span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  
                  {activeFixture.odds?.bothTeamsToScore && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs th-text font-bold">Both Teams to Score (GG/NG)</span>
                        <InfoButton text="Will both teams score at least 1 goal?" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {(() => {
                          const liveBttsYes = getModalLiveOdds("BOTH_TEAMS_TO_SCORE", "YES", activeFixture.odds!.bothTeamsToScore!.yes);
                          const liveBttsNo = getModalLiveOdds("BOTH_TEAMS_TO_SCORE", "NO", activeFixture.odds!.bothTeamsToScore!.no);
                          return (
                            <>
                              <button
                                disabled={liveBttsYes === null}
                                onClick={() => handleMarketClick(activeFixture, "BOTH_TEAMS_TO_SCORE", "YES", liveBttsYes, `BTTS: Yes`, "BTTS")}
                                className={`py-3 px-4 rounded-lg flex items-center justify-between border cursor-pointer transition-all ${
                                  liveBttsYes === null
                                    ? "th-inset border-transparent th-faint cursor-not-allowed opacity-50"
                                    : isSelected(activeFixture.id, "BOTH_TEAMS_TO_SCORE", "YES") ? "th-acc-soft th-border-acc th-acc font-bold" : "th-solid2 th-border hover:th-wash th-sub"
                                }`}
                              >
                                <span className="text-[10px] sm:text-xs font-semibold">Yes (GG)</span>
                                <span className="text-xs font-black font-mono">{liveBttsYes !== null ? `@${liveBttsYes.toFixed(2)}` : "🔒 SUSP"}</span>
                              </button>
                              <button
                                disabled={liveBttsNo === null}
                                onClick={() => handleMarketClick(activeFixture, "BOTH_TEAMS_TO_SCORE", "NO", liveBttsNo, `BTTS: No`, "BTTS")}
                                className={`py-3 px-4 rounded-lg flex items-center justify-between border cursor-pointer transition-all ${
                                  liveBttsNo === null
                                    ? "th-inset border-transparent th-faint cursor-not-allowed opacity-50"
                                    : isSelected(activeFixture.id, "BOTH_TEAMS_TO_SCORE", "NO") ? "th-acc-soft th-border-acc th-acc font-bold" : "th-solid2 th-border hover:th-wash th-sub"
                                }`}
                              >
                                <span className="text-[10px] sm:text-xs font-semibold">No (NG)</span>
                                <span className="text-xs font-black font-mono">{liveBttsNo !== null ? `@${liveBttsNo.toFixed(2)}` : "🔒 SUSP"}</span>
                              </button>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs th-text font-bold">Correct Score</span>
                      <InfoButton text="Predict the exact final score of the match. High odds, high risk!" />
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {activeFixture.odds.exactScores.map(sc => {
                        const isSel = isSelected(activeFixture.id, "EXACT_SCORE", sc.score);
                        const liveScoOdds = getModalLiveOdds("EXACT_SCORE", sc.score, sc.odds);
                        return (
                          <button
                            key={sc.score}
                            disabled={liveScoOdds === null}
                            onClick={() => handleMarketClick(activeFixture, "EXACT_SCORE", sc.score, liveScoOdds, `Score: ${sc.score}`, "Correct Score")}
                            className={`py-2 px-2 rounded-lg text-center border cursor-pointer font-mono whitespace-nowrap transition-all flex flex-col items-center ${
                              liveScoOdds === null
                                ? "th-inset border-transparent th-faint cursor-not-allowed opacity-50"
                                : isSel ? "th-acc-soft th-border-acc th-acc" : "th-solid2 th-border hover:th-wash th-sub"
                            }`}
                          >
                            <span className="text-[10px] sm:text-xs font-bold">{sc.score.startsWith("ANY_") ? (sc.score === "ANY_HOME" ? "Any other home" : sc.score === "ANY_DRAW" ? "Any other draw" : "Any other away") : sc.score}</span>
                            <span className="text-[10px] font-black tracking-tight">{liveScoOdds !== null ? `@${liveScoOdds.toFixed(2)}` : "🔒 SUSP"}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {activeFixture.odds.teamTotals && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs th-text font-bold">Team Totals</span>
                        <InfoButton text="How many goals will one team score? Home and away lines are independent." />
                      </div>
                      <div className="space-y-2">
                        {(["HOME", "AWAY"] as const).map((side) => (
                          <div key={side} className="space-y-1.5">
                            <span className="text-[10px] font-mono th-muted">
                              {side === "HOME" ? activeFixtureHomeTeam.shortName : activeFixtureAwayTeam.shortName} goals
                            </span>
                            <div className="grid grid-cols-2 gap-1.5">
                              {activeFixture.odds.teamTotals!.filter((t) => t.side === side).map((t) => {
                                const overId = `${side}_OVER_${t.line}`;
                                const underId = `${side}_UNDER_${t.line}`;
                                const liveOver = getModalLiveOdds("TEAM_TOTAL_GOALS", overId, t.over);
                                const liveUnder = getModalLiveOdds("TEAM_TOTAL_GOALS", underId, t.under);
                                return (
                                  <div key={`${side}-${t.line}`} className="grid grid-cols-2 gap-1.5 col-span-2 items-center">
                                    <span className="text-[10px] font-mono th-muted col-span-2 -mb-0.5">Line {t.line}</span>
                                    <button
                                      disabled={liveOver === null}
                                      onClick={() => handleMarketClick(activeFixture, "TEAM_TOTAL_GOALS", overId, liveOver, `${side === "HOME" ? activeFixtureHomeTeam.shortName : activeFixtureAwayTeam.shortName} Over ${t.line}`, "Team Total")}
                                      className={`py-2 px-2 rounded-lg text-center border cursor-pointer font-mono transition-all ${liveOver === null ? "th-inset border-transparent th-faint cursor-not-allowed opacity-50" : isSelected(activeFixture.id, "TEAM_TOTAL_GOALS", overId) ? "th-acc-soft th-border-acc th-acc" : "th-solid2 th-border hover:th-wash th-sub"}`}
                                    >
                                      <span className="text-[10px] font-bold">Over {t.line} @{liveOver !== null ? liveOver.toFixed(2) : "🔒"}</span>
                                    </button>
                                    <button
                                      disabled={liveUnder === null}
                                      onClick={() => handleMarketClick(activeFixture, "TEAM_TOTAL_GOALS", underId, liveUnder, `${side === "HOME" ? activeFixtureHomeTeam.shortName : activeFixtureAwayTeam.shortName} Under ${t.line}`, "Team Total")}
                                      className={`py-2 px-2 rounded-lg text-center border cursor-pointer font-mono transition-all ${liveUnder === null ? "th-inset border-transparent th-faint cursor-not-allowed opacity-50" : isSelected(activeFixture.id, "TEAM_TOTAL_GOALS", underId) ? "th-acc-soft th-border-acc th-acc" : "th-solid2 th-border hover:th-wash th-sub"}`}
                                    >
                                      <span className="text-[10px] font-bold">Under {t.line} @{liveUnder !== null ? liveUnder.toFixed(2) : "🔒"}</span>
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeFixture.odds.cleanSheet && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs th-text font-bold">Clean Sheet</span>
                        <InfoButton text="Will a team finish without conceding? Home and away are independent picks." />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {activeFixture.odds.cleanSheet.map((c) => {
                          const live = getModalLiveOdds("CLEAN_SHEET", c.selectionId, c.odds);
                          return (
                            <button
                              key={c.selectionId}
                              disabled={live === null}
                              onClick={() => handleMarketClick(activeFixture, "CLEAN_SHEET", c.selectionId, live, c.label, "Clean Sheet")}
                              className={`py-2 px-3 rounded-lg flex items-center justify-between border cursor-pointer transition-all ${live === null ? "th-inset border-transparent th-faint cursor-not-allowed opacity-50" : isSelected(activeFixture.id, "CLEAN_SHEET", c.selectionId) ? "th-acc-soft th-border-acc th-acc font-bold" : "th-solid2 th-border hover:th-wash th-sub"}`}
                            >
                              <span className="text-[10px] sm:text-xs font-semibold">{c.label}</span>
                              <span className="text-xs font-black font-mono">{live !== null ? `@${live.toFixed(2)}` : "🔒 SUSP"}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Half-time / Full-time */}
              {activeFixture.odds.htFt && (activeModalTab === "ALL" || activeModalTab === "HALF") && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs th-text font-bold">Half-time / Full-time</span>
                    <InfoButton text="Predict the half-time result and the full-time result together (e.g. Draw then Home win)." />
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {activeFixture.odds.htFt.map((r) => {
                      const live = getModalLiveOdds("HT_FT", r.selectionId, r.odds);
                      return (
                        <button
                          key={r.selectionId}
                          disabled={live === null}
                          onClick={() => handleMarketClick(activeFixture, "HT_FT", r.selectionId, live, `HT/FT: ${r.label}`, "HT/FT")}
                          className={`py-2 px-2 rounded-lg text-center border cursor-pointer transition-all flex flex-col items-center ${live === null ? "th-inset border-transparent th-faint cursor-not-allowed opacity-50" : isSelected(activeFixture.id, "HT_FT", r.selectionId) ? "th-acc-soft th-border-acc th-acc" : "th-solid2 th-border hover:th-wash th-sub"}`}
                        >
                          <span className="text-[10px] sm:text-xs font-bold">{r.label}</span>
                          <span className="text-[10px] font-black tracking-tight">{live !== null ? `@${live.toFixed(2)}` : "🔒 SUSP"}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Player Specials (Half/Others) */}
              {(activeModalTab === "ALL" || activeModalTab === "HALF") && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs th-text font-bold">Anytime Goalscorers</span>
                    <InfoButton text="Predict a player to score at any time during the match." />
                  </div>
                  <div className="grid grid-cols-1 gap-1">
                    {activeFixture.odds.goalscorers.map(gs => {
                      const liveGsOdds = getModalLiveOdds("ANYTIME_GOALSCORER", gs.playerId, gs.odds);
                      return (
                        <button
                          key={gs.playerId}
                          disabled={liveGsOdds === null}
                          onClick={() => handleMarketClick(activeFixture, "ANYTIME_GOALSCORER", gs.playerId, liveGsOdds, `${gs.name} to Score`, "Goalscorer")}
                          className={`py-2 px-3 rounded-lg flex items-center justify-between border cursor-pointer transition-all ${
                            liveGsOdds === null
                              ? "th-inset border-transparent th-faint cursor-not-allowed opacity-50"
                              : isSelected(activeFixture.id, "ANYTIME_GOALSCORER", gs.playerId) ? "th-acc-soft th-border-acc th-acc font-bold" : "th-solid2 th-border hover:th-wash th-sub"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold">{gs.name}</span>
                            <span className="text-[9px] th-muted font-mono">{gs.position}</span>
                          </div>
                          <span className="text-xs font-black font-mono">{liveGsOdds !== null ? `@${liveGsOdds.toFixed(2)}` : "🔒 SUSP"}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Corners */}
              {activeFixture.odds.overUnderCorners && activeFixture.odds.overUnderCorners.length > 0 && (activeModalTab === "ALL" || activeModalTab === "CORNERS") && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs th-text font-bold">Total Corners</span>
                    <InfoButton text="Will the match have over or under the total number of corners?" />
                  </div>
                  <div className="flex flex-col gap-2 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                    {activeFixture.odds.overUnderCorners.map((ou) => {
                      const liveOver = getModalLiveOdds("OVER_UNDER_CORNERS", `OVER_${ou.line}`, ou.over);
                      const liveUnder = getModalLiveOdds("OVER_UNDER_CORNERS", `UNDER_${ou.line}`, ou.under);
                      return (
                        <div key={`corners-${ou.line}`} className="grid grid-cols-[auto_1fr_1fr] gap-2 items-center">
                          <span className="text-xs font-bold th-muted w-8">{ou.line}</span>
                          <button
                            disabled={liveOver === null}
                            onClick={() => handleMarketClick(activeFixture, "OVER_UNDER_CORNERS", `OVER_${ou.line}`, liveOver, `Over ${ou.line} Corners`, "Corners")}
                            className={`py-2 px-3 rounded-lg flex items-center justify-between border cursor-pointer transition-all ${
                              liveOver === null
                                ? "th-inset border-transparent th-faint cursor-not-allowed opacity-50"
                                : isSelected(activeFixture.id, "OVER_UNDER_CORNERS", `OVER_${ou.line}`) ? "th-acc-soft th-border-acc th-acc" : "th-solid2 th-border hover:th-wash th-sub"
                            }`}
                          >
                            <span className="text-[10px] font-semibold">Over</span>
                            <span className="text-[10px] font-black font-mono">{liveOver !== null ? `@${liveOver.toFixed(2)}` : "🔒 SUSP"}</span>
                          </button>
                          <button
                            disabled={liveUnder === null}
                            onClick={() => handleMarketClick(activeFixture, "OVER_UNDER_CORNERS", `UNDER_${ou.line}`, liveUnder, `Under ${ou.line} Corners`, "Corners")}
                            className={`py-2 px-3 rounded-lg flex items-center justify-between border cursor-pointer transition-all ${
                              liveUnder === null
                                ? "th-inset border-transparent th-faint cursor-not-allowed opacity-50"
                                : isSelected(activeFixture.id, "OVER_UNDER_CORNERS", `UNDER_${ou.line}`) ? "th-acc-soft th-border-acc th-acc" : "th-solid2 th-border hover:th-wash th-sub"
                            }`}
                          >
                            <span className="text-[10px] font-semibold">Under</span>
                            <span className="text-[10px] font-black font-mono">{liveUnder !== null ? `@${liveUnder.toFixed(2)}` : "🔒 SUSP"}</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Cards */}
              {activeFixture.odds.overUnderCards && activeFixture.odds.overUnderCards.length > 0 && (activeModalTab === "ALL" || activeModalTab === "CARDS") && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs th-text font-bold">Total Cards Issued</span>
                    <InfoButton text="Will the ref issue over or under the total number of cards?" />
                  </div>
                  <div className="flex flex-col gap-2 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                    {activeFixture.odds.overUnderCards.map((ou) => {
                      const liveOver = getModalLiveOdds("OVER_UNDER_CARDS", `OVER_${ou.line}`, ou.over);
                      const liveUnder = getModalLiveOdds("OVER_UNDER_CARDS", `UNDER_${ou.line}`, ou.under);
                      return (
                        <div key={`cards-${ou.line}`} className="grid grid-cols-[auto_1fr_1fr] gap-2 items-center">
                          <span className="text-xs font-bold th-muted w-8">{ou.line}</span>
                          <button
                            disabled={liveOver === null}
                            onClick={() => handleMarketClick(activeFixture, "OVER_UNDER_CARDS", `OVER_${ou.line}`, liveOver, `Over ${ou.line} Cards`, "Cards")}
                            className={`py-2 px-3 rounded-lg flex items-center justify-between border cursor-pointer transition-all ${
                              liveOver === null
                                ? "th-inset border-transparent th-faint cursor-not-allowed opacity-50"
                                : isSelected(activeFixture.id, "OVER_UNDER_CARDS", `OVER_${ou.line}`) ? "th-acc-soft th-border-acc th-acc" : "th-solid2 th-border hover:th-wash th-sub"
                            }`}
                          >
                            <span className="text-[10px] font-semibold">Over</span>
                            <span className="text-[10px] font-black font-mono">{liveOver !== null ? `@${liveOver.toFixed(2)}` : "🔒 SUSP"}</span>
                          </button>
                          <button
                            disabled={liveUnder === null}
                            onClick={() => handleMarketClick(activeFixture, "OVER_UNDER_CARDS", `UNDER_${ou.line}`, liveUnder, `Under ${ou.line} Cards`, "Cards")}
                            className={`py-2 px-3 rounded-lg flex items-center justify-between border cursor-pointer transition-all ${
                              liveUnder === null
                                ? "th-inset border-transparent th-faint cursor-not-allowed opacity-50"
                                : isSelected(activeFixture.id, "OVER_UNDER_CARDS", `UNDER_${ou.line}`) ? "th-acc-soft th-border-acc th-acc" : "th-solid2 th-border hover:th-wash th-sub"
                            }`}
                          >
                            <span className="text-[10px] font-semibold">Under</span>
                            <span className="text-[10px] font-black font-mono">{liveUnder !== null ? `@${liveUnder.toFixed(2)}` : "🔒 SUSP"}</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              
              {/* Goalkeeper Saves */}
              {activeFixture.odds.overUnderSaves && activeFixture.odds.overUnderSaves.length > 0 && (activeModalTab === "ALL" || activeModalTab === "MAIN") && (
                 <div className="space-y-2">
                   <div className="flex items-center gap-2 mb-1">
                     <span className="text-xs th-text font-bold">Total Scrapes & Saves</span>
                     <InfoButton text="Will both Goalkeepers make more combined saves than this number?" />
                   </div>
                   <div className="flex flex-col gap-2 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                     {activeFixture.odds.overUnderSaves.map((ou) => {
                       const liveOver = getModalLiveOdds("OVER_UNDER_SAVES", `OVER_${ou.line}`, ou.over);
                       const liveUnder = getModalLiveOdds("OVER_UNDER_SAVES", `UNDER_${ou.line}`, ou.under);
                       return (
                         <div key={`saves-${ou.line}`} className="grid grid-cols-[auto_1fr_1fr] gap-2 items-center">
                           <span className="text-xs font-bold th-muted w-8">{ou.line}</span>
                           <button
                             disabled={liveOver === null}
                             onClick={() => handleMarketClick(activeFixture, "OVER_UNDER_SAVES", `OVER_${ou.line}`, liveOver, `Over ${ou.line} Saves`, "Saves")}
                             className={`py-2 px-3 rounded-lg flex items-center justify-between border cursor-pointer transition-all ${
                               liveOver === null
                                 ? "th-inset border-transparent th-faint cursor-not-allowed opacity-50"
                                 : isSelected(activeFixture.id, "OVER_UNDER_SAVES", `OVER_${ou.line}`) ? "th-acc-soft th-border-acc th-acc" : "th-solid2 th-border hover:th-wash th-sub"
                             }`}
                           >
                             <span className="text-[10px] font-semibold">Over</span>
                             <span className="text-[10px] font-black font-mono">{liveOver !== null ? `@${liveOver.toFixed(2)}` : "🔒 SUSP"}</span>
                           </button>
                           <button
                             disabled={liveUnder === null}
                             onClick={() => handleMarketClick(activeFixture, "OVER_UNDER_SAVES", `UNDER_${ou.line}`, liveUnder, `Under ${ou.line} Saves`, "Saves")}
                             className={`py-2 px-3 rounded-lg flex items-center justify-between border cursor-pointer transition-all ${
                               liveUnder === null
                                 ? "th-inset border-transparent th-faint cursor-not-allowed opacity-50"
                                 : isSelected(activeFixture.id, "OVER_UNDER_SAVES", `UNDER_${ou.line}`) ? "th-acc-soft th-border-acc th-acc" : "th-solid2 th-border hover:th-wash th-sub"
                             }`}
                           >
                             <span className="text-[10px] font-semibold">Under</span>
                             <span className="text-[10px] font-black font-mono">{liveUnder !== null ? `@${liveUnder.toFixed(2)}` : "🔒 SUSP"}</span>
                           </button>
                         </div>
                       );
                     })}
                   </div>
                 </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
};

