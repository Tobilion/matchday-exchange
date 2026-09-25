import React, { useState } from "react";
import { formatMoney } from "../../utils";

interface WalletModalProps {
  balance: number;
  onConfirmTransaction: (amount: number, action: "DEPOSIT" | "WITHDRAW") => boolean;
  onClose: () => void;
  /** Per-save-slot scope (e.g. "tournament_slot1") — the emergency grant is one-time per scope. */
  grantScopeKey?: string;
}

const EMERGENCY_GRANT = 1000;

export const WalletModal: React.FC<WalletModalProps> = ({
  balance,
  onConfirmTransaction,
  onClose,
  grantScopeKey,
}) => {
  const [walletAction, setWalletAction] = useState<"DEPOSIT" | "WITHDRAW">("DEPOSIT");
  const [walletValue, setWalletValue] = useState<string>("100");
  const [walletSuccessMsg, setWalletSuccessMsg] = useState<string>("");
  const grantKey = grantScopeKey ? `fs_emergency_grant_${grantScopeKey}` : null;
  const [grantClaimed, setGrantClaimed] = useState<boolean>(() => {
    try { return grantKey ? localStorage.getItem(grantKey) === "1" : false; } catch { return false; }
  });

  const handleConfirm = () => {
    const amount = parseFloat(walletValue);
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid positive transaction amount!");
      return;
    }
    const success = onConfirmTransaction(amount, walletAction);
    if (success) {
      setWalletSuccessMsg(
        walletAction === "DEPOSIT"
          ? `Successfully deposited $${formatMoney(amount)} to your wallet!`
          : `Successfully withdrew $${formatMoney(amount)} from your wallet!`
      );
      setWalletValue("");
      setTimeout(() => {
        onClose();
        setWalletSuccessMsg("");
      }, 1500);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-55 flex items-center justify-center p-4 animate-fade-in">
      <div className="relative glass-panel-heavy border th-border rounded-2xl p-6 max-w-sm w-full mx-auto space-y-5 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 th-wash hover:th-wash2 th-muted hover:th-text h-8 w-8 rounded-full flex items-center justify-center cursor-pointer text-xs"
        >
          ✕
        </button>

        <div className="text-center space-y-1 select-none">
          <span className="text-2xl block">🏦</span>
          <h3 className="text-sm font-black tracking-wider uppercase text-emerald-400 font-sans mt-2">
            Matchday Exchange Wallet Centre
          </h3>
          <p className="text-[9px] th-muted font-mono tracking-tight">
            SECURE TRANSACTION PORTAL
          </p>
        </div>

        <div className="text-center th-inset rounded-xl border th-border p-3">
          <span className="text-[8px] th-muted font-mono block uppercase">CURRENT BANKROLL</span>
          <span className="text-lg font-black th-acc font-mono block mt-0.5 animate-pulse">
            ${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        <div className="flex th-inset p-1 border th-border rounded-xl gap-1">
          <button
            onClick={() => setWalletAction("DEPOSIT")}
            className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg cursor-pointer transition-all ${
              walletAction === "DEPOSIT"
                ? "bg-emerald-500 text-slate-950 font-extrabold shadow-md"
                : "th-muted hover:th-text"
            }`}
          >
            📥 DEPOSIT
          </button>
          <button
            onClick={() => setWalletAction("WITHDRAW")}
            className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg cursor-pointer transition-all ${
              walletAction === "WITHDRAW"
                ? "bg-rose-650 th-text font-extrabold shadow-md"
                : "th-muted hover:th-text"
            }`}
          >
            📤 WITHDRAW
          </button>
        </div>

        <div className="space-y-1">
          <label className="text-[9px] font-mono font-bold th-muted uppercase block">
            {walletAction === "DEPOSIT" ? "ENTER DEPOSIT AMOUNT ($)" : "ENTER WITHDRAWAL AMOUNT ($)"}
          </label>
          <div className="relative th-inset rounded-xl border th-border flex items-center px-3.5 py-1.5">
            <span className="th-muted text-xs font-bold mr-1.5">$</span>
            <input
              type="number"
              min="1"
              placeholder="Enter amount (e.g. 100)"
              value={walletValue}
              onChange={(e) => {
                setWalletValue(e.target.value);
                setWalletSuccessMsg("");
              }}
              className="w-full bg-transparent border-none text-xs th-text focus:outline-none placeholder:th-muted font-bold font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-4 gap-1.5 select-none">
          {[50, 100, 500, 1000].map(pt => (
            <button
              key={pt}
              onClick={() => {
                setWalletValue(pt.toString());
                setWalletSuccessMsg("");
              }}
              className="th-wash hover:th-wash2 th-sub font-mono text-[10px] py-1 rounded-lg border th-border cursor-pointer text-center"
            >
              +${pt}
            </button>
          ))}
        </div>

        {balance < 50 && !grantClaimed && (
          <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl text-center space-y-2 animate-fade-in">
            <span className="text-[10px] text-amber-400 font-mono uppercase font-black block">
              ⚠️ EMERGENCY FUNDS AVAILABLE
            </span>
            <p className="text-[9px] th-muted">
              Your balance is critically low. Collect a one-time ${EMERGENCY_GRANT.toLocaleString()}.00 cash grant to continue wagering!
            </p>
            <button
              onClick={() => {
                if (onConfirmTransaction(EMERGENCY_GRANT, "DEPOSIT")) {
                  try { if (grantKey) localStorage.setItem(grantKey, "1"); } catch {}
                  setGrantClaimed(true);
                  setWalletSuccessMsg(`Claimed $${EMERGENCY_GRANT.toLocaleString()}.00 Emergency Grant!`);
                }
              }}
              className="w-full py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[10px] rounded-lg tracking-wider uppercase cursor-pointer transition-colors"
            >
              Collect ${EMERGENCY_GRANT.toLocaleString()} Grant
            </button>
          </div>
        )}

        {walletSuccessMsg && (
          <div className="text-[10px] th-acc-soft border th-border-acc text-emerald-400 p-2 rounded-xl text-center font-bold">
            {walletSuccessMsg}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 th-wash hover:th-wash2 border th-border rounded-xl text-xs font-bold th-muted cursor-pointer"
          >
            Close
          </button>
          <button
            onClick={handleConfirm}
            className={`flex-1 py-2 rounded-xl text-xs font-black cursor-pointer text-center transition-all ${
              walletAction === "DEPOSIT"
                ? "bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-md shadow-emerald-500/10"
                : "bg-rose-650 hover:bg-rose-700 th-text"
            }`}
          >
            Confirm {walletAction === "DEPOSIT" ? "Deposit" : "Withdraw"}
          </button>
        </div>
      </div>
    </div>
  );
};

