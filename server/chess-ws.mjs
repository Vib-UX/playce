import { WebSocketServer } from "ws";
import { getStakeStatus } from "../src/lib/server/stake-registry.mjs";
import {
  getMatch,
  getLiveMatches,
  upsertMatch,
  setMatchResult,
  markResultRecorded,
} from "../src/lib/server/chess-store.mjs";
import {
  recordBattleResult,
  recordOutcome,
} from "../src/lib/server/leaderboard-store.mjs";

/**
 * Live relay for Playce chess PvP (`/api/chess-ws`).
 *
 * This is the real-time companion to the HTTP routes: registration, staking and
 * the Lichess challenge stay on `/api/chess/*` (they need Privy auth + secrets),
 * while this socket owns the authoritative RESULT polling. On a tick it reads
 * the Lichess result for any live game, records a finish into the shared
 * leaderboard store (so `/api/reward/claim` can verify + settle), and broadcasts
 * the match + stake state to everyone in the room. Clients still poll
 * `/api/chess/status` as a fallback when the socket is unavailable.
 */

const REFRESH_MS = 4000;

/** @type {Map<string, Set<import("ws").WebSocket>>} code -> sockets */
const rooms = new Map();

function publicMatch(m) {
  if (!m) return null;
  return {
    roomCode: m.roomCode,
    sponsorId: m.sponsorId ?? null,
    white: m.white ?? null,
    black: m.black ?? null,
    gameId: m.gameId ?? null,
    url: m.url ?? null,
    urlWhite: m.urlWhite ?? null,
    urlBlack: m.urlBlack ?? null,
    status: m.status ?? "lobby",
    winnerColor: m.winnerColor ?? null,
    winnerWallet: m.winnerWallet ?? null,
    draw: Boolean(m.draw),
    lichessStatus: m.lichessStatus ?? null,
    opened: Boolean(m.opened),
  };
}

function send(ws, payload) {
  if (ws && ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function broadcast(code) {
  const sockets = rooms.get(code);
  if (!sockets || sockets.size === 0) return;
  const payload = {
    type: "state",
    match: publicMatch(getMatch(code)),
    stakes: getStakeStatus(code),
  };
  for (const ws of sockets) send(ws, payload);
}

async function fetchLichessResult(gameId) {
  const url = `https://lichess.org/game/export/${encodeURIComponent(
    gameId,
  )}?moves=false&clocks=false&evals=false&opening=false`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  // 404 = the open challenge hasn't become a game yet (no player joined).
  if (res.status === 404) {
    return { state: "pending", status: "created", winner: null, draw: false };
  }
  if (!res.ok) throw new Error(`lichess export ${res.status}`);
  const data = await res.json();
  const status = data.status ?? "unknown";
  const unstarted = status === "created";
  const ongoing = status === "started";
  const finished = !unstarted && !ongoing;
  const winner =
    data.winner === "white" || data.winner === "black" ? data.winner : null;
  return {
    state: unstarted ? "pending" : ongoing ? "ongoing" : "finished",
    status,
    winner: finished ? winner : null,
    draw: finished && winner === null,
  };
}

async function refreshLiveMatches() {
  const live = getLiveMatches();
  for (const m of live) {
    // Only spend a request when someone is actually watching the room.
    if (!rooms.has(m.roomCode)) continue;
    try {
      const r = await fetchLichessResult(m.gameId);
      if (r.state === "finished") {
        const updated = setMatchResult(m.roomCode, {
          winner: r.winner,
          draw: r.draw,
          status: r.status,
        });
        if (updated && !updated.resultRecorded) {
          recordBattleResult({
            roomCode: m.roomCode,
            roundId: 1,
            winnerWallet: updated.winnerWallet,
            winnerSponsorId: updated.sponsorId,
            battleMode: "chain",
          });
          recordOutcome({
            winnerWallet: updated.winnerWallet ?? undefined,
            winnerSponsorId: updated.sponsorId ?? undefined,
            players: [
              { wallet: updated.white ?? undefined, sponsorId: updated.sponsorId },
              { wallet: updated.black ?? undefined, sponsorId: updated.sponsorId },
            ],
            roomCode: m.roomCode,
            battleKey: m.gameId,
          });
          markResultRecorded(m.roomCode);
        }
      } else if (r.state === "ongoing" && m.status === "lobby") {
        upsertMatch(m.roomCode, { status: "live", lichessStatus: r.status });
      }
    } catch {
      /* transient — retry next tick */
    }
    broadcast(m.roomCode);
  }
}

export function attachChessWss() {
  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const code = (url.searchParams.get("code") ?? "").toUpperCase();
    if (!code) {
      send(ws, { type: "error", message: "Missing room code." });
      ws.close();
      return;
    }

    let set = rooms.get(code);
    if (!set) {
      set = new Set();
      rooms.set(code, set);
    }
    set.add(ws);

    // Send the current snapshot immediately.
    send(ws, {
      type: "state",
      match: publicMatch(getMatch(code)),
      stakes: getStakeStatus(code),
    });

    ws.on("close", () => {
      const sockets = rooms.get(code);
      if (!sockets) return;
      sockets.delete(ws);
      if (sockets.size === 0) rooms.delete(code);
    });
  });

  // Single shared poll loop across all watched rooms.
  setInterval(() => {
    void refreshLiveMatches();
  }, REFRESH_MS);

  return wss;
}
