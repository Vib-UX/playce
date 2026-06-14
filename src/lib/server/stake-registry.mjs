/**
 * Stake registry shared by the 67 WS server and Next.js confirm API. Tracks
 * which seats have confirmed Blink deposits per room code.
 *
 * Durability: the in-memory map is the hot path; every mutation writes through
 * to Redis and `hydrateStakeRegistry()` reloads it on boot so confirmed stakes
 * survive restarts. Falls back to pure in-memory if REDIS_URL is unset.
 */
import { loadJSON, saveJSON } from "./redis.mjs";

const REDIS_KEY = "playce:stakes:rooms";

/** @typedef {"host"|"guest"} StakeRole */

/**
 * @typedef {Object} ConfirmedStake
 * @property {string} roomCode
 * @property {StakeRole} role
 * @property {string} playerAddress
 * @property {number} amount
 * @property {string} transferId
 * @property {number} confirmedAt
 */

/** @type {Map<string, { host?: ConfirmedStake, guest?: ConfirmedStake }>} */
const GLOBAL_KEY = "__playce_stake_registry__";
if (!globalThis[GLOBAL_KEY]) {
  globalThis[GLOBAL_KEY] = new Map();
}
/** @type {Map<string, { host?: ConfirmedStake, guest?: ConfirmedStake }>} */
const rooms = globalThis[GLOBAL_KEY];

function roomKey(code) {
  return String(code).toUpperCase();
}

/** Write-through the whole registry to Redis (fire-and-forget). */
function persist() {
  saveJSON(REDIS_KEY, Object.fromEntries(rooms));
}

/**
 * Reload confirmed stakes from Redis into the in-memory map. Call once at boot.
 * @returns {Promise<number>} number of rooms hydrated
 */
export async function hydrateStakeRegistry() {
  const stored = await loadJSON(REDIS_KEY, null);
  if (!stored || typeof stored !== "object") return 0;
  let count = 0;
  for (const [key, value] of Object.entries(stored)) {
    if (value && typeof value === "object") {
      rooms.set(key, value);
      count += 1;
    }
  }
  return count;
}

/**
 * @param {ConfirmedStake} stake
 */
export function recordStake(stake) {
  const key = roomKey(stake.roomCode);
  const entry = rooms.get(key) ?? {};
  entry[stake.role] = stake;
  rooms.set(key, entry);
  persist();
  return entry;
}

/**
 * @param {string} roomCode
 * @returns {{ host: boolean, guest: boolean, hostAmount?: number, guestAmount?: number }}
 */
export function getStakeStatus(roomCode) {
  const entry = rooms.get(roomKey(roomCode)) ?? {};
  return {
    host: Boolean(entry.host),
    guest: Boolean(entry.guest),
    hostAmount: entry.host?.amount,
    guestAmount: entry.guest?.amount,
  };
}

/**
 * @param {string} roomCode
 */
export function clearRoomStakes(roomCode) {
  rooms.delete(roomKey(roomCode));
  persist();
}

/**
 * @param {string} roomCode
 * @param {StakeRole} role
 * @returns {ConfirmedStake | undefined}
 */
export function getStake(roomCode, role) {
  return rooms.get(roomKey(roomCode))?.[role];
}
