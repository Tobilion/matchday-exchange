import { useEffect, useRef, useState } from "react";
import {
  BetSelection,
  BetBuilderSelection,
  BetTicket,
  Fixture,
  MarketType,
  Profile,
  Team,
  Tipster,
} from "../types";
import { persistStateToCache } from "../utils/storage";
import { credit, debit, round2 } from "../utils/wallet";
import { computeAccaOdds, settleBetBuilderTicket } from "../utils/betBuilderUtils";
import { settlePendingTickets } from "../utils/betSettlement";
import { addToast } from "../hooks/useToast";
import { bootstrapWallet, placeBetOnServer, cashOutOnServer, settleOnServer, placeBetBuilderOnServer, overwriteWalletOnServer, type ServerFailure } from "../utils/apiClient";

/** Ticket identity for offline/server merge + toast matching. */
function ticketKey(t: BetTicket): string {
  const sels = t.selections.map((s) => `${s.fixtureId}|${s.marketType}|${s.selectionId}|${s.odds}`).join(";");
  return `${t.type}|${t.stake}|${sels}`;
}

interface UseBettingDeps {
  userProfile: Profile | null;
  setUserProfile: React.Dispatch<React.SetStateAction<Profile | null>>;
  fixtures: Fixture[];
  teams: Team[];
  tipsters: Tipster[];
  tipsterTickets: { [id: string]: BetTicket };
  gameMode: "TOURNAMENT" | "LEAGUE" | null;
  activeSlot: number;
  setCollapsedSlip: React.Dispatch<React.SetStateAction<boolean>>;
}


