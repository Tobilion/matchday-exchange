import { useState, useEffect, useRef } from "react";
import { Profile, Team, Fixture, Tipster, BetTicket, ClubOwnership, PurchasedItem } from "../types";
import { persistStateToCache, getKeysForMode, isSaveCompatible, loadProfile } from "../utils/storage";
import { creditWalletOnServer } from "../utils/apiClient";

// Casino jackpots legitimately exceed 100k (Keno 5000x, Slots 100x, Hi-Lo
// 120x), so there is no per-call cap here beyond finiteness and the max
// balance. The server enforces its own ±50M per-call cap; larger deltas are
// split into chunks below so a jackpot is never silently dropped.
export const MAX_BALANCE = 1e15;
const SERVER_TX_CHUNK = 40_000_000;
const MAX_WALLET_DEPOSIT_TX = 10_000_000;

interface UseProfileDeps {
  gameMode: "TOURNAMENT" | "LEAGUE" | null;
  activeSlot: number;
  teams: Team[];
  setTeams: React.Dispatch<React.SetStateAction<Team[]>>;
  fixtures: Fixture[];
  tipsters: Tipster[];
  tipsterTickets: { [id: string]: BetTicket };
}

export function useProfile(deps: UseProfileDeps) {
  const { gameMode, activeSlot, teams, setTeams, fixtures, tipsters, tipsterTickets } = deps;

  const [userProfile, setUserProfile] = useState<Profile | null>(null);

  // Synchronous mirror of the profile for money math. Event handlers compute
  // the next profile from this ref (not from a functional setState updater) so
  // each delta persists + syncs exactly once — no StrictMode double-credit,
  // no stale-closure races on rapid successive casino calls.
  const profileRef = useRef<Profile | null>(null);
  useEffect(() => { profileRef.current = userProfile; }, [userProfile]);

  // Restore saved profile on mount / game-mode change (e.g. campaign resume)
  useEffect(() => {
    if (!gameMode) return;
    const keys = getKeysForMode(gameMode, activeSlot);
    if (!isSaveCompatible(keys)) return; // GameContext regenerates; don't load stale shapes
    const loaded = loadProfile(keys);
    if (loaded) { profileRef.current = loaded; setUserProfile(loaded); }
  }, [gameMode, activeSlot]);

  const persist = (
    profile: Profile,
    t: Team[] = teams,
    f: Fixture[] = fixtures,
    ts: Tipster[] = tipsters,
    tt: { [id: string]: BetTicket } = tipsterTickets,
  ) => persistStateToCache(gameMode, activeSlot, profile, t, f, ts, tt);

  /** Pushes a delta to the server in ≤50M chunks (fire-and-forget). */
  const syncDeltaToServer = (delta: number, reason: string) => {
    if (!gameMode || !Number.isFinite(delta) || delta === 0) return;
    let remaining = Math.round(delta * 100) / 100;
    const sendChunk = (chunk: number) => {
      creditWalletOnServer({ gameMode, slot: activeSlot }, chunk, reason).then((r) => {
        if (!r.ok) return;
        // Reconcile local balance to the server's canonical figure so the
        // two never silently diverge (e.g. server clamped at its max).
        const serverBalance = (r as { profile?: Profile }).profile?.balance;
        if (typeof serverBalance === "number" && profileRef.current &&
            Math.abs(serverBalance - profileRef.current.balance) > 0.01) {
          const reconciled = { ...profileRef.current, balance: serverBalance };
          profileRef.current = reconciled;
          setUserProfile(reconciled);
          persist(reconciled);
        }
      });
    };
    while (Math.abs(remaining) > SERVER_TX_CHUNK) {
      const chunk = Math.sign(remaining) * SERVER_TX_CHUNK;
      sendChunk(Math.round(chunk * 100) / 100);
      remaining = Math.round((remaining - chunk) * 100) / 100;
    }
    sendChunk(remaining);
  };

  /**
   * Applies a signed balance delta locally (persisted) and mirrors it to the
   * server. Single funnel for casino, VIP, transfers-adjacent and challenge
   * money so no path can drift the server balance again.
   */
  const applyBalanceDelta = (delta: number, reason: string, opts?: { affectNetProfit?: boolean }): boolean => {
    const prev = profileRef.current;
    if (!prev || !Number.isFinite(delta) || delta === 0) return false;
    const nextRaw = prev.balance + delta;
    if (!Number.isFinite(nextRaw) || nextRaw < -1e-9 || nextRaw > MAX_BALANCE) return false;
    const nextBalance = Math.round(Math.max(0, Math.min(MAX_BALANCE, nextRaw)) * 100) / 100;
    const next: Profile = {
      ...prev,
      balance: nextBalance,
      netProfit: opts?.affectNetProfit === false ? prev.netProfit : Math.round((prev.netProfit + delta) * 100) / 100,
      bankrollHistory: [...(prev.bankrollHistory ?? []), { timestamp: Date.now(), balance: nextBalance, detail: reason }].slice(-500),
    };
    profileRef.current = next;
    setUserProfile(next);
    persist(next);
    syncDeltaToServer(Math.round((nextBalance - prev.balance) * 100) / 100, reason);
    return true;
  };

  // Central funnel for all casino money movements. Every game settles through
  // here, which persists to localStorage and mirrors to the server — casino
  // wins are no longer invisible to bet validation or lost on reload.
  const handleUpdateBalanceCasino = (delta: number) => {
    if (!Number.isFinite(delta) || delta === 0) {
      console.warn("[casino] rejected non-finite delta", delta);
      return;
    }
    applyBalanceDelta(delta, delta >= 0 ? `Casino win: +$${delta}` : `Casino stake: -$${Math.abs(delta)}`);
  };

  const handleConfirmWalletTransaction = (
    amount: number,
    action: "DEPOSIT" | "WITHDRAW",
  ): boolean => {
    const prev = profileRef.current;
    if (!prev || !Number.isFinite(amount) || amount <= 0) return false;
    if (action === "DEPOSIT" && amount > MAX_WALLET_DEPOSIT_TX) {
      alert(`Deposits are capped at $${MAX_WALLET_DEPOSIT_TX.toLocaleString()} per transaction.`);
      return false;
    }
    if (action === "WITHDRAW" && prev.balance < amount) {
      alert("Insufficient wallet balance for withdrawal!");
      return false;
    }
    const delta = action === "DEPOSIT" ? amount : -amount;
    // Deposits/withdrawals don't affect betting netProfit; they do get a
    // ledger line so bankroll history stays accurate.
    return applyBalanceDelta(delta, `Wallet ${action.toLowerCase()}: ${delta >= 0 ? "+" : "-"}$${Math.abs(amount)}`, { affectNetProfit: false });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handlePurchaseVIPItem = (itemDetails: any) => {
    const prev = profileRef.current;
    if (!prev) return;
    if (!Number.isFinite(itemDetails.price) || prev.balance < itemDetails.price) return;

    const newItem: PurchasedItem = {
      id: Math.random().toString(36).substring(7),
      name: itemDetails.name,
      description: itemDetails.description || "",
      price: itemDetails.price,
      worth: itemDetails.worth ?? Math.round(itemDetails.price * 0.7),
      icon: itemDetails.icon || "🏆",
      dateStr: new Date().toLocaleDateString(),
      imageUrl: itemDetails.imageUrl,
      category: itemDetails.category,
      rarity: itemDetails.rarity,
      teamId: itemDetails.category === "Football Clubs" ? itemDetails.teamId : undefined,
    };

    let nextTeams = teams;
    if (itemDetails.category === "Football Clubs" && itemDetails.teamId) {
      const targetTeam = teams.find((t) => t.id === itemDetails.teamId);
      if (targetTeam && !targetTeam.ownership) {
        const isHealthy = (p: import("../types").Player) =>
          !p.injured && (p.injuredRounds ?? 0) === 0 && (p.injuryRecoveryMatches ?? 0) === 0;
        const gk = targetTeam.players.find(p => p.position === "GK" && isHealthy(p));
        const outfield = targetTeam.players.filter(p => p.id !== gk?.id && isHealthy(p)).slice(0, gk ? 10 : 11);
        const defaultStarters = (gk ? [gk, ...outfield] : outfield).slice(0, 11).map(p => p.id);

        const ownership: ClubOwnership = {
          clubId: targetTeam.id,
          purchasedAt: Date.now(),
          purchasePrice: itemDetails.price,
          trainingFacilityLevel: 1,
          stadiumLevel: 1,
          totalInvested: itemDetails.price,
          passiveIncomePerMatch: 50000,
          formation: "4-4-2",
          mentality: "Balanced",
          pressingStyle: "Mid Block",
          starterIds: defaultStarters,
          matchesManaged: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          totalGoalsFor: 0,
          totalGoalsAgainst: 0,
        };
        nextTeams = teams.map((t) =>
          t.id === itemDetails.teamId ? { ...t, ownership } : t,
        );
        setTeams(nextTeams);
      }
    }

    const isClub = itemDetails.category === "Football Clubs" && itemDetails.teamId;
    const prevIds = prev.ownedTeamIds ?? (prev.ownedTeamId ? [prev.ownedTeamId] : []);
    const nextIds = isClub ? Array.from(new Set([...prevIds, itemDetails.teamId])) : prevIds;
    const nextBalance = Math.round((prev.balance - itemDetails.price) * 100) / 100;
    const nextProfile: Profile = {
      ...prev,
      balance: nextBalance,
      purchasedItems: [...(prev.purchasedItems || []), newItem],
      ownedTeamIds: nextIds,
      ownedTeamId: isClub ? (prev.ownedTeamId ?? itemDetails.teamId) : prev.ownedTeamId,
      bankrollHistory: [...(prev.bankrollHistory ?? []), { timestamp: Date.now(), balance: nextBalance, detail: `VIP purchase ${itemDetails.name}: -$${itemDetails.price}` }].slice(-500),
    };
    profileRef.current = nextProfile;
    setUserProfile(nextProfile);
    persist(nextProfile, nextTeams);
    syncDeltaToServer(-itemDetails.price, `VIP purchase ${itemDetails.name}`);
  };

  const handleUpdateClubOwnership = (
    teamId: string,
    updates: Partial<ClubOwnership>,
  ) => {
    const nextTeams = teams.map((t) =>
      t.id === teamId && t.ownership
        ? { ...t, ownership: { ...t.ownership, ...updates } }
        : t,
    );
    setTeams(nextTeams);
    if (profileRef.current) persist(profileRef.current, nextTeams);
  };

  const handleUpgradeFacility = (
    teamId: string,
    type: "training" | "stadium",
  ) => {
    const prev = profileRef.current;
    if (!prev) return;
    const team = teams.find((t) => t.id === teamId);
    if (!team?.ownership) return;
    const lvl =
      type === "training"
        ? team.ownership.trainingFacilityLevel
        : team.ownership.stadiumLevel;
    const cost = type === "training" ? lvl * 2_000_000 : lvl * 5_000_000;
    if (prev.balance < cost) return;
    const newIncome =
      type === "stadium"
        ? (lvl + 1) * 50_000
        : team.ownership.passiveIncomePerMatch;
    const nextTeams = teams.map((t) =>
      t.id === teamId && t.ownership
        ? {
            ...t,
            ownership: {
              ...t.ownership,
              trainingFacilityLevel:
                type === "training" ? lvl + 1 : t.ownership.trainingFacilityLevel,
              stadiumLevel: type === "stadium" ? lvl + 1 : t.ownership.stadiumLevel,
              totalInvested: t.ownership.totalInvested + cost,
              passiveIncomePerMatch: newIncome,
            },
          }
        : t,
    );
    const nextProfile: Profile = {
      ...prev,
      balance: Math.round((prev.balance - cost) * 100) / 100,
      bankrollHistory: [...(prev.bankrollHistory ?? []), { timestamp: Date.now(), balance: Math.round((prev.balance - cost) * 100) / 100, detail: `Facility upgrade (${type}): -$${cost}` }].slice(-500),
    };
    profileRef.current = nextProfile;
    setTeams(nextTeams);
    setUserProfile(nextProfile);
    persist(nextProfile, nextTeams);
    syncDeltaToServer(-cost, `Facility upgrade (${type})`);
  };

  /**
   * Stadium Naming Rights: rename an OWNED club's stadium for a fee. This grants
   * NO ownership — it only updates the stadium name on a club the user already owns.
   */
  const handleRenameStadium = (teamId: string, newName: string, fee: number): boolean => {
    const prev = profileRef.current;
    if (!prev) return false;
    const team = teams.find((t) => t.id === teamId);
    if (!team?.ownership) return false;            // must already own the club
    if (prev.balance < fee) return false;
    const nextTeams = teams.map((t) => (t.id === teamId ? { ...t, stadiumName: newName } : t));
    const nextBalance = Math.round((prev.balance - fee) * 100) / 100;
    const nextProfile: Profile = { ...prev, balance: nextBalance, bankrollHistory: [...(prev.bankrollHistory ?? []), { timestamp: Date.now(), balance: nextBalance, detail: `Stadium naming: -$${fee}` }].slice(-500) };
    profileRef.current = nextProfile;
    setTeams(nextTeams);
    setUserProfile(nextProfile);
    persist(nextProfile, nextTeams);
    syncDeltaToServer(-fee, "Stadium naming rights");
    return true;
  };

  /**
   * Training Complex Upgrade: permanently boost an OWNED club's player ratings by
   * +2 (capped at 99) for a fee. Grants NO ownership.
   */
  const handleBoostClubRatings = (teamId: string, fee: number): boolean => {
    const prev = profileRef.current;
    if (!prev) return false;
    const team = teams.find((t) => t.id === teamId);
    if (!team?.ownership) return false;
    if (prev.balance < fee) return false;
    const nextTeams = teams.map((t) =>
      t.id === teamId
        ? { ...t, players: t.players.map((p) => ({ ...p, rating: Math.min(99, p.rating + 2) })) }
        : t,
    );
    const nextBalance = Math.round((prev.balance - fee) * 100) / 100;
    const nextProfile: Profile = { ...prev, balance: nextBalance, bankrollHistory: [...(prev.bankrollHistory ?? []), { timestamp: Date.now(), balance: nextBalance, detail: `Training upgrade: -$${fee}` }].slice(-500) };
    profileRef.current = nextProfile;
    setTeams(nextTeams);
    setUserProfile(nextProfile);
    persist(nextProfile, nextTeams);
    syncDeltaToServer(-fee, "Training upgrade");
    return true;
  };

  const handleLiquidateVIPItem = (item: { id: string; worth: number; category?: string; teamId?: string }) => {
    const prev = profileRef.current;
    if (!prev) return;
    const isClubSale = item.category === "Football Clubs";
    const soldTeamId =
      item.teamId ??
      (prev.purchasedItems || []).find((i) => i.id === item.id)?.teamId ??
      prev.ownedTeamId;
    const prevIds = prev.ownedTeamIds ?? (prev.ownedTeamId ? [prev.ownedTeamId] : []);
    let nextTeams = teams;
    let nextIds = prevIds;
    let nextActive = prev.ownedTeamId;
    if (isClubSale && soldTeamId) {
      // Strip ownership from just the sold club so it can be purchased again
      nextTeams = teams.map((t) => (t.id === soldTeamId ? { ...t, ownership: undefined } : t));
      setTeams(nextTeams);
      nextIds = prevIds.filter((id) => id !== soldTeamId);
      nextActive = prev.ownedTeamId === soldTeamId ? nextIds[0] : prev.ownedTeamId;
    }
    const nextBalance = Math.round((prev.balance + item.worth) * 100) / 100;
    const nextProfile: Profile = {
      ...prev,
      balance: nextBalance,
      purchasedItems: (prev.purchasedItems || []).filter((i) => i.id !== item.id),
      ownedTeamIds: nextIds,
      ownedTeamId: nextActive,
      bankrollHistory: [...(prev.bankrollHistory ?? []), { timestamp: Date.now(), balance: nextBalance, detail: `VIP sale: +$${item.worth}` }].slice(-500),
    };
    profileRef.current = nextProfile;
    setUserProfile(nextProfile);
    persist(nextProfile, nextTeams);
    syncDeltaToServer(item.worth, "VIP sale");
  };

  return {
    userProfile,
    setUserProfile,
    persist,
    handleUpdateBalanceCasino,
    handleConfirmWalletTransaction,
    handlePurchaseVIPItem,
    handleUpdateClubOwnership,
    handleUpgradeFacility,
    handleRenameStadium,
    handleBoostClubRatings,
    handleLiquidateVIPItem,
  };
}
