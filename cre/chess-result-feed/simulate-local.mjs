/**
 * Local simulation of the Playces chess result feed (no CRE DON required).
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
 * With `--settle`, the harness completes the LAST workflow capability too
 * (`evmClient.writeReport()`): it spins up a Base mainnet fork (anvil), deploys
 * ChessArbiter wired to the LIVE StakeEscrow, and delivers the report through
 * `onReport`, ending with the winner's USDC balance increased by the pot. This
 * runs the entire CRE flow locally — fetch -> report -> on-chain settle -> paid
 * — with no DON and no broadcast.
 *
 * Usage:
 *   node cre/chess-result-feed/simulate-local.mjs
 *   node cre/chess-result-feed/simulate-local.mjs <gameId> [whiteAddr] [blackAddr]
 *   node cre/chess-result-feed/simulate-local.mjs --settle            # full flow
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";
import {
  createPublicClient,
  createTestClient,
  createWalletClient,
  encodeAbiParameters,
  formatUnits,
  http,
  keccak256,
  parseAbi,
  toBytes,
} from "viem";
import { base } from "viem/chains";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "..");
const LICHESS_BASE = "https://lichess.org";

// ── On-chain settlement (--settle) config ──────────────────────────────────
const BASE_RPC = process.env.BASE_RPC_URL ?? "https://mainnet.base.org";
const ANVIL_PORT = Number(process.env.ANVIL_PORT ?? 8546);
const ANVIL_RPC = `http://127.0.0.1:${ANVIL_PORT}`;
// Live deployment (contracts/deployments/production.json).
const ESCROW_ADDRESS = "0x01D514432b6694D8260bbA0fc2af3Cf327020823";
const ESCROW_ADMIN = "0x88cb5e1fAee0798E2780618CF4fD12933E385426";
// anvil's first dev account (auto-unlocked) — used as deployer + forwarder.
const ANVIL_ACCOUNT = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const OPERATOR_ROLE = keccak256(toBytes("OPERATOR_ROLE"));
const STAKE = 250_000n; // 0.25 USDC (6 decimals)

const ESCROW_ABI = parseAbi([
  "function usdc() view returns (address)",
  "function grantRole(bytes32 role, address account)",
  "function creditStake(bytes32 roomId, uint8 role, address player, uint256 amount)",
  "function potAmount(bytes32 roomId) view returns (uint256)",
]);
const USDC_ABI = parseAbi([
  "function balanceOf(address) view returns (uint256)",
]);

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

/**
 * Resolve the most recent game id from the token's Lichess account. Used when
 * no gameId is passed on the CLI, so the demo always targets your latest game.
 */
