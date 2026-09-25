import React, { useEffect, useRef, useState } from "react";
import { FixtureStatus, Team, MatchEvent } from "../types";
import type { FootysimMatch } from "../engine/footysimBridge";
import { getFootysimSession, setFootysimSession } from "../engine/footysimSessionCache";
import { FootballPitch2D, Frame } from "./FootballPitch2D";
import { TeamCrest } from "./TeamCrest";
import { cleanPlayerName } from "../utils/playerUtils";

interface Props {
  homeTeam: Team;
  awayTeam: Team;
  seed: number;
  knockout?: boolean;
  fixtureId: string;
  fixtureStatus: FixtureStatus;
  /** The fixture's real (classic-engine) score — shown for context in replay mode. */
  officialScore: { home: number; away: number } | null;
  /**
   * "official" — fixture is not FT: reaching full time applies this 2D result
   * (it becomes the real score that settles bets). "replay" — fixture already
   * FT: this view never writes; the official score is shown alongside.
   */
  applyMode: "official" | "replay";
  onClose: () => void;
  onApply: (m: FootysimMatch) => void;
  onResim: () => void;
}

const SPEEDS = [1, 2, 4, 8, 20];

type RailTab = "stats" | "feed" | "goals";
type FeedFilter = "ALL" | "KEY" | "ATTACK";

const eventIcon = (type: MatchEvent["type"]): string => {
  switch (type) {
    case "GOAL": return "⚽";
    case "SAVE": return "🧤";
    case "YELLOW_CARD": return "🟨";
    case "RED_CARD": return "🟥";
    case "MISS": return "🎯";
    case "FOUL": return "⚠️";
    default: return "•";
  }
};

