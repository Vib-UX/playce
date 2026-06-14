# Chess Result Feed — Chainlink CRE workflow

The trust-minimized settlement layer for Playce chess PvP. It reads the
authoritative result of a Lichess game and writes a DON-signed report to the
on-chain [`ChessArbiter`](../../contracts/src/ChessArbiter.sol), which releases
the staked pot from `StakeEscrow` to the winner.

This is a fork of Chainlink's **Custom Data Feed** starter template (the
recommended mapping for "fetch off-chain data over HTTP → signed report → an
`IReceiver` consumer").

## How it fits together

```
Lichess game  ──HTTP──▶  CRE workflow (this)  ──signed report──▶  ChessArbiter.onReport
                                                                      │
                                                                      ▼
                                                            StakeEscrow.settle(winner)
```

- App side (`/api/chess/*`) creates the Lichess open challenge and, once both
  players have staked, registers the match on-chain via
  `ChessArbiter.openMatch(...)`, emitting `ChessMatchOpened`.
- This workflow polls `ChessArbiter.pendingMatches()` on a cron schedule,
  fetches each game's result from the Lichess export API, and settles finished,
  decisive games. Draws are skipped (refunded off-chain).

## Prerequisites

1. Install the CRE CLI and authenticate — see the Chainlink CRE Getting Started
   guide.
2. Deploy the contracts and wire env:
   ```bash
   bash ../../contracts/deploy-stake-escrow.sh   # if not already deployed
   bash ../../contracts/deploy-chess-arbiter.sh  # deploys + grants OPERATOR_ROLE
   ```
3. Set `config.json`:
   - `arbiterAddress` → the deployed `ChessArbiter` address (`CHESS_ARBITER_ADDRESS`).
   - `chainSelector` → the CRE/CCIP selector for the arbiter's chain (see
     `project.yaml` for the common values; default is Base mainnet).

## Local feed simulation (no CRE account needed)

To demonstrate the data feed end-to-end **without** the `cre` CLI or a DON, run
the local harness. It reproduces the workflow's exact logic — fetch the Lichess
result, then ABI-encode `(matchId, winner)` — and prints the byte-identical
report payload that would be signed and delivered to `ChessArbiter.onReport`:

```bash
# Default: auto-fetches the token account's most recent game (report only)
node simulate-local.mjs
# Or point it at a specific game + players
node simulate-local.mjs <gameId> <whiteAddr> <blackAddr>
# Full CRE flow incl. the on-chain write (writeReport -> onReport -> paid)
node simulate-local.mjs --settle
```

With no `gameId` arg it resolves the latest game from the `LICHESS_TOKEN`
account (in `.env`); pass a `gameId` to target a specific game. The token is
also used for authenticated reads, otherwise it falls back to anonymous public
reads.

### `--settle` — the full flow, end to end

`--settle` completes the workflow's last capability (`evmClient.writeReport()`)
locally: it forks Base mainnet with **anvil**, deploys `ChessArbiter` against the
**live** `StakeEscrow`, grants it `OPERATOR_ROLE`, registers the match, and
delivers the report through `onReport` — finishing with the winner's USDC
balance increased by the pot. No DON, no broadcast.

Requires `anvil` (Foundry) and a built arbiter artifact
(`cd contracts && forge build`). Real parts: the live escrow bytecode/balances,
the arbiter logic, the report encoding, the payout. Simulated: the DON
signature (we impersonate the forwarder) and the USDC deposits.

## Simulate with the CRE CLI (local-first)

```bash
npm install            # @chainlink/cre-sdk + viem
npm run simulate       # cre workflow simulate .
```

Pick the cron trigger when prompted. Open a real Lichess game, register it via
the app (or call `openMatch` directly), then run the simulation to watch the
workflow fetch the result and produce a report. For local writes use
`MockKeystoneForwarder` and set it on the arbiter via `setForwarder(...)`.

## Deploy

```bash
npm run deploy         # cre workflow deploy .
```

After deploy, set the production Keystone forwarder for your chain on the
arbiter so it accepts the workflow's reports:

```solidity
chessArbiter.setForwarder(<KeystoneForwarder for the chain>);
```

> Early Access: exact `@chainlink/cre-sdk` call shapes may shift between
> versions. If `main.ts` doesn't compile against your installed SDK, align the
> capability calls (`cre.capabilities.cron.trigger`, `runtime.http.sendRequest`,
> `runtime.report`, `cre.evm.EVMClient`, `evm.writeReport`) with the version's
> reference, keeping the same logic.