async function fetchLatestGameId() {
  if (!TOKEN) {
    throw new Error("No LICHESS_TOKEN — pass a gameId arg or set the token in .env");
  }
  const auth = { Authorization: `Bearer ${TOKEN}` };
  const acct = await fetch(`${LICHESS_BASE}/api/account`, { headers: auth });
  if (!acct.ok) throw new Error(`Lichess account lookup failed (${acct.status})`);
  const { username } = await acct.json();
  if (!username) throw new Error("Could not resolve Lichess username from token.");

  const games = await fetch(
    `${LICHESS_BASE}/api/games/user/${username}?max=1&pgnInJson=false`,
    { headers: { ...auth, Accept: "application/x-ndjson" } },
  );
  if (!games.ok) throw new Error(`Lichess games lookup failed (${games.status})`);
  const text = (await games.text()).trim();
  const line = text.split("\n").find((l) => l.trim());
  if (!line) throw new Error(`No games found for ${username}.`);
  const { id } = JSON.parse(line);
  if (!id) throw new Error("Latest game has no id.");
  console.log(`Latest game for ${username}: ${id}`);
  return id;
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

// ── CLI parsing: flags (--settle) + positional [gameId, white, black] ───────
const rawArgs = process.argv.slice(2);
const SETTLE_ONCHAIN =
  rawArgs.includes("--settle") || process.env.SETTLE_ONCHAIN === "true";
const [argGameId, argWhite, argBlack] = rawArgs.filter((a) => !a.startsWith("--"));
const SAMPLE_WHITE = "0x2637c4A0eE962d76c272f85aA9eF6538ccdF1dA9";
const SAMPLE_BLACK = "0x000000000000000000000000000000000000dEaD";

async function main() {
  console.log("─".repeat(64));
  console.log("Playces chess result feed — LOCAL SIMULATION");
  console.log(`Lichess auth: ${TOKEN ? "token present" : "anonymous"}`);
  console.log(`On-chain settle: ${SETTLE_ONCHAIN ? "ON (Base fork)" : "off (report only)"}`);

  const gameId = argGameId ?? (await fetchLatestGameId());
  // roomId mirrors the app: keccak of the (uppercased) room code. We don't have
  // the room code here, so derive a deterministic one from the game id.
  const roomId = keccak256(toBytes(`room:${gameId}`));
  const pendingMatches = [
    {
      gameId,
      roomId,
      white: argWhite ?? SAMPLE_WHITE,
      black: argBlack ?? SAMPLE_BLACK,
    },
  ];

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
    console.log("  ↳ this signed payload calls ChessArbiter.onReport →");
    console.log("    StakeEscrow.settle(roomId, winner) releasing the pot.");

    reports.push({ ...m, matchId, winner, payload });
  }

  console.log(`\n${"─".repeat(64)}`);
  console.log(`Off-chain feed complete — ${reports.length} report(s) ready to write.`);
  console.log("─".repeat(64));

  if (SETTLE_ONCHAIN && reports.length > 0) {
    await settleReportsOnchain(reports);
  } else if (SETTLE_ONCHAIN) {
    console.log("\nNothing to settle (no finished, decisive games).");
  }
}

// ── On-chain settlement: the workflow's evm.writeReport(), on a Base fork ───

/** Load the compiled ChessArbiter (abi + bytecode) from the Foundry artifact. */
function loadArbiterArtifact() {
  const p = join(REPO_ROOT, "contracts/out/ChessArbiter.sol/ChessArbiter.json");
  let json;
  try {
    json = JSON.parse(readFileSync(p, "utf8"));
  } catch {
    throw new Error(
      "ChessArbiter artifact not found. Build it first: (cd contracts && forge build)",
    );
  }
  const bytecode = json.bytecode?.object ?? json.bytecode;
  return {
    abi: json.abi,
    bytecode: bytecode.startsWith("0x") ? bytecode : `0x${bytecode}`,
  };
}

/** Start an anvil fork of Base mainnet and wait until it answers RPC. */
async function startAnvilFork() {
  console.log(`\nStarting Base fork (anvil :${ANVIL_PORT}) from ${BASE_RPC} …`);
  const proc = spawn(
    "anvil",
    ["--fork-url", BASE_RPC, "--port", String(ANVIL_PORT), "--silent"],
    { stdio: "ignore" },
  );

  const probe = createPublicClient({ transport: http(ANVIL_RPC) });
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      await probe.getBlockNumber();
      return proc;
    } catch {
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  proc.kill("SIGKILL");
  throw new Error("anvil fork did not become ready in time.");
}

