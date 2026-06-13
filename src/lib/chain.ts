import { baseSepolia } from "viem/chains";

/**
 * Base Sepolia (chain id 84532) — Playce's settlement chain.
 * Imported from `viem/chains` so the app tracks the canonical chain definition.
 * Swap to `base` (mainnet, 8453) when going to production.
 */
export const ACTIVE_CHAIN = baseSepolia;

export function explorerTxUrl(hash: string): string {
  return `${ACTIVE_CHAIN.blockExplorers.default.url}/tx/${hash}`;
}

export function explorerAddressUrl(address: string): string {
  return `${ACTIVE_CHAIN.blockExplorers.default.url}/address/${address}`;
}

/**
 * Playce reward collection address. Replace with the deployed ERC-721
 * (OpenZeppelin-based) contract address once `contracts/` is deployed +
 * verified on Base Sepolia.
 */
export const PLAYCE_CONTRACT_ADDRESS = (process.env
  .NEXT_PUBLIC_PLAYCE_CONTRACT_ADDRESS ??
  "0x0000000000000000000000000000000000000000") as `0x${string}`;
