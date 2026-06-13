import { WebSocketServer } from "ws";
import { getStakeStatus } from "../src/lib/server/stake-registry.mjs";

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

function bothOnline(room) {
  return (
    room.seats.host?.status === "online" &&
    room.seats.guest?.status === "online"
  );
}

function bothStaked(room) {
  const stakes = getStakeStatus(room.code);
  return stakes.host && stakes.guest;
}

function startGame(room) {
  if (room.status === "running") return;
  if (!bothOnline(room)) return;
  if (!bothStaked(room)) return;
  clearTimer(room);
  room.scores = [0, 0];
  room.winner = null;
  room.timeLeft = ROUND_SECONDS;
  room.status = "running";
  broadcast(room);
  room.timer = setInterval(() => {
    room.timeLeft -= 1;
    if (room.timeLeft <= 0) {
      room.timeLeft = 0;
      room.status = "finished";
      room.winner = decideWinner(room.scores);
      clearTimer(room);
    }
    broadcast(room);
  }, 1000);
}

function resetGame(room) {
  clearTimer(room);
  room.scores = [0, 0];
  room.winner = null;
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
 *
 * @typedef {Object} Room
 * @property {string} code
 * @property {{host: Seat|null, guest: Seat|null}} seats
 * @property {[number, number]} scores
 * @property {GameStatus} status
 * @property {number} timeLeft
 * @property {number|null} winner
 * @property {ReturnType<typeof setInterval>|null} timer
 */
