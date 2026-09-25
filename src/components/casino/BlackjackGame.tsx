import React, { useState, useCallback, useRef, useEffect } from "react";
import { GameProps, StakeSlider } from "./shared";
import { formatMoney } from "../../utils";

type Suit = "♠" | "♥" | "♦" | "♣";
type CardVal = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";

interface Card { val: CardVal; suit: Suit; hidden?: boolean; }

const SUITS: Suit[] = ["♠", "♥", "♦", "♣"];
const VALS: CardVal[] = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];

function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) for (const val of VALS) deck.push({ val, suit });
  return deck;
}

function shuffle(deck: Card[]): Card[] {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

function cardNumericValue(val: CardVal): number {
  if (["J","Q","K"].includes(val)) return 10;
  if (val === "A") return 11;
  return parseInt(val);
}

function handValue(hand: Card[]): number {
  let total = 0; let aces = 0;
  for (const c of hand) {
    if (c.hidden) continue;
    total += cardNumericValue(c.val);
    if (c.val === "A") aces++;
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

function isRed(suit: Suit) { return suit === "♥" || suit === "♦"; }

const CardUI: React.FC<{ card: Card }> = ({ card }) => {
  if (card.hidden) {
    return (
      <div className="w-10 h-14 sm:w-12 sm:h-16 rounded-lg border th-border bg-gradient-to-br from-blue-900 to-blue-950 flex items-center justify-center shadow-md">
        <span className="text-blue-400/40 text-xl">🂠</span>
      </div>
    );
  }
  return (
    <div className="w-10 h-14 sm:w-12 sm:h-16 rounded-lg border th-border bg-white flex flex-col items-start justify-start p-1 shadow-md">
      <span className={`text-[10px] sm:text-[11px] font-black leading-none ${isRed(card.suit) ? "text-red-600" : "text-slate-900"}`}>{card.val}</span>
      <span className={`text-xs sm:text-[13px] leading-none ${isRed(card.suit) ? "text-red-600" : "text-slate-900"}`}>{card.suit}</span>
    </div>
  );
};

type Phase = "idle" | "playing" | "done";
type Result = "bust" | "dealer_bust" | "win" | "loss" | "push" | "blackjack" | null;

export const BlackjackGame: React.FC<GameProps> = ({ balance, onUpdateBalance, addLog }) => {
  const [stake, setStake] = useState(() => Math.max(1, Math.min(50, Math.floor(balance))));
  const [deck, setDeck] = useState<Card[]>([]);
  const [playerHand, setPlayerHand] = useState<Card[]>([]);
  const [dealerHand, setDealerHand] = useState<Card[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<Result>(null);
  const [message, setMessage] = useState("Place your bet and deal to begin!");
  const [doubled, setDoubled] = useState(false);

  const safeStake = Math.max(1, Math.min(stake, Math.max(1, balance)));
  // Round stake captured at deal time. Payouts MUST use this, never the live
  // `safeStake` (which shrinks after the deduct re-renders with a lower
  // balance — the old code underpaid every win when balance < 2x stake).
  const roundStakeRef = useRef(0);
  // Sync guards: state flips are async, so rapid clicks would double-act.
  const actingRef = useRef(false);
  const liveRef = useRef(false);
  const onUpdateBalanceRef = useRef(onUpdateBalance);
  onUpdateBalanceRef.current = onUpdateBalance;
  // Leaving mid-hand refunds the total staked instead of burning it.
  useEffect(() => () => {
    if (liveRef.current && roundStakeRef.current > 0) {
      onUpdateBalanceRef.current(roundStakeRef.current);
      liveRef.current = false;
    }
  }, []);

  const resolveDealer = useCallback((pHand: Card[], currentDeck: Card[], currentStake: number, currentDealerHand: Card[]) => {
    const pVal = handValue(pHand);
    let dHand: Card[] = currentDealerHand.map(c => ({ ...c, hidden: false }));
    let remDeck = [...currentDeck];
    while (handValue(dHand) < 17) { dHand = [...dHand, remDeck[0]]; remDeck = remDeck.slice(1); }
    setDealerHand(dHand);
    setDeck(remDeck);
    const dVal = handValue(dHand);
    let res: Result; let msg: string; let payout = 0;
    if (dVal > 21) { res = "dealer_bust"; payout = currentStake * 2; msg = `🎉 Dealer busts ${dVal}! Win $${formatMoney(payout)}!`; }
    else if (pVal > dVal) { res = "win"; payout = currentStake * 2; msg = `✅ ${pVal} beats dealer ${dVal}! Win $${formatMoney(payout)}!`; }
    else if (pVal === dVal) { res = "push"; payout = currentStake; msg = `🤝 Push! ${pVal} each. Stake returned.`; }
    else { res = "loss"; msg = `❌ Dealer wins ${dVal} vs your ${pVal}.`; }
    onUpdateBalance(payout);
    setResult(res); setMessage(msg); setPhase("done");
    addLog("Stadium Blackjack", currentStake, payout > 0 ? payout / currentStake : 0, res === "loss" ? "LOSS" : "WIN", msg.slice(0, 50));
  }, [onUpdateBalance, addLog]);

  const deal = useCallback(() => {
    if (actingRef.current || liveRef.current) return;
    if (balance < safeStake) { setMessage("❌ Insufficient balance."); return; }
    actingRef.current = true;
    roundStakeRef.current = safeStake;
    const roundStake = roundStakeRef.current;
    const newDeck = shuffle([...buildDeck(),...buildDeck(),...buildDeck(),...buildDeck(),...buildDeck(),...buildDeck()]);
    const pH: Card[] = [newDeck[0], newDeck[2]];
    const dH: Card[] = [newDeck[1], { ...newDeck[3], hidden: true }];
    onUpdateBalance(-roundStake);
    liveRef.current = true;
    const remDeck = newDeck.slice(4);
    setDeck(remDeck); setPlayerHand(pH); setDealerHand(dH); setPhase("playing"); setResult(null); setDoubled(false);
    const pVal = handValue(pH);
    if (pVal === 21) {
      const dReveal = dH.map(c => ({ ...c, hidden: false }));
      setDealerHand(dReveal);
      if (handValue(dReveal) === 21) { onUpdateBalance(roundStake); setResult("push"); setMessage("🤝 Both Blackjack — Push!"); addLog("Stadium Blackjack", roundStake, 1, "WIN", "Push both BJ"); setPhase("done"); liveRef.current = false; actingRef.current = false; return; }
      onUpdateBalance(roundStake * 2.5); setResult("blackjack"); setMessage(`🃏 BLACKJACK! Win $${formatMoney(roundStake * 2.5)} (3:2)!`); addLog("Stadium Blackjack", roundStake, 2.5, "WIN", "Blackjack 3:2"); setPhase("done"); liveRef.current = false; actingRef.current = false; return;
    }
    setMessage(`Your hand: ${pVal} | Dealer shows: ${handValue([dH[0]])}. Hit or Stand?`);
    actingRef.current = false;
  }, [balance, safeStake, onUpdateBalance, addLog]);

  const hit = useCallback(() => {
    if (phase !== "playing" || actingRef.current) return;
    actingRef.current = true;
    const roundStake = roundStakeRef.current;
    const newCard = deck[0]; const newHand = [...playerHand, newCard]; const remDeck = deck.slice(1);
    setPlayerHand(newHand); setDeck(remDeck);
    const val = handValue(newHand);
    if (val > 21) {
      setDealerHand(h => h.map(c => ({ ...c, hidden: false }))); setResult("bust");
      setMessage(`💥 Bust! ${val}. Lost $${formatMoney(roundStake)}.`);
      addLog("Stadium Blackjack", roundStake, 0, "LOSS", `Bust at ${val}`); setPhase("done"); liveRef.current = false;
    } else if (val === 21) { resolveDealer(newHand, remDeck, roundStake, dealerHand); liveRef.current = false; }
    else { setMessage(`Hand: ${val}. Hit or Stand?`); }
    actingRef.current = false;
  }, [phase, deck, playerHand, dealerHand, resolveDealer, addLog]);

  const stand = useCallback(() => {
    if (phase !== "playing" || actingRef.current) return;
    actingRef.current = true;
    resolveDealer(playerHand, deck, roundStakeRef.current, dealerHand);
    liveRef.current = false;
    actingRef.current = false;
  }, [phase, playerHand, deck, dealerHand, resolveDealer]);

  const doubleDown = useCallback(() => {
    if (phase !== "playing" || actingRef.current || playerHand.length !== 2 || balance < roundStakeRef.current) return;
    actingRef.current = true;
    const roundStake = roundStakeRef.current;
    onUpdateBalance(-roundStake); setDoubled(true);
    roundStakeRef.current = roundStake * 2;
    const newCard = deck[0]; const newHand = [...playerHand, newCard]; const remDeck = deck.slice(1);
    setPlayerHand(newHand); setDeck(remDeck);
    const val = handValue(newHand);
    if (val > 21) {
      setDealerHand(h => h.map(c => ({ ...c, hidden: false }))); setResult("bust");
      setMessage(`💥 Double Bust ${val}! Lost $${formatMoney(roundStake * 2)}.`);
      addLog("Stadium Blackjack", roundStake * 2, 0, "LOSS", `Double bust ${val}`); setPhase("done"); liveRef.current = false;
    } else { resolveDealer(newHand, remDeck, roundStake * 2, dealerHand); liveRef.current = false; }
    actingRef.current = false;
  }, [phase, playerHand, deck, dealerHand, balance, onUpdateBalance, resolveDealer, addLog]);

  return (
    <div className="space-y-3 select-none">
      <div className="th-inset border th-border rounded-xl p-3 sm:p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-mono th-muted uppercase font-bold">DEALER</span>
          <span className="text-[10px] font-mono th-muted">{phase !== "idle" ? `Value: ${phase === "done" ? handValue(dealerHand) : handValue([dealerHand[0]])}` : "—"}</span>
        </div>
        <div className="flex gap-1.5 flex-wrap min-h-[3.5rem]">
          {dealerHand.map((c, i) => <CardUI key={i} card={c} />)}
        </div>
      </div>
      <div className="th-inset border th-border rounded-xl p-3 sm:p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-mono th-muted uppercase font-bold">YOU {doubled && <span className="text-amber-400">(DOUBLED)</span>}</span>
          <span className="text-[10px] font-mono th-muted">{phase !== "idle" ? `Value: ${handValue(playerHand)}` : "—"}</span>
        </div>
        <div className="flex gap-1.5 flex-wrap min-h-[3.5rem]">
          {playerHand.map((c, i) => <CardUI key={i} card={c} />)}
        </div>
      </div>
      <div className={`text-center text-xs font-bold py-2.5 px-3 rounded-xl border leading-snug ${
        result === "bust" || result === "loss" ? "bg-red-500/10 border-red-500/20 text-red-400" :
        result === "push" ? "bg-amber-500/10 border-amber-500/20 text-amber-400" :
        result ? "th-acc-soft th-border-acc text-emerald-400" :
        "th-wash th-border th-sub"
      }`}>{message}</div>
      {phase === "idle" || phase === "done" ? (
        <div className="space-y-3">
          <StakeSlider balance={balance} stake={safeStake} setStake={setStake} label="BET STAKE" />
          <button onClick={deal} disabled={balance <= 0}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm py-3 rounded-2xl transition-all active:scale-95 disabled:opacity-40 cursor-pointer uppercase tracking-wide block text-center">
            🃏 {phase === "done" ? "NEW HAND" : "DEAL CARDS"}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <button onClick={hit} className="bg-blue-600 hover:bg-blue-500 th-text font-black text-xs py-3 rounded-2xl transition-all active:scale-95 cursor-pointer uppercase">HIT</button>
          <button onClick={stand} className="bg-red-700 hover:bg-red-600 th-text font-black text-xs py-3 rounded-2xl transition-all active:scale-95 cursor-pointer uppercase">STAND</button>
          <button onClick={doubleDown} disabled={playerHand.length !== 2 || balance < safeStake}
            className="bg-amber-600 hover:bg-amber-500 th-text font-black text-xs py-3 rounded-2xl transition-all active:scale-95 disabled:opacity-40 cursor-pointer uppercase">2X DOWN</button>
        </div>
      )}
      <div className="text-[9px] th-faint font-mono text-center">6-deck shoe • Dealer stands soft 17 • Blackjack pays 3:2 • RTP ~99.5%</div>
    </div>
  );
};

