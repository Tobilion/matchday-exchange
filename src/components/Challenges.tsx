import React from "react";
import { Challenge } from "../types";
import { formatMoney } from "../utils";

interface ChallengesProps {
  challenges: Challenge[];
  currentRoundIndex: number;
  onClaim: (challengeId: string) => void;
  onDismiss?: (challengeId: string) => void;
}

const TYPE_ICONS: Record<Challenge["type"], string> = {
  WIN_ACCUMULATORS: "🎰",
  BET_ON_UNDERDOG_WIN: "🐺",
  CASHOUT_PROFIT: "💸",
  BET_BUILDER_WIN: "🧱",
  WIN_STREAK: "🔥",
  BET_ON_DRAW: "🤝",
};

export const Challenges: React.FC<ChallengesProps> = ({
  challenges,
  currentRoundIndex,
  onClaim,
  onDismiss,
}) => {
  const visible = challenges.filter(
    (c) => c.status === "ACTIVE" || c.status === "COMPLETED" || c.status === "EXPIRED",
  );
  if (visible.length === 0) return null;

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-2.5">
        <h3 className="text-xs font-black tracking-widest th-muted uppercase">
          🎯 Betting Challenges
        </h3>
        <span className="text-[9px] th-muted font-mono uppercase">
          Complete missions to earn bonus cash
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {visible.map((c) => {
          const pct = Math.min(100, Math.round((c.progress / c.target) * 100));
          const isCompleted = c.status === "COMPLETED";
          const isExpired = c.status === "EXPIRED";
          const roundsLeft = Math.max(0, c.expiresAtRound - currentRoundIndex);

          return (
            <div
              key={c.id}
              className={`glass-card rounded-xl p-3.5 border flex flex-col gap-2 transition-all ${
                isCompleted
                  ? "border-yellow-400/40 bg-yellow-400/5"
                  : isExpired
                  ? "th-border opacity-50"
                  : "th-border"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-black th-text truncate">
                    {TYPE_ICONS[c.type]} {c.title}
                  </p>
                  <p className="text-[10px] th-muted mt-0.5 leading-snug">{c.description}</p>
                </div>
                <span className="shrink-0 text-[10px] font-black th-acc font-mono">
                  +{formatMoney(c.reward)}
                </span>
              </div>

              <div>
                <div className="flex justify-between text-[9px] font-mono th-muted mb-1">
                  <span>
                    {c.progress}/{c.target}
                  </span>
                  <span>
                    {isExpired ? "EXPIRED" : isCompleted ? "DONE" : `${roundsLeft} round${roundsLeft === 1 ? "" : "s"} left`}
                  </span>
                </div>
                <div className="h-1.5 th-inset rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      isCompleted ? "bg-yellow-400" : isExpired ? "bg-slate-600" : "bg-emerald-500"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              {isCompleted && (
                <button
                  onClick={() => onClaim(c.id)}
                  className="w-full text-[10px] font-black tracking-widest uppercase text-black bg-yellow-400 hover:bg-yellow-300 rounded-md py-1.5 transition-colors"
                >
                  🏆 Claim Reward
                </button>
              )}
              {isExpired && (
                <button
                  onClick={() => onDismiss?.(c.id)}
                  className="w-full text-[10px] font-bold tracking-widest uppercase th-muted th-wash rounded-md py-1.5 cursor-pointer hover:th-wash2"
                >
                  Expired — Dismiss
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

