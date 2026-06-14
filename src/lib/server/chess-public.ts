import "server-only";

/** Shape returned to the client for a chess match (safe to expose). */
export interface ChessMatchView {
  roomCode: string;
  sponsorId: string | null;
  white: string | null;
  black: string | null;
  gameId: string | null;
  url: string | null;
  urlWhite: string | null;
  urlBlack: string | null;
  status: "lobby" | "live" | "finished";
  winnerColor: "white" | "black" | null;
  winnerWallet: string | null;
  draw: boolean;
  lichessStatus: string | null;
  opened: boolean;
}

/** Map a stored match (chess-store) to the client-facing view. */
export function publicMatch(match: unknown): ChessMatchView | null {
  if (!match || typeof match !== "object") return null;
  const m = match as Record<string, unknown>;
  return {
    roomCode: String(m.roomCode ?? ""),
    sponsorId: (m.sponsorId as string | null) ?? null,
    white: (m.white as string | null) ?? null,
    black: (m.black as string | null) ?? null,
    gameId: (m.gameId as string | null) ?? null,
    url: (m.url as string | null) ?? null,
    urlWhite: (m.urlWhite as string | null) ?? null,
    urlBlack: (m.urlBlack as string | null) ?? null,
    status: (m.status as ChessMatchView["status"]) ?? "lobby",
    winnerColor: (m.winnerColor as ChessMatchView["winnerColor"]) ?? null,
    winnerWallet: (m.winnerWallet as string | null) ?? null,
    draw: Boolean(m.draw),
    lichessStatus: (m.lichessStatus as string | null) ?? null,
    opened: Boolean(m.opened),
  };
}
