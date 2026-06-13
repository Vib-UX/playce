/**
 * The 67 — shared protocol between the room client and the authoritative WS
 * server (`server/six-seven-ws.mjs`).
 *
 * The server owns scores, the countdown, and the winner; clients send swaps and
 * (host only) start/reset. Staking is intentionally not modeled here yet — it
 * will be layered on later via Privy smart wallets without changing this
 * protocol.
 */

export type GameStatus = "waiting" | "running" | "finished";
export type PeerStatus = "online" | "reconnecting" | "empty";
export type Role = "host" | "guest";

/** Seconds in a 67 round (kept in sync with the server). */
export const ROUND_SECONDS = 20;

export interface ServerState {
  /** [host, guest] swap counts. */
  scores: [number, number];
  timeLeft: number;
  status: GameStatus;
  /** 0 = host, 1 = guest, null = tie / not finished. */
  winner: number | null;
  peers: { host: PeerStatus; guest: PeerStatus };
}

export type ClientMessage =
  | { type: "score" }
  | { type: "start" }
  | { type: "reset" };

export type ServerMessage =
  | { type: "joined"; role: Role }
  | ({ type: "state" } & ServerState)
  | { type: "error"; message: string };

const ROOM_CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Generate a shareable, unambiguous room code (no 0/O/1/I/L). */
export function generateRoomCode(len = 6): string {
  let out = "";
  const buf = new Uint8Array(len);
  if (typeof window !== "undefined" && window.crypto) {
    window.crypto.getRandomValues(buf);
  } else {
    for (let i = 0; i < len; i++) buf[i] = Math.floor(Math.random() * 256);
  }
  for (let i = 0; i < len; i++) out += ROOM_CODE_CHARS[buf[i] % ROOM_CODE_CHARS.length];
  return out;
}

/** Stable per-tab id so a refresh reclaims the same seat. */
export function getClientId(): string {
  if (typeof window === "undefined") return "";
  const key = "playce-67-client-id";
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
    sessionStorage.setItem(key, id);
  }
  return id;
}
