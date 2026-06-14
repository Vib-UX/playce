import { ACTIVE_CHAIN, ARBITRUM_SEPOLIA, ETHEREUM_SEPOLIA, explorerBaseUrl } from "@/lib/chain";
import type { Sponsor } from "@/lib/types";

/** Win badges for Blink/Chainlink stakes settle on the active chain (Base). */
const SETTLEMENT_REWARD_CHAIN = {
  chainId: ACTIVE_CHAIN.id,
  badgeMechanism: "direct" as const,
  label: ACTIVE_CHAIN.name,
  explorerBaseUrl: explorerBaseUrl(),
};

/**
 * Chains / products / oracles that "rep" at Playce venues. Attendees can rep
 * their favorite and play games skinned with the sponsor's AR model.
 *
 * AR skins reuse bundled placeholder .glb models for now — swap `arModelUrl`
 * with real sponsor assets when available.
 */
export const SPONSORS: Sponsor[] = [
  // ── Oracle / data ──────────────────────────────────────────────────────────
  // Chainlink reps a staked chain battle — pot settles via Blink on the active
  // chain; winner gets a soulbound badge there (CRE path for chess, direct for 67).
  {
    id: "chainlink",
    name: "Chainlink",
    kind: "oracle",
    category: "Oracle",
    tagline: "The standard for onchain data & cross-chain.",
    brandColor: "#2a5ada",
    arModelUrl: "/models/chainlink.glb",
    rewardChain: SETTLEMENT_REWARD_CHAIN,
  },
  {
    id: "pyth",
    name: "Pyth",
    kind: "oracle",
    category: "Oracle",
    tagline: "Real-time market data, first-party sourced.",
    brandColor: "#7c3aed",
    arModelUrl: "/models/pyth.glb",
  },
  // ── Chains ─────────────────────────────────────────────────────────────────
  // Reward-bearing chains: repping these turns the 67 into a staked "chain
  // battle" — the winner takes the pot (settled on Base mainnet) and a soulbound
  // win badge on this chain. `rewardChain.chainId` matches src/lib/chain.ts.
  {
    id: "arbitrum",
    name: "Arbitrum",
    kind: "chain",
    category: "Chain",
    tagline: "Scaling Ethereum, secured by Ethereum.",
    brandColor: "#12aaff",
    arModelUrl: "/models/arb.glb",
    rewardChain: {
      chainId: ARBITRUM_SEPOLIA.id,
      badgeMechanism: "direct",
      label: "Arbitrum Sepolia",
      explorerBaseUrl: "https://sepolia.arbiscan.io",
    },
  },
  {
    id: "ethereum",
    name: "Ethereum",
    kind: "chain",
    category: "Chain",
    tagline: "The world computer.",
    brandColor: "#627eea",
    arModelUrl: "/models/eth.glb",
    rewardChain: {
      chainId: ETHEREUM_SEPOLIA.id,
      badgeMechanism: "ccip",
      label: "Ethereum Sepolia",
      explorerBaseUrl: "https://sepolia.etherscan.io",
    },
  },
  {
    id: "base",
    name: "Base",
    kind: "chain",
    category: "Chain",
    tagline: "Bring the world onchain.",
    brandColor: "#0052ff",
    arModelUrl: "/models/mascot-plush.glb",
  },
  {
    id: "sui",
    name: "Sui",
    kind: "chain",
    category: "Chain",
    tagline: "A high-performance L1 for the next billion users.",
    brandColor: "#4da2ff",
  },
  {
    id: "world",
    name: "World",
    kind: "chain",
    category: "Chain",
    tagline: "Proof of human, onchain.",
    brandColor: "#000000",
  },
  {
    id: "arc",
    name: "Arc",
    kind: "chain",
    category: "Chain",
    tagline: "An open L1 built for stablecoin finance.",
    brandColor: "#00d3a9",
  },
  {
    id: "hedera",
    name: "Hedera",
    kind: "chain",
    category: "Chain",
    tagline: "Fast, fair, and secure public network.",
    brandColor: "#222222",
  },
  {
    id: "canton",
    name: "Canton Foundation",
    kind: "chain",
    category: "Chain",
    tagline: "The network for institutional finance.",
    brandColor: "#e4002b",
  },
  // ── Wallets ──────────────────────────────────────────────────────────────
  {
    id: "dynamic",
    name: "Dynamic",
    kind: "product",
    category: "Wallet",
    tagline: "Wallet onboarding & auth for every app.",
    brandColor: "#7d56f4",
    arModelUrl: "/models/dynamic.glb",
  },
  {
    id: "privy",
    name: "Privy",
    kind: "product",
    category: "Wallet",
    tagline: "Embedded wallets in a few lines of code.",
    brandColor: "#4b3bff",
    arModelUrl: "/models/privy.glb",
  },
  {
    id: "ledger",
    name: "Ledger",
    kind: "product",
    category: "Wallet",
    tagline: "Self-custody, secured by hardware.",
    brandColor: "#000000",
  },
  // ── DeFi ───────────────────────────────────────────────────────────────────
  {
    id: "uniswap",
    name: "Uniswap Foundation",
    kind: "product",
    category: "DeFi",
    tagline: "The protocol powering onchain liquidity.",
    brandColor: "#ff007a",
  },
  {
    id: "1inch",
    name: "1inch",
    kind: "product",
    category: "DeFi",
    tagline: "Best execution across DeFi.",
    brandColor: "#1b314f",
  },
  // ── Interoperability ─────────────────────────────────────────────────────
  {
    id: "lifi",
    name: "LI.FI",
    kind: "product",
    category: "Interoperability",
    tagline: "Any-chain, any-token bridging & swaps.",
    brandColor: "#f5b1cc",
  },
  // ── Identity ───────────────────────────────────────────────────────────────
  {
    id: "ens",
    name: "ENS",
    kind: "product",
    category: "Identity",
    tagline: "Decentralized naming for everything.",
    brandColor: "#5298ff",
    arModelUrl: "/models/ens.glb",
    rewardChain: SETTLEMENT_REWARD_CHAIN,
  },
  // ── Infrastructure ─────────────────────────────────────────────────────────
  {
    id: "google-cloud",
    name: "Google Cloud",
    kind: "product",
    category: "Infra",
    tagline: "Build, scale, and secure web3 apps.",
    brandColor: "#4285f4",
  },
  // ── Products ─────────────────────────────────────────────────────────────
  // Blink powers the USDC stake deposit — repping Blink is a chain battle too.
  {
    id: "blink",
    name: "Blink",
    kind: "product",
    category: "Product",
    tagline: "Actions you can play, anywhere.",
    brandColor: "#ff7a1a",
    arModelUrl: "/models/blink.glb",
    rewardChain: SETTLEMENT_REWARD_CHAIN,
  },
  {
    id: "unlink",
    name: "Unlink",
    kind: "product",
    category: "Product",
    tagline: "Private, self-custodial payments.",
    brandColor: "#10b981",
  },
];

