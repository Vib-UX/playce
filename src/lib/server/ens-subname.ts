import "server-only";
import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  encodePacked,
  http,
  isAddress,
  parseAbi,
  zeroAddress,
  type Address,
  type Chain,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { normalize } from "viem/ens";
import { sepolia, baseSepolia, base, arbitrumSepolia } from "viem/chains";
import { rpcUrlForChain } from "@/lib/chain";
import {
  buildTicketLabel,
  ticketName,
  ticketNode,
  type TicketTier,
} from "@/lib/ens";

/**
 * Server-only ENS subname issuer. The minter wallet owns the parent name
 * (`playce.eth`) in a Durin-style L2 registry on Sepolia, so it can mint
 * event-scoped subname tickets to attendees and write their resolver records —
 * all gasless for the user. Never import this from a client component.
 */

// register(label, owner, addr?, resolver, uint256?, expiry) — selector 0x85f3e643,
// recovered from the live btcvib.playce.eth registration tx. Declared without an
// output so simulate/availability checks decode cleanly.
const registryAbi = parseAbi([
  "function register(string label, address owner, address a2, address resolver, uint256 u, uint64 expiry)",
]);

// Standard ENS resolver setters (confirmed callable by the parent owner).
const resolverAbi = parseAbi([
  "function setAddr(bytes32 node, uint256 coinType, bytes value)",
  "function setText(bytes32 node, string key, string value)",
  "function multicall(bytes[] data) returns (bytes[])",
]);

const CHAINS_BY_ID: Record<number, Chain> = {
  [sepolia.id]: sepolia,
  [baseSepolia.id]: baseSepolia,
  [base.id]: base,
  [arbitrumSepolia.id]: arbitrumSepolia,
};

const ENS_CHAIN_ID = Number(process.env.ENS_CHAIN_ID ?? "11155111");
const ENS_CHAIN: Chain = CHAINS_BY_ID[ENS_CHAIN_ID] ?? sepolia;
const RPC_URL = rpcUrlForChain(ENS_CHAIN.id);

export const ENS_PARENT_NAME = process.env.ENS_PARENT_NAME ?? "playce.eth";

const TICKET_DURATION_DAYS = Number(
  process.env.ENS_TICKET_DURATION_DAYS ?? "365",
);

const rawRegistry = process.env.ENS_REGISTRY_ADDRESS ?? "";
const rawResolver = process.env.ENS_RESOLVER_ADDRESS ?? "";
const rawKey = process.env.MINTER_PRIVATE_KEY ?? "";

export const ENS_REGISTRY_ADDRESS: Address | null = isAddress(rawRegistry)
  ? (rawRegistry as Address)
  : null;
export const ENS_RESOLVER_ADDRESS: Address | null = isAddress(rawResolver)
  ? (rawResolver as Address)
  : null;

const minterKey = rawKey.startsWith("0x")
  ? (rawKey as `0x${string}`)
  : rawKey
    ? (`0x${rawKey}` as `0x${string}`)
    : null;

/** True when the backend can actually issue subnames onchain. */
export const ENS_SUBNAME_ENABLED =
  (process.env.ENS_SUBNAME_ENABLED ?? "") === "true" &&
  Boolean(ENS_REGISTRY_ADDRESS && ENS_RESOLVER_ADDRESS && minterKey);

const publicClient = createPublicClient({
  chain: ENS_CHAIN,
  transport: http(RPC_URL),
});

function getMinterWallet() {
  if (!minterKey) throw new Error("MINTER_PRIVATE_KEY is not configured");
  const account = privateKeyToAccount(minterKey);
  const walletClient = createWalletClient({
    account,
    chain: ENS_CHAIN,
    transport: http(RPC_URL),
  });
  return { account, walletClient };
}

/** Explorer tx link on the ENS chain (Sepolia by default). */
export function ensExplorerTxUrl(hash: string): string {
  const baseUrl =
    ENS_CHAIN.blockExplorers?.default?.url ?? "https://sepolia.etherscan.io";
  return `${baseUrl}/tx/${hash}`;
}

