import { NextResponse } from "next/server";
import { isAddress, type Address } from "viem";
import { getEventBySlug } from "@/lib/mock/events";
import { verifyPrivyWalletOwnership } from "@/lib/server/blink-signer";
import {
  ENS_PARENT_NAME,
  ENS_SUBNAME_ENABLED,
  computeExpiry,
  ensExplorerTxUrl,
  mintSubnameTicket,
} from "@/lib/server/ens-subname";
import {
  buildTicketLabel,
  labelBaseFromIdentity,
  ticketName,
  ticketNode,
  type EnsTicket,
  type TicketTier,
} from "@/lib/ens";

interface TicketBody {
  slug: string;
  address: string;
  email?: string;
  tier?: TicketTier;
  accessToken?: string;
}

function bearerToken(req: Request, body: TicketBody): string | null {
  const header = req.headers.get("authorization");
  if (header?.startsWith("Bearer ")) return header.slice(7);
  return body.accessToken ?? null;
}

export async function POST(req: Request) {
  let body: TicketBody;
  try {
    body = (await req.json()) as TicketBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { slug, address, email } = body;
  const tier: TicketTier = body.tier === "vip" ? "vip" : "ga";

  if (!address || !isAddress(address)) {
    return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
  }

  const event = getEventBySlug(slug);
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // Verify the wallet belongs to the authenticated Privy user (503 = Privy not
  // configured locally -> treated as a pass, like the other routes).
  const ownership = await verifyPrivyWalletOwnership(
    bearerToken(req, body),
    address,
  );
  if (!ownership.ok && ownership.status !== 503) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.status });
  }

  const base = labelBaseFromIdentity({ email, wallet: address });

  // Mock fallback — keeps the UX working before ENS is configured.
  if (!ENS_SUBNAME_ENABLED) {
    const label = buildTicketLabel(base, event.slug);
    const name = ticketName(label, ENS_PARENT_NAME);
    const ticket: EnsTicket = {
      name,
      label,
      node: ticketNode(name),
      eventId: event.id,
      eventSlug: event.slug,
      eventTitle: event.title,
      wallet: address,
      tier,
      expiry: Number(computeExpiry()),
      claimedAtISO: new Date().toISOString(),
      onchain: false,
    };
    return NextResponse.json({ ticket });
  }

  try {
    const result = await mintSubnameTicket({
      base,
      eventSlug: event.slug,
      owner: address as Address,
      tier,
    });

    const ticket: EnsTicket = {
      name: result.name,
      label: result.label,
      node: result.node,
      eventId: event.id,
      eventSlug: event.slug,
      eventTitle: event.title,
      wallet: result.wallet,
      tier: result.tier,
      expiry: result.expiry,
      txHash: result.txHash,
      recordsTxHash: result.recordsTxHash,
      explorerUrl: ensExplorerTxUrl(result.txHash),
      claimedAtISO: new Date().toISOString(),
      onchain: true,
    };

    return NextResponse.json({ ticket });
  } catch (err) {
    console.error("[ens/ticket] mint failed", err);
    return NextResponse.json(
      { error: "Could not issue your ENS ticket. Please try again." },
      { status: 500 },
    );
  }
}