export function useBetting(deps: UseBettingDeps) {
  const {
    userProfile,
    setUserProfile,
    fixtures,
    teams,
    tipsters,
    tipsterTickets,
    gameMode,
    activeSlot,
    setCollapsedSlip,
  } = deps;

  const [selectedBets, setSelectedBets] = useState<BetSelection[]>([]);

  // Tri-state: null = not checked yet, true/false = last known reachability.
  // Once a call comes back "unreachable" we stop retrying the server for the
  // rest of the session (each attempt still has to time out first, so this
  // avoids a repeated ~1.2s stall on every bet when there's simply no server
  // running — the overwhelmingly common case for local/offline play). The
  // latch resets on save-slot change so waking the server (or switching to a
  // slot it knows) is picked up without a page reload.
  const serverAvailable = useRef<boolean | null>(null);
  const serverSlotKey = useRef<string>("");

  useEffect(() => {
    if (!userProfile || !gameMode) return;
    const slotKey = `${gameMode}_slot${activeSlot}`;
    if (serverSlotKey.current !== slotKey) {
      serverSlotKey.current = slotKey;
      serverAvailable.current = null;
    }
    // Capture the profile that is current for THIS slot at effect time — the
    // async bootstrap below must merge against this snapshot, never a newer
    // render's profile (which may already belong to another slot).
    const snapshot = userProfile;
    let cancelled = false;
    bootstrapWallet({ gameMode, slot: activeSlot }, snapshot).then(async (result) => {
      if (cancelled) return;
      serverAvailable.current = result.ok;
      if (!result.ok) return;
      const server = result.profile;
      if (JSON.stringify(server) === JSON.stringify(snapshot)) return;
      // Merge, don't overwrite: the server missed everything that happened
      // while it was unreachable (casino wins, VIP, transfers, offline bets).
      // Fresh-campaign case: local is a brand-new profile for this slot —
      // the server copy is stale, replace it wholesale.
      const localIsFresh =
        snapshot.tickets.length === 0 && snapshot.currentRoundIndex === 0 &&
        (server.tickets.length > 0 || server.currentRoundIndex > 0 ||
          Math.abs(server.balance - snapshot.balance) > 0.01);
      if (localIsFresh) {
        const over = await overwriteWalletOnServer({ gameMode, slot: activeSlot }, snapshot);
        if (!cancelled && over.ok) serverAvailable.current = true;
        return; // local is already correct on screen
      }
      // Timeout-duplicate dedup: a local ticket with identical content placed
      // within 15s of a server ticket is the same intent sent twice (server
      // wrote it, client timed out and minted a local copy). Drop the local copy.
      const serverKeys = new Map<string, number>();
      server.tickets.forEach((t) => {
        const k = ticketKey(t);
        serverKeys.set(k, Math.min(serverKeys.get(k) ?? Infinity, t.timestamp));
      });
      let refundForDupes = 0;
      const localOnly = snapshot.tickets.filter((t) => {
        if (server.tickets.some((s) => s.id === t.id)) return false;
        const st = serverKeys.get(ticketKey(t));
        if (st !== undefined && Math.abs(t.timestamp - st) < 15000) {
          if (t.status === "PENDING" || t.status === "SETTLING") refundForDupes += t.stake;
          return false;
        }
        return true;
      });
      const mergedTickets: BetTicket[] = [
        ...server.tickets,
        ...localOnly.filter((t) => !server.tickets.some((s) => s.id === t.id)),
      ];
      // Net local-only balance effect (offline wins/spends + local-only ticket
      // stakes already deducted locally), minus refunded duplicates.
      const balanceDelta = Math.round((snapshot.balance - server.balance + refundForDupes) * 100) / 100;
      if (Math.abs(balanceDelta) < 0.01 && mergedTickets.length === server.tickets.length) {
        if (!cancelled) setUserProfile(server);
        return;
      }
      const merged: Profile = {
        ...server,
        balance: Math.round((server.balance + balanceDelta) * 100) / 100,
        tickets: mergedTickets,
        bankrollHistory: [...(server.bankrollHistory ?? []), ...(snapshot.bankrollHistory ?? []).filter((h) =>
          !(server.bankrollHistory ?? []).some((sh) => sh.timestamp === h.timestamp && sh.detail === h.detail),
        )].slice(-500),
      };
      const over = await overwriteWalletOnServer({ gameMode, slot: activeSlot }, merged);
      if (cancelled) return;
      if (over.ok) {
        setUserProfile(over.profile);
        persist(over.profile);
      } else {
        // Server refused the merge — apply it locally so offline progress is
        // never wiped; the next successful server call reconciles again.
        const localMerged: Profile = { ...snapshot, tickets: mergedTickets, balance: Math.round((snapshot.balance + refundForDupes) * 100) / 100 };
        setUserProfile(localMerged);
        persist(localMerged);
      }
    });
    return () => { cancelled = true; };
    // Re-run when the save slot changes, AND when userProfile first becomes
    // available for that slot (the `!!userProfile` dep) — NOT on every
    // subsequent profile edit, since `!!userProfile` only flips once it's
    // already true. This matters because gameMode/activeSlot are often set
    // (e.g. on campaign resume) on a render where userProfile is still null
    // (useProfile's own restore effect hasn't committed yet); without this,
    // the early-return above would skip bootstrap for the whole session and
    // every bet/cash-out would hit the server with no profile ever seeded,
    // surfacing a raw 409 "call bootstrap first" instead of falling back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameMode, activeSlot, !!userProfile]);

  const persist = (profile: Profile) =>
    persistStateToCache(gameMode, activeSlot, profile, teams, fixtures, tipsters, tipsterTickets);

  const sameSelection = (a: BetSelection, b: BetSelection) =>
    a.fixtureId === b.fixtureId &&
    a.marketType === b.marketType &&
    a.selectionId === b.selectionId;

  const handleAddBetSelection = (newSel: BetSelection) => {
    setCollapsedSlip(false);
    // Pure toggle: clicking a selection adds it, clicking it again removes it.
    // Mutually-exclusive outcomes from the same match (e.g. Home + Away) are now
    // allowed to coexist in the slip so they can be placed as separate singles.
    // The accumulator view enforces exclusivity separately (see BettingSlip).
    setSelectedBets((prev) => {
      const exists = prev.some((s) => sameSelection(s, newSel));
      if (exists) return prev.filter((s) => !sameSelection(s, newSel));
      return [...prev, newSel];
    });
  };

  const handleAddMultipleSelections = (newSels: BetSelection[]) => {
    setCollapsedSlip(false);
    setSelectedBets((prev) => {
      const current = [...prev];
      newSels.forEach((newSel) => {
        if (!current.some((s) => sameSelection(s, newSel))) current.push(newSel);
      });
      return current;
    });
  };

  const handleRemoveSelection = (
    fixtureId: string,
    marketType: MarketType,
    selectionId: string,
  ) => {
    setSelectedBets((prev) =>
      prev.filter(
        (s) =>
          !(
            s.fixtureId === fixtureId &&
            s.marketType === marketType &&
            s.selectionId === selectionId
          ),
      ),
    );
  };

  const handleClearAllSelections = () => setSelectedBets([]);

  /**
   * Local (client-only) bet placement — the ORIGINAL logic, unchanged. This
   * runs whenever the wallet server isn't reachable, so offline play behaves
   * exactly as it always has. When the server IS reachable, handlePlaceBet
   * (below) defers to it instead, since the server recomputes this same
   * math against its own stored balance rather than trusting this one.
   */
  const placeBetLocally = (
    type: "SINGLE" | "ACCUMULATOR",
    totalStake: number,
    selectionStakes?: { [secId: string]: number },
  ) => {
    if (!userProfile) return;
    const debited = debit(userProfile.balance, totalStake);
    if (debited === null) {
      alert("Insufficient wallet balance!");
      return;
    }

    let newTickets: BetTicket[];
    if (type === "SINGLE") {
      // Each single is its OWN independent ticket — its own stake, odds,
      // settlement and cash-out. Placing several singles at once no longer
      // groups them into a single multi-leg ticket.
      const ts = Date.now();
      newTickets = selectedBets.map((b, i) => {
        const key = `${b.fixtureId}-${b.marketType}-${b.selectionId}`;
        const stake = round2(selectionStakes?.[key] ?? totalStake / selectedBets.length);
        return {
          id: `ticket-${ts}-${i}-${Math.floor(Math.random() * 1000)}`,
          type: "SINGLE" as const,
          selections: [b],
          totalOdds: b.odds,
          stake,
          potentialPayout: round2(stake * b.odds),
          status: "PENDING" as const,
          timestamp: ts,
        };
      });
    } else {
      // Same-game-multi pricing: same-fixture legs get a correlation discount.
      const totalOdds = computeAccaOdds(selectedBets);
      newTickets = [{
        id: `ticket-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        type,
        selections: [...selectedBets],
        totalOdds,
        stake: totalStake,
        potentialPayout: Math.round(totalStake * totalOdds * 100) / 100,
        status: "PENDING",
        timestamp: Date.now(),
      }];
    }

    const nextProfile: Profile = {
      ...userProfile,
      balance: debited,
      tickets: [...userProfile.tickets, ...newTickets],
    };

    setUserProfile(nextProfile);
    setSelectedBets([]);
    persist(nextProfile);
  };

  // Guards against a double-submit (double-click, or a slow server response
  // tempting a second click before the first resolves) firing two concurrent
  // placeBetOnServer calls for the same stake. Without this, the button in
  // BettingSlip has nothing stopping a second call from going out while the
  // first is still in flight; the first debits the server balance, and the
  // second — now genuinely insufficient — comes back a real 402, which reads
  // very confusingly on screen ("it said insufficient funds but also took my
  // money") even though only the first bet was actually placed.
  const placingBet = useRef(false);

  const handlePlaceBet = async (
    type: "SINGLE" | "ACCUMULATOR",
    totalStake: number,
    selectionStakes?: { [secId: string]: number },
  ) => {
    if (!userProfile) return;
    if (placingBet.current) return;
    if (!Number.isFinite(totalStake) || totalStake <= 0) {
      alert("Stake must be greater than zero.");
      return;
    }
    if (type === "SINGLE" && selectionStakes) {
      const sum = round2(Object.values(selectionStakes).reduce((a, b) => a + (b || 0), 0));
      if (Math.abs(sum - totalStake) > 0.01) {
        alert("Per-selection stakes must add up to the total stake.");
        return;
      }
    }

    placingBet.current = true;
    try {
    if (gameMode && serverAvailable.current !== false) {
      const result = await placeBetOnServer(
        { gameMode, slot: activeSlot },
        { type, totalStake, selectedBets, selectionStakes },
      );
      if (result.ok) {
        serverAvailable.current = true;
        setUserProfile(result.profile);
        setSelectedBets([]);
        persist(result.profile);
        return;
      }
      const failure = result as ServerFailure;
      if (failure.reason === "rejected") {
        // 409 "no server-side profile yet" (server wiped/restarted) is
        // recoverable: seed it from the current local profile and retry once
        // instead of blocking the bet with a raw error.
        if ((failure as { status?: number }).status === 409 && userProfile) {
          const boot = await bootstrapWallet({ gameMode, slot: activeSlot }, userProfile);
          if (boot.ok) {
            const retry = await placeBetOnServer(
              { gameMode, slot: activeSlot },
              { type, totalStake, selectedBets, selectionStakes },
            );
            if (retry.ok) {
              serverAvailable.current = true;
              setUserProfile(retry.profile);
              setSelectedBets([]);
              persist(retry.profile);
              return;
            }
            const retryFailure = retry as ServerFailure;
            if (retryFailure.reason === "rejected") {
              serverAvailable.current = true;
              alert(retryFailure.error);
              return;
            }
          } else if ((boot as ServerFailure).reason !== "unreachable") {
            serverAvailable.current = true;
            alert((boot as { error?: string }).error ?? "Server error.");
            return;
          }
          serverAvailable.current = false;
        } else {
          // The server WAS reached and it has the real, authoritative balance
          // — trust its answer rather than falling through to local logic,
          // which could be operating on a stale/out-of-sync balance by now.
          serverAvailable.current = true;
          alert(failure.error);
          return;
        }
      } else {
        // "unreachable": no server running (or it just went away) — fall back
        // to local computation exactly as before this feature existed.
        serverAvailable.current = false;
      }
    }

    placeBetLocally(type, totalStake, selectionStakes);
    } finally {
      placingBet.current = false;
    }
  };

  /** Local (client-only) cash-out — the ORIGINAL logic, used when the server isn't reachable. */
  const cashOutLocally = (ticketId: string, offerAmount: number) => {
    if (!userProfile) return;
    const target = userProfile.tickets.find((t) => t.id === ticketId);
    if (!target || target.status !== "PENDING") return; // guard against double cash-out
    const nextTickets = userProfile.tickets.map((t) =>
      t.id === ticketId && t.status === "PENDING"
        ? { ...t, status: "CASHED_OUT" as const, cashedOutAmount: offerAmount, cashedOutRound: userProfile.currentRoundIndex }
        : t,
    );
    const nextBalance = credit(userProfile.balance, offerAmount);
    const nextProfile: Profile = {
      ...userProfile,
      balance: nextBalance,
      tickets: nextTickets,
    };
    addToast({ type: "cashout", title: "💸 Cashed Out", message: `$${offerAmount.toFixed(2)} added to wallet`, duration: 4000 });
    setUserProfile(nextProfile);
    persist(nextProfile);
  };

  /**
   * `offerAmount` is what the UI displayed to the user a moment ago (computed
   * client-side, same as always, for the on-screen "cash out for $X" button).
   * When the server is reachable it is NOT trusted here — the server
   * recomputes the fair value itself from the same fixtures and only ever
   * credits its own number. This is deliberate: a modified client could send
   * any `offerAmount` it likes, so the server treats it as a display hint,
   * never as the amount to actually pay out.
   */
  const cashingOutTickets = useRef<Set<string>>(new Set());

  const handleCashOut = async (ticketId: string, offerAmount: number) => {
    if (!userProfile) return;
    // Same double-submit guard as handlePlaceBet, keyed per-ticket so cashing
    // out one ticket doesn't block cashing out a different one at the same time.
    if (cashingOutTickets.current.has(ticketId)) return;
    cashingOutTickets.current.add(ticketId);

    try {
    if (gameMode && serverAvailable.current !== false) {
      const result = await cashOutOnServer({ gameMode, slot: activeSlot }, ticketId, fixtures);
      if (result.ok) {
        serverAvailable.current = true;
        addToast({
          type: "cashout", title: "💸 Cashed Out",
          message: `$${result.cashedOutAmount.toFixed(2)} added to wallet`, duration: 4000,
        });
        setUserProfile(result.profile);
        persist(result.profile);
        return;
      }
      const failure = result as ServerFailure;
      if (failure.reason === "rejected") {
        if ((failure as { status?: number }).status === 409 && userProfile) {
          const boot = await bootstrapWallet({ gameMode, slot: activeSlot }, userProfile);
          if (boot.ok) {
            const retry = await cashOutOnServer({ gameMode, slot: activeSlot }, ticketId, fixtures);
            if (retry.ok) {
              serverAvailable.current = true;
              addToast({
                type: "cashout", title: "💸 Cashed Out",
                message: `$${retry.cashedOutAmount.toFixed(2)} added to wallet`, duration: 4000,
              });
              setUserProfile(retry.profile);
              persist(retry.profile);
              return;
            }
            const retryFailure = retry as ServerFailure;
            if (retryFailure.reason === "rejected") {
              serverAvailable.current = true;
              alert(retryFailure.error);
              return;
            }
          } else if ((boot as ServerFailure).reason !== "unreachable") {
            serverAvailable.current = true;
            alert((boot as { error?: string }).error ?? "Server error.");
            return;
          }
          serverAvailable.current = false; // unreachable — fall back below
        } else {
          serverAvailable.current = true;
          alert(failure.error);
          return;
        }
      } else {
        serverAvailable.current = false; // unreachable — fall back below
      }
    }

    cashOutLocally(ticketId, offerAmount);
    } finally {
      cashingOutTickets.current.delete(ticketId);
    }
  };

  // In-flight guard: the auto-settle effect fires on every fixtures change,
  // and rapid FT updates could otherwise overlap two closures on the same
  // stale profile (lost-update → missing payout in offline mode).
  const settlingNow = useRef(false);

  /**
   * Auto-settles any PENDING ticket whose fixtures have all reached FT, without
   * waiting for a round advance. This prevents tickets from sitting in a
   * pending/"suspended" limbo after their matches finish. Returns silently when
   * nothing is settleable so it is safe to call from an effect on every tick.
   */
  const settleFinishedTickets = async () => {
    if (!userProfile || settlingNow.current) return;
    const ftFixtures = fixtures.filter((f) => f.status === "FT");
    if (ftFixtures.length === 0) return;

    const settleableIds = userProfile.tickets
      .filter(
        (t) =>
          (t.status === "PENDING" || t.status === "SETTLING") &&
          t.selections.every((sel) =>
            ftFixtures.some((f) => f.id === sel.fixtureId),
          ),
      )
      .map((t) => t.id);
    const bbSettleable = (userProfile.betBuilderTickets ?? []).some(
      (t) => t.status === "PENDING" && ftFixtures.some((f) => f.id === t.fixtureId),
    );
    if (settleableIds.length === 0 && !bbSettleable) return;

    settlingNow.current = true;
    try {
    // Mark SETTLING: transient status that prevents double settlement if the
    // round-advance effect fires before the async setState batch (or the
    // server round-trip below) settles.
    const markingTickets = userProfile.tickets.map((t) =>
      settleableIds.includes(t.id) ? { ...t, status: "SETTLING" as const } : t,
    );
    // Optimistically persist the SETTLING state
    const markingProfile: Profile = { ...userProfile, tickets: markingTickets };
    setUserProfile(markingProfile);
    persist(markingProfile);

    // Toast by ticket id (not array index) — server/client order can differ
    // after timeout-duplicate merges.
    const toastSettled = (before: BetTicket[], after: BetTicket[]) => {
      const beforeById = new Map(before.map((t) => [t.id, t]));
      after.forEach((ticket) => {
        const b = beforeById.get(ticket.id);
        if ((b?.status === "SETTLING" || b?.status === "PENDING") && (ticket.status === "WON" || ticket.status === "LOST")) {
          if (ticket.status === "WON") {
            addToast({ type: "win", title: "🏆 Ticket Won!", message: `+$${(ticket.settledPayout ?? ticket.potentialPayout).toFixed(2)} payout`, duration: 5000 });
          } else {
            addToast({ type: "loss", title: "Ticket Lost", message: `-$${ticket.stake.toFixed(2)} stake lost`, duration: 3000 });
          }
        }
      });
    };

    if (gameMode && serverAvailable.current !== false) {
      const result = await settleOnServer({ gameMode, slot: activeSlot }, ftFixtures);
      if (result.ok) {
        serverAvailable.current = true;
        toastSettled(markingTickets, result.profile.tickets);
        setUserProfile(result.profile);
        persist(result.profile);
        return;
      }
      const failure = result as ServerFailure;
      if (failure.reason === "rejected") {
        // 409 "no server-side profile yet" (server restarted/wiped, or the
        // bootstrap race) is recoverable: seed the server from the current
        // local profile (which already carries the SETTLING marks) and retry
        // once. The server's settle handles SETTLING tickets, so nothing gets
        // stuck or double-paid. Any other rejection is authoritative.
        if ((failure as { status?: number }).status === 409) {
          const boot = await bootstrapWallet({ gameMode, slot: activeSlot }, markingProfile);
          if (boot.ok) {
            const retry = await settleOnServer({ gameMode, slot: activeSlot }, ftFixtures);
            if (retry.ok) {
              serverAvailable.current = true;
              toastSettled(markingTickets, retry.profile.tickets);
              setUserProfile(retry.profile);
              persist(retry.profile);
              return;
            }
            const retryFailure = retry as ServerFailure;
            if (retryFailure.reason === "unreachable") serverAvailable.current = false;
            else { serverAvailable.current = true; return; }
          } else if ((boot as ServerFailure).reason === "unreachable") {
            serverAvailable.current = false;
          } else {
            serverAvailable.current = true;
            return;
          }
        } else {
          serverAvailable.current = true;
          return;
        }
      } else {
        serverAvailable.current = false; // unreachable — fall back below
      }
    }

    // Local settlement (server unavailable) — also settles Bet Builder tickets
    // so offline behavior matches the server path (previously BB tickets only
    // settled on round advance, diverging timing/amounts).
    const { finalTickets, totalWinPayoutSum } = settlePendingTickets(
      markingTickets,
      ftFixtures,
    );
    let bbPayoutSum = 0;
    const finalBbTickets = (userProfile.betBuilderTickets ?? []).map((ticket) => {
      if (ticket.status !== "PENDING") return ticket;
      const match = ftFixtures.find((f) => f.id === ticket.fixtureId);
      if (!match) return ticket;
      const result = settleBetBuilderTicket(ticket, match);
      if (result === "WON") bbPayoutSum += ticket.potentialPayout;
      return { ...ticket, status: result };
    });

    toastSettled(markingTickets, finalTickets);

    const nextProfile: Profile = {
      ...userProfile,
      balance: credit(credit(userProfile.balance, totalWinPayoutSum), bbPayoutSum),
      tickets: finalTickets,
      betBuilderTickets: finalBbTickets,
    };
    setUserProfile(nextProfile);
    persist(nextProfile);
    } finally {
      settlingNow.current = false;
    }
  };

  /** Local (client-only) Bet Builder placement — the ORIGINAL logic, used when the server isn't reachable. */
  const placeBetBuilderLocally = (
    fixtureId: string,
    selections: BetBuilderSelection[],
    stake: number,
    combinedOdds: number,
  ): boolean => {
    if (!userProfile) return false;
    const bbDebited = debit(userProfile.balance, stake);
    if (bbDebited === null) return false;
    // Same-game multis are regular tickets: they appear in the bet list,
    // analytics, and settle through the normal pipeline.
    const ticket: BetTicket = {
      id: `sgm-${Date.now()}`,
      type: "ACCUMULATOR",
      selections: selections.map((s) => ({
        fixtureId,
        marketType: s.marketType,
        selectionId: s.selectionId,
        odds: s.odds,
        details: s.label,
        marketName: "Same Game Multi",
      })),
      totalOdds: combinedOdds,
      stake,
      potentialPayout: Math.round(stake * combinedOdds * 100) / 100,
      status: "PENDING",
      timestamp: Date.now(),
    };
    const nextProfile = {
      ...userProfile,
      balance: bbDebited,
      tickets: [...userProfile.tickets, ticket],
    };
    setUserProfile(nextProfile);
    persist(nextProfile);
    return true;
  };

  const placingBuilder = useRef(false);

  /**
   * NOTE: `combinedOdds` here is a display value the caller already computed
   * (used for the local-fallback path only). When the server is reachable it
   * recomputes the same correlation-discounted odds itself and that's the
   * number actually charged/paid — see server/index.ts's place-builder route.
   */
  const handlePlaceBetBuilder = async (
    fixtureId: string,
    selections: BetBuilderSelection[],
    stake: number,
    combinedOdds: number,
  ): Promise<boolean> => {
    if (!userProfile || placingBuilder.current) return false;
    placingBuilder.current = true;
    try {
    if (gameMode && serverAvailable.current !== false) {
      const result = await placeBetBuilderOnServer({ gameMode, slot: activeSlot }, { fixtureId, selections, stake });
      if (result.ok) {
        serverAvailable.current = true;
        setUserProfile(result.profile);
        persist(result.profile);
        return true;
      }
      const failure = result as ServerFailure;
      if (failure.reason === "rejected") {
        if ((failure as { status?: number }).status === 409) {
          const boot = await bootstrapWallet({ gameMode, slot: activeSlot }, userProfile);
          if (boot.ok) {
            const retry = await placeBetBuilderOnServer({ gameMode, slot: activeSlot }, { fixtureId, selections, stake });
            if (retry.ok) {
              serverAvailable.current = true;
              setUserProfile(retry.profile);
              persist(retry.profile);
              return true;
            }
            const retryFailure = retry as ServerFailure;
            if (retryFailure.reason === "rejected") {
              serverAvailable.current = true;
              alert(retryFailure.error);
              return false;
            }
          } else if ((boot as ServerFailure).reason !== "unreachable") {
            serverAvailable.current = true;
            alert((boot as { error?: string }).error ?? "Server error.");
            return false;
          }
          serverAvailable.current = false;
        } else {
          serverAvailable.current = true;
          alert(failure.error);
          return false;
        }
      } else {
        serverAvailable.current = false; // unreachable — fall back below
      }
    }

    return placeBetBuilderLocally(fixtureId, selections, stake, combinedOdds);
    } finally {
      placingBuilder.current = false;
    }
  };

  return {
    selectedBets,
    setSelectedBets,
    handleAddBetSelection,
    handleAddMultipleSelections,
    handleRemoveSelection,
    handleClearAllSelections,
    handlePlaceBet,
    handleCashOut,
    settleFinishedTickets,
    handlePlaceBetBuilder,
  };
}
