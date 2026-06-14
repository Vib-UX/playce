import { NextResponse } from "next/server";
import { getGameResult } from "@/lib/server/lichess";
import {
  getMatch,
  upsertMatch,
  setMatchResult,
  markResultRecorded,
} from "@/lib/server/chess-store.mjs";
import {
  recordBattleResult,
  recordOutcome,
} from "@/lib/server/leaderboard-store.mjs";
import { getStakeStatus } from "@/lib/server/stake-registry.mjs";
import { isMatchSettledOnchain } from "@/lib/server/chess-arbiter";
import { publicMatch } from "@/lib/server/chess-public";

export const runtime = "nodejs";

/**
 * Poll a chess room: refreshes the authoritative Lichess result, records a
 * finished outcome into the shared leaderboard store (so the existing
 * `/api/reward/claim` flow can verify the winner + settle the pot), and returns
 * the current match + stake state.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const roomCode = (searchParams.get("code") ?? "").toUpperCase().slice(0, 12);

  if (!roomCode || roomCode.length < 4) {
    return NextResponse.json({ error: "A valid room code is required." }, { status: 400 });
  }

  let match = getMatch(roomCode);
  if (!match) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }

  // Refresh the Lichess result for any room with a game that isn't finished.
  if (match.gameId && match.status !== "finished") {
    try {
      const result = await getGameResult(match.gameId);
      if (result.state === "finished") {
        match = setMatchResult(roomCode, {
          winner: result.winner,
          draw: result.draw,
          status: result.status,
        }) ?? match;

        // Push the authoritative outcome into the leaderboard store once, so
        // the reward-claim route can verify + settle and standings update.
        if (match && !match.resultRecorded) {
          recordBattleResult({
            roomCode,
            roundId: 1,
            winnerWallet: match.winnerWallet,
            winnerSponsorId: match.sponsorId,
            battleMode: "chain",
          });
          recordOutcome({
            winnerWallet: match.winnerWallet ?? undefined,
            winnerSponsorId: match.sponsorId ?? undefined,
            players: [
              { wallet: match.white ?? undefined, sponsorId: match.sponsorId },
              { wallet: match.black ?? undefined, sponsorId: match.sponsorId },
            ],
            roomCode,
            battleKey: match.gameId ?? roomCode,
          });
          markResultRecorded(roomCode);
        }
      } else if (result.state === "ongoing" && match.status === "lobby") {
        match = upsertMatch(roomCode, { status: "live", lichessStatus: result.status });
      }
    } catch (err) {
      // Lichess can rate-limit / hiccup; keep serving the last known state.
      console.error("[chess/status] result refresh failed", err);
    }
  }

  const stakes = getStakeStatus(roomCode);
  const settledOnchain =
    match?.gameId && match.status === "finished"
      ? await isMatchSettledOnchain(match.gameId)
      : false;

  return NextResponse.json({
    match: publicMatch(match),
    stakes,
    settledOnchain,
  });
}