export const FootysimMatchViewer: React.FC<Props> = ({
  homeTeam, awayTeam, seed, knockout, fixtureId, fixtureStatus,
  officialScore, applyMode, onClose, onApply, onResim,
}) => {
  // Hydrate from the per-fixture session cache so reopening replays the same
  // match (same seed → same cached sim), never a fresh random one.
  const cached = getFootysimSession(fixtureId);
  const hydrated = cached && cached.seed === seed && cached.match;
  const [match, setMatch] = useState<FootysimMatch | null>(hydrated ? (cached!.match as FootysimMatch) : null);
  const [phase, setPhase] = useState<"simulating" | "playing" | "done" | "error">(
    hydrated ? (cached!.finished ? "done" : "playing") : "simulating",
  );
  const [idx, setIdx] = useState(hydrated ? cached!.idx : 0);
  const [playing, setPlaying] = useState(!hydrated || !cached!.finished);
  const [speed, setSpeed] = useState(hydrated ? cached!.speed : 4);
  const [railTab, setRailTab] = useState<RailTab>("feed");
  const [feedFilter, setFeedFilter] = useState<FeedFilter>("ALL");
  const [goalFlash, setGoalFlash] = useState<MatchEvent | null>(null);
  const [resimArmed, setResimArmed] = useState(false);
  const applied = useRef(false);
  const shownGoalKeys = useRef<Set<string>>(new Set());
  // Refs mirror state for the unmount write-back (closing the modal persists
  // playback so coming back resumes where you left off).
  const stateRef = useRef({ match, idx, phase, speed });
  stateRef.current = { match, idx, phase, speed };
  const seedRef = useRef(seed);
  seedRef.current = seed;

  // Simulate once per fixture+seed in a web worker (keeps the UI responsive).
  useEffect(() => {
    const existing = getFootysimSession(fixtureId);
    if (existing && existing.seed === seed && existing.match) return; // replay cached
    setMatch(null);
    setPhase("simulating");
    setIdx(0);
    applied.current = false;
    shownGoalKeys.current = new Set();
    const worker = new Worker(new URL("../engine/footysimWorker.ts", import.meta.url), { type: "module" });
    worker.postMessage({ homeTeam, awayTeam, seed, knockout });
    worker.onmessage = (e: MessageEvent<FootysimMatch>) => {
      setMatch(e.data);
      setPhase("playing");
      setFootysimSession(fixtureId, { seed, match: e.data, idx: 0, speed: speedRef.current, finished: false });
      worker.terminate();
    };
    worker.onerror = (err) => {
      // Surface worker failure distinctly — never a fake 0-0 "saved" result.
      console.error("[footysim] worker failed to simulate match", err.message || err);
      setPhase("error");
      worker.terminate();
    };
    return () => worker.terminate();
    // homeTeam/awayTeam are stable object refs from context for this fixture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixtureId, seed]);

  const speedRef = useRef(speed);
  speedRef.current = speed;

  // Persist playback on unmount (modal closed → progress saved, not lost).
  useEffect(() => {
    return () => {
      const s = stateRef.current;
      if (s.match) {
        setFootysimSession(fixtureId, {
          seed: seedRef.current,
          match: s.match,
          idx: s.idx,
          speed: speedRef.current,
          finished: s.phase === "done",
        });
      }
    };
  }, [fixtureId]);

  // Frame playback.
  useEffect(() => {
    if (phase !== "playing" || !match || !playing) return;
    const iv = setInterval(() => {
      setIdx((i) => {
        if (i >= match.frames.length - 1) {
          setPhase("done");
          setFootysimSession(fixtureId, { seed: seedRef.current, match, idx: match.frames.length - 1, speed: speedRef.current, finished: true });
          return i;
        }
        return i + 1;
      });
    }, 340 / speed);
    return () => clearInterval(iv);
  }, [phase, match, playing, speed, fixtureId]);

  const frames = (match?.frames ?? []) as unknown as Frame[];
  const frame = frames[Math.min(idx, frames.length - 1)] ?? null;
  const minute = phase === "done" ? 90 : frame ? Math.min(90, Math.round(Number(frame.t) / 60)) : 0;
  const shownEvents = (match?.events ?? []).filter((e) => e.minute <= (phase === "done" ? 999 : minute));
  // Scoreboard + goals rail only ever show goals reached by playback — the
  // final result must not leak before full time is actually watched.
  const goals = shownEvents.filter((e) => e.type === "GOAL");
  const hs = goals.filter((e) => e.teamId === homeTeam.id).length;
  const as_ = goals.filter((e) => e.teamId === awayTeam.id).length;
  const isHalfTime = minute >= 45 && minute <= 47 && phase === "playing";
  const wentET = !!match?.wentToExtraTime;
  const timeLabel =
    phase === "simulating" ? "…" :
    phase === "error" ? "—" :
    phase === "done" ? (wentET ? "AET" : "FULL TIME") :
    isHalfTime ? "HALF TIME" : `${minute}'`;

  // Goal celebration when a new goal is reached.
  useEffect(() => {
    for (const e of shownEvents) {
      if (e.type !== "GOAL") continue;
      const key = `${e.minute}-${e.playerId}`;
      if (!shownGoalKeys.current.has(key)) {
        shownGoalKeys.current.add(key);
        setGoalFlash(e);
        const t = setTimeout(() => setGoalFlash(null), 2200);
        return () => clearTimeout(t);
      }
    }
  }, [shownEvents, setGoalFlash]);

  // Record the result once at full time — ONLY in official mode (fixture not
  // yet FT). In replay mode this view never writes; the official score stands.
  useEffect(() => {
    if (phase === "done" && match && applyMode === "official" && !applied.current) {
      applied.current = true;
      onApply(match);
    }
  }, [phase, match, applyMode, onApply]);

  const skipToResult = () => { if (match) { setIdx(match.frames.length - 1); setPhase("done"); setPlaying(false); } };
  const teamName = (id: string) => (id === homeTeam.id ? homeTeam.name : awayTeam.name);

  const feedEvents = shownEvents.filter((e) => {
    if (feedFilter === "KEY") return e.type === "GOAL" || e.type === "RED_CARD" || e.type === "YELLOW_CARD" || e.type === "COMMENTARY";
    if (feedFilter === "ATTACK") return e.type === "GOAL" || e.type === "SAVE" || e.type === "MISS";
    return true;
  });

  const statsRows = (() => {
    if (!match) return [];
    const h = match.stats.home, a = match.stats.away;
    const possH = h.passes + a.passes > 0 ? Math.round((h.passes / (h.passes + a.passes)) * 100) : 50;
    return [
      { label: "Possession (pass share)", hv: `${possH}%`, av: `${100 - possH}%`, hp: possH, ap: 100 - possH },
      { label: "Shots", hv: h.shots, av: a.shots, hp: h.shots, ap: a.shots },
      { label: "Shots on target", hv: h.shotsOnTarget, av: a.shotsOnTarget, hp: h.shotsOnTarget, ap: a.shotsOnTarget },
      { label: "Corners", hv: h.corners, av: a.corners, hp: h.corners, ap: a.corners },
      { label: "Fouls", hv: h.fouls, av: a.fouls, hp: h.fouls, ap: a.fouls },
      { label: "Yellow cards", hv: h.yellowCards, av: a.yellowCards, hp: h.yellowCards, ap: a.yellowCards },
      { label: "Red cards", hv: h.redCards, av: a.redCards, hp: h.redCards, ap: a.redCards },
      { label: "Saves", hv: h.saves, av: a.saves, hp: h.saves, ap: a.saves },
      { label: "Passes", hv: h.passes, av: a.passes, hp: h.passes, ap: a.passes },
    ];
  })();

  return (
    <div className="fixed inset-0 z-[200] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div className="glass-panel border border-indigo-500/25 rounded-2xl w-full max-w-5xl max-h-[94vh] overflow-y-auto no-scrollbar p-4 space-y-3 shadow-2xl relative">
        {/* top bar */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <button onClick={onClose} className="flex items-center gap-1.5 text-xs font-bold th-wash hover:th-wash2 border th-border px-3 py-1.5 rounded-lg th-text cursor-pointer" title="Close — playback progress is saved, close to place live bets elsewhere">
            ← Back to Live
          </button>
          <span className="text-[10px] font-mono font-black uppercase tracking-widest text-indigo-300">🛰️ Spatial Engine · 2D Match</span>
          {phase === "done" && applyMode === "official"
            ? <span className="text-[9px] font-mono th-acc uppercase">✓ Official result saved</span>
            : applyMode === "replay"
              ? <span className="text-[9px] font-mono th-info uppercase">↻ Replay — official score stands</span>
              : phase === "error"
                ? <span className="text-[9px] font-mono text-rose-400 uppercase">⚠ Simulation failed</span>
                : <span className="text-[9px] font-mono th-amber uppercase">● Becomes official at FT</span>}
        </div>

        {/* authority banner */}
        {applyMode === "replay" && officialScore && (
          <div className="text-[11px] font-mono text-center bg-sky-500/10 border border-sky-500/25 text-sky-200 rounded-lg px-3 py-1.5">
            Official result (settles bets): <span className="font-black">{officialScore.home} – {officialScore.away}</span>
            <span className="th-info/70"> · this 2D view is a replay and will not overwrite it</span>
          </div>
        )}
        {applyMode === "official" && fixtureStatus !== "FT" && (
          <div className="text-[11px] font-mono text-center bg-amber-500/10 border border-amber-500/25 text-amber-200 rounded-lg px-3 py-1.5">
            2D sim is authoritative here — the full-time score below becomes the official result and settles bets
          </div>
        )}

        {/* scoreboard */}
        <div className="flex items-center justify-center gap-4">
          <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
            <span className="text-sm font-black th-text truncate">{homeTeam.name}</span>
            <TeamCrest team={homeTeam} size={28} />
          </div>
          <div className="text-center shrink-0">
            <div className="font-mono text-2xl font-black th-text th-inset px-4 py-1 rounded-lg">{hs} - {as_}</div>
            <div className="text-[10px] font-mono th-muted mt-1">{timeLabel}</div>
            {match?.penaltyScore && (
              <div className="text-[10px] font-mono th-amber mt-0.5">PENS {match.penaltyScore}</div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <TeamCrest team={awayTeam} size={28} />
            <span className="text-sm font-black th-text truncate">{awayTeam.name}</span>
          </div>
        </div>

        {/* main grid: pitch + side rail (compact so stats/feed live alongside) */}
        <div className="grid grid-cols-1 md:grid-cols-[1.35fr_1fr] gap-3">
          <div className="space-y-2 min-w-0">
            <div className="relative">
              {phase === "simulating" ? (
                <div className="h-64 flex items-center justify-center th-muted text-sm animate-pulse">Running the spatial simulation…</div>
              ) : phase === "error" ? (
                <div className="h-64 flex flex-col items-center justify-center gap-2 text-center px-6">
                  <span className="text-3xl">⚠️</span>
                  <p className="text-sm font-bold text-rose-400">The spatial engine couldn't simulate this match.</p>
                  <p className="text-xs th-muted max-w-sm">
                    No result was recorded — the fixture is unchanged. Check the browser console for details, or go back and use the standard sim for this match instead.
                  </p>
                </div>
              ) : (
                <FootballPitch2D frame={frame} homeTeamId={homeTeam.id} homeColor={homeTeam.primaryColor} awayColor={awayTeam.primaryColor} homeName={homeTeam.shortName} awayName={awayTeam.shortName} />
              )}
              {goalFlash && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="bg-emerald-500/90 text-slate-950 font-black px-6 py-3 rounded-2xl text-xl shadow-2xl animate-bounce text-center">
                    ⚽ GOAL!<div className="text-xs font-bold mt-1">{cleanPlayerName(goalFlash.playerName ?? "")} · {teamName(goalFlash.teamId ?? "")}</div>
                  </div>
                </div>
              )}
              {isHalfTime && !goalFlash && (
                <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-amber-500/90 text-slate-950 font-black px-4 py-1 rounded-full text-xs">⏸ HALF TIME</div>
              )}
              {phase === "done" && (
                <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-white/90 text-slate-950 font-black px-4 py-1 rounded-full text-xs">
                  🏁 {wentET ? (match?.penaltyScore ? `PENS ${match.penaltyScore}` : "AFTER EXTRA TIME") : "FULL TIME"}
                </div>
              )}
            </div>

            {/* controls */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                {phase === "playing" && (
                  <button onClick={() => setPlaying((p) => !p)} className="text-[11px] font-bold uppercase th-wash hover:th-wash2 border th-border px-3 py-1.5 rounded-lg th-text cursor-pointer">
                    {playing ? "⏸ Pause" : "▶ Play"}
                  </button>
                )}
                {phase !== "simulating" && SPEEDS.map((s) => (
                  <button key={s} onClick={() => setSpeed(s)} className={`text-[10px] font-bold px-2 py-1.5 rounded-lg cursor-pointer border ${speed === s ? "bg-indigo-500 th-text border-indigo-500" : "th-wash th-muted th-border"}`}>{s}x</button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                {match && !resimArmed && (
                  <button onClick={() => setResimArmed(true)} title="Simulate a brand-new 2D match for this fixture" className="text-[11px] font-bold uppercase th-wash hover:th-wash2 border th-border px-3 py-1.5 rounded-lg th-sub cursor-pointer">
                    🎲 Re-sim
                  </button>
                )}
                {resimArmed && (
                  <span className="flex items-center gap-1.5 text-[11px]">
                    <span className="th-amber font-mono">{fixtureStatus === "FT" || applyMode === "replay" ? "Overwrite official?" : "Discard & re-sim?"}</span>
                    <button onClick={() => { setResimArmed(false); onResim(); }} className="font-bold uppercase bg-red-500 hover:bg-red-400 th-text px-2 py-1 rounded-lg cursor-pointer">Yes</button>
                    <button onClick={() => setResimArmed(false)} className="font-bold uppercase th-wash hover:th-wash2 border th-border px-2 py-1 rounded-lg th-sub cursor-pointer">No</button>
                  </span>
                )}
                {phase === "playing" && (
                  <button onClick={skipToResult} className="text-[11px] font-bold uppercase th-wash hover:th-wash2 border th-border px-3 py-1.5 rounded-lg th-sub cursor-pointer">⏭ Sim straight through</button>
                )}
                <button onClick={onClose} className="text-[11px] font-black uppercase bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-1.5 rounded-lg cursor-pointer">
                  {phase === "done" ? "Done → Live" : "Back to Live"}
                </button>
              </div>
            </div>
            <p className="text-[10px] font-mono th-muted">Closing saves playback — reopen to resume. Place live bets from the Live tab while paused.</p>
          </div>

          {/* side rail */}
          <div className="min-w-0 flex flex-col rounded-xl border th-border th-inset overflow-hidden">
            <div className="flex border-b th-border shrink-0">
              {(["feed", "goals", "stats"] as RailTab[]).map((t) => (
                <button key={t} type="button" onClick={() => setRailTab(t)}
                  className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${railTab === t ? "text-indigo-300 border-b-2 border-indigo-400 bg-indigo-500/5" : "th-muted hover:th-sub"}`}>
                  {t === "feed" ? "Feed" : t === "goals" ? `Goals (${goals.length})` : "Stats"}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto no-scrollbar p-2 min-h-[220px] max-h-[380px]">
              {railTab === "feed" && (
                <div className="space-y-1">
                  <div className="flex gap-1 mb-1.5">
                    {(["ALL", "KEY", "ATTACK"] as FeedFilter[]).map((f) => (
                      <button key={f} type="button" onClick={() => setFeedFilter(f)}
                        className={`text-[9px] font-mono font-bold px-2 py-1 rounded-md cursor-pointer border ${feedFilter === f ? "th-wash2 th-text th-border2" : "th-muted border-transparent hover:th-sub"}`}>
                        {f === "ALL" ? "All" : f === "KEY" ? "Key moments" : "Attack"}
                      </button>
                    ))}
                  </div>
                  <div className="text-[11px] font-mono space-y-0.5">
                    {feedEvents.length === 0 && <div className="th-muted">Kick-off…</div>}
                    {[...feedEvents].reverse().map((e, i) => (
                      <div key={i} className={e.type === "GOAL" ? "th-acc font-bold" : "th-sub"}>
                        <span className="th-muted">{e.minute}'</span>{" "}
                        {eventIcon(e.type)}{" "}
                        {cleanPlayerName(e.playerName ?? e.commentary ?? "")}
                        {e.type === "GOAL" && e.assistantPlayerName && (
                          <span className="th-muted font-normal"> (asst. {cleanPlayerName(e.assistantPlayerName)})</span>
                        )}{" "}
                        <span className="th-muted">· {teamName(e.teamId ?? "")}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {railTab === "goals" && (
                <div className="space-y-1 text-[11px] font-mono">
                  {goals.length === 0 && <div className="th-muted">No goals yet — they stay pinned here once scored.</div>}
                  {goals.map((e, i) => (
                    <div key={i} className="flex items-center gap-2 th-acc-soft border th-border-acc rounded-lg px-2 py-1.5">
                      <span className="font-black th-acc">{e.minute}'</span>
                      <span className="th-text font-bold truncate">{cleanPlayerName(e.playerName ?? "")}</span>
                      {e.assistantPlayerName && (
                        <span className="th-muted truncate text-[10px]">asst. {cleanPlayerName(e.assistantPlayerName)}</span>
                      )}
                      <span className="th-muted truncate">· {teamName(e.teamId ?? "")}</span>
                    </div>
                  ))}
                  {wentET && (
                    <div className="th-amber pt-1">↳ Went to extra time{match?.penaltyScore ? ` — shootout ${match.penaltyScore}` : ""}.</div>
                  )}
                </div>
              )}
              {railTab === "stats" && (
                <div className="space-y-2">
                  <p className="text-[9px] font-mono th-muted uppercase tracking-widest text-center">
                    {phase === "done" ? "Full-time stats" : "Sim final stats (score still playing out)"}
                  </p>
                  <div className="flex items-center justify-between text-[10px] font-mono th-muted px-1">
                    <span className="font-bold" style={{ color: homeTeam.primaryColor }}>{homeTeam.shortName}</span>
                    <span className="uppercase tracking-widest">Stat</span>
                    <span className="font-bold" style={{ color: awayTeam.primaryColor }}>{awayTeam.shortName}</span>
                  </div>
                  {statsRows.map((r) => {
                    const total = Number(r.hp) + Number(r.ap);
                    const pctH = total > 0 ? Math.round((Number(r.hp) / total) * 100) : 50;
                    return (
                      <div key={r.label}>
                        <div className="flex items-center justify-between text-[11px] font-mono px-1">
                          <span className="th-text font-bold">{String(r.hv)}</span>
                          <span className="th-muted text-[10px]">{r.label}</span>
                          <span className="th-text font-bold">{String(r.av)}</span>
                        </div>
                        <div className="flex h-1 rounded-full overflow-hidden th-wash mt-0.5">
                          <div style={{ width: `${pctH}%`, background: homeTeam.primaryColor }} />
                          <div style={{ width: `${100 - pctH}%`, background: awayTeam.primaryColor }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

