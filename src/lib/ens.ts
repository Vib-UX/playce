/**
 * Shared ENS subname-ticket helpers (client + server safe — no secrets here).
 *
 * Playce issues each attendee an event-scoped subname (e.g.
 * `alice-ethglobal-nyc.playce.eth`) off the parent `playce.eth`, registered in a
 * Durin-style L2 registry on Sepolia and resolved via viem's ENSv2 Universal
 * Resolver. This module holds the label rules, the shared ticket shape, and
 * read-only resolution helpers. The privileged minting path lives in
 * `src/lib/server/ens-subname.ts`.
 */

import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";
import { namehash, normalize } from "viem/ens";

export type TicketTier = "ga" | "vip";

/** A claimed ENS subname ticket (persisted client-side, returned by the API). */
export interface EnsTicket {
  /** Full ENS name, e.g. `alice-ethglobal-nyc.playce.eth`. */
  name: string;
  /** Leftmost label, e.g. `alice-ethglobal-nyc`. */
  label: string;
  /** namehash(name). */
  node: `0x${string}`;
  eventId: string;
  eventSlug: string;
  eventTitle: string;
  /** Wallet the subname resolves to (the attendee). */
  wallet: string;
  tier: TicketTier;
  /** Unix seconds the subname expires. */
  expiry: number;
  /** Registration tx hash (the subname mint). */
  txHash?: string;
  /** Records (addr/text) tx hash. */
  recordsTxHash?: string;
  /** Explorer link for the registration tx. */
  explorerUrl?: string;
  claimedAtISO: string;
  /** False when the backend returned a mock ticket (ENS not configured). */
  onchain: boolean;
}

export const ENS_PARENT_NAME =
  process.env.NEXT_PUBLIC_ENS_PARENT_NAME ?? "playce.eth";

export const ENS_CLIENT_ENABLED =
  (process.env.NEXT_PUBLIC_ENS_ENABLED ?? "") === "true";

/**
 * Normalize an arbitrary string into a valid ENS label fragment:
 * lowercase, only `[a-z0-9-]`, no leading/trailing/double hyphens.
 */
export function slugifyLabel(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Best-effort human label from a Privy identity (email local-part > fallback). */
export function labelBaseFromIdentity(opts: {
  email?: string;
  wallet?: string;
}): string {
  const fromEmail = opts.email ? slugifyLabel(opts.email.split("@")[0]) : "";
  if (fromEmail.length >= 2) return fromEmail;
  if (opts.wallet) return `user-${opts.wallet.toLowerCase().slice(2, 8)}`;
  return "guest";
}

/**
 * Event-scoped label: `<base>-<eventSlug>` (so one attendee can hold a distinct
 * subname per event). The optional numeric suffix de-duplicates collisions.
 */
export function buildTicketLabel(
  base: string,
  eventSlug: string,
  suffix = 0,
): string {
  const core = slugifyLabel(`${base}-${eventSlug}`) || "guest";
  return suffix > 0 ? `${core}-${suffix + 1}` : core;
}

/** Full ENS name for a label under the parent (e.g. `x.playce.eth`). */
export function ticketName(label: string, parent = ENS_PARENT_NAME): string {
  return `${label}.${parent}`;
}

/** namehash of a full ticket name. */
export function ticketNode(name: string): `0x${string}` {
  return namehash(normalize(name));
}

// ── Read-only resolution (browser-safe; uses the ENSv2 Universal Resolver) ──

const readClient = createPublicClient({
  chain: sepolia,
  transport: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL),
});

export interface ResolvedTicket {
  /** Address the name resolves to, or null if it doesn't resolve. */
  address: string | null;
  tier?: string;
  event?: string;
  avatar?: string;
}

/** Resolve a ticket name's address + records via viem (ENSv2 Universal Resolver). */
export async function resolveEnsTicket(name: string): Promise<ResolvedTicket> {
  const normalized = normalize(name);
  const [address, tier, event, avatar] = await Promise.all([
    readClient.getEnsAddress({ name: normalized }).catch(() => null),
    readClient.getEnsText({ name: normalized, key: "tier" }).catch(() => null),
    readClient.getEnsText({ name: normalized, key: "event" }).catch(() => null),
    readClient.getEnsText({ name: normalized, key: "avatar" }).catch(() => null),
  ]);
  return {
    address,
    tier: tier ?? undefined,
    event: event ?? undefined,
    avatar: avatar ?? undefined,
  };
}
