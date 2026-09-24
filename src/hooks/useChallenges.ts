import { useEffect } from "react";
import { Challenge, Profile } from "../types";
import { generateRoundChallenges } from "../data/challenges";
import { addToast } from "./useToast";
import { creditWalletOnServer } from "../utils/apiClient";

interface UseChallengesDeps {
  userProfile: Profile | null;
  setUserProfile: React.Dispatch<React.SetStateAction<Profile | null>>;
  persist: (profile: Profile) => void;
  gameMode: "TOURNAMENT" | "LEAGUE" | null;
  activeSlot: number;
}

export function useChallenges({ userProfile, setUserProfile, persist, gameMode, activeSlot }: UseChallengesDeps) {
  const activeChallenges: Challenge[] = userProfile?.challenges ?? [];

  // Top up to 3 active challenges at the start of each round
  useEffect(() => {
    if (!userProfile) return;
    const current = userProfile.challenges ?? [];
    const active = current.filter((c) => c.status === "ACTIVE");
    if (active.length >= 3) return;
    const fresh = generateRoundChallenges(userProfile.currentRoundIndex).slice(
      0,
      3 - active.length,
    );
    const existingTypes = new Set(active.map((c) => c.type));
    const additions = fresh.filter((c) => !existingTypes.has(c.type));
    if (additions.length === 0) return;
    const nextProfile: Profile = { ...userProfile, challenges: [...current, ...additions] };
    setUserProfile(nextProfile);
    persist(nextProfile);
  }, [userProfile?.currentRoundIndex, userProfile?.challenges?.length, setUserProfile, persist]);

  const handleClaimChallenge = (challengeId: string) => {
    if (!userProfile) return;
    const challenge = (userProfile.challenges ?? []).find((c) => c.id === challengeId);
    if (!challenge || challenge.status !== "COMPLETED") return;
    const nextBalance = Math.round((userProfile.balance + challenge.reward) * 100) / 100;
    const nextProfile: Profile = {
      ...userProfile,
      balance: nextBalance,
      challenges: (userProfile.challenges ?? []).filter((c) => c.id !== challengeId),
      bankrollHistory: [...(userProfile.bankrollHistory ?? []), { timestamp: Date.now(), balance: nextBalance, detail: `Challenge reward: +$${challenge.reward}` }].slice(-500),
    };
    setUserProfile(nextProfile);
    persist(nextProfile);
    if (gameMode) {
      creditWalletOnServer({ gameMode, slot: activeSlot }, challenge.reward, `Challenge reward: ${challenge.title}`);
    }
    addToast({
      type: "win",
      title: "🎯 Challenge Reward",
      message: `+$${challenge.reward.toFixed(2)} — ${challenge.title}`,
      duration: 5000,
    });
  };

  const handleDismissChallenge = (challengeId: string) => {
    if (!userProfile) return;
    const nextProfile: Profile = {
      ...userProfile,
      challenges: (userProfile.challenges ?? []).filter((c) => c.id !== challengeId),
    };
    setUserProfile(nextProfile);
    persist(nextProfile);
  };

  return { activeChallenges, handleClaimChallenge, handleDismissChallenge };
}
