import "server-only";
import {
  createPublicClient,
  createWalletClient,
  http,
  isAddress,
  parseAbi,
  parseEventLogs,
  type Address,
  type Chain,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  ETHEREUM_SEPOLIA,
  BASE_SEPOLIA,
  BASE_MAINNET,
  ARBITRUM_SEPOLIA,
  rpcUrlForChain,
} from "@/lib/chain";

/**
 * Server-only Chainlink CCIP sender. When a chain battle finishes, this sends a
 * cross-chain message from the SOURCE chain's `ProofSender` so the proof-of-
 * presence NFT is minted on the DEST chain's `ProofReceiverPass`.
 *
 * Configured via the CCIP_* env vars written by `contracts/deploy-ccip.sh`.
 * Falls back gracefully (CCIP_ENABLED=false) to the direct/mock mint path.
 */

const SOURCE_CHAINS: Record<string, Chain> = {
  sepolia: ETHEREUM_SEPOLIA,
  "base-sepolia": BASE_SEPOLIA,
  "arbitrum-sepolia": ARBITRUM_SEPOLIA,
  base: BASE_MAINNET,
};

const proofSenderAbi = parseAbi([
  "function sendProof(uint64 destinationChainSelector, address receiver, address winner, bytes32 eventId, string uri) returns (bytes32 messageId)",
  "event ProofSent(bytes32 indexed messageId, uint64 indexed destinationChainSelector, address indexed winner, bytes32 eventId, uint256 fees)",
  // Custom errors so viem decodes reverts into readable names/args.
  "error NotAllowlistedDestinationChain(uint64 chainSelector)",
  "error InsufficientLinkBalance(uint256 needed, uint256 balance)",
  "error ZeroAddress()",
]);

const rawSourceKey = process.env.CCIP_SOURCE_CHAIN ?? "arbitrum-sepolia";
const sourceChain = SOURCE_CHAINS[rawSourceKey] ?? ARBITRUM_SEPOLIA;

const rawSender = process.env.PROOF_SENDER_ADDRESS ?? "";
const rawReceiver = process.env.PROOF_RECEIVER_ADDRESS ?? "";
const rawSelector = process.env.CCIP_DEST_CHAIN_SELECTOR ?? "";
const rawKey = process.env.MINTER_PRIVATE_KEY ?? "";

const SENDER_ADDRESS: Address | null = isAddress(rawSender)
  ? (rawSender as Address)
  : null;
const RECEIVER_ADDRESS: Address | null = isAddress(rawReceiver)
  ? (rawReceiver as Address)
  : null;

const senderKey = rawKey.startsWith("0x")
  ? (rawKey as `0x${string}`)
  : rawKey
    ? (`0x${rawKey}` as `0x${string}`)
    : null;

/** True when the backend can dispatch a real CCIP cross-chain proof mint. */
export const CCIP_ENABLED =
  process.env.CCIP_ENABLED === "true" &&
  Boolean(SENDER_ADDRESS && RECEIVER_ADDRESS && rawSelector && senderKey);

export interface CrossChainProofResult {
  /** Source-chain transaction that dispatched the CCIP message. */
  txHash: string;
  /** CCIP message id (track delivery on ccip.chain.link). */
  messageId: string;
  ccipExplorerUrl: string;
  sourceChain: string;
}

/**
 * Dispatch a cross-chain proof-of-presence mint. Returns the source tx hash and
 * the CCIP message id; the destination mint completes asynchronously once CCIP
 * delivers (typically a few minutes on testnets).
 */
export async function sendProofCrossChain(args: {
  winner: Address;
  eventId: `0x${string}`;
  uri: string;
}): Promise<CrossChainProofResult> {
  if (!CCIP_ENABLED || !SENDER_ADDRESS || !RECEIVER_ADDRESS || !senderKey) {
    throw new Error("CCIP is not configured");
  }

  const rpcUrl = rpcUrlForChain(sourceChain.id);
  const account = privateKeyToAccount(senderKey);
  const publicClient = createPublicClient({
    chain: sourceChain,
    transport: http(rpcUrl),
  });
  const walletClient = createWalletClient({
    account,
    chain: sourceChain,
    transport: http(rpcUrl),
  });

  const destSelector = BigInt(rawSelector);

  const hash = await walletClient.writeContract({
    address: SENDER_ADDRESS,
    abi: proofSenderAbi,
    functionName: "sendProof",
    args: [destSelector, RECEIVER_ADDRESS, args.winner, args.eventId, args.uri],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const logs = parseEventLogs({
    abi: proofSenderAbi,
    logs: receipt.logs,
    eventName: "ProofSent",
  });
  const messageId =
    logs.length > 0 ? (logs[0].args.messageId as string) : `0x${"0".repeat(64)}`;

  return {
    txHash: hash,
    messageId,
    ccipExplorerUrl: `https://ccip.chain.link/msg/${messageId}`,
    sourceChain: rawSourceKey,
  };
}
