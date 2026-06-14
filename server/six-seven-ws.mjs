import { WebSocketServer } from "ws";
import { getStakeStatus } from "../src/lib/server/stake-registry.mjs";
import {
  recordOutcome,
  recordHighScore,
  recordBattleResult,
} from "../src/lib/server/leaderboard-store.mjs";

/**
 * Authoritative game server for "The 67".
 *
 * Two seats per room (host / guest). Each client runs hand-tracking locally and
 * sends a {type:"score"} message on every valid seesaw swap; the server is the
 * single source of truth for scores, the countdown, and the winner. Web3 is
 * intentionally absent here — staking will be layered on later (Privy smart
 * wallets) without changing this protocol.
 *
 * Protocol
 *   client -> server : {type:"score"|"start"|"reset"|"stake-status"}
 *   server -> client : {type:"joined", role}
 *                      {type:"state", scores, timeLeft, status, winner, peers, stakes}
 *                      {type:"error", message}
 */

const ROUND_SECONDS = 20;
/** How long a seat is held (status "reconnecting") after a socket drops. */
const RECONNECT_GRACE_MS = 12_000;

/** @typedef {"waiting"|"running"|"finished"} GameStatus */
/** @typedef {"online"|"reconnecting"|"empty"} PeerStatus */

/** @type {Map<string, Room>} */
const rooms = new Map();

function makeRoom(code) {
  /** @type {Room} */
  const room = {
    code,
    seats: { host: null, guest: null },
    scores: [0, 0],
    status: "waiting",
    timeLeft: ROUND_SECONDS,
    winner: null,
    timer: null,
    roundId: 0,
    // Battle type is defined by the host's repped sponsor ("chain" stakes a pot
    // + rewards a badge; "memory" mints the proof clip only).
    battleMode: "memory",
    // Whether the in-progress round is solo (no online guest) -> high score.
    solo: false,
    winnerWallet: null,
    winnerSponsorId: null,
  };
  rooms.set(code, room);
  return room;
}

function seatEntries(room) {
  return /** @type {const} */ ([
    ["host", room.seats.host],
    ["guest", room.seats.guest],
  ]);
}

function peerStatus(seat) {
  return seat ? seat.status : "empty";
}

function buildState(room) {
  const stakes = getStakeStatus(room.code);
  return {
    type: "state",
    scores: room.scores,
    timeLeft: room.timeLeft,
    status: room.status,
    winner: room.winner,
    peers: {
      host: peerStatus(room.seats.host),
      guest: peerStatus(room.seats.guest),
    },
    stakes,
    battleMode: room.battleMode,
    solo: room.solo,
    winnerWallet: room.winnerWallet,
    winnerSponsorId: room.winnerSponsorId,
  };
}

