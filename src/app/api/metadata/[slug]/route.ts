import { NextResponse } from "next/server";
import { getEventBySlug } from "@/lib/mock/events";

/**
 * ERC-721 metadata for an event's POAP. POAPs share per-event artwork, so this
 * is keyed by event slug (the value stored as tokenURI onchain).
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const event = getEventBySlug(slug);
  if (!event) {
    return new NextResponse("Not found", { status: 404 });
  }

  const origin = new URL(req.url).origin;
  const metadata = {
    name: event.collectible.name,
    description: event.collectible.description,
    image: `${origin}/api/collectible/${event.slug}`,
    external_url: `${origin}/event/${event.slug}`,
    attributes: [
      { trait_type: "Event", value: event.title },
      { trait_type: "Edition", value: event.collectible.art.edition },
      { trait_type: "City", value: event.venue.city },
      { trait_type: "Variant", value: event.collectible.art.variant },
      { trait_type: "Network", value: "Base Sepolia" },
      { trait_type: "Verification", value: "Geo + Email" },
    ],
  };

  return NextResponse.json(metadata, {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
