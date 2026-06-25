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

/**
 * Server-only bridge to the on-chain `ChessArbiter` (a Chainlink CRE
 * `IReceiver` consumer). When configured, Playces registers a finished-or-not
 * match on-chain via `openMatch`; the CRE workflow later fetches the Lichess
 * result and calls `onReport`, which settles the `StakeEscrow` pot to the
 * verified winner — no trusted backend in the settlement path.
 *
 * Falls back gracefully (ARBITER_ENABLED = false) so dev/demo runs settle via
 * the existing backend `/api/reward/claim` path instead.
 */

const RPC_URL = rpcUrlForChain(ACTIVE_CHAIN.id);

const rawArbiter = process.env.CHESS_ARBITER_ADDRESS ?? "";
const rawKey = process.env.MINTER_PRIVATE_KEY ?? "";

export const CHESS_ARBITER_ADDRESS: Address | null = isAddress(rawArbiter)
  ? (rawArbiter as Address)
  : null;

const operatorKey = rawKey.startsWith("0x")
  ? (rawKey as `0x${string}`)
  : rawKey
    ? (`0x${rawKey}` as `0x${string}`)
    : null;

/** True when Playces can register matches on-chain for CRE settlement. */
export const CHESS_ARBITER_ENABLED =
  process.env.CHESS_ARBITER_ENABLED === "true" &&
  Boolean(CHESS_ARBITER_ADDRESS && operatorKey);

export const chessArbiterAbi = [
  {
    type: "function",
    name: "openMatch",
    inputs: [
      { name: "matchId", type: "bytes32" },
      { name: "roomId", type: "bytes32" },
      { name: "white", type: "address" },
      { name: "black", type: "address" },
      { name: "gameId", type: "string" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "matches",
    inputs: [{ name: "matchId", type: "bytes32" }],
    outputs: [
      { name: "roomId", type: "bytes32" },
      { name: "white", type: "address" },
      { name: "black", type: "address" },
      { name: "winner", type: "address" },
      { name: "opened", type: "bool" },
      { name: "settled", type: "bool" },
      { name: "gameId", type: "string" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "pendingMatches",
    inputs: [],
    outputs: [
      { name: "ids", type: "bytes32[]" },
      { name: "gameIds", type: "string[]" },
      { name: "whites", type: "address[]" },
      { name: "blacks", type: "address[]" },
    ],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "ChessMatchOpened",
    inputs: [
      { name: "matchId", type: "bytes32", indexed: true },
      { name: "roomId", type: "bytes32", indexed: true },
      { name: "white", type: "address", indexed: false },
      { name: "black", type: "address", indexed: false },
      { name: "gameId", type: "string", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "ChessMatchSettled",
    inputs: [
      { name: "matchId", type: "bytes32", indexed: true },
      { name: "winner", type: "address", indexed: true },
    ],
    anonymous: false,
  },
] as const;

/** Deterministic match id from the Lichess game id. */
export function matchIdForGame(gameId: string): `0x${string}` {
  return keccak256(toBytes(`chess:${gameId}`));
}

/** Room id shared with `StakeEscrow` (keccak of the uppercased room code). */
export function roomIdForCode(roomCode: string): `0x${string}` {
  return keccak256(toBytes(roomCode.toUpperCase()));
}

export interface OpenMatchResult {
  txHash: `0x${string}`;
  matchId: `0x${string}`;
}

/**
 * Register a match on-chain so the CRE workflow can settle it. Idempotent at the
 * contract level (re-opening the same matchId reverts), so callers should only
 * invoke this once both players + the Lichess game id are known. Returns null
 * when the arbiter isn't configured (dev/demo).
 */
export async function openMatchOnchain(params: {
  roomCode: string;
  gameId: string;
  white: Address;
  black: Address;
}): Promise<OpenMatchResult | null> {
  if (!CHESS_ARBITER_ENABLED || !CHESS_ARBITER_ADDRESS || !operatorKey) {
    return null;
  }

  const matchId = matchIdForGame(params.gameId);
  const roomId = roomIdForCode(params.roomCode);
  const account = privateKeyToAccount(operatorKey);

  const publicClient = createPublicClient({
    chain: ACTIVE_CHAIN,
    transport: http(RPC_URL),
  });
  const walletClient = createWalletClient({
    account,
    chain: ACTIVE_CHAIN,
    transport: http(RPC_URL),
  });

  const txHash = await walletClient.writeContract({
    address: CHESS_ARBITER_ADDRESS,
    abi: chessArbiterAbi,
    functionName: "openMatch",
    args: [matchId, roomId, params.white, params.black, params.gameId],
  });

  await publicClient.waitForTransactionReceipt({ hash: txHash });
  return { txHash, matchId };
}

/** Read whether a match has been settled on-chain by the CRE report. */
export async function isMatchSettledOnchain(gameId: string): Promise<boolean> {
  if (!CHESS_ARBITER_ADDRESS) return false;
  try {
    const publicClient = createPublicClient({
      chain: ACTIVE_CHAIN,
      transport: http(RPC_URL),
    });
    const m = (await publicClient.readContract({
      address: CHESS_ARBITER_ADDRESS,
      abi: chessArbiterAbi,
      functionName: "matches",
      args: [matchIdForGame(gameId)],
    })) as readonly [
      `0x${string}`,
      Address,
      Address,
      Address,
      boolean,
      boolean,
      string,
    ];
    return Boolean(m[5]);
  } catch {
    return false;
  }
}
