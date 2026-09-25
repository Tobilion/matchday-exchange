import React, { useState, useRef, useEffect } from "react";
import { GameProps, StakeSlider } from "./shared";
import { formatMoney } from "../../utils";

export const SportyMinesGame: React.FC<GameProps> = ({
  balance,
  onUpdateBalance,
  addLog,
}) => {
  const [mineCount, setMineCount] = useState<number>(3);
  const [stake, setStake] = useState<number>(() =>
    Math.max(1, Math.min(50, Math.floor(balance))),
  );
  const [inGame, setInGame] = useState<boolean>(false);
  const [grid, setGrid] = useState<{ mine: boolean; revealed: boolean }[]>([]);
  const [revealedCount, setRevealedCount] = useState<number>(0);
  const [multiplier, setMultiplier] = useState<number>(1.0);
  const [commentary, setCommentary] = useState<string>(
    "Set mine density, choose your stake and click START to dig!",
  );
  const [roundOver, setRoundOver] = useState<boolean>(false);
  const stakeRef = useRef<number>(1);
  // Synchronous round guards (state updates are async — a second click before
  // re-render would otherwise deduct/credit twice).
  const liveRef = useRef(false);
  const busyRef = useRef(false);

  // If the player leaves mid-round (lobby, tab switch unmount), refund the
  // stake instead of burning it.
  const onUpdateBalanceRef = useRef(onUpdateBalance);
  onUpdateBalanceRef.current = onUpdateBalance;
  useEffect(() => () => {
    if (liveRef.current && stakeRef.current > 0) {
      onUpdateBalanceRef.current(stakeRef.current);
      liveRef.current = false;
    }
  }, []);

  const totalCells = 25;
  const safeStake = Math.max(1, Math.min(stake, Math.max(1, balance)));

  const getMultiplier = (clicks: number, mines: number) => {
    if (clicks === 0) return 1.0;
    let odds = 1.0;
    for (let i = 0; i < clicks; i++) {
      odds *= (totalCells - i) / (totalCells - mines - i);
    }
    return Math.round(odds * 0.99 * 100) / 100;
  };

  const handleStartGame = () => {
    if (liveRef.current || busyRef.current) return;
    if (balance < safeStake) {
      setCommentary("❌ Insufficient funds.");
      return;
    }
    busyRef.current = true;
    stakeRef.current = safeStake;
    onUpdateBalance(-stakeRef.current);
    liveRef.current = true;
    setInGame(true);
    setRoundOver(false);
    setRevealedCount(0);
    setMultiplier(1.0);
    setCommentary(
      `🎮 SportyMines Active! ${mineCount} explosive mines hidden in the 5x5 pitch. Tap cells!`,
    );

    const minesIdxs = new Set<number>();
    while (minesIdxs.size < mineCount) {
      minesIdxs.add(Math.floor(Math.random() * totalCells));
    }

    const nextGrid = Array.from({ length: totalCells }, (_, index) => ({
      mine: minesIdxs.has(index),
      revealed: false,
    }));
    setGrid(nextGrid);
    busyRef.current = false;
  };

  const handleCellClick = (index: number) => {
    if (!inGame || !liveRef.current || grid[index].revealed || roundOver) return;

    const cell = grid[index];
    const newGrid = [...grid];
    newGrid[index] = { ...newGrid[index], revealed: true };
    setGrid(newGrid);

    if (cell.mine) {
      const fullyRevealedGrid = newGrid.map((c) => ({ ...c, revealed: true }));
      setGrid(fullyRevealedGrid);
      setInGame(false);
      liveRef.current = false;
      setRoundOver(true);
      setCommentary(
        `💥 EXPLOSION! You hit a mine! Game over — see where all ${mineCount} mines were hidden.`,
      );
      addLog(
        "SportyMines",
        stakeRef.current,
        0,
        "LOSS",
        `Exploded after ${revealedCount} clicks`,
      );
    } else {
      const nextClicks = revealedCount + 1;
      setRevealedCount(nextClicks);
      const nextMulti = getMultiplier(nextClicks, mineCount);
      setMultiplier(nextMulti);

      const remainingSafe = totalCells - mineCount - nextClicks;
      if (remainingSafe === 0) {
        const fullyRevealedGrid = newGrid.map((c) => ({
          ...c,
          revealed: true,
        }));
        setGrid(fullyRevealedGrid);
        const winAmount = stakeRef.current * nextMulti;
        onUpdateBalance(winAmount);
        setInGame(false);
        liveRef.current = false;
        setRoundOver(true);
        setCommentary(
          `🏆 BOARD CLEARANCE! All safe cells revealed! Won $${formatMoney(winAmount)} (${nextMulti}x)`,
        );
        addLog(
          "SportyMines",
          stakeRef.current,
          nextMulti,
          "WIN",
          "Full Board Clearance!",
        );
      } else {
        setCommentary(
          `🟢 SAFE HELMET! Multiplier: ${nextMulti}x. Cash out or keep going!`,
        );
      }
    }
  };

  const handleCashout = () => {
    if (!inGame || !liveRef.current || revealedCount === 0 || busyRef.current) return;
    busyRef.current = true;
    liveRef.current = false;
    const finalMulti = multiplier;
    const finalPayout = stakeRef.current * finalMulti;
    const fullyRevealedGrid = grid.map((c) => ({ ...c, revealed: true }));
    setGrid(fullyRevealedGrid);
    onUpdateBalance(finalPayout);
    setInGame(false);
    busyRef.current = false;
    setRoundOver(true);
    setCommentary(
      `💰 SAFE CASHOUT! Secured $${formatMoney(finalPayout)} at ${finalMulti}x. See the full board reveal!`,
    );
    addLog(
      "SportyMines",
      stakeRef.current,
      finalMulti,
      "WIN",
      `Safe Cashout at ${finalMulti}x`,
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-center select-none">
        <div className="grid grid-cols-5 gap-1.5 th-inset p-3 border th-border rounded-2xl w-full max-w-xs">
          {grid.length === 0
            ? Array.from({ length: totalCells }).map((_, index) => (
                <div
                  key={index}
                  className="aspect-square th-solid border th-border rounded-lg flex items-center justify-center th-faint text-[10px] opacity-30"
                >
                  {index + 1}
                </div>
              ))
            : grid.map((cell, idx) => (
                <button
                  key={idx}
                  onClick={() => handleCellClick(idx)}
                  className={`aspect-square rounded-lg flex items-center justify-center border transition-all text-sm ${
                    cell.revealed
                      ? cell.mine
                        ? "bg-red-700/80 border-red-500 th-text"
                        : "th-acc-soft th-border-acc th-acc"
                      : inGame
                        ? "th-solid2 th-border hover:th-border-acc hover:th-track th-sub cursor-pointer"
                        : "th-solid th-border th-faint cursor-default"
                  }`}
                >
                  {cell.revealed ? (
                    cell.mine ? (
                      "💣"
                    ) : (
                      "🪖"
                    )
                  ) : (
                    <span className="text-[9px] font-mono th-muted">
                      {idx + 1}
                    </span>
                  )}
                </button>
              ))}
        </div>
      </div>

      <p className="text-[11px] leading-relaxed th-sub text-center th-wash p-2.5 rounded-xl border th-border select-none font-mono">
        {commentary}
      </p>

      {!inGame && (
        <div className="space-y-3">
          <div className="space-y-1">
            <span className="text-[10px] th-muted font-mono block">
              MINE DENSITY (5×5 grid)
            </span>
            <div className="flex gap-1.5">
              {[2, 3, 5, 8].map((density) => (
                <button
                  key={density}
                  onClick={() => setMineCount(density)}
                  className={`flex-1 py-2 px-2 rounded-xl border text-xs font-mono font-bold transition-all ${
                    mineCount === density
                      ? "bg-amber-500/20 border-amber-500 th-amber shadow-[0_0_8px_rgba(245,158,11,0.15)]"
                      : "th-wash th-border th-muted hover:th-border cursor-pointer"
                  }`}
                >
                  <div>{density} 💣</div>
                  <div className="text-[8px] font-mono th-muted mt-0.5">
                    ~{getMultiplier(3, density).toFixed(1)}x@3
                  </div>
                </button>
              ))}
            </div>
          </div>

          <StakeSlider
            balance={balance}
            stake={safeStake}
            setStake={setStake}
            disabled={inGame}
            label="STAKE AMOUNT"
          />
        </div>
      )}

      {inGame ? (
        <>
          <div className="th-inset border th-border rounded-xl p-2.5 flex justify-between text-xs font-mono">
            <span>
              Revealed: <b className="th-acc">{revealedCount}</b> safe
              cells
            </span>
            <span>
              Cashout:{" "}
              <b className="th-acc">
                ${formatMoney(stakeRef.current * multiplier)} ({multiplier}x)
              </b>
            </span>
          </div>
          <button
            onClick={handleCashout}
            disabled={revealedCount === 0}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-[#05070a] font-sans font-black text-xs py-3.5 rounded-2xl transition-all shadow-lg active:scale-95 disabled:opacity-50 cursor-pointer uppercase tracking-wider"
          >
            💰 CASHOUT NOW (${formatMoney(stakeRef.current * multiplier)})
          </button>
        </>
      ) : (
        <button
          onClick={handleStartGame}
          disabled={balance <= 0}
          className="w-full bg-blue-500 hover:bg-blue-400 th-text font-sans font-black text-xs py-3.5 rounded-2xl transition-all shadow-lg active:scale-95 disabled:opacity-50 cursor-pointer uppercase tracking-wider"
        >
          💣 START SOCCERMINES (${safeStake.toLocaleString()})
        </button>
      )}
    </div>
  );
};