/** Ticket expiry (unix seconds) = now + ENS_TICKET_DURATION_DAYS. */
export function computeExpiry(): bigint {
  const now = Math.floor(Date.now() / 1000);
  return BigInt(now + TICKET_DURATION_DAYS * 86_400);
}

export interface MintSubnameArgs {
  /** Human base for the label, e.g. `alice` (already identity-derived). */
  base: string;
  /** Event slug — appended to the base for event-scoped labels. */
  eventSlug: string;
  /** Attendee wallet that will own + resolve the subname. */
  owner: Address;
  tier: TicketTier;
}

export interface MintSubnameResult {
  name: string;
  label: string;
  node: `0x${string}`;
  wallet: Address;
  tier: TicketTier;
  expiry: number;
  txHash: `0x${string}`;
  recordsTxHash: `0x${string}`;
}

/**
 * Register an available event-scoped subname to the attendee and set its
 * resolver records (addr -> attendee, text tier/event) so it resolves via the
 * ENSv2 Universal Resolver. Retries with a numeric suffix on name collisions.
 */
export async function mintSubnameTicket(
  args: MintSubnameArgs,
): Promise<MintSubnameResult> {
  if (!ENS_REGISTRY_ADDRESS || !ENS_RESOLVER_ADDRESS) {
    throw new Error("ENS registry/resolver not configured");
  }
  const { account } = getMinterWallet();
  const expiry = computeExpiry();

  const MAX_ATTEMPTS = 10;
  let chosen:
    | { label: string; name: string; node: `0x${string}`; request: unknown }
    | null = null;
  let lastError: unknown = null;

  for (let suffix = 0; suffix < MAX_ATTEMPTS; suffix++) {
    const label = buildTicketLabel(args.base, args.eventSlug, suffix);
    const name = ticketName(label, ENS_PARENT_NAME);
    const node = ticketNode(name);
    try {
      const sim = await publicClient.simulateContract({
        account,
        address: ENS_REGISTRY_ADDRESS,
        abi: registryAbi,
        functionName: "register",
        args: [label, args.owner, zeroAddress, ENS_RESOLVER_ADDRESS, 0n, expiry],
      });
      chosen = { label, name, node, request: sim.request };
      break;
    } catch (err) {
      // Name taken (or otherwise un-mintable at this label) — try next suffix.
      lastError = err;
    }
  }

  if (!chosen) {
    throw (
      lastError ?? new Error("Could not find an available subname to register")
    );
  }

  const { walletClient } = getMinterWallet();

  // 1. Register the subname (mints the ERC-721 to the attendee).
  const txHash = await walletClient.writeContract(
    chosen.request as Parameters<typeof walletClient.writeContract>[0],
  );
  await publicClient.waitForTransactionReceipt({ hash: txHash });

  // 2. Set resolver records so the name resolves to the attendee + carries tier.
  const records = [
    encodeFunctionData({
      abi: resolverAbi,
      functionName: "setAddr",
      args: [chosen.node, 60n, encodePacked(["address"], [args.owner])],
    }),
    encodeFunctionData({
      abi: resolverAbi,
      functionName: "setText",
      args: [chosen.node, "tier", args.tier],
    }),
    encodeFunctionData({
      abi: resolverAbi,
      functionName: "setText",
      args: [chosen.node, "event", args.eventSlug],
    }),
  ];

  const recordsTxHash = await walletClient.writeContract({
    account,
    chain: ENS_CHAIN,
    address: ENS_RESOLVER_ADDRESS,
    abi: resolverAbi,
    functionName: "multicall",
    args: [records],
  });
  await publicClient.waitForTransactionReceipt({ hash: recordsTxHash });

  return {
    name: chosen.name,
    label: chosen.label,
    node: chosen.node,
    wallet: args.owner,
    tier: args.tier,
    expiry: Number(expiry),
    txHash,
    recordsTxHash,
  };
}
