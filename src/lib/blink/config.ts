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

/** Fixed stake per player for a 67 match (USD / USDC). Blink minimum is $0.25. */
export const STAKE_AMOUNT = 0.25;
