/**
 * In-memory leaderboard for "The 67" chain battles.
 *
 * The authoritative WS server (`server/six-seven-ws.mjs`) records an outcome
 * whenever a round finishes; the Next API route (`/api/leaderboard`) reads the
 * aggregated standings. Both run inside the same Node process (`server.mjs`),
 * so they share this module instance — the same pattern as `stake-registry`.
 *
 * Durability: the in-memory structures are the hot path; every mutation writes
 * the full snapshot through to Redis and `hydrateLeaderboard()` reloads it on
 * boot so standings + battle results survive restarts. Falls back to pure
 * in-memory if REDIS_URL is unset.
 */
import { loadJSON, saveJSON } from "./redis.mjs";

const REDIS_KEY = "playce:leaderboard:state";

/** @typedef {{ wallet: string, label: string, wins: number, battles: number, sponsorId: string|null, updatedAt: number }} PlayerRow */
/** @typedef {{ sponsorId: string, wins: number }} ChainRow */
/** @typedef {{ wallet: string, label: string, score: number, sponsorId: string|null, updatedAt: number }} HighScoreRow */

/** @type {Map<string, PlayerRow>} wallet (lowercased) -> row */
const players = new Map();
/** @type {Map<string, number>} sponsorId -> wins */
const chains = new Map();
/** @type {Map<string, HighScoreRow>} wallet (lowercased) -> best solo score */
const highScores = new Map();
/** Guards against double-recording the same finished round. */
const recorded = new Set();
let totalBattles = 0;

/**
 * @typedef {{ roomCode: string, roundId: number, winnerWallet: string|null,
 *   winnerSponsorId: string|null, battleMode: string, claimedAt: number|null,
 *   updatedAt: number }} BattleResult
 */
/** @type {Map<string, BattleResult>} roomCode (upper) -> latest finished result */
const battleResults = new Map();

function normRoom(roomCode) {
  return typeof roomCode === "string" ? roomCode.trim().toUpperCase() : "";
}

function normWallet(wallet) {
  return typeof wallet === "string" ? wallet.trim().toLowerCase() : "";
}

function shortLabel(wallet) {
  if (!wallet) return "Player";
  return `${wallet.slice(0, 6)}…${wallet.slice(-4)}`;
}

/** Write-through the full leaderboard snapshot to Redis (fire-and-forget). */
function persist() {
  saveJSON(REDIS_KEY, {
    players: [...players.entries()],
    chains: [...chains.entries()],
    highScores: [...highScores.entries()],
    battleResults: [...battleResults.entries()],
    recorded: [...recorded],
    totalBattles,
  });
}

/**
 * Reload the leaderboard from Redis into the in-memory structures. Call once at
 * boot, before serving.
 * @returns {Promise<number>} number of player rows hydrated
 */
export async function hydrateLeaderboard() {
  const s = await loadJSON(REDIS_KEY, null);
  if (!s || typeof s !== "object") return 0;
  const restoreMap = (target, entries) => {
    if (!Array.isArray(entries)) return;
    for (const [k, v] of entries) target.set(k, v);
  };
  restoreMap(players, s.players);
  restoreMap(chains, s.chains);
  restoreMap(highScores, s.highScores);
  restoreMap(battleResults, s.battleResults);
  if (Array.isArray(s.recorded)) for (const k of s.recorded) recorded.add(k);
  if (Number.isFinite(s.totalBattles)) totalBattles = s.totalBattles;
  return players.size;
}

/**
 * Record the outcome of a finished battle.
 *
 * @param {Object} outcome
 * @param {string} [outcome.winnerWallet]  Winning player's wallet (null on a tie).
 * @param {string} [outcome.winnerSponsorId]  Sponsor/chain the winner repped.
 * @param {Array<{wallet?: string, sponsorId?: string|null}>} [outcome.players]  All seats in the battle.
 * @param {string} outcome.roomCode  Room the battle happened in.
 * @param {string|number} outcome.battleKey  Unique key for this finished round (dedupe).
 */
