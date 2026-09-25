import React, { useMemo, useState } from "react";
import { Trophy, Award, Sparkles, User, Coins, ArrowRight, Trash2, Wallet, Swords, CalendarDays, ChevronDown } from "lucide-react";
import { LINKS } from "./ui/site-footer";
import { getKeysForMode, loadFixtures, loadProfile } from "../utils/storage";
import { ROUND_SHORT_LABELS } from "../data/tournament";
import { useTheme } from "../hooks/useTheme";
import { ThemeToggle } from "./ThemeToggle";

// Last mode/slot the player actually entered — read once on mount so the
// form (and "Last Played" badge below) default to wherever they left off.
const getLastUsed = (): { mode: "TOURNAMENT" | "LEAGUE"; slot: number } => {
  const mode =
    (localStorage.getItem("fs_selected_game_mode") as "TOURNAMENT" | "LEAGUE" | null) ||
    "TOURNAMENT";
  const slot = parseInt(localStorage.getItem("fs_selected_game_slot") || "1", 10) || 1;
  return { mode, slot: slot >= 1 && slot <= 3 ? slot : 1 };
};

interface WelcomeScreenProps {
  onKickoff: (username: string, startingBalance: number, mode: "TOURNAMENT" | "LEAGUE", slot: number) => void;
  savedTournaments: boolean[]; // index 0, 1, 2 correspond to Slot 1, 2, 3
  savedLeagues: boolean[];      // index 0, 1, 2 correspond to Slot 1, 2, 3
  resumeActiveMode: (mode: "TOURNAMENT" | "LEAGUE", slot: number) => void;
  onDeleteSave: (mode: "TOURNAMENT" | "LEAGUE", slot: number) => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onKickoff,
  savedTournaments,
  savedLeagues,
  resumeActiveMode,
  onDeleteSave
}) => {
  const lastUsed = React.useMemo(getLastUsed, []);
  const [username, setUsername] = useState<string>(() => {
    try {
      const cp = localStorage.getItem(getKeysForMode(lastUsed.mode, lastUsed.slot).profile);
      const savedUsername = cp ? JSON.parse(cp)?.username : null;
      return typeof savedUsername === "string" && savedUsername ? savedUsername : "Tobi";
    } catch {
      return "Tobi";
    }
  });
  const [balance, setBalance] = useState<number>(1000);
  const [mode, setMode] = useState<"TOURNAMENT" | "LEAGUE">(lastUsed.mode);
  const [selectedSlot, setSelectedSlot] = useState<number>(lastUsed.slot);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{mode: "TOURNAMENT" | "LEAGUE", slot: number} | null>(null);
  const [overwriteConfirmation, setOverwriteConfirmation] = useState(false);
  const [expandedKey, setExpandedKey] = useState<string | null>(() => `${lastUsed.mode}:${lastUsed.slot}`);
  // Bumped after delete/overwrite so slot summaries re-read localStorage even
  // when the parent doesn't re-render (deleting a save sets no React state).
  const [refreshKey, setRefreshKey] = useState(0);
  const { theme, setTheme } = useTheme();

  // Selection presets for starting bankroll budget
  const balancePresets = [500, 1000, 2500, 5000];

  // Real save details per slot, read from the signed saves (same keys the game
  // resumes from). Corrupt/tampered saves verify to null and render as Empty.
  interface SlotSummary {
    exists: boolean;
    username: string;
    balance: number;
    stageLabel: string;
    gamesPlayed: number;
    betsPlaced: number;
  }
  const readSummary = (slotMode: "TOURNAMENT" | "LEAGUE", slot: number): SlotSummary => {
    const empty: SlotSummary = { exists: false, username: "", balance: 0, stageLabel: "", gamesPlayed: 0, betsPlaced: 0 };
    try {
      const keys = getKeysForMode(slotMode, slot);
      const profile = loadProfile(keys);
      if (!profile) return empty;
      const fixtures = loadFixtures(keys);
      const finished = fixtures ? fixtures.filter((f) => f.status === "FT").length : 0;
      const stageLabel =
        slotMode === "TOURNAMENT"
          ? (ROUND_SHORT_LABELS[profile.currentRoundIndex] ?? `Round ${profile.currentRoundIndex + 1}`)
          : `Matchday ${(profile.currentRoundIndex ?? 0) + 1}`;
      return {
        exists: true,
        username: profile.username || "Manager",
        balance: profile.balance ?? 0,
        stageLabel,
        gamesPlayed: finished,
        betsPlaced: profile.tickets?.length ?? 0,
      };
    } catch {
      return empty;
    }
  };
  const summaries = useMemo(() => {
    const out: Record<string, SlotSummary> = {};
    (["TOURNAMENT", "LEAGUE"] as const).forEach((m) => {
      [1, 2, 3].forEach((slot) => { out[`${m}:${slot}`] = readSummary(m, slot); });
    });
    // Re-read when the parent's existence flags change (resume/delete/kickoff),
    // or when refreshKey is bumped after an in-place delete/overwrite.
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedTournaments.join(""), savedLeagues.join(""), refreshKey]);

  const writeTargetOccupied =
    (mode === "TOURNAMENT" ? savedTournaments[selectedSlot - 1] : savedLeagues[selectedSlot - 1]) ||
    summaries[`${mode}:${selectedSlot}`]?.exists;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    // Never silently overwrite: an occupied write slot requires confirmation.
    if (writeTargetOccupied && !overwriteConfirmation) {
      setOverwriteConfirmation(true);
      return;
    }
    setOverwriteConfirmation(false);
    onKickoff(username.trim(), balance, mode, selectedSlot);
  };

  return (
    <div className="h-screen w-screen th-app overflow-y-auto overflow-x-hidden font-sans select-none relative" id="welcome-gate-screen">
      <div className="min-h-full w-full flex flex-col items-center justify-center gap-4 p-4 py-12 relative">
        {/* Background visual graphics - football pitch subtle glows */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full th-acc-soft blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-500/5 blur-[120px] pointer-events-none"></div>

        <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-12 gap-8 z-10 my-auto items-stretch">
        
        {/* Left Side: Brand Concept Panel */}
        <div className="md:col-span-5 flex flex-col justify-between p-8 rounded-3xl th-solid border th-border backdrop-blur-md relative">
          
          <div className="space-y-6 relative z-10">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl th-acc-soft border th-border-acc th-acc">
              <Sparkles size={20} className="animate-pulse" />
            </div>
            
            <div className="space-y-2">
              <h1 className="text-3xl font-black uppercase tracking-wider th-text font-sans leading-none">
                Matchday <span className="th-acc">Exchange</span>
              </h1>
              <p className="text-xs th-muted font-mono tracking-widest uppercase">
                Campaign Seeding Arena
              </p>
            </div>

            <p className="text-xs th-muted leading-relaxed">
              Step into the ultimate visual betting and matches simulator. Take charge of a football club championship campaign as a general manager and elite bet predictor.
            </p>

            <div className="flex items-center gap-2">
              <span className="text-[9px] font-mono uppercase tracking-widest th-muted font-bold">Theme</span>
              <ThemeToggle theme={theme} onChange={setTheme} />
            </div>
          </div>

          {/* Quick Stats Panel / Resume options if they already exist */}
          <div className="pt-6 border-t th-border mt-6 space-y-4 relative z-10 max-h-[340px] overflow-y-auto no-scrollbar">
            <h4 className="text-xs font-mono th-muted uppercase tracking-widest block font-bold">
              Active Saved Sessions (Slots)
            </h4>
            
            <div className="space-y-4">
              {([
                { slotMode: "TOURNAMENT" as const, title: "Tournament Mode", icon: Trophy, accent: "amber", existsArr: savedTournaments },
                { slotMode: "LEAGUE" as const, title: "Elite League Mode", icon: Award, accent: "blue", existsArr: savedLeagues },
              ]).map(({ slotMode, title, icon: ModeIcon, accent, existsArr }) => (
                <div key={slotMode} className="space-y-1.5 animate-fade-in">
                  <div className={`flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest font-bold ${accent === "amber" ? "text-amber-500" : "th-info"}`}>
                    <ModeIcon size={11} className="shrink-0" />
                    <span>{title}</span>
                  </div>
                  <div className="grid grid-cols-1 gap-1.5">
                    {[1, 2, 3].map((slot) => {
                      const summary = summaries[`${slotMode}:${slot}`];
                      const exists = existsArr[slot - 1] || summary.exists;
                      const isLastPlayed = exists && lastUsed.mode === slotMode && lastUsed.slot === slot;
                      const key = `${slotMode}:${slot}`;
                      const expanded = expandedKey === key;
                      const ring = isLastPlayed
                        ? (accent === "amber" ? "border-amber-500/40" : "border-blue-400/40")
                        : "th-border";
                      const dot = exists
                        ? (accent === "amber" ? "bg-amber-500 animate-pulse" : "bg-blue-400 animate-pulse")
                        : "th-track";
                      return (
                        <div key={`${slotMode}-slot-${slot}`} className={`rounded-xl th-wash border text-[11px] overflow-hidden ${ring}`}>
                          <button
                            type="button"
                            onClick={() => setExpandedKey(expanded ? null : key)}
                            aria-expanded={expanded}
                            className="w-full flex items-center justify-between p-2 cursor-pointer text-left"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
                              <span className="font-bold th-sub">Slot {slot}</span>
                              {isLastPlayed ? (
                                <span className={`text-[8px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${accent === "amber" ? "bg-amber-500/20 th-amber" : "bg-blue-500/20 th-info"}`}>
                                  Last Played
                                </span>
                              ) : (
                                <span className="text-[9px] font-mono th-muted">
                                  {exists ? "Active Save" : "Empty Slot"}
                                </span>
                              )}
                              {exists && (
                                <span className="text-[9px] font-mono th-acc truncate">
                                  ${summary.balance.toLocaleString()}
                                </span>
                              )}
                            </div>
                            <ChevronDown size={12} className={`th-muted shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} />
                          </button>
                          {expanded && (
                            <div className="px-2 pb-2 pt-0.5 space-y-2 border-t th-border">
                              {exists ? (
                                <>
                                  <div className="grid grid-cols-2 gap-1.5 pt-1.5">
                                    <div className="rounded-lg th-inset border th-border px-2 py-1.5">
                                      <p className="text-[8px] font-mono uppercase tracking-widest th-muted flex items-center gap-1">
                                        <Wallet size={9} /> Wallet
                                      </p>
                                      <p className="text-[12px] font-mono font-bold th-acc">
                                        ${summary.balance.toLocaleString()}
                                      </p>
                                    </div>
                                    <div className="rounded-lg th-inset border th-border px-2 py-1.5">
                                      <p className="text-[8px] font-mono uppercase tracking-widest th-muted flex items-center gap-1">
                                        <CalendarDays size={9} /> Stage
                                      </p>
                                      <p className="text-[11px] font-bold th-text truncate">{summary.stageLabel}</p>
                                    </div>
                                    <div className="rounded-lg th-inset border th-border px-2 py-1.5 col-span-2">
                                      <p className="text-[8px] font-mono uppercase tracking-widest th-muted flex items-center gap-1">
                                        <Swords size={9} /> Campaign
                                      </p>
                                      <p className="text-[10px] th-sub">
                                        <span className="font-bold th-text">{summary.username}</span>
                                        <span className="th-muted"> · {summary.gamesPlayed} played · {summary.betsPlaced} bets</span>
                                      </p>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-2 gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => resumeActiveMode(slotMode, slot)}
                                      className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-2 py-1.5 rounded-lg transition-all text-[10px] uppercase tracking-wide cursor-pointer"
                                    >
                                      Continue Save
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setDeleteConfirmation({ mode: slotMode, slot })}
                                      title="Reset (delete) this save"
                                      className="border border-red-500/40 hover:bg-red-500/15 th-danger font-bold px-2 py-1.5 rounded-lg transition-all text-[10px] uppercase tracking-wide cursor-pointer flex items-center justify-center gap-1"
                                    >
                                      <Trash2 size={10} /> Reset
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <div className="pt-1.5 flex items-center justify-between gap-2">
                                  <span className="text-[9px] font-mono th-muted uppercase">Available — start fresh here</span>
                                  <button
                                    type="button"
                                    onClick={() => { setMode(slotMode); setSelectedSlot(slot); }}
                                    className="th-wash hover:th-wash2 border th-border th-text font-bold px-2 py-1 rounded-lg transition-all text-[9.5px] cursor-pointer"
                                  >
                                    Use this slot
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side: Setup Form Panel */}
        <div className="md:col-span-7 flex flex-col justify-center p-8 rounded-3xl glass-panel-heavy border th-border shadow-2xl relative">
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-1">
              <h2 className="text-xl font-bold th-text font-sans tracking-tight">
                Create Manager Profile
              </h2>
              <p className="text-xs th-muted font-medium">Configure your initial parameters to enter the lobby</p>
            </div>

            {/* Input 1: Username */}
            <div className="space-y-2">
              <label className="text-xs font-mono th-muted uppercase tracking-wider flex items-center gap-1.5 font-bold">
                <User size={12} className="th-muted" />
                Manager Username
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.slice(0, 15))}
                  placeholder="Enter manager name..."
                  required
                  className="w-full th-wash border th-border rounded-xl px-4 py-3 text-sm th-text placeholder:th-muted focus:outline-none focus:th-border-acc focus:ring-1 focus:ring-emerald-500/20 transition-all font-medium"
                />
              </div>
            </div>

            {/* Input 2: Starting Balance presets */}
            <div className="space-y-2">
              <label className="text-xs font-mono th-muted uppercase tracking-wider flex items-center gap-1.5 font-bold">
                <Coins size={12} className="th-muted" />
                Starting Budget Balance
              </label>
              <div className="grid grid-cols-4 gap-2">
                {balancePresets.map((val) => {
                  const isSelected = balance === val;
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setBalance(val)}
                      className={`py-2 rounded-lg text-xs font-bold font-mono transition-all border ${
                        isSelected
                          ? "th-acc-soft th-border-acc th-acc shadow-[0_0_8px_rgba(16,185,129,0.1)]"
                          : "th-wash th-border th-muted hover:th-border hover:th-sub cursor-pointer"
                      }`}
                    >
                      ${val.toLocaleString()}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Input 3: Game Campaign Selection Cards */}
            <div className="space-y-2.5">
              <label className="text-xs font-mono th-muted uppercase tracking-wider font-bold">
                Select Simulation Campaign Mode
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Mode A: TOURNAMENT */}
                <div
                  onClick={() => setMode("TOURNAMENT")}
                  className={`p-4 rounded-2xl border transition-all duration-205 cursor-pointer flex flex-col space-y-2 relative select-none ${
                    mode === "TOURNAMENT"
                      ? "th-solid border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.1)] th-text"
                      : "th-wash th-border th-muted hover:th-border hover:th-wash"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <Trophy className={mode === "TOURNAMENT" ? "text-amber-500" : "th-muted"} size={18} />
                    {mode === "TOURNAMENT" && (
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
                    )}
                  </div>
                  <div>
                    <h3 className={`text-sm font-bold ${mode === "TOURNAMENT" ? "th-text" : "th-sub"}`}>
                      Knockout Tournament
                    </h3>
                    <p className="text-[10.5px] th-muted mt-1 leading-relaxed">
                      Play through a grand 16-team custom bracket. One loss and you are eliminated. Perfect cup rules!
                    </p>
                  </div>
                </div>

                {/* Mode B: LEAGUE */}
                <div
                  onClick={() => setMode("LEAGUE")}
                  className={`p-4 rounded-2xl border transition-all duration-205 cursor-pointer flex flex-col space-y-2 relative select-none ${
                    mode === "LEAGUE"
                      ? "th-solid border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.1)] th-text"
                      : "th-wash th-border th-muted hover:th-border hover:th-wash"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <Award className={mode === "LEAGUE" ? "th-info" : "th-muted"} size={18} />
                    {mode === "LEAGUE" && (
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-450 animate-pulse"></span>
                    )}
                  </div>
                  <div>
                    <h3 className={`text-sm font-bold ${mode === "LEAGUE" ? "th-text" : "th-sub"}`}>
                      Elite League Table
                    </h3>
                    <p className="text-[10.5px] th-muted mt-1 leading-relaxed">
                      Participate in a 15-round, 16-club league. Accumulate points, monitor goal stats, and aim for 1st place!
                    </p>
                  </div>
                </div>

              </div>
            </div>

            {/* Input 4: Active Write Target Slot Selection */}
            <div className="space-y-2">
              <label className="text-xs font-mono th-muted uppercase tracking-wider block font-bold">
                Select Active Write Slot
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map((slotNum) => {
                  const hasExist = mode === "TOURNAMENT" ? savedTournaments[slotNum - 1] : savedLeagues[slotNum - 1];
                  const isSelected = selectedSlot === slotNum;
                  return (
                    <button
                      key={`write-slot-${slotNum}`}
                      type="button"
                      onClick={() => setSelectedSlot(slotNum)}
                      className={`py-2 rounded-xl text-xs font-bold font-mono transition-all border flex flex-col items-center justify-center gap-0.5 ${
                        isSelected
                          ? "th-acc-soft th-border-acc th-acc shadow-[0_0_12px_rgba(16,185,129,0.1)]"
                          : "th-wash th-border th-muted hover:th-border hover:th-sub cursor-pointer"
                      }`}
                    >
                      <span className="text-[11px]">Slot {slotNum}</span>
                      <span className="text-[8px] opacity-70">
                        {hasExist ? "⚠️ Overwrite" : "Empty Slot"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Kick off CTA button */}
            <button
              type="submit"
              className="w-full bg-emerald-500 hover:bg-emerald-450 active:scale-98 text-slate-950 font-sans font-black tracking-wider uppercase py-3.5 px-4 rounded-2xl text-xs transition-all duration-150 flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/25 cursor-pointer mt-4"
            >
              {writeTargetOccupied ? "REVIEW OVERWRITE & KICK OFF" : "KICK OFF CAMPAIGN"}
              <ArrowRight size={14} strokeWidth={2.5} />
            </button>
          </form>

        </div>
      </div>

      {/* Credit — shown every time the app loads (before entering the app), so it's never blocked by in-game UI */}
      <div className="z-10 flex items-center gap-2.5 text-[11px] th-muted">
        <span>
          Built by <span className="font-semibold th-sub">Tobiloba Jagun</span>
        </span>
        <div className="flex overflow-hidden rounded-lg border th-border">
          {LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={link.label}
                title={link.label}
                className="flex h-7 w-8 items-center justify-center th-wash th-sub border-r th-border last:border-r-0 hover:th-wash2 hover:th-text transition-colors"
              >
                <Icon className="size-3.5" />
              </a>
            );
          })}
        </div>
      </div>
      </div>

      {/* Overwrite Confirmation Modal — starting a new campaign on an occupied slot */}
      {overwriteConfirmation && (
        <div className="fixed inset-0 th-inset backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="th-solid border border-amber-500/30 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-xl shadow-amber-500/10 animate-fade-in text-center flex flex-col items-center">
            <div className="h-12 w-12 rounded-full bg-amber-500/10 th-amber flex items-center justify-center mb-2">
              <Trash2 size={24} />
            </div>
            <h3 className="text-lg font-black th-text uppercase tracking-widest font-sans">Overwrite Save?</h3>
            <p className="text-xs th-muted">
              <span className="th-text font-bold">Slot {selectedSlot}</span> ({mode}) already holds a campaign
              {summaries[`${mode}:${selectedSlot}`]?.exists
                ? <> — <span className="th-acc font-mono font-bold">${summaries[`${mode}:${selectedSlot}`].balance.toLocaleString()}</span>, {summaries[`${mode}:${selectedSlot}`].stageLabel}</>
                : null}
              . Starting fresh here permanently replaces it. This cannot be undone.
            </p>
            <div className="grid grid-cols-2 gap-3 w-full pt-4">
              <button
                type="button"
                onClick={() => setOverwriteConfirmation(false)}
                className="py-2.5 rounded-xl border th-border hover:th-wash text-xs font-bold th-sub transition-colors cursor-pointer"
              >
                Keep Save
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setOverwriteConfirmation(false);
                  if (!username.trim()) return;
                  onKickoff(username.trim(), balance, mode, selectedSlot);
                }}
                className="py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-colors shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                Overwrite & Kick Off
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmation && (
        <div className="fixed inset-0 th-inset backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="th-solid border border-red-500/30 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-xl shadow-red-500/10 animate-fade-in text-center flex flex-col items-center">
            <div className="h-12 w-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mb-2">
              <Trash2 size={24} />
            </div>
            <h3 className="text-lg font-black th-text uppercase tracking-widest font-sans">Delete Save?</h3>
            <p className="text-xs th-muted">
              Are you sure you want to permanently delete the <span className="th-text font-bold">{deleteConfirmation.mode}</span> save in <span className="th-text font-bold">Slot {deleteConfirmation.slot}</span>? This action cannot be undone.
            </p>
            <div className="grid grid-cols-2 gap-3 w-full pt-4">
              <button
                onClick={() => setDeleteConfirmation(null)}
                className="py-2.5 rounded-xl border th-border hover:th-wash text-xs font-bold th-sub transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDeleteSave(deleteConfirmation.mode, deleteConfirmation.slot);
                  setDeleteConfirmation(null);
                  setRefreshKey((k) => k + 1);
                }}
                className="py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-slate-950 font-black text-xs transition-colors shadow-lg shadow-red-500/20"
              >
                Delete Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

