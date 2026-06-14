import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { verifyPrivyWalletOwnership } from "@/lib/server/blink-signer";
import { createOpenChallenge } from "@/lib/server/lichess";
import { getSponsorById } from "@/lib/mock/sponsors";
import {
  getMatch,
  upsertMatch,
  markMatchOpened,
} from "@/lib/server/chess-store.mjs";
import {
  CHESS_ARBITER_ENABLED,
  openMatchOnchain,
} from "@/lib/server/chess-arbiter";
import { publicMatch } from "@/lib/server/chess-public";

export const runtime = "nodejs";

interface CreateBody {
  roomCode?: string;
  address?: string;
  role?: "host" | "guest";
  sponsorId?: string;
  clockLimit?: number;
  clockIncrement?: number;
}

/**
 * Create (host) or join (guest) a chess room.
 *
 *  - host:  creates the Lichess open challenge, takes the white pieces, and
 *           records the repped chain. Returns the board links.
 *  - guest: registers the black pieces. Once both wallets + the Lichess game
 *           are known, the match is registered on-chain (ChessArbiter) so the
 *           CRE workflow can settle it.
 */
export async function POST(req: Request) {
  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const roomCode = (body.roomCode ?? "").toUpperCase().slice(0, 12);
  const address = body.address ?? "";
  const role = body.role;

  if (!roomCode || roomCode.length < 4) {
    return NextResponse.json({ error: "A valid roomCode is required." }, { status: 400 });
  }
  if (role !== "host" && role !== "guest") {
    return NextResponse.json({ error: "role must be host or guest." }, { status: 400 });
  }
  if (!isAddress(address)) {
    return NextResponse.json({ error: "A valid wallet address is required." }, { status: 400 });
  }

  // Verify the caller owns the wallet (Privy). A 503 means Privy isn't
  // configured (dev) — treat as a pass so the local flow still works.
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const ownership = await verifyPrivyWalletOwnership(token, address);
  if (!ownership.ok && ownership.status !== 503) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.status });
  }

  const existing = getMatch(roomCode);

  if (role === "host") {
    const sponsorId = body.sponsorId ?? existing?.sponsorId ?? null;
    if (sponsorId && !getSponsorById(sponsorId)) {
      return NextResponse.json({ error: "Unknown sponsor." }, { status: 400 });
    }

    // Reuse an already-created challenge so a refresh doesn't spawn duplicates.
    let challenge = existing?.gameId
      ? {
          gameId: existing.gameId,
          url: existing.url ?? "",
          urlWhite: existing.urlWhite ?? "",
          urlBlack: existing.urlBlack ?? "",
        }
      : null;

    if (!challenge) {
      try {
        challenge = await createOpenChallenge({
          clockLimit: body.clockLimit,
          clockIncrement: body.clockIncrement,
          name: `Playce Chess · ${roomCode}`,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Lichess challenge failed.";
        return NextResponse.json({ error: message }, { status: 502 });
      }
    }

    upsertMatch(roomCode, {
      white: address,
      sponsorId,
      gameId: challenge.gameId,
      url: challenge.url,
      urlWhite: challenge.urlWhite,
      urlBlack: challenge.urlBlack,
    });
  } else {
    // Guest join — the host must have opened the room first.
    if (!existing || !existing.gameId) {
      return NextResponse.json(
        { error: "This room hasn't been opened yet. Ask the host to create it." },
        { status: 409 },
      );
    }
    if (
      existing.white &&
      existing.white.toLowerCase() === address.toLowerCase()
    ) {
      return NextResponse.json(
        { error: "You're already the host of this room." },
        { status: 409 },
      );
    }
    upsertMatch(roomCode, { black: address });
  }

  // Once both seats + the game are known, register the match on-chain so the
  // CRE workflow can settle the pot from the verified Lichess result.
  const match = getMatch(roomCode);
  if (
    match &&
    match.white &&
    match.black &&
    match.gameId &&
    !match.opened &&
    CHESS_ARBITER_ENABLED
  ) {
    try {
      const opened = await openMatchOnchain({
        roomCode,
        gameId: match.gameId,
        white: match.white as `0x${string}`,
        black: match.black as `0x${string}`,
      });
      if (opened) markMatchOpened(roomCode);
    } catch (err) {
      // Non-fatal: the app still works via the backend settlement path.
      console.error("[chess/create] openMatch on-chain failed", err);
    }
  }

  return NextResponse.json({ match: publicMatch(getMatch(roomCode)) });
}
