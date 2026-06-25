/**
 * Playces — Chess result feed (Chainlink CRE workflow).
 *
 * This is the "custom feed" that brings the authoritative Lichess result
 * on-chain trust-minimized. Forked from the CRE Custom Data Feed starter
 * template (the closest mapping for "fetch off-chain data over HTTP and write a
 * signed report to an IReceiver consumer").
 *
 * On each cron tick the workflow:
 *   1. Reads `pendingMatches()` from the on-chain `ChessArbiter` (opened but
 *      unsettled chess matches, each carrying its Lichess game id + the white /
 *      black wallets).
 *   2. Fetches the authoritative result from the Lichess game-export API.
 *   3. For finished, decisive games, ABI-encodes `(matchId, winnerAddress)`,
 *      produces a DON-signed report via `runtime.report()`, and submits it with
 *      `evmClient.writeReport()` to the `ChessArbiter` (an `IReceiver`), whose
 *      `onReport` releases the staked pot from `StakeEscrow` to the winner.
 *
 * Draws are intentionally skipped (handled off-chain as a refund).
 *
 * NOTE (Early Access): exact CRE SDK call shapes can drift across `@chainlink/
 * cre-sdk` versions. Validate locally with `cre workflow simulate
 * cre/chess-result-feed` before deploying with `cre workflow deploy`.
 */
import { cre } from "@chainlink/cre-sdk";
import {
  decodeFunctionResult,
  encodeAbiParameters,
  encodeFunctionData,
  type Hex,
} from "viem";
import config from "./config.json";

/** Minimal ABI: only what the workflow reads from the arbiter. */
const ARBITER_ABI = [
  {
    type: "function",
    name: "pendingMatches",
    inputs: [],
    outputs: [
      { name: "ids", type: "bytes32[]" },
      { name: "gameIds", type: "string[]" },
      { name: "whites", type: "address[]" },
      { name: "blacks", type: "address[]" },
    ],
    stateMutability: "view",
  },
] as const;

interface LichessGame {
  status?: string;
  winner?: "white" | "black";
}

/** True when a Lichess game has reached a terminal state. */
function isFinished(status: string): boolean {
  return status !== "created" && status !== "started";
}

export async function main() {
  const trigger = cre.capabilities.cron.trigger({
    schedule: config.cronSchedule ?? "*/1 * * * *",
  });

  cre.handler(trigger, async (runtime) => {
    const chainSelector = BigInt(config.chainSelector);
    const evm = new cre.evm.EVMClient(chainSelector);
    const arbiter = config.arbiterAddress as Hex;

    // 1. Read opened-but-unsettled matches from the arbiter.
    const readData = (await evm
      .callContract({
        to: arbiter,
        data: encodeFunctionData({
          abi: ARBITER_ABI,
          functionName: "pendingMatches",
        }),
        blockNumber: cre.evm.LAST_FINALIZED_BLOCK_NUMBER,
      })
      .result()) as Hex;

    const [ids, gameIds, whites, blacks] = decodeFunctionResult({
      abi: ARBITER_ABI,
      functionName: "pendingMatches",
      data: readData,
    }) as unknown as [Hex[], string[], Hex[], Hex[]];

    runtime.log(`pending chess matches: ${gameIds.length}`);

    // 2. Resolve + settle each finished, decisive game.
    for (let i = 0; i < gameIds.length; i++) {
      const gameId = gameIds[i];
      const res = await runtime.http
        .sendRequest({
          url: `${config.lichessApiBase}/game/export/${gameId}?moves=false&clocks=false&evals=false&opening=false`,
          method: "GET",
          headers: { Accept: "application/json" },
        })
        .result();

      const game = res.json() as LichessGame;
      const status = game.status ?? "unknown";
      if (!isFinished(status)) continue;
      // Draw / unknown winner -> leave for the off-chain refund path.
      if (game.winner !== "white" && game.winner !== "black") continue;

      const winner = game.winner === "white" ? whites[i] : blacks[i];

      // 3. ABI-encode (matchId, winner) -> signed report -> arbiter.onReport.
      const payload = encodeAbiParameters(
        [{ type: "bytes32" }, { type: "address" }],
        [ids[i], winner],
      );
      const report = await runtime.report(payload).result();
      await evm
        .writeReport({
          receiver: arbiter,
          report,
          gasLimit: "300000",
        })
        .result();

      runtime.log(`settled match ${gameId} -> winner ${winner} (${status})`);
    }
  });

  return cre.workflow();
}
