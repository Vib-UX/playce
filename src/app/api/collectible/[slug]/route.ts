import { NextResponse } from "next/server";
import { getEventBySlug } from "@/lib/mock/events";
import { collectibleSvg } from "@/lib/collectible-svg";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const event = getEventBySlug(slug);
  if (!event) {
    return new NextResponse("Not found", { status: 404 });
  }
  const svg = collectibleSvg(event.collectible.art, event.title);
  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