/** Stable display order for the sponsor "rep" categories. */
export const SPONSOR_CATEGORY_ORDER = [
  "Chain",
  "Wallet",
  "Oracle",
  "DeFi",
  "Interoperability",
  "Identity",
  "Infra",
  "Product",
];

/** Group a set of sponsors by their `category`, in a stable display order. */
export function groupSponsorsByCategory(
  sponsors: Sponsor[],
): { category: string; sponsors: Sponsor[] }[] {
  const byCategory = new Map<string, Sponsor[]>();
  for (const s of sponsors) {
    const list = byCategory.get(s.category) ?? [];
    list.push(s);
    byCategory.set(s.category, list);
  }
  const ordered = [...byCategory.keys()].sort((a, b) => {
    const ia = SPONSOR_CATEGORY_ORDER.indexOf(a);
    const ib = SPONSOR_CATEGORY_ORDER.indexOf(b);
    return (ia === -1 ? Infinity : ia) - (ib === -1 ? Infinity : ib);
  });
  return ordered.map((category) => ({
    category,
    sponsors: byCategory.get(category) ?? [],
  }));
}

export function getSponsorById(id: string): Sponsor | undefined {
  return SPONSORS.find((s) => s.id === id);
}

export function getSponsorsByIds(ids: string[]): Sponsor[] {
  return ids
    .map((id) => getSponsorById(id))
    .filter((s): s is Sponsor => Boolean(s));
}
