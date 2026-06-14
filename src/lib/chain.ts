import { arbitrumSepolia, base, baseSepolia, sepolia, type Chain } from "viem/chains";

/** Ethereum Sepolia — chain id 11155111. */
export const ETHEREUM_SEPOLIA = sepolia;

/** Base Sepolia — chain id 84532. */
export const BASE_SEPOLIA = baseSepolia;

/** Arbitrum Sepolia — chain id 421614. */
export const ARBITRUM_SEPOLIA = arbitrumSepolia;

/** Base Mainnet — chain id 8453. */
export const BASE_MAINNET = base;

/** Circle USDC on Ethereum Sepolia (6 decimals). */
export const ETHEREUM_SEPOLIA_USDC =
  "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238" as const;

/** Circle USDC on Base Sepolia (6 decimals). */
export const BASE_SEPOLIA_USDC =
  "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as const;

/** Native USDC on Base Mainnet (6 decimals). */
export const BASE_MAINNET_USDC =
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;

export type SettlementChainKey = "sepolia" | "base-sepolia" | "base";

const CHAINS: Record<SettlementChainKey, Chain> = {
  sepolia: ETHEREUM_SEPOLIA,
  "base-sepolia": BASE_SEPOLIA,
  base: BASE_MAINNET,
};

const USDC_BY_CHAIN: Record<SettlementChainKey, `0x${string}`> = {
  sepolia: ETHEREUM_SEPOLIA_USDC,
  "base-sepolia": BASE_SEPOLIA_USDC,
  base: BASE_MAINNET_USDC,
};

/** Privy + wagmi: testnets and Base mainnet (active chain via SETTLEMENT_CHAIN). */
export const SUPPORTED_CHAINS = [
  ETHEREUM_SEPOLIA,
  BASE_SEPOLIA,
  BASE_MAINNET,
] as const;

function resolveSettlementKey(): SettlementChainKey {
  const raw =
    process.env.NEXT_PUBLIC_SETTLEMENT_CHAIN ??
    process.env.SETTLEMENT_CHAIN ??
    "base";
  if (raw === "base-sepolia") return "base-sepolia";
  if (raw === "base") return "base";
  if (raw === "sepolia") return "sepolia";
  return "base";
}

/** Active settlement chain — defaults to Base mainnet. */
export const SETTLEMENT_CHAIN_KEY = resolveSettlementKey();

export const ACTIVE_CHAIN = CHAINS[SETTLEMENT_CHAIN_KEY];

/** USDC token for the active settlement chain. */
export const ACTIVE_USDC = USDC_BY_CHAIN[SETTLEMENT_CHAIN_KEY];

/** @deprecated Use ACTIVE_USDC. */
export const SEPOLIA_USDC = ETHEREUM_SEPOLIA_USDC;

export function usdcForChain(chainId: number): `0x${string}` | null {
  if (chainId === ETHEREUM_SEPOLIA.id) return ETHEREUM_SEPOLIA_USDC;
  if (chainId === BASE_SEPOLIA.id) return BASE_SEPOLIA_USDC;
  if (chainId === BASE_MAINNET.id) return BASE_MAINNET_USDC;
  return null;
}

export function rpcUrlForChain(chainId: number): string {
  if (chainId === ETHEREUM_SEPOLIA.id) {
    return (
      process.env.SEPOLIA_RPC_URL ??
      process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ??
      ETHEREUM_SEPOLIA.rpcUrls.default.http[0]
    );
  }
  if (chainId === BASE_SEPOLIA.id) {
    return (
      process.env.BASE_SEPOLIA_RPC_URL ??
      process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL ??
      BASE_SEPOLIA.rpcUrls.default.http[0]
    );
  }
  if (chainId === ARBITRUM_SEPOLIA.id) {
    return (
      process.env.ARBITRUM_SEPOLIA_RPC_URL ??
      process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC_URL ??
      ARBITRUM_SEPOLIA.rpcUrls.default.http[0]
    );
  }
  if (chainId === BASE_MAINNET.id) {
    return (
      process.env.BASE_RPC_URL ??
      process.env.NEXT_PUBLIC_BASE_RPC_URL ??
      BASE_MAINNET.rpcUrls.default.http[0]
    );
  }
  return ACTIVE_CHAIN.rpcUrls.default.http[0];
}

export function explorerBaseUrl(): string {
  return (
    ACTIVE_CHAIN.blockExplorers?.default?.url ??
    (SETTLEMENT_CHAIN_KEY === "base"
      ? "https://basescan.org"
      : "https://sepolia.etherscan.io")
  );
}

export function explorerTxUrl(hash: string): string {
  return `${explorerBaseUrl()}/tx/${hash}`;
}

export function explorerAddressUrl(address: string): string {
  return `${explorerBaseUrl()}/address/${address}`;
}

/** True when a wallet reports the app's active settlement chain. */
export function isWalletOnActiveChain(chainId: string): boolean {
  const id = ACTIVE_CHAIN.id;
  const hex = `0x${id.toString(16)}`;
  return (
    chainId === String(id) ||
    chainId === hex ||
    chainId.toLowerCase() === hex ||
    chainId === `eip155:${id}`
  );
}

/**
 * Playce reward collection address. Replace with the deployed ERC-721
 * contract address once `contracts/` is deployed on the active chain.
 */
export const PLAYCE_CONTRACT_ADDRESS = (process.env
  .NEXT_PUBLIC_PLAYCE_CONTRACT_ADDRESS ??
  "0x0000000000000000000000000000000000000000") as `0x${string}`;
