import React from "react";
import { Trophy, ArrowRight, PlayCircle, Coins, Layers } from "lucide-react";

interface SplashGateProps {
  onEnter: () => void;
}

const FEATURES = [
  {
    icon: PlayCircle,
    color: "th-info",
    ring: "bg-sky-500/10 border-sky-500/20",
    title: "Simulate Matches",
    body: "Live tick-by-tick match engine with tactics, formations, and real-time momentum swings.",
  },
  {
    icon: Coins,
    color: "th-amber",
    ring: "bg-amber-500/10 border-amber-500/20",
    title: "Bet With Virtual Cash",
    body: "Place accumulators, go live in-play, and cash out before the final whistle.",
  },
  {
    icon: Layers,
    color: "th-acc",
    ring: "th-acc-soft th-border-acc",
    title: "Build Your Club",
    body: "Sign players, upgrade facilities, develop youth, and chase league and cup glory.",
  },
];

/** Branded entry gate — shown every time the app is opened, before the save-slot picker. */
export const SplashGate: React.FC<SplashGateProps> = ({ onEnter }) => {
  return (
    <div
      id="splash-gate"
      className="fixed inset-0 z-[999] th-app overflow-y-auto overflow-x-hidden font-sans select-none animate-fade-in"
    >
      <div className="min-h-full w-full flex flex-col items-center justify-center gap-10 px-4 py-14">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-sky-500 flex items-center justify-center shadow-[0_0_40px_rgba(16,185,129,0.35)]">
            <Trophy size={30} className="text-slate-950" strokeWidth={2.5} />
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-wider uppercase leading-none">
            <span className="th-text">Matchday</span>{" "}
            <span className="th-acc">Exchange</span>
          </h1>
          <p className="text-xs font-mono uppercase tracking-[0.3em] th-muted">
            Elite Football &amp; Prediction Market Simulator
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl w-full">
          {FEATURES.map((card) => (
            <div
              key={card.title}
              className="p-6 rounded-2xl th-solid border th-border backdrop-blur-md flex flex-col gap-3"
            >
              <div
                className={`h-10 w-10 rounded-xl border flex items-center justify-center ${card.ring}`}
              >
                <card.icon size={18} className={card.color} />
              </div>
              <h3
                className={`text-xs font-black uppercase tracking-widest ${card.color}`}
              >
                {card.title}
              </h3>
              <p className="text-xs th-muted leading-relaxed">
                {card.body}
              </p>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={onEnter}
            className="px-10 py-4 rounded-2xl bg-gradient-to-r from-emerald-400 to-sky-400 text-slate-950 font-black uppercase tracking-wider text-sm shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 active:scale-98 transition-all cursor-pointer flex items-center gap-2"
          >
            Enter Matchday Exchange
            <ArrowRight size={16} strokeWidth={2.5} />
          </button>
          <span className="text-[10px] th-muted">
            Click anywhere on the button to begin
          </span>
        </div>
      </div>
    </div>
  );
};

export default SplashGate;

