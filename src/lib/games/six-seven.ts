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

/** Per-seat Blink stake confirmation tracked by the WS server. */
export interface StakeStatus {
  host: boolean;
  guest: boolean;
  hostAmount?: number;
  guestAmount?: number;
}

/** Seconds in a 67 round (kept in sync with the server). */
export const ROUND_SECONDS = 20;

/** Auto proof-of-presence recording length (ms) once both players are in. */
export const GAME_RECORD_MS = 15000;

/** Off-chain event slug used for the auto-minted proof-of-presence NFT. */
export const PROOF_EVENT_SLUG = "ethglobal-nyc";

/** Cosmetic winner-showcase model shown in the finished overlay. */
export const WINNER_SHOWCASE_MODEL = "/models/ethglobal-nyc.glb";

/**
 * Paired winner-showcase models shown side by side on every finished round:
 * the Chainlink skin next to the ETHGlobal NYC artifact. The ETHGlobal model
 * renders smaller (it's oversized natively), so its scale is dialed down.
 */
export const WINNER_SHOWCASE_MODELS = [
  "/models/chainlink.glb",
  "/models/ethglobal-nyc.glb",
] as const;

/** Per-model size multipliers, index-aligned with `WINNER_SHOWCASE_MODELS`. */
export const WINNER_SHOWCASE_MODEL_SCALES = [1, 0.7] as const;

/** Battle type for a room, derived from the host's repped sponsor. */
export type BattleMode = "chain" | "memory";

export interface ServerState {
  /** [host, guest] swap counts. */
  scores: [number, number];
  timeLeft: number;
  status: GameStatus;
  /** 0 = host, 1 = guest, null = tie / not finished. */
  winner: number | null;
  peers: { host: PeerStatus; guest: PeerStatus };
  stakes: StakeStatus;
  /** Room battle type (host-defined). Drives staking + rewards vs proof-only. */
  battleMode: BattleMode;
  /** True when the finished/active round was solo (high score, no stake). */
  solo: boolean;
  /** Winning player's wallet (for the claim flow); null on tie / not finished. */
  winnerWallet: string | null;
  /** Sponsor/chain the winner repped (drives the reward chain). */
  winnerSponsorId: string | null;
}

export type ClientMessage =
  | { type: "score" }
  | { type: "start" }
  | { type: "reset" }
  | { type: "stake-status" }
  | {
      type: "identify";
      wallet?: string;
      sponsorId?: string;
      battleMode?: BattleMode;
    };

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
