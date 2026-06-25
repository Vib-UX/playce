import { NextResponse } from "next/server";
import { incrementRsvp } from "@/lib/server/events-store.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lightweight "Going" RSVP for a user-created event. Mock events aren't backed
 * by the store, so this only applies to user events (404 otherwise).
 */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const count = await incrementRsvp(slug);
  if (count === null) {
    return NextResponse.json(
      { error: "Event not found." },
      { status: 404 },
    );
  }
  return NextResponse.json({ rsvpCount: count });
}