export function recordOutcome({
  winnerWallet,
  winnerSponsorId,
  players: seats = [],
  roomCode,
  battleKey,
}) {
  const key = `${roomCode ?? "?"}:${battleKey ?? Date.now()}`;
  if (recorded.has(key)) return;
  recorded.add(key);
  totalBattles += 1;

  const now = Date.now();

  // Count a "battle played" for every identified seat.
  for (const seat of seats) {
    const wallet = normWallet(seat?.wallet);
    if (!wallet) continue;
    const row =
      players.get(wallet) ??
      ({
        wallet,
        label: shortLabel(wallet),
        wins: 0,
        battles: 0,
        sponsorId: seat?.sponsorId ?? null,
        updatedAt: now,
      });
    row.battles += 1;
    if (seat?.sponsorId) row.sponsorId = seat.sponsorId;
    row.updatedAt = now;
    players.set(wallet, row);
  }

  const winner = normWallet(winnerWallet);
  if (winner) {
    const row =
      players.get(winner) ??
      ({
        wallet: winner,
        label: shortLabel(winner),
        wins: 0,
        battles: 0,
        sponsorId: winnerSponsorId ?? null,
        updatedAt: now,
      });
    row.wins += 1;
    if (winnerSponsorId) row.sponsorId = winnerSponsorId;
    row.updatedAt = now;
    players.set(winner, row);

    if (winnerSponsorId) {
      chains.set(winnerSponsorId, (chains.get(winnerSponsorId) ?? 0) + 1);
    }
  }

  persist();
}

/**
 * Record a solo high score (no-stake practice run). Keeps the best score per
 * wallet. Solo runs do NOT count as PvP battles or chain wins.
 *
 * @param {Object} run
 * @param {string} [run.wallet]
 * @param {string|null} [run.sponsorId]
 * @param {number} run.score
 * @param {string} [run.label]
 */
export function recordHighScore({ wallet, sponsorId, score, label } = {}) {
  const w = normWallet(wallet);
  if (!w) return;
  const next = Math.max(0, Math.round(Number(score) || 0));
  const now = Date.now();
  const prev = highScores.get(w);
  if (prev && prev.score >= next) {
    // Keep the best score; still refresh rep + recency.
    if (sponsorId) prev.sponsorId = sponsorId;
    prev.updatedAt = now;
    persist();
    return;
  }
  highScores.set(w, {
    wallet: w,
    label: label || shortLabel(w),
    score: next,
    sponsorId: sponsorId ?? prev?.sponsorId ?? null,
    updatedAt: now,
  });
  persist();
}

/**
 * Record the authoritative result of a finished PvP round so the reward-claim
 * route can verify the winner + repped chain and prevent double-claims. Keyed by
 * room (latest round wins).
 *
 * @param {Object} result
 * @param {string} result.roomCode
 * @param {number} result.roundId
 * @param {string|null} [result.winnerWallet]
 * @param {string|null} [result.winnerSponsorId]
 * @param {string} result.battleMode
 */
export function recordBattleResult({
  roomCode,
  roundId,
  winnerWallet,
  winnerSponsorId,
  battleMode,
}) {
  const room = normRoom(roomCode);
  if (!room) return;
  battleResults.set(room, {
    roomCode: room,
    roundId: Number(roundId) || 0,
    winnerWallet: winnerWallet ? normWallet(winnerWallet) : null,
    winnerSponsorId: winnerSponsorId ?? null,
    battleMode: battleMode ?? "memory",
    claimedAt: null,
    updatedAt: Date.now(),
  });
  persist();
}

/** Latest finished result for a room (or null). */
export function getBattleResult(roomCode) {
  return battleResults.get(normRoom(roomCode)) ?? null;
}

/** Mark a room's reward as claimed (idempotency guard). Returns the result. */
export function markBattleClaimed(roomCode) {
  const result = battleResults.get(normRoom(roomCode));
  if (result) {
    result.claimedAt = Date.now();
    result.updatedAt = Date.now();
    persist();
  }
  return result ?? null;
}

/** Aggregated standings: players by wins, chains/sponsors by wins, solo bests. */
export function getLeaderboard() {
  const playerRows = [...players.values()].sort(
    (a, b) => b.wins - a.wins || b.battles - a.battles || a.updatedAt - b.updatedAt,
  );
  const chainRows = [...chains.entries()]
    .map(([sponsorId, wins]) => ({ sponsorId, wins }))
    .sort((a, b) => b.wins - a.wins);
  const highScoreRows = [...highScores.values()].sort(
    (a, b) => b.score - a.score || a.updatedAt - b.updatedAt,
  );
  return { players: playerRows, chains: chainRows, highScores: highScoreRows, totalBattles };
}
