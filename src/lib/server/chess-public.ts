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
  gameType: "friendly" | "rated";
  timeControlKey: string | null;
  timeLabel: string | null;
  clockLimit: number;
  clockIncrement: number;
  stakeAmount: number;
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
    gameType: m.gameType === "rated" ? "rated" : "friendly",
    timeControlKey: (m.timeControlKey as string | null) ?? null,
    timeLabel: (m.timeLabel as string | null) ?? null,
    clockLimit: typeof m.clockLimit === "number" ? m.clockLimit : 300,
    clockIncrement: typeof m.clockIncrement === "number" ? m.clockIncrement : 0,
    stakeAmount: typeof m.stakeAmount === "number" ? m.stakeAmount : 0.25,
    status: (m.status as ChessMatchView["status"]) ?? "lobby",
    winnerColor: (m.winnerColor as ChessMatchView["winnerColor"]) ?? null,
    winnerWallet: (m.winnerWallet as string | null) ?? null,
    draw: Boolean(m.draw),
    lichessStatus: (m.lichessStatus as string | null) ?? null,
    opened: Boolean(m.opened),
  };
}
