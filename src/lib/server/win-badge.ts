import "server-only";
import {
  createPublicClient,
  createWalletClient,
  http,
  isAddress,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ARBITRUM_SEPOLIA, rpcUrlForChain } from "@/lib/chain";
import { playcesAbi } from "@/lib/poap-abi";
import { rewardChainForSponsorId } from "@/lib/battle";
import { CCIP_ENABLED, sendProofCrossChain } from "@/lib/server/ccip-minter";

/**
 * Server-only soulbound WIN BADGE minter for chain battles. The badge is minted
 * on the winner's repped chain:
 *  - Arbitrum-repped win -> DIRECT backend mint on Arbitrum Sepolia (PlaycesPass).
 *  - Ethereum-repped win  -> Chainlink CCIP (Arbitrum Sepolia -> Ethereum Sepolia
 *    ProofReceiverPass), reusing `ccip-minter`.
 *
 * All on-chain writes are backend-signed with MINTER_PRIVATE_KEY so winners just
 * claim via their Privy wallet.
 */

const rawBadgeArb = process.env.BADGE_ARBITRUM_ADDRESS ?? "";
const rawKey = process.env.MINTER_PRIVATE_KEY ?? "";

const BADGE_ARBITRUM: Address | null = isAddress(rawBadgeArb)
  ? (rawBadgeArb as Address)
  : null;

const minterKey = rawKey.startsWith("0x")
  ? (rawKey as `0x${string}`)
  : rawKey
    ? (`0x${rawKey}` as `0x${string}`)
    : null;

/** Master toggle: badges only mint when explicitly enabled + configured. */
export const WIN_BADGE_ENABLED = process.env.WIN_BADGE_ENABLED === "true";

export interface WinBadgeResult {
  mechanism: "direct" | "ccip";
  chainLabel: string;
  txHash?: string;
  explorerUrl?: string;
  ccip?: { messageId: string; explorerUrl: string };
}

/**
 * Mint the soulbound win badge for `sponsorId`'s reward chain. Returns null when
 * the sponsor isn't a chain-battle sponsor or badge minting isn't configured
 * (caller can still settle the pot + report success without an on-chain badge).
 */
export async function mintWinBadge(args: {
  winner: Address;
  sponsorId: string | null;
  eventId: `0x${string}`;
  uri: string;
}): Promise<WinBadgeResult | null> {
  const rewardChain = rewardChainForSponsorId(args.sponsorId);
  if (!rewardChain) return null;

  if (rewardChain.badgeMechanism === "ccip") {
    if (!CCIP_ENABLED) return null;
    const cc = await sendProofCrossChain({
      winner: args.winner,
      eventId: args.eventId,
      uri: args.uri,
    });
    return {
      mechanism: "ccip",
      chainLabel: rewardChain.label,
      txHash: cc.txHash,
      explorerUrl: `${rewardChain.explorerBaseUrl}/tx/${cc.txHash}`,
      ccip: { messageId: cc.messageId, explorerUrl: cc.ccipExplorerUrl },
    };
  }

  // Direct mint on Arbitrum Sepolia.
  if (!WIN_BADGE_ENABLED || !BADGE_ARBITRUM || !minterKey) return null;

  const rpcUrl = rpcUrlForChain(ARBITRUM_SEPOLIA.id);
  const account = privateKeyToAccount(minterKey);
  const publicClient = createPublicClient({
    chain: ARBITRUM_SEPOLIA,
    transport: http(rpcUrl),
  });
  const walletClient = createWalletClient({
    account,
    chain: ARBITRUM_SEPOLIA,
    transport: http(rpcUrl),
  });

  const hash = await walletClient.writeContract({
    address: BADGE_ARBITRUM,
    abi: playcesAbi,
    functionName: "mintClaim",
    args: [args.winner, args.eventId, args.uri],
  });
  await publicClient.waitForTransactionReceipt({ hash });

  return {
    mechanism: "direct",
    chainLabel: rewardChain.label,
    txHash: hash,
    explorerUrl: `${rewardChain.explorerBaseUrl}/tx/${hash}`,
  };
}