async function settleReportsOnchain(reports) {
  console.log("\n" + "═".repeat(64));
  console.log("ON-CHAIN SETTLEMENT (writeReport → onReport), Base fork, no broadcast");
  console.log("═".repeat(64));

  const { abi: arbiterAbi, bytecode } = loadArbiterArtifact();
  const anvil = await startAnvilFork();

  try {
    const transport = http(ANVIL_RPC);
    const pub = createPublicClient({ chain: base, transport });
    const wallet = createWalletClient({ chain: base, transport });
    const test = createTestClient({ chain: base, mode: "anvil", transport });

    const usdc = await pub.readContract({
      address: ESCROW_ADDRESS,
      abi: ESCROW_ABI,
      functionName: "usdc",
    });

    // Fund the impersonated escrow admin/operator for gas.
    await test.impersonateAccount({ address: ESCROW_ADMIN });
    await test.setBalance({ address: ESCROW_ADMIN, value: 10n ** 18n });

    // Deploy ChessArbiter wired to the LIVE escrow. anvil dev account is the
    // arbiter admin/operator AND the forwarder (so it can deliver onReport).
    const deployHash = await wallet.deployContract({
      abi: arbiterAbi,
      bytecode,
      account: ANVIL_ACCOUNT,
      args: [ANVIL_ACCOUNT, ANVIL_ACCOUNT, ESCROW_ADDRESS, ANVIL_ACCOUNT],
    });
    const { contractAddress: arbiter } =
      await pub.waitForTransactionReceipt({ hash: deployHash });
    console.log(`Arbiter deployed (fork): ${arbiter}`);

    // Grant the arbiter OPERATOR_ROLE on the live escrow.
    await wallet.writeContract({
      address: ESCROW_ADDRESS,
      abi: ESCROW_ABI,
      functionName: "grantRole",
      args: [OPERATOR_ROLE, arbiter],
      account: ESCROW_ADMIN,
    });

    for (const r of reports) {
      console.log(`\n▶ settling game ${r.gameId}`);

      // Backend registers the match (emits ChessMatchOpened).
      const openHash = await wallet.writeContract({
        address: arbiter,
        abi: arbiterAbi,
        functionName: "openMatch",
        args: [r.matchId, r.roomId, r.white, r.black, r.gameId],
        account: ANVIL_ACCOUNT,
      });
      await pub.waitForTransactionReceipt({ hash: openHash });

      // Credit both seats (uses the escrow's real forked USDC balance).
      for (const [role, player] of [
        [0, r.white],
        [1, r.black],
      ]) {
        const h = await wallet.writeContract({
          address: ESCROW_ADDRESS,
          abi: ESCROW_ABI,
          functionName: "creditStake",
          args: [r.roomId, role, player, STAKE],
          account: ESCROW_ADMIN,
        });
        await pub.waitForTransactionReceipt({ hash: h });
      }
      const pot = await pub.readContract({
        address: ESCROW_ADDRESS,
        abi: ESCROW_ABI,
        functionName: "potAmount",
        args: [r.roomId],
      });

      const before = await pub.readContract({
        address: usdc,
        abi: USDC_ABI,
        functionName: "balanceOf",
        args: [r.winner],
      });

      // Deliver the signed report exactly as the Keystone forwarder would.
      const reportHash = await wallet.writeContract({
        address: arbiter,
        abi: arbiterAbi,
        functionName: "onReport",
        args: ["0x", r.payload],
        account: ANVIL_ACCOUNT,
      });
      const receipt = await pub.waitForTransactionReceipt({ hash: reportHash });

      const after = await pub.readContract({
        address: usdc,
        abi: USDC_ABI,
        functionName: "balanceOf",
        args: [r.winner],
      });
      const delta = after - before;

      console.log(`  pot         : ${formatUnits(pot, 6)} USDC`);
      console.log(`  onReport tx : ${receipt.transactionHash} (status ${receipt.status})`);
      console.log(`  winner +    : ${formatUnits(delta, 6)} USDC → ${r.winner}`);
      if (delta !== pot) {
        throw new Error(`Winner delta ${delta} != pot ${pot}`);
      }
      console.log("  ✓ pot released to the CRE-verified winner");
    }

    console.log("\n" + "═".repeat(64));
    console.log("Full CRE flow verified on the fork: fetch → report → onReport → paid.");
    console.log("═".repeat(64));
  } finally {
    anvil.kill("SIGKILL");
  }
}

main().catch((err) => {
  console.error("Simulation failed:", err);
  process.exit(1);
});
