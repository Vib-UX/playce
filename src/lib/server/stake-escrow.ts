import "server-only";

import {
  createPublicClient,
  createWalletClient,
  http,
  isAddress,
  keccak256,
  toBytes,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ACTIVE_CHAIN, rpcUrlForChain } from "@/lib/chain";
import { stakeEscrowAbi } from "@/lib/stake-escrow-abi";

const RPC_URL = rpcUrlForChain(ACTIVE_CHAIN.id);

const rawEscrow = process.env.STAKE_ESCROW_ADDRESS ?? "";
const rawKey = process.env.MINTER_PRIVATE_KEY ?? "";

export const STAKE_ESCROW_ADDRESS: Address | null = isAddress(rawEscrow)
  ? (rawEscrow as Address)
  : null;

const operatorKey = rawKey.startsWith("0x")
  ? (rawKey as `0x${string}`)
  : rawKey
    ? (`0x${rawKey}` as `0x${string}`)
    : null;

export const ESCROW_ONCHAIN_ENABLED = Boolean(STAKE_ESCROW_ADDRESS && operatorKey);

const publicClient = createPublicClient({
  chain: ACTIVE_CHAIN,
  transport: http(RPC_URL),
});

function roomIdBytes(roomCode: string): `0x${string}` {
  return keccak256(toBytes(roomCode.toUpperCase()));
}

export function roleToUint8(role: "host" | "guest"): 0 | 1 {
  return role === "host" ? 0 : 1;
}

/** USDC has 6 decimals on EVM chains used by Playce. */
export function usdToUsdcUnits(amount: number): bigint {
  return BigInt(Math.round(amount * 1_000_000));
}

export async function creditStakeOnchain(params: {
  roomCode: string;
  role: "host" | "guest";
  player: Address;
  amount: number;
}): Promise<`0x${string}` | null> {
  if (!ESCROW_ONCHAIN_ENABLED || !STAKE_ESCROW_ADDRESS || !operatorKey) {
    return null;
  }

  const account = privateKeyToAccount(operatorKey);
  const walletClient = createWalletClient({
    account,
    chain: ACTIVE_CHAIN,
    transport: http(RPC_URL),
  });

  const hash = await walletClient.writeContract({
    address: STAKE_ESCROW_ADDRESS,
    abi: stakeEscrowAbi,
    functionName: "creditStake",
    args: [
      roomIdBytes(params.roomCode),
      roleToUint8(params.role),
      params.player,
      usdToUsdcUnits(params.amount),
    ],
  });

  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}