function send(ws, payload) {
  if (ws && ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function broadcast(room) {
  const state = buildState(room);
  for (const [, seat] of seatEntries(room)) {
    if (seat) send(seat.ws, state);
  }
}

function clearTimer(room) {
  if (room.timer) {
    clearInterval(room.timer);
    room.timer = null;
  }
}

function decideWinner(scores) {
  if (scores[0] === scores[1]) return null;
  return scores[0] > scores[1] ? 0 : 1;
}

/**
 * Every currently-online seat must be staked. Solo play needs only the host's
 * stake; PvP needs both. Empty/reconnecting seats are not required to stake.
 */
function onlineSeatsStaked(room) {
  const stakes = getStakeStatus(room.code);
  if (room.seats.host?.status === "online" && !stakes.host) return false;
  if (room.seats.guest?.status === "online" && !stakes.guest) return false;
  return true;
}

function startGame(room) {
  if (room.status === "running") return;
  // Only the host can start; they must be present. Solo is allowed — no guest
  // required.
  if (room.seats.host?.status !== "online") return;
  // A round is "solo" when no guest is online. For chain battles we still treat
  // it as a real match (the host "continues" against the house) so the stake +
  // win badge / CCIP reward flow runs; only memory runs stay free practice.
  const solo = room.seats.guest?.status !== "online";
  // Chain battles always stake (solo or PvP). Memory runs are free to start.
  const requiresStake = room.battleMode === "chain";
  if (requiresStake && !onlineSeatsStaked(room)) return;
  clearTimer(room);
  room.scores = [0, 0];
  room.winner = null;
  room.winnerWallet = null;
  room.winnerSponsorId = null;
  room.solo = solo;
  room.timeLeft = ROUND_SECONDS;
  room.status = "running";
  room.roundId += 1;
  broadcast(room);
  room.timer = setInterval(() => {
    room.timeLeft -= 1;
    if (room.timeLeft <= 0) {
      room.timeLeft = 0;
      room.status = "finished";
      // Solo is a single-player high-score run — there is no opponent to tie
      // with, so the host always "wins" their own run.
      room.winner = room.solo ? 0 : decideWinner(room.scores);
      const winnerSeat =
        room.winner === 0
          ? room.seats.host
          : room.winner === 1
            ? room.seats.guest
            : null;
      room.winnerWallet = winnerSeat?.wallet ?? null;
      room.winnerSponsorId = winnerSeat?.sponsorId ?? null;
      clearTimer(room);
      // Chain battles always record a claimable outcome (pot + win badge /
      // CCIP), even when solo. Only memory solo runs are pure high scores.
      if (room.solo && room.battleMode !== "chain") {
        recordSoloOutcome(room);
      } else {
        recordBattleOutcome(room);
      }
    }
    broadcast(room);
  }, 1000);
}

/** Record a solo run's score as a personal high score (no battle/chain win). */
function recordSoloOutcome(room) {
  const host = room.seats.host;
  if (!host) return;
  recordHighScore({
    wallet: host.wallet ?? null,
    sponsorId: host.sponsorId ?? null,
    score: room.scores[0] ?? 0,
  });
}

/** Push a finished PvP round into the shared leaderboard store. */
function recordBattleOutcome(room) {
  const seats = seatEntries(room)
    .map(([, seat]) => seat)
    .filter(Boolean)
    .map((seat) => ({ wallet: seat.wallet ?? null, sponsorId: seat.sponsorId ?? null }));
  recordOutcome({
    winnerWallet: room.winnerWallet,
    winnerSponsorId: room.winnerSponsorId,
    players: seats,
    roomCode: room.code,
    battleKey: room.roundId,
  });
  // Authoritative per-room result for the reward-claim route (chain battles add
  // a pot + win badge; the route verifies the winner against this).
  recordBattleResult({
    roomCode: room.code,
    roundId: room.roundId,
    winnerWallet: room.winnerWallet,
    winnerSponsorId: room.winnerSponsorId,
    battleMode: room.battleMode,
  });
}

function resetGame(room) {
  clearTimer(room);
  room.scores = [0, 0];
  room.winner = null;
  room.winnerWallet = null;
  room.winnerSponsorId = null;
  room.solo = false;
  room.timeLeft = ROUND_SECONDS;
  room.status = "waiting";
  broadcast(room);
}

function findSeatByClientId(room, clientId) {
  for (const [role, seat] of seatEntries(room)) {
    if (seat && seat.clientId === clientId) return role;
  }
  return null;
}

function assignSeat(room, clientId, ws) {
  // Reconnect into an existing seat for this client.
  const existing = findSeatByClientId(room, clientId);
  if (existing) {
    const seat = room.seats[existing];
    if (seat.graceTimer) {
      clearTimeout(seat.graceTimer);
      seat.graceTimer = null;
    }
    seat.ws = ws;
    seat.status = "online";
    return existing;
  }
  // Otherwise take the first free seat.
  for (const role of /** @type {const} */ (["host", "guest"])) {
    if (!room.seats[role]) {
      room.seats[role] = { clientId, ws, status: "online", graceTimer: null };
      return role;
    }
  }
  return null;
}

function releaseSeat(room, role) {
  const seat = room.seats[role];
  if (!seat) return;
  if (seat.graceTimer) clearTimeout(seat.graceTimer);
  room.seats[role] = null;
  if (!room.seats.host && !room.seats.guest) {
    clearTimer(room);
    rooms.delete(room.code);
  } else {
    broadcast(room);
  }
}

export function attachSixSevenWss() {
  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const code = (url.searchParams.get("code") ?? "").toUpperCase();
    const clientId = url.searchParams.get("clientId") ?? "";

    if (!code || !clientId) {
      send(ws, { type: "error", message: "Missing room code." });
      ws.close();
      return;
    }

    const room = rooms.get(code) ?? makeRoom(code);
    const role = assignSeat(room, clientId, ws);

    if (!role) {
      send(ws, { type: "error", message: "This room is full." });
      ws.close();
      return;
    }

    send(ws, { type: "joined", role });
    broadcast(room);

    ws.on("message", (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      const seatRole = findSeatByClientId(room, clientId);
      if (!seatRole) return;

      switch (msg.type) {
        case "score": {
          if (room.status !== "running") return;
          room.scores[seatRole === "host" ? 0 : 1] += 1;
          broadcast(room);
          break;
        }
        case "start": {
          if (seatRole === "host") startGame(room);
          break;
        }
        case "reset": {
          if (seatRole === "host") resetGame(room);
          break;
        }
        case "stake-status": {
          broadcast(room);
          break;
        }
        case "identify": {
          // Client reports its wallet + repped sponsor (+ derived battle mode)
          // so finished rounds can be attributed on the leaderboard and the
          // room can branch chain vs memory behavior. Not authoritative for
          // gameplay scoring.
          const seat = room.seats[seatRole];
          if (seat) {
            if (typeof msg.wallet === "string") seat.wallet = msg.wallet;
            if (typeof msg.sponsorId === "string") seat.sponsorId = msg.sponsorId;
            if (msg.battleMode === "chain" || msg.battleMode === "memory") {
              seat.battleMode = msg.battleMode;
            }
          }
          // The host defines the room's battle type.
          if (seatRole === "host" && room.seats.host) {
            room.battleMode = room.seats.host.battleMode ?? "memory";
          }
          broadcast(room);
          break;
        }
        default:
          break;
      }
    });

    ws.on("close", () => {
      const seatRole = findSeatByClientId(room, clientId);
      if (!seatRole) return;
      const seat = room.seats[seatRole];
      if (!seat || seat.ws !== ws) return; // superseded by a reconnect
      seat.status = "reconnecting";
      broadcast(room);
      seat.graceTimer = setTimeout(() => {
        releaseSeat(room, seatRole);
      }, RECONNECT_GRACE_MS);
    });
  });

  return wss;
}

/**
 * @typedef {Object} Seat
 * @property {string} clientId
 * @property {import("ws").WebSocket} ws
 * @property {PeerStatus} status
 * @property {ReturnType<typeof setTimeout>|null} graceTimer
 * @property {string} [wallet]
 * @property {string} [sponsorId]
 * @property {"chain"|"memory"} [battleMode]
 *
 * @typedef {Object} Room
 * @property {string} code
 * @property {{host: Seat|null, guest: Seat|null}} seats
 * @property {[number, number]} scores
 * @property {GameStatus} status
 * @property {number} timeLeft
 * @property {number|null} winner
 * @property {ReturnType<typeof setInterval>|null} timer
 * @property {number} roundId
 * @property {"chain"|"memory"} battleMode
 * @property {boolean} solo
 * @property {string|null} winnerWallet
 * @property {string|null} winnerSponsorId
 */
