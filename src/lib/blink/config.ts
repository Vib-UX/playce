import { ACTIVE_CHAIN, ACTIVE_USDC } from "@/lib/chain";

/** USDC on the active settlement chain (default: Base mainnet). */
export const BLINK_USDC_ADDRESS = ACTIVE_USDC;

export const BLINK_CHAIN_ID = ACTIVE_CHAIN.id;

export const BLINK_MERCHANT_ID =
  process.env.NEXT_PUBLIC_BLINK_MERCHANT_ID ?? "";

export const STAKE_ESCROW_ADDRESS =
  process.env.NEXT_PUBLIC_STAKE_ESCROW_ADDRESS ?? "";

/** Blink hosted flow — production (mainnet). Set sandbox only for local testnet dev. */
export const BLINK_ENVIRONMENT = (
  process.env.NEXT_PUBLIC_BLINK_ENVIRONMENT === "sandbox"
    ? "sandbox"
    : "production"
) as "production" | "sandbox";

export const BLINK_STAKING_ENABLED =
  Boolean(BLINK_MERCHANT_ID) &&
  Boolean(STAKE_ESCROW_ADDRESS) &&
  Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID);

/**
 * Dev/test mode: keep the stake UI but skip the real Blink deposit + on-chain
 * USDC credit, auto-marking the seat as staked. Never enable in production.
 */
export const BLINK_DEV_MOCK_STAKE =
  process.env.NEXT_PUBLIC_BLINK_DEV_MOCK_STAKE === "true";

/** Default stake per player (USD / USDC). Blink minimum is $0.25. */
export const STAKE_AMOUNT = 0.25;

/** Selectable stake bounds for a customizable match (USD / USDC). */
export const MIN_STAKE_AMOUNT = 0.25;
export const MAX_STAKE_AMOUNT = 100;

/**
 * Validate a user-chosen stake amount: finite, within bounds, and at most two
 * decimal places (USDC has 6 but we keep dollar-cent granularity for the UI).
 */
export function isValidStakeAmount(amount: number): boolean {
  if (!Number.isFinite(amount)) return false;
  if (amount < MIN_STAKE_AMOUNT || amount > MAX_STAKE_AMOUNT) return false;
  return Math.abs(amount * 100 - Math.round(amount * 100)) < 1e-9;
}

/** Clamp + round an arbitrary number to a valid stake amount (2 decimals). */
export function clampStakeAmount(amount: number): number {
  const n = Number.isFinite(amount) ? amount : STAKE_AMOUNT;
  const clamped = Math.min(MAX_STAKE_AMOUNT, Math.max(MIN_STAKE_AMOUNT, n));
  return Math.round(clamped * 100) / 100;
}
