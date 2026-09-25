import React, { useState, useRef, useEffect } from "react";
import { GameProps, StakeSlider } from "./shared";
import { formatMoney } from "../../utils";
import { DICE_MULTI_OVER_UNDER, DICE_MULTI_EXACT } from "./constants";

export const OverUnderDiceGame: React.FC<GameProps> = ({ balance, onUpdateBalance, addLog }) => {
  const [stake, setStake] = useState<number>(() => Math.max(1, Math.min(50, Math.floor(balance))));
  const [targetMode, setTargetMode] = useState<"OVER_7" | "UNDER_7" | "EQUAL_7">("OVER_7");
  const [rolling, setRolling] = useState<boolean>(false);
  const [diceVals, setDiceVals] = useState<number[]>([3, 4]);
  const [commentary, setCommentary] = useState<string>("Pick Over/Under/Exact 7, set wager and click ROLL to duel!");

  const safeStake = Math.max(1, Math.min(stake, Math.max(1, balance)));
  const rollingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rollStakeRef = useRef(0);
  const onUpdateBalanceRef = useRef(onUpdateBalance);
  onUpdateBalanceRef.current = onUpdateBalance;
  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (rollingRef.current && rollStakeRef.current > 0) {
      onUpdateBalanceRef.current(rollStakeRef.current);
      rollingRef.current = false;
    }
  }, []);

  const handleRoll = () => {
    if (rolling || rollingRef.current) return;
    if (balance < safeStake) {
      setCommentary("❌ Insufficient balance.");
      return;
    }
    rollingRef.current = true;
    rollStakeRef.current = safeStake;
    const roundStake = rollStakeRef.current;
    const roundMode = targetMode;
    onUpdateBalance(-roundStake);
    setRolling(true);
    setCommentary("Rolling dice cups...");

    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      rollingRef.current = false;
      setRolling(false);

      const d1 = Math.floor(Math.random() * 6) + 1;
      const d2 = Math.floor(Math.random() * 6) + 1;
      const sum = d1 + d2;
      setDiceVals([d1, d2]);

      let success = false;
      let multiplier = DICE_MULTI_OVER_UNDER;

      if (roundMode === "OVER_7") {
        success = sum > 7;
        multiplier = DICE_MULTI_OVER_UNDER;
      } else if (roundMode === "UNDER_7") {
        success = sum < 7;
        multiplier = DICE_MULTI_OVER_UNDER;
      } else {
        success = sum === 7;
        multiplier = DICE_MULTI_EXACT;
      }

      if (success) {
        const winVal = roundStake * multiplier;
        onUpdateBalance(winVal);
        setCommentary(`🎉 ${d1} + ${d2} = ${sum} — ${roundMode.replace("_", " ")} HIT! Won $${formatMoney(winVal)} (${multiplier}x)!`);
        addLog("Over/Under Dice", roundStake, multiplier, "WIN", `Sum was ${sum} (Guessed ${roundMode})`);
      } else {
        setCommentary(`💔 ${d1} + ${d2} = ${sum} — ${roundMode.replace("_", " ")} MISSED!`);
        addLog("Over/Under Dice", roundStake, 0, "LOSS", `Sum was ${sum} (Guessed ${roundMode})`);
      }
    }, 1100);
  };

  const DICE_FACES: Record<number, string> = {
    1: "⚀", 2: "⚁", 3: "⚂", 4: "⚃", 5: "⚄", 6: "⚅"
  };

  return (
    <div className="space-y-4">
      <div className="th-app border th-border rounded-2xl p-5 flex justify-center gap-6 select-none relative">
        <span className="text-[10px] font-mono th-muted absolute top-2 left-2 uppercase">Duel Dice Cup</span>
        {diceVals.map((val, index) => (
          <div
            key={index}
            className={`h-20 w-20 rounded-2xl bg-gradient-to-br from-[#121824] to-[#05070a] border-2 th-border-acc shadow-md flex items-center justify-center font-black text-4xl font-mono transition-all duration-300 ${
              rolling ? "rotate-12 animate-pulse scale-90 border-amber-500" : ""
            }`}
          >
            {rolling ? "🎲" : DICE_FACES[val] ?? val}
          </div>
        ))}
        {!rolling && (
          <div className="absolute bottom-3 left-0 right-0 text-center">
            <span className="text-[10px] font-mono th-muted">Sum: <b className="th-text">{diceVals[0] + diceVals[1]}</b></span>
          </div>
        )}
      </div>

      <p className="text-[11px] leading-relaxed th-sub text-center th-wash p-2.5 rounded-xl border th-border select-none font-mono">{commentary}</p>

      <div className="grid grid-cols-3 gap-2 shrink-0 select-none">
        {(["UNDER_7", "EQUAL_7", "OVER_7"] as const).map(mode => {
          const isActive = targetMode === mode;
          const multi = mode === "EQUAL_7" ? `${DICE_MULTI_EXACT}x` : `${DICE_MULTI_OVER_UNDER}x`;
          const label = mode === "UNDER_7" ? "UNDER 7" : mode === "EQUAL_7" ? "EXACTLY 7" : "OVER 7";
          const activeStyle = mode === "UNDER_7"
            ? "th-acc-soft th-border-acc text-emerald-400"
            : mode === "EQUAL_7"
            ? "bg-amber-500/25 border-amber-500 text-amber-400"
            : "bg-sky-500/20 border-sky-500 text-sky-400";
          return (
            <button
              key={mode}
              onClick={() => setTargetMode(mode)}
              disabled={rolling}
              className={`py-3 rounded-2xl font-sans font-bold text-xs border transition-all active:scale-95 cursor-pointer flex flex-col items-center ${
                isActive ? activeStyle : "th-solid th-border th-muted hover:th-border"
              }`}
            >
              <span>{label}</span>
              <span className="text-[8px] font-mono th-muted mt-1">{multi} Pays</span>
            </button>
          );
        })}
      </div>

      <StakeSlider balance={balance} stake={safeStake} setStake={setStake} disabled={rolling} label="STAKE AMOUNT" />

      <button
        onClick={handleRoll}
        disabled={rolling || balance <= 0}
        className="w-full bg-emerald-500 hover:bg-emerald-400 text-[#05070a] font-sans font-black text-xs py-3.5 rounded-2xl transition-all shadow-lg active:scale-95 disabled:opacity-50 cursor-pointer uppercase tracking-wider block text-center"
      >
        {rolling ? "ROLLING DICE..." : `🎲 ROLL DUEL DICE ($${safeStake.toLocaleString()})`}
      </button>
    </div>
  );
};

