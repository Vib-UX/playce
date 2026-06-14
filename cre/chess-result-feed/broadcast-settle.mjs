/**
 * PRODUCTION settlement broadcaster for Playce chess — REAL funds on Base.
 *
 * This is the broadcasting counterpart to `simulate-local.mjs --settle`. Use it
 * to actually settle a finished chess pot on Base mainnet when you are NOT yet
 * running the CRE workflow on a live DON (the workflow does this automatically
 * once deployed). It:
 *
 *   1. Fetches the authoritative Lichess result for the game.
 *   2. Maps the winning color to the staked wallet.
 *   3. Settles on-chain via one of two paths:
 *        - ChessArbiter.adminSettle(matchId, winner)  (if CHESS_ARBITER_ADDRESS
 *          is set — the admin escape hatch for settling without a live DON)
 *        - StakeEscrow.settle(roomId, winner)         (direct, otherwise)
 *
 * SAFETY: dry-run by default (eth_call simulation, no tx). It only broadcasts a
 * real transaction when you pass `--broadcast`. Settling requires the room's
 * stakes to be credited on-chain (real USDC in the escrow) — with dev-mock
 * staking there is nothing to settle and the simulation will revert.
 *
 * Env (process.env or repo .env.local):
 *   MINTER_PRIVATE_KEY      operator key (OPERATOR_ROLE). Required to broadcast.
 *   BASE_RPC_URL            default https://mainnet.base.org
 *   STAKE_ESCROW_ADDRESS    default the live deployment
 *   CHESS_ARBITER_ADDRESS   optional; routes settlement through the arbiter
 *   LICHESS_TOKEN           optional; authenticated reads
 *
 * Usage:
 *   node cre/chess-result-feed/broadcast-settle.mjs \
 *     --game <gameId> --room <ROOMCODE> --white <addr> --black <addr>          # dry-run
 *   node cre/chess-result-feed/broadcast-settle.mjs ... --broadcast            # REAL tx
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  createPublicClient,
  createWalletClient,
  encodeAbiParameters,
  http,
  isAddress,
  keccak256,
  parseAbi,
  toBytes,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "..");
const LICHESS_BASE = "https://lichess.org";

// ── Read a key from process.env, falling back to repo .env.local ────────────
function fromEnv(key, fallback = "") {
  if (process.env[key]) return process.env[key];
  for (const file of [join(HERE, ".env"), join(REPO_ROOT, ".env.local")]) {
    try {
      const txt = readFileSync(file, "utf8");
      const line = txt.split("\n").find((l) => l.startsWith(`${key}=`));
      if (line) return line.slice(key.length + 1).trim().replace(/^["']|["']$/g, "");
    } catch {
      /* file may not exist */
    }
  }
  return fallback;
}

const BASE_RPC = fromEnv("BASE_RPC_URL", "https://mainnet.base.org");
const ESCROW_ADDRESS = fromEnv(
  "STAKE_ESCROW_ADDRESS",
  "0x01D514432b6694D8260bbA0fc2af3Cf327020823",
);
const ARBITER_ADDRESS = fromEnv("CHESS_ARBITER_ADDRESS", "");
const TOKEN = fromEnv("LICHESS_TOKEN", "");

const ESCROW_ABI = parseAbi([
  "function settle(bytes32 roomId, address winner)",
  "function bothStaked(bytes32 roomId) view returns (bool)",
  "function potAmount(bytes32 roomId) view returns (uint256)",
]);
const ARBITER_ABI = parseAbi([
  "function adminSettle(bytes32 matchId, address winner)",
]);

// ── CLI ─────────────────────────────────────────────────────────────────────
function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}
const DO_BROADCAST = process.argv.includes("--broadcast");
const gameId = arg("game");
const roomCode = arg("room");
const white = arg("white");
const black = arg("black");

function fail(msg) {
  console.error(`Error: ${msg}`);
  process.exit(1);
}

function matchIdForGame(id) {
  return keccak256(toBytes(`chess:${id}`));
}
function roomIdForCode(code) {
  return keccak256(toBytes(String(code).toUpperCase()));
}

async function getGameResult(id) {
  const url = `${LICHESS_BASE}/game/export/${encodeURIComponent(
    id,
  )}?moves=false&clocks=false&evals=false&opening=false`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
    },
  });
  if (!res.ok) fail(`Lichess export failed (${res.status}) for ${id}`);
  const data = await res.json();
  const status = data.status ?? "unknown";
  const finished = status !== "created" && status !== "started";
  const winner =
    data.winner === "white" || data.winner === "black" ? data.winner : null;
  return { finished, status, winner };
}

