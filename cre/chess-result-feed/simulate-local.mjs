/**
 * Local simulation of the Playce chess result feed (no CRE DON required).
 *
 * The real workflow (`main.ts`) runs on a Chainlink CRE DON and needs the `cre`
 * CLI + a CRE account. This harness reproduces the SAME data-feed logic on plain
 * Node so you can demonstrate, locally, that the custom feed works end-to-end:
 *
 *   1. Take the "pending matches" the workflow would read from `ChessArbiter`
 *      (here: provided via CLI args or the built-in sample), each carrying a
 *      Lichess gameId + the white/black wallets.
 *   2. Fetch the authoritative result from the Lichess game-export API
 *      (the off-chain HTTP fetch — `runtime.http.sendRequest` in the workflow).
 *   3. For finished, decisive games, ABI-encode `(matchId, winner)` exactly as
 *      the workflow does before `runtime.report()` + `writeReport()`.
 *
 * The encoded payload printed here is byte-identical to what the DON would sign
 * and deliver to `ChessArbiter.onReport`, which settles the StakeEscrow pot.
 *
 * Usage:
 *   node cre/chess-result-feed/simulate-local.mjs
 *   node cre/chess-result-feed/simulate-local.mjs <gameId> [whiteAddr] [blackAddr]
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { encodeAbiParameters, keccak256, toBytes } from "viem";

const HERE = dirname(fileURLToPath(import.meta.url));
const LICHESS_BASE = "https://lichess.org";

// ── Load LICHESS_TOKEN from .env (optional — public reads work without it) ──
function loadToken() {
  if (process.env.LICHESS_TOKEN) return process.env.LICHESS_TOKEN;
  try {
    const env = readFileSync(join(HERE, ".env"), "utf8");
    const line = env.split("\n").find((l) => l.startsWith("LICHESS_TOKEN="));
    return line ? line.slice("LICHESS_TOKEN=".length).trim() : "";
  } catch {
    return "";
  }
}
const TOKEN = loadToken();

/** matchId derivation — must match src/lib/server/chess-arbiter.ts. */
function matchIdForGame(gameId) {
  return keccak256(toBytes(`chess:${gameId}`));
}

/** Fetch + normalize the authoritative Lichess result (mirrors lichess.ts). */
async function getGameResult(gameId) {
  const url = `${LICHESS_BASE}/game/export/${encodeURIComponent(
    gameId,
  )}?moves=false&clocks=false&evals=false&opening=false`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
    },
  });
  if (res.status === 404) {
    return { state: "pending", status: "created", winner: null, draw: false };
  }
  if (!res.ok) throw new Error(`Lichess export failed (${res.status}) for ${gameId}`);
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

// ── "Pending matches" the workflow would read from ChessArbiter.pendingMatches.
// Override the first via CLI args; otherwise use a real finished public game.
const [argGameId, argWhite, argBlack] = process.argv.slice(2);
const SAMPLE_WHITE = "0x2637c4A0eE962d76c272f85aA9eF6538ccdF1dA9";
const SAMPLE_BLACK = "0x000000000000000000000000000000000000dEaD";

const pendingMatches = [
  {
    gameId: argGameId ?? "wYvLmAHI",
    white: argWhite ?? SAMPLE_WHITE,
    black: argBlack ?? SAMPLE_BLACK,
  },
];

async function main() {
  console.log("─".repeat(64));
  console.log("Playce chess result feed — LOCAL SIMULATION");
  console.log(`Lichess auth: ${TOKEN ? "token present" : "anonymous"}`);
  console.log(`Pending matches to resolve: ${pendingMatches.length}`);
  console.log("─".repeat(64));

  const reports = [];

  for (const m of pendingMatches) {
    const matchId = matchIdForGame(m.gameId);
    console.log(`\n▶ game ${m.gameId}`);
    console.log(`  matchId : ${matchId}`);
    console.log(`  white   : ${m.white}`);
    console.log(`  black   : ${m.black}`);

    const result = await getGameResult(m.gameId);
    console.log(`  fetch   : status=${result.status} state=${result.state} winner=${result.winner ?? "—"}`);

    if (result.state !== "finished") {
      console.log("  skip    : not finished yet (no report)");
      continue;
    }
    if (result.winner !== "white" && result.winner !== "black") {
      console.log("  skip    : draw / no winner (off-chain refund path)");
      continue;
    }

    const winner = result.winner === "white" ? m.white : m.black;
    const payload = encodeAbiParameters(
      [{ type: "bytes32" }, { type: "address" }],
      [matchId, winner],
    );

    console.log(`  winner  : ${result.winner} → ${winner}`);
    console.log(`  report  : ${payload}`);
    console.log("  ↳ this signed payload would call ChessArbiter.onReport →");
    console.log("    StakeEscrow.settle(roomId, winner) releasing the pot.");

    reports.push({ gameId: m.gameId, matchId, winner, payload });
  }

  console.log(`\n${"─".repeat(64)}`);
  console.log(`Simulation complete — ${reports.length} report(s) would be written on-chain.`);
  console.log("─".repeat(64));
}

main().catch((err) => {
  console.error("Simulation failed:", err);
  process.exit(1);
});
