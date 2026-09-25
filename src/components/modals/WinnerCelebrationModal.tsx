import React from "react";
import { TeamCrest } from "../TeamCrest";
import { Team } from "../../types";
import { formatMoney } from "../../utils";

interface WinnerCelebrationModalProps {
  gameMode: "TOURNAMENT" | "LEAGUE";
  balance: number;
  championName: string;
  championCrest: Team;
  onClose: () => void;
  onResetRound: (keepRecords: boolean) => void;
}

export const WinnerCelebrationModal: React.FC<WinnerCelebrationModalProps> = ({
  gameMode,
  balance,
  championName,
  championCrest,
  onClose,
  onResetRound
}) => {
  return (
    <div className="fixed inset-0 bg-[#070b11]/95 backdrop-blur-md flex flex-col items-center justify-center p-6 z-[120] animate-fade-in text-center select-none">
      <div className="bg-[#121b26] border border-amber-500/40 rounded-3xl p-8 max-w-sm shadow-2xl relative space-y-6">
        {/* Close Button to inspect matches */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 th-wash hover:th-wash2 th-muted hover:th-text h-8 w-8 rounded-full flex flex-col items-center justify-center cursor-pointer text-xs border th-border transition-colors"
          title="Close and inspect slip results"
        >
          ✕
        </button>

        <div>
          <span className="text-6xl block mt-1 animate-bounce">🏆</span>
          <h1 className="text-base font-black tracking-widest text-[#f5a623] uppercase mt-4">
            CHAMPIONSHIP CROWNED!
          </h1>
        </div>

        <div className="th-inset border th-border rounded-2xl p-4">
          <TeamCrest team={championCrest} size={64} className="mx-auto block" />
          <h2 className="text-sm font-bold th-text mt-2 truncate">
            {championName}
          </h2>
          <p className="text-[10px] th-muted font-mono uppercase mt-1">
            {gameMode === "LEAGUE" ? "League Title Winner" : "Tournament Cup Champions"}
          </p>
        </div>

        <div className="space-y-3 pt-2">
          <div className="text-left">
            <span className="text-[9px] font-mono font-bold th-muted uppercase tracking-widest block">
              Next Season Setup Trajectory
            </span>
            <p className="text-[10px] th-muted leading-tight mt-1">
              Would you like to continue with your accumulated manager records (balance & analytics) or start a completely fresh season?
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            {/* Carry Over */}
            <button
              onClick={() => onResetRound(true)}
              className="th-acc-soft hover:bg-emerald-500 hover:text-slate-950 text-emerald-400 border th-border-acc rounded-2xl p-3 text-left font-sans flex flex-col justify-between h-[105px] transition-all hover:scale-[1.02] cursor-pointer"
            >
              <span className="text-xs font-black uppercase tracking-wider block leading-snug">Continue<br />Records</span>
              <span className="text-[8.5px] font-mono opacity-80 leading-snug">Preserves balance (${formatMoney(balance, 0)}) & analytics sheets.</span>
            </button>

            {/* Fresh Start */}
            <button
              onClick={() => onResetRound(false)}
              className="th-wash hover:th-wash2 hover:th-text th-sub border th-border rounded-2xl p-3 text-left font-sans flex flex-col justify-between h-[105px] transition-all hover:scale-[1.02] cursor-pointer"
            >
              <span className="text-xs font-black uppercase tracking-wider block leading-snug">Fresh<br />Start</span>
              <span className="text-[8.5px] font-mono opacity-80 leading-snug">Resets budget to $1,000 and clears all history.</span>
            </button>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2 border border-slate-500/20 hover:border-slate-500/40 th-muted hover:th-sub rounded-xl text-xs font-bold transition-all cursor-pointer"
        >
          Close & Inspect Last Bets
        </button>
      </div>
    </div>
  );
};

