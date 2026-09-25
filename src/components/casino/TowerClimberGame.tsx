import React, { useState, useRef, useEffect } from "react";
import { GameProps, StakeSlider } from "./shared";
import { formatMoney } from "../../utils";
import { TOWER_FLOORS as FLOORS, TOWER_COLS as COLS, TOWER_FLOOR_MULTIPLIERS as FLOOR_MULTIPLIERS } from "./constants";

// Each floor has one safe and two bombs (roughly)
// On harder floors, more bombs
function genFloor(floorIdx: number): ("safe"|"bomb")[] {
  const bombs = Math.min(2, Math.floor(floorIdx / 3) + 1);
  const cells: ("safe"|"bomb")[] = Array(COLS).fill("safe");
  const bombIdxs = new Set<number>();
  while (bombIdxs.size < bombs) bombIdxs.add(Math.floor(Math.random() * COLS));
  bombIdxs.forEach(i => { cells[i] = "bomb"; });
  return cells;
}

export const TowerClimberGame: React.FC<GameProps> = ({ balance, onUpdateBalance, addLog }) => {
  const [stake, setStake] = useState(() => Math.max(1, Math.min(50, Math.floor(balance))));
  const [phase, setPhase] = useState<"idle"|"playing"|"done">("idle");
  const [floors, setFloors] = useState<("safe"|"bomb"|"hidden")[][]>([]);
  const [currentFloor, setCurrentFloor] = useState(0);
  const [revealedFloors, setRevealedFloors] = useState<{ cells: ("safe"|"bomb"|"hidden")[]; chosen: number }[]>([]);
  const [message, setMessage] = useState("Set stake and START to climb the tower!");
  const [pool, setPool] = useState(0);
  const safeStake = Math.max(1, Math.min(stake, Math.max(1, balance)));
  // Round stake captured at start — payouts/logs must use this, never the
  // live `safeStake` (which shrinks after the deduct re-renders).
  const roundStakeRef = useRef(0);
  const liveRef = useRef(false);
  const busyRef = useRef(false);
  const onUpdateBalanceRef = useRef(onUpdateBalance);
  onUpdateBalanceRef.current = onUpdateBalance;
  useEffect(() => () => {
    if (liveRef.current && roundStakeRef.current > 0) {
      onUpdateBalanceRef.current(roundStakeRef.current);
      liveRef.current = false;
    }
  }, []);

  const startGame = () => {
    if (liveRef.current || busyRef.current) return;
    if (balance < safeStake) { setMessage("❌ Insufficient balance."); return; }
    busyRef.current = true;
    roundStakeRef.current = safeStake;
    onUpdateBalance(-roundStakeRef.current);
    liveRef.current = true;
    const generatedFloors = Array.from({ length: FLOORS }, (_, i) => genFloor(i));
    setFloors(generatedFloors);
    setCurrentFloor(0); setRevealedFloors([]); setPool(roundStakeRef.current);
    setPhase("playing"); setMessage(`Floor 1 of ${FLOORS} — Pick a door!`);
    busyRef.current = false;
  };

  const pickCell = (col: number) => {
    if (phase !== "playing" || !liveRef.current || busyRef.current) return;
    busyRef.current = true;
    const roundStake = roundStakeRef.current;
    const floor = floors[currentFloor];
    const chosen = floor[col];
    const newRevealed = [...revealedFloors, { cells: floor, chosen: col }];
    setRevealedFloors(newRevealed);
    if (chosen === "bomb") {
      setPhase("done");
      liveRef.current = false;
      const lostMsg = `💥 BOOM! Hit a bomb on floor ${currentFloor + 1}! Lost $${formatMoney(roundStake)}.`;
      setMessage(lostMsg);
      addLog("Tower Climber", roundStake, 0, "LOSS", `Bombed floor ${currentFloor + 1}`);
    } else {
      const nextFloor = currentFloor + 1;
      const multi = FLOOR_MULTIPLIERS[currentFloor];
      const newPool = roundStake * multi;
      setPool(newPool);
      if (nextFloor >= FLOORS) {
        onUpdateBalance(newPool);
        setPhase("done");
        liveRef.current = false;
        setMessage(`🏆 TOP FLOOR! ${FLOORS}/${FLOORS} climbed! Win $${formatMoney(newPool)} (${multi}x)!`);
        addLog("Tower Climber", roundStake, multi, "WIN", `Completed all ${FLOORS} floors!`);
      } else {
        setCurrentFloor(nextFloor);
        setMessage(`✅ Safe! Floor ${nextFloor + 1} next — Pool: $${formatMoney(newPool)} (${multi}x). Pick or Cashout.`);
      }
    }
    busyRef.current = false;
  };

  const cashout = () => {
    if (phase !== "playing" || !liveRef.current || busyRef.current || currentFloor === 0) return;
    busyRef.current = true;
    liveRef.current = false;
    const roundStake = roundStakeRef.current;
    onUpdateBalance(pool);
    addLog("Tower Climber", roundStake, pool / roundStake, "WIN", `Cashed at floor ${currentFloor}`);
    setMessage(`💰 Cashed out $${formatMoney(pool)} at floor ${currentFloor}/${FLOORS}!`);
    setPhase("done");
    busyRef.current = false;
  };

  const renderFloor = (idx: number) => {
    const isActive = idx === currentFloor && phase === "playing";
    const revealed = revealedFloors[revealedFloors.length - 1 - (currentFloor - idx - (phase === "done" ? 0 : 0))];
    const floorReveal = revealedFloors.find((_, ri) => ri === idx);
    const isDone = phase === "done" || idx < currentFloor;
    
    return (
      <div key={idx} className={`flex items-center gap-2 ${idx > currentFloor && phase === "playing" ? "opacity-30" : ""}`}>
        <span className={`text-[9px] font-mono w-12 text-right shrink-0 ${idx < currentFloor ? "text-emerald-400" : isActive ? "text-amber-400 font-black" : "th-faint"}`}>
          {FLOOR_MULTIPLIERS[idx]}x
        </span>
        <div className="flex gap-1.5 flex-1">
          {Array.from({ length: COLS }, (_, col) => {
            const fr = floorReveal;
            const showResult = fr !== undefined;
            const cellVal = showResult ? floors[idx][col] : null;
            const wasChosen = fr?.chosen === col;
            const isBomb = cellVal === "bomb";
            return (
              <button key={col} onClick={() => isActive && pickCell(col)}
                disabled={!isActive}
                className={`flex-1 h-10 rounded-xl border text-sm transition-all ${
                  isActive ? "bg-blue-900/40 border-blue-500/30 hover:bg-blue-800/60 hover:border-blue-400 cursor-pointer active:scale-95" :
                  showResult && wasChosen && isBomb ? "bg-red-700/40 border-red-500" :
                  showResult && wasChosen ? "th-acc-soft th-border-acc" :
                  showResult && isBomb ? "bg-red-900/20 border-red-700/30" :
                  showResult ? "th-wash th-border" :
                  "th-wash th-border"
                }`}>
                {showResult ? (isBomb ? "💣" : wasChosen ? "✅" : "🟩") : isActive ? "?" : ""}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3 select-none">
      {/* Tower - render from top to bottom (floor 9 first) */}
      <div className="th-inset border th-border rounded-xl p-3 space-y-1.5">
        <div className="text-[9px] font-mono th-muted uppercase font-bold mb-2 flex justify-between">
          <span>FLOOR</span><span>MULTIPLIER</span>
        </div>
        {Array.from({ length: FLOORS }, (_, i) => FLOORS - 1 - i).map(idx => renderFloor(idx))}
      </div>

      <p className="text-xs text-center th-sub th-wash border th-border rounded-xl py-2 px-3 font-bold leading-snug">{message}</p>

      {phase === "idle" || phase === "done" ? (
        <div className="space-y-3">
          <StakeSlider balance={balance} stake={safeStake} setStake={setStake} label="CLIMB STAKE" />
          <button onClick={startGame} disabled={balance <= 0}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm py-3 rounded-2xl transition-all active:scale-95 disabled:opacity-40 cursor-pointer uppercase block text-center">
            🏗️ {phase === "done" ? "CLIMB AGAIN" : "START CLIMBING"}
          </button>
        </div>
      ) : (
        currentFloor > 0 && (
          <button onClick={cashout}
            className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs py-2.5 rounded-2xl transition-all active:scale-95 cursor-pointer uppercase block text-center">
            💰 CASHOUT ${formatMoney(pool)} ({FLOOR_MULTIPLIERS[currentFloor - 1]}x)
          </button>
        )
      )}
      <div className="text-[9px] th-faint font-mono text-center">3 doors per floor • 1 safe per floor • Top prize 50x</div>
    </div>
  );
};

