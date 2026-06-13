import "server-only";
import {
  createPublicClient,
  createWalletClient,
  http,
  isAddress,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ACTIVE_CHAIN } from "@/lib/chain";

/**
 * Server-only chain clients. The minter account mints rewards to verified
 * attendees so check-ins are gasless for users. Never import this from client
 * components — it reads MINTER_PRIVATE_KEY.
 */

const RPC_URL =
  process.env.BASE_SEPOLIA_RPC_URL ?? ACTIVE_CHAIN.rpcUrls.default.http[0];

const rawContract = process.env.NEXT_PUBLIC_PLAYCE_CONTRACT_ADDRESS ?? "";
const rawKey = process.env.MINTER_PRIVATE_KEY ?? "";

export const PLAYCE_ADDRESS: Address | null =
  isAddress(rawContract) &&
  rawContract.toLowerCase() !== "0x0000000000000000000000000000000000000000"
    ? (rawContract as Address)
    : null;

const minterKey = rawKey.startsWith("0x")
  ? (rawKey as `0x${string}`)
  : rawKey
    ? (`0x${rawKey}` as `0x${string}`)
    : null;

/** True when the backend can actually mint onchain. */
export const ONCHAIN_ENABLED = Boolean(PLAYCE_ADDRESS && minterKey);

export const publicClient = createPublicClient({
  chain: ACTIVE_CHAIN,
  transport: http(RPC_URL),
});

export function getMinterWallet() {
  if (!minterKey) throw new Error("MINTER_PRIVATE_KEY is not configured");
  const account = privateKeyToAccount(minterKey);
  const walletClient = createWalletClient({
    account,
    chain: ACTIVE_CHAIN,
    transport: http(RPC_URL),
  });
  return { account, walletClient };
}
