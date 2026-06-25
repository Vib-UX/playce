import { NextResponse } from "next/server";
import { verifyPrivyAuth } from "@/lib/server/blink-signer";
import {
  createUserEvent,
  validateCreateInput,
  type CreateEventInput,
} from "@/lib/events-service";
import { listUserEvents } from "@/lib/server/events-store.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** List user-created events (newest first). */
export async function GET() {
  const events = await listUserEvents();
  return NextResponse.json({ events });
}

/** Create a new user event. Requires a signed-in caller (when Privy is set up). */
export async function POST(req: Request) {
  let body: Partial<CreateEventInput> & { createdBy?: string };
  try {
    body = (await req.json()) as Partial<CreateEventInput>;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const auth = await verifyPrivyAuth(token);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const errors = validateCreateInput(body);
  if (errors.length > 0) {
    return NextResponse.json(
      { error: errors[0], errors },
      { status: 400 },
    );
  }

  const handle =
    (auth.configured ? auth.email?.split("@")[0] : undefined) ||
    (auth.configured ? auth.wallet : undefined) ||
    (typeof body.createdBy === "string" ? body.createdBy : undefined) ||
    "Host";

  try {
    const event = await createUserEvent(body as CreateEventInput, {
      id: auth.configured ? auth.userId : undefined,
      handle,
    });
    return NextResponse.json({ event }, { status: 201 });
  } catch (err) {
    console.error("[api/events] create failed", err);
    return NextResponse.json(
      { error: "Could not create the event. Please try again." },
      { status: 500 },
    );
  }
}