async function main() {
  if (!gameId) fail("--game <gameId> is required.");
  if (!roomCode) fail("--room <ROOMCODE> is required.");
  if (!isAddress(white ?? "") || !isAddress(black ?? "")) {
    fail("--white and --black must be valid addresses.");
  }

  console.log("─".repeat(64));
  console.log("Playce chess — PRODUCTION settlement broadcaster");
  console.log(`Mode    : ${DO_BROADCAST ? "BROADCAST (real tx)" : "dry-run (no tx)"}`);
  console.log(`RPC     : ${BASE_RPC}`);
  console.log(`Route   : ${ARBITER_ADDRESS ? `ChessArbiter ${ARBITER_ADDRESS}` : `StakeEscrow ${ESCROW_ADDRESS}`}`);
  console.log("─".repeat(64));

  const result = await getGameResult(gameId);
  console.log(`Lichess : status=${result.status} winner=${result.winner ?? "—"}`);
  if (!result.finished) fail("Game is not finished yet.");
  if (!result.winner) fail("Game was a draw — refund off-chain instead of settling.");

  const winner = result.winner === "white" ? white : black;
  const roomId = roomIdForCode(roomCode);
  const matchId = matchIdForGame(gameId);
  console.log(`Winner  : ${result.winner} → ${winner}`);
  console.log(`roomId  : ${roomId}`);

  const pub = createPublicClient({ chain: base, transport: http(BASE_RPC) });

  // Pre-flight: report the pot + staking state (best-effort).
  try {
    const both = await pub.readContract({
      address: ESCROW_ADDRESS, abi: ESCROW_ABI, functionName: "bothStaked", args: [roomId],
    });
    const pot = await pub.readContract({
      address: ESCROW_ADDRESS, abi: ESCROW_ABI, functionName: "potAmount", args: [roomId],
    });
    console.log(`Escrow  : bothStaked=${both} pot=${Number(pot) / 1e6} USDC`);
    if (!both) {
      console.log("⚠ Both seats are not credited on-chain — settlement will revert.");
      console.log("  (dev-mock staking does not credit real USDC.)");
    }
  } catch {
    /* read best-effort */
  }

  // Build the settlement call for the chosen route.
  const call = ARBITER_ADDRESS
    ? { address: ARBITER_ADDRESS, abi: ARBITER_ABI, functionName: "adminSettle", args: [matchId, winner] }
    : { address: ESCROW_ADDRESS, abi: ESCROW_ABI, functionName: "settle", args: [roomId, winner] };

  const rawKey = fromEnv("MINTER_PRIVATE_KEY", "");
  const key = rawKey ? (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) : "";
  const account = key ? privateKeyToAccount(key) : undefined;

  // Dry-run simulation (eth_call) — validates the tx would succeed.
  console.log(`\nSimulating ${call.functionName}(…) from ${account?.address ?? "operator"} …`);
  try {
    await pub.simulateContract({ ...call, account: account?.address });
    console.log("✓ Simulation succeeded — the settlement transaction would go through.");
  } catch (err) {
    fail(`Simulation reverted: ${err?.shortMessage ?? err?.message ?? err}`);
  }

  if (!DO_BROADCAST) {
    console.log("\nDry-run only. Re-run with --broadcast to send the real transaction.");
    // Show the exact CRE report bytes for reference (what the DON would emit).
    if (ARBITER_ADDRESS) {
      const report = encodeAbiParameters(
        [{ type: "bytes32" }, { type: "address" }],
        [matchId, winner],
      );
      console.log(`CRE report payload (for reference): ${report}`);
    }
    return;
  }

  if (!account) fail("MINTER_PRIVATE_KEY is required to broadcast.");
  const wallet = createWalletClient({ account, chain: base, transport: http(BASE_RPC) });
  console.log("\nBroadcasting settlement transaction …");
  const hash = await wallet.writeContract(call);
  console.log(`tx: ${hash}`);
  const receipt = await pub.waitForTransactionReceipt({ hash });
  console.log(`status: ${receipt.status}`);
  console.log(`explorer: https://basescan.org/tx/${hash}`);
}

main().catch((err) => {
  console.error("Broadcast failed:", err);
  process.exit(1);
});
