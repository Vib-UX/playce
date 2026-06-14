import { NextResponse } from "next/server";
import { getLeaderboard } from "@/lib/server/leaderboard-store.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Aggregated "The 67" chain-battle standings — players by wins and chains /
 * sponsors by wins. Recorded by the authoritative WS server when a round
 * finishes (see `server/six-seven-ws.mjs`).
 */
export async function GET() {
  const board = getLeaderboard();
  return NextResponse.json(board, {
    headers: { "Cache-Control": "no-store" },
  });
}
