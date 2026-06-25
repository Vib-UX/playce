/**
 * In-memory chess match registry for Playces chess PvP.
 *
 * Mirrors `stake-registry.mjs` / `leaderboard-store.mjs`: a single process-local
 * map (shared via globalThis) used by the Next API routes (`/api/chess/*`) and
 * the chess WS relay (`server/chess-ws.mjs`), which all run inside the same
 * `server.mjs` process. Resets on restart — swap for a DB or onchain indexer
 * later without changing this surface.
 *
 * A match is the off-chain bookkeeping for one Lichess game: who plays which
 * color (white = host, black = guest), the staked sponsor/chain, and the
 * authoritative Lichess result once the game ends. The on-chain `ChessArbiter`
 * + CRE workflow settle the pot from the same result.
 *
 * Durability: the map is the hot path, but every mutation writes through to
 * Redis and `hydrateChessStore()` reloads it on boot, so room→game mappings
 * survive restarts/redeploys. Falls back to pure in-memory if REDIS_URL is
 * unset.
 */
import { loadJSON, saveJSON } from "./redis.mjs";

const REDIS_KEY = "playces:chess:matches";

/**
 * @typedef {Object} ChessMatch
 * @property {string} roomCode
 * @property {string|null} sponsorId        Repped chain (host-defined).
 * @property {string|null} white            Host wallet (white pieces).
 * @property {string|null} black            Guest wallet (black pieces).
 * @property {string|null} gameId           Lichess game id.
 * @property {string|null} url              Public game URL.
 * @property {string|null} urlWhite         Host board link.
 * @property {string|null} urlBlack         Guest board link.
 * @property {"lobby"|"live"|"finished"} status
 * @property {"white"|"black"|null} winnerColor
 * @property {string|null} winnerWallet
 * @property {boolean} draw
 * @property {string|null} lichessStatus    Raw Lichess status.
 * @property {boolean} opened               Registered on-chain (ChessArbiter).
 * @property {boolean} resultRecorded       Pushed into the leaderboard store.
 * @property {number} createdAt
 * @property {number} updatedAt
 */

const GLOBAL_KEY = "__playces_chess_matches__";
if (!globalThis[GLOBAL_KEY]) {
  globalThis[GLOBAL_KEY] = new Map();
}
/** @type {Map<string, ChessMatch>} */
const matches = globalThis[GLOBAL_KEY];

function roomKey(code) {
  return String(code ?? "").trim().toUpperCase();
}

/** Write-through the whole registry to Redis (fire-and-forget). */
function persist() {
  saveJSON(REDIS_KEY, Object.fromEntries(matches));
}

/**
 * Reload the registry from Redis into the in-memory map. Call once at boot
 * (before serving) so rooms created before a restart are still resolvable.
 * @returns {Promise<number>} number of matches hydrated
 */
export async function hydrateChessStore() {
  const stored = await loadJSON(REDIS_KEY, null);
  if (!stored || typeof stored !== "object") return 0;
  let count = 0;
  for (const [key, value] of Object.entries(stored)) {
    if (value && typeof value === "object") {
      matches.set(key, /** @type {ChessMatch} */ (value));
      count += 1;
    }
  }
  return count;
}

/** @returns {ChessMatch} */
function blankMatch(roomCode) {
  const now = Date.now();
  return {
    roomCode,
    sponsorId: null,
    white: null,
    black: null,
    gameId: null,
    url: null,
    urlWhite: null,
    urlBlack: null,
    status: "lobby",
    winnerColor: null,
    winnerWallet: null,
    draw: false,
    lichessStatus: null,
    opened: false,
    resultRecorded: false,
    createdAt: now,
    updatedAt: now,
  };
}

/** Get a match by room code (or null). */
export function getMatch(roomCode) {
  return matches.get(roomKey(roomCode)) ?? null;
}

/**
 * Create-or-update a match with a partial patch. Returns the stored match.
 * @param {string} roomCode
 * @param {Partial<ChessMatch>} patch
 * @returns {ChessMatch}
 */
export function upsertMatch(roomCode, patch = {}) {
  const key = roomKey(roomCode);
  if (!key) throw new Error("roomCode is required");
  const current = matches.get(key) ?? blankMatch(key);
  /** @type {ChessMatch} */
  const next = { ...current, ...patch, roomCode: key, updatedAt: Date.now() };
  matches.set(key, next);
  persist();
  return next;
}

/**
 * Record the authoritative Lichess result on a match (idempotent — only the
 * first finish sticks). Maps the winning color to the staked wallet.
 * @param {string} roomCode
 * @param {{ winner: "white"|"black"|null, draw: boolean, status: string }} result
 * @returns {ChessMatch | null}
 */
export function setMatchResult(roomCode, result) {
  const key = roomKey(roomCode);
  const current = matches.get(key);
  if (!current) return null;
  if (current.status === "finished") return current;

  const winnerWallet =
    result.winner === "white"
      ? current.white
      : result.winner === "black"
        ? current.black
        : null;

  /** @type {ChessMatch} */
  const next = {
    ...current,
    status: "finished",
    winnerColor: result.winner,
    winnerWallet,
    draw: Boolean(result.draw),
    lichessStatus: result.status,
    updatedAt: Date.now(),
  };
  matches.set(key, next);
  persist();
  return next;
}

/** Mark a match as registered on-chain (ChessArbiter.openMatch sent). */
export function markMatchOpened(roomCode) {
  const m = matches.get(roomKey(roomCode));
  if (m) {
    m.opened = true;
    m.updatedAt = Date.now();
    persist();
  }
  return m ?? null;
}

/** Mark a finished match's result as pushed into the leaderboard store. */
export function markResultRecorded(roomCode) {
  const m = matches.get(roomKey(roomCode));
  if (m) {
    m.resultRecorded = true;
    m.updatedAt = Date.now();
    persist();
  }
  return m ?? null;
}

/** All matches that have a Lichess game but haven't finished yet. */
export function getLiveMatches() {
  return [...matches.values()].filter(
    (m) => m.gameId && m.status !== "finished",
  );
}
