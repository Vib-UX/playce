/**
 * Shared chess room options used by the lobby (client), the room page, and the
 * server routes that create the Lichess challenge + persist the match. Keeping
 * the presets in one place means the time-control keys, stake bounds, and game
 * types can't drift between where they're picked and where they're validated.
 */
import {
  STAKE_AMOUNT,
  MIN_STAKE_AMOUNT,
  MAX_STAKE_AMOUNT,
  clampStakeAmount,
} from "@/lib/blink/config";

export { MIN_STAKE_AMOUNT, MAX_STAKE_AMOUNT, clampStakeAmount };

// ── Game type (friendly vs rated) ─────────────────────────────────────────
export type ChessGameType = "friendly" | "rated";

export const DEFAULT_GAME_TYPE: ChessGameType = "friendly";

export const GAME_TYPES: { value: ChessGameType; label: string; hint: string }[] = [
  { value: "friendly", label: "Friendly", hint: "Casual — just for the win" },
  { value: "rated", label: "Rated", hint: "Competitive — counts on Lichess" },
];

export function normalizeGameType(value: unknown): ChessGameType {
  return value === "rated" ? "rated" : "friendly";
}

// ── Time controls ─────────────────────────────────────────────────────────
export interface TimeControlPreset {
  /** Stable key passed through the URL + stored on the match. */
  key: string;
  /** Human label, e.g. "Blitz 3+2". */
  label: string;
  category: "Bullet" | "Blitz" | "Rapid";
  /** Total clock per side, in seconds. */
  clockLimit: number;
  /** Increment per move, in seconds. */
  clockIncrement: number;
}

export const TIME_CONTROLS: TimeControlPreset[] = [
  { key: "bullet_1_0", label: "Bullet 1+0", category: "Bullet", clockLimit: 60, clockIncrement: 0 },
  { key: "bullet_2_1", label: "Bullet 2+1", category: "Bullet", clockLimit: 120, clockIncrement: 1 },
  { key: "blitz_3_2", label: "Blitz 3+2", category: "Blitz", clockLimit: 180, clockIncrement: 2 },
  { key: "blitz_5_0", label: "Blitz 5+0", category: "Blitz", clockLimit: 300, clockIncrement: 0 },
  { key: "blitz_5_3", label: "Blitz 5+3", category: "Blitz", clockLimit: 300, clockIncrement: 3 },
  { key: "rapid_10_0", label: "Rapid 10+0", category: "Rapid", clockLimit: 600, clockIncrement: 0 },
];

export const DEFAULT_TIME_CONTROL_KEY = "blitz_5_0";

/** Resolve a time-control key to its preset, falling back to the default. */
export function getTimeControl(key?: string | null): TimeControlPreset {
  return (
    TIME_CONTROLS.find((tc) => tc.key === key) ??
    TIME_CONTROLS.find((tc) => tc.key === DEFAULT_TIME_CONTROL_KEY) ??
    TIME_CONTROLS[0]
  );
}

/** Build a "5+0" style label from raw clock values (display fallback). */
export function formatClock(clockLimit?: number | null, clockIncrement?: number | null): string {
  const minutes = Math.round((clockLimit ?? 0) / 60);
  return `${minutes}+${clockIncrement ?? 0}`;
}

// ── Stake amounts ─────────────────────────────────────────────────────────
export const STAKE_PRESETS = [0.25, 1, 5, 10, 25, 50, 100];

export const DEFAULT_STAKE_AMOUNT = STAKE_AMOUNT;

/** Format a stake amount as a compact USD string ($0.25, $5, $12.50). */
export function formatStake(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  return Number.isInteger(rounded) ? `$${rounded}` : `$${rounded.toFixed(2)}`;
}
