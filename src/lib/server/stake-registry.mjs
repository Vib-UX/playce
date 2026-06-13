/**
 * In-memory stake registry shared by the 67 WS server and Next.js confirm API.
 * Tracks which seats have confirmed Blink deposits per room code.
 */

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

/**
 * @param {ConfirmedStake} stake
 */
export function recordStake(stake) {
  const key = roomKey(stake.roomCode);
  const entry = rooms.get(key) ?? {};
  entry[stake.role] = stake;
  rooms.set(key, entry);
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
}

/**
 * @param {string} roomCode
 * @param {StakeRole} role
 * @returns {ConfirmedStake | undefined}
 */
export function getStake(roomCode, role) {
  return rooms.get(roomKey(roomCode))?.[role];
}
