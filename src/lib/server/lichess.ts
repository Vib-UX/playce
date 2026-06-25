import "server-only";

/**
 * Lichess integration for Playces chess PvP.
 *
 * Players never leave to a bespoke chess engine — Playces creates a Lichess
 * "open challenge" (no OAuth required) and hands each player their colored
 * board link. The authoritative game RESULT is read back from the Lichess
 * export API. That result is what a Chainlink CRE workflow fetches to settle
 * the staked pot on-chain (see `cre/chess-result-feed` + `ChessArbiter.sol`);
 * this module is the same source of truth for the app's status polling.
 *
 * Docs: https://lichess.org/api#tag/Challenges/operation/challengeOpen
 *       https://lichess.org/api#tag/Games/operation/gameExport
 */

const LICHESS_BASE = "https://lichess.org";

/** Optional token (challenge:write) to create challenges as a Lichess account. */
const LICHESS_TOKEN = process.env.LICHESS_TOKEN ?? "";

export interface OpenChallenge {
  /** Lichess game id — the on-chain `gameId` the CRE workflow reads. */
  gameId: string;
  /** Public game URL. */
  url: string;
  /** Board link that assigns the white pieces (host). */
  urlWhite: string;
  /** Board link that assigns the black pieces (guest). */
  urlBlack: string;
}

export interface ChallengeOptions {
  /** Total clock per side, in seconds (default 300 = 5+0 blitz). */
  clockLimit?: number;
  /** Clock increment per move, in seconds (default 0). */
  clockIncrement?: number;
  /** Lichess variant (default "standard"). */
  variant?: string;
  /** Label shown on the Lichess board. */
  name?: string;
  /**
   * Create a rated game (default false). Note: Lichess only rates games between
   * two logged-in accounts, so anonymous open challenges fall back to casual.
   */
  rated?: boolean;
}

/** Lichess game lifecycle, normalized for the app + CRE settlement. */
export type ChessResultState = "pending" | "ongoing" | "finished";

export interface ChessGameResult {
  gameId: string;
  state: ChessResultState;
  /** Raw Lichess status (e.g. "mate", "resign", "draw", "started"). */
  status: string;
  /** Winning color when decisive; null on a draw or while unfinished. */
  winner: "white" | "black" | null;
  /** True when the game ended in a draw (finished with no winner). */
  draw: boolean;
}

function authHeaders(): Record<string, string> {
  return LICHESS_TOKEN ? { Authorization: `Bearer ${LICHESS_TOKEN}` } : {};
}

/**
 * Create an anonymous Lichess open challenge. Either player can take a side by
 * opening their colored URL; the returned `gameId` is what gets registered
 * on-chain and read by the CRE workflow.
 */
export async function createOpenChallenge(
  opts: ChallengeOptions = {},
): Promise<OpenChallenge> {
  const {
    clockLimit = 300,
    clockIncrement = 0,
    variant = "standard",
    name = "Playces Chess",
    rated = false,
  } = opts;

  const body = new URLSearchParams({
    "clock.limit": String(clockLimit),
    "clock.increment": String(clockIncrement),
    variant,
    name,
    rated: rated ? "true" : "false",
  });

  const res = await fetch(`${LICHESS_BASE}/api/challenge/open`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      ...authHeaders(),
    },
    body: body.toString(),
    cache: "no-store",
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Lichess challenge failed (${res.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`,
    );
  }

  const data = (await res.json()) as {
    id?: string;
    url?: string;
    urlWhite?: string;
    urlBlack?: string;
    challenge?: { id?: string; url?: string };
  };

  const gameId = data.id ?? data.challenge?.id;
  const url = data.url ?? data.challenge?.url ?? `${LICHESS_BASE}/${gameId}`;
  if (!gameId) {
    throw new Error("Lichess challenge response missing a game id.");
  }

  return {
    gameId,
    url,
    urlWhite: data.urlWhite ?? `${url}?color=white`,
    urlBlack: data.urlBlack ?? `${url}?color=black`,
  };
}

/**
 * Read the authoritative result for a Lichess game. Returns a normalized state
 * so callers (status route + CRE workflow) treat finished/decisive games
 * identically.
 */
export async function getGameResult(gameId: string): Promise<ChessGameResult> {
  const url = `${LICHESS_BASE}/game/export/${encodeURIComponent(
    gameId,
  )}?moves=false&clocks=false&evals=false&opening=false`;

  const res = await fetch(url, {
    headers: { Accept: "application/json", ...authHeaders() },
    cache: "no-store",
  });

  // An open challenge isn't an exportable game until a player joins — Lichess
  // returns 404 until then. Treat that as "not started yet", not an error.
  if (res.status === 404) {
    return { gameId, state: "pending", status: "created", winner: null, draw: false };
  }
  if (!res.ok) {
    throw new Error(`Lichess export failed (${res.status}) for ${gameId}`);
  }

  const data = (await res.json()) as {
    status?: string;
    winner?: "white" | "black";
  };

  const status = data.status ?? "unknown";
  // Lichess statuses that mean "not done yet".
  const unstarted = status === "created";
  const ongoing = status === "started";
  const finished = !unstarted && !ongoing;
  const winner = data.winner === "white" || data.winner === "black" ? data.winner : null;

  return {
    gameId,
    state: unstarted ? "pending" : ongoing ? "ongoing" : "finished",
    status,
    winner: finished ? winner : null,
    draw: finished && winner === null,
  };
}
