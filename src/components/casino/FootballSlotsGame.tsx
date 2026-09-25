import React, { useState, useRef, useEffect } from "react";
import { GameProps, StakeSlider } from "./shared";
import { formatMoney } from "../../utils";
import { SLOTS_REEL_WEIGHTS as REEL_WEIGHTS, SLOTS_TRIPLE_PAY as TRIPLE_PAY, SLOTS_PAIR_PAY as PAIR_PAY, SLOTS_REEL_SYMS as REEL_SYMS } from "./constants";

const REEL_TOTAL = REEL_SYMS.reduce((a, s) => a + REEL_WEIGHTS[s], 0);
function spinReel(): string {
  let r = Math.random() * REEL_TOTAL;
  for (const sym of REEL_SYMS) { r -= REEL_WEIGHTS[sym]; if (r <= 0) return sym; }
  return REEL_SYMS[REEL_SYMS.length - 1];
}

export const FootballSlotsGame: React.FC<GameProps> = ({ balance, onUpdateBalance, addLog }) => {
  const [stake, setStake] = useState<number>(() => Math.max(1, Math.min(50, Math.floor(balance))));
  const [reels, setReels] = useState<string[]>(["Cup", "Boot", "Ball"]);
  const [spinning, setSpinning] = useState<boolean>(false);
  const [commentary, setCommentary] = useState<string>("Click SPIN below to trigger high-fidelity football slot reels!");

  const symbolsSet = ["Cup", "Boot", "Ball", "Whistle", "Card"];
  const weightsSet = ["🏆", "👟", "⚽", "📯", "🟨"];

  const safeStake = Math.max(1, Math.min(stake, Math.max(1, balance)));
  const spinningRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spinStakeRef = useRef(0);
  const onUpdateBalanceRef = useRef(onUpdateBalance);
  onUpdateBalanceRef.current = onUpdateBalance;
  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (spinningRef.current && spinStakeRef.current > 0) {
      onUpdateBalanceRef.current(spinStakeRef.current);
      spinningRef.current = false;
    }
  }, []);

  const handleSpin = () => {
    if (spinning || spinningRef.current) return;
    if (balance < safeStake) {
      setCommentary("❌ Insufficient balance.");
      return;
    }
    spinningRef.current = true;
    spinStakeRef.current = safeStake;
    const roundStake = spinStakeRef.current;
    onUpdateBalance(-roundStake);
    setSpinning(true);
    setCommentary("Football slot reels are rotating fast...");

    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      spinningRef.current = false;
      setSpinning(false);

      const r1 = spinReel();
      const r2 = spinReel();
      const r3 = spinReel();
      const resultReels = [r1, r2, r3];
      setReels(resultReels);

      const tripleMulti = r1 === r2 && r2 === r3 ? TRIPLE_PAY[r1] ?? 0 : 0;
      const matchedSym = r1 === r2 ? r1 : r2 === r3 ? r2 : r1 === r3 ? r1 : null;
      const pairMulti = matchedSym ? PAIR_PAY[matchedSym] ?? 0 : 0;

      if (tripleMulti > 0) {
        const winVal = roundStake * tripleMulti;
        onUpdateBalance(winVal);
        setCommentary(`🎉 MEGA WIN! 3×${r1}! Won $${formatMoney(winVal)} (${tripleMulti}x)!`);
        addLog("Football Slots", roundStake, tripleMulti, "WIN", `Hit 3 of a kind: ${r1}`);
      } else if (matchedSym && pairMulti > 0) {
        const winVal = roundStake * pairMulti;
        onUpdateBalance(winVal);
        setCommentary(`🎉 WIN! Two-of-a-kind ${matchedSym}! Won $${formatMoney(winVal)} (${pairMulti}x)!`);
        addLog("Football Slots", roundStake, pairMulti, "WIN", `Matched 2: ${matchedSym}`);
      } else {
        setCommentary("💔 No matching lines. Try another spin to hit the Cup jackpot (100x)!");
        addLog("Football Slots", roundStake, 0, "LOSS", "No matching lines");
      }
    }, 1100);
  };

  const getSymbolChar = (id: string) => {
    const idx = symbolsSet.indexOf(id);
    return idx !== -1 ? weightsSet[idx] : "⚽";
  };

  return (
    <div className="space-y-4">
      <div className="th-app border th-border rounded-2xl p-5 flex justify-center gap-4 select-none relative">
        {reels.map((sym, index) => (
          <div
            key={index}
            className={`h-28 w-20 rounded-xl bg-gradient-to-b from-[#131923] to-[#040608] border th-border flex flex-col items-center justify-center font-bold relative overflow-hidden transition-all duration-300 ${
              spinning ? "animate-pulse border-amber-500/30 scale-95" : ""
            }`}
          >
            <span className="text-3xl block">{spinning ? "⚙️" : getSymbolChar(sym)}</span>
            <span className="text-[10px] th-muted font-mono uppercase mt-1 tracking-wider">{spinning ? "..." : sym}</span>
          </div>
        ))}
      </div>

      <div className="th-inset border th-border rounded-xl p-2.5 grid grid-cols-4 gap-1 text-center select-none">
        {[["3×Cup", "100x"], ["3×Boot", "50x"], ["3×Ball", "30x"], ["Pair Cup/Boot/Ball", "4/3/2x"]].map(([label, val]) => (
          <div key={label} className="th-wash rounded-lg py-1.5 px-1">
            <div className="text-[9px] th-muted font-mono">{label}</div>
            <div className="text-[11px] font-black text-amber-400 font-mono mt-0.5">{val}</div>
          </div>
        ))}
      </div>

      <p className="text-[11px] leading-relaxed th-sub text-center th-wash p-2.5 rounded-xl border th-border select-none font-mono">{commentary}</p>

      <StakeSlider balance={balance} stake={safeStake} setStake={setStake} disabled={spinning} label="STAKE SLOTS AMOUNT" />

      <button
        onClick={handleSpin}
        disabled={spinning || balance <= 0}
        className="w-full bg-emerald-500 hover:bg-emerald-400 text-[#05070a] font-sans font-black text-xs py-3.5 rounded-2xl transition-all shadow-lg active:scale-95 disabled:opacity-50 cursor-pointer uppercase tracking-wider block text-center"
      >
        {spinning ? "SPINNING REELS..." : `🎰 SPIN REEL ($${safeStake.toLocaleString()})`}
      </button>
    </div>
  );
};

