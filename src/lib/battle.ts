import { getSponsorById, SPONSORS } from "@/lib/mock/sponsors";
import type { BattleMode, Sponsor, SponsorRewardChain } from "@/lib/types";

/**
 * Battle type derived from the repped sponsor.
 *  - reward-bearing chain (Arbitrum / Ethereum) => staked "chain battle"
 *  - everything else                            => "memory battle" (clip only)
 */
export function battleModeForSponsor(sponsor?: Sponsor | null): BattleMode {
  return sponsor?.rewardChain ? "chain" : "memory";
}

export function battleModeForSponsorId(id?: string | null): BattleMode {
  if (!id) return "memory";
  return battleModeForSponsor(getSponsorById(id));
}

/** Reward-chain config for a sponsor id, if it is a chain-battle sponsor. */
export function rewardChainForSponsorId(
  id?: string | null,
): SponsorRewardChain | undefined {
  if (!id) return undefined;
  return getSponsorById(id)?.rewardChain;
}

/** True when repping this sponsor stakes a pot and rewards the winner. */
export function isChainBattleSponsorId(id?: string | null): boolean {
  return battleModeForSponsorId(id) === "chain";
}

/** All sponsors that map to reward-bearing chain battles. */
export function getChainBattleSponsors(): Sponsor[] {
  return SPONSORS.filter((s) => Boolean(s.rewardChain));
}
