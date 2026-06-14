# Playce

**Show up. Play. Earn.** Playce turns real-world venues into interactive social
arenas — geofenced check-ins, embedded wallets, onchain mini-games (like the
**67**), chain/product airdrops, and collectible onchain rewards on **Base**.

Attendees check in at a venue, onboard with email (embedded wallet via Privy),
play sponsor-skinned mini-games head-to-head, rep their favorite chain, and
collect a memorable onchain reward. The reward reveal shows a **3D collectible
artifact**.

> Be there. Play. Earn your moment.

---

## Features

- **Gamified venue experience** — bold arcade UX, mobile-first, light & dark.
- **Email onboarding via Privy** — embedded wallets created instantly, no seed
  phrases.
- **ENS subname tickets** — every attendee claims an event-scoped subname (e.g.
  `you-ethglobal-nyc.playce.eth`) off `playce.eth`, minted gasless to their
  wallet with `addr` + `tier`/`event` resolver records.
- **Geofenced check-in** — location permission → "inside / outside zone" → check
  in, with clear fallback states.
- **Mini-games hub** — including the **67**: two players stake p2p, the camera
  opens with a sponsor AR skin (Chainlink / Pyth / Blink), and they throw the 67
  — best score wins the pot.
- **Rep your chain + airdrops** — sponsors drop rewards to attendees at the
  venue.
- **Onchain reward mint** — viem/wagmi-shaped states (preparing → signing →
  submitting → confirming → success).
- **3D reward reveal** + shareable collectible page + rewards gallery.

## Tech stack

| Area        | Choice |
| ----------- | ------ |
| Framework   | Next.js (App Router) + TypeScript |
| Styling     | Tailwind CSS v4 + shadcn-style UI primitives |
| Motion      | Framer Motion |
| Auth/Wallet | Privy embedded wallets (`@privy-io/react-auth`, `@privy-io/wagmi`) |
| Identity    | ENS subname tickets — Durin-style L2 registry on **Sepolia**, resolved via viem's ENSv2 Universal Resolver |
| Chain       | viem + wagmi — **Base mainnet** (8453) for proofs & staking; **Arbitrum Sepolia** + **Ethereum Sepolia** for chain-battle CCIP badges |
| 3D          | Three.js via React Three Fiber + drei |
| State       | Zustand (persisted rewards) |

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Configure Privy
cp .env.example .env.local
# then set NEXT_PUBLIC_PRIVY_APP_ID=... from https://dashboard.privy.io

# 3. Run the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Pages

| Route               | Description |
| ------------------- | ----------- |
| `/`                 | Hero, featured venues, how it works, why Playce |
| `/event/[slug]`     | Venue hero, schedule, games, airdrops, venue map, check-in rail |
| `/play/67`          | The 67 game — lobby, stake, camera + AR sponsor skin, scoring |
| `/claim`            | Check-in eligibility, geofence, wallet status, reward mint, 3D preview |
| `/collectible/[id]` | 3D reward hero, NFT metadata, tx hash, share card |
| `/profile`          | Collected rewards, history, wallet & email |

## Smart contracts & onchain rewards

Production contracts live in `contracts/` (Foundry). Source is verified on
[Sourcify](https://sourcify.dev); browse verified contracts on **Blockscout**
(links below).

Machine-readable manifest: `contracts/deployments/production.json`.

**Deployer:** `0x88cb5e1fAee0798E2780618CF4fD12933E385426`

### Deployed contracts

| Network | Contract | Address (Blockscout) | Role |
| ------- | -------- | -------------------- | ---- |
| **Base mainnet** (8453) | `PlaycePass` | [`0xC1eF…50FC`](https://base.blockscout.com/address/0xC1eF7A81195538bc529b8Ed42182eC73764450FC) | Soulbound memory / proof-of-presence mint |
| **Base mainnet** (8453) | `StakeEscrow` | [`0x01D5…0823`](https://base.blockscout.com/address/0x01D514432b6694D8260bbA0fc2af3Cf327020823) | Blink USDC stake escrow + winner settlement |
| **Arbitrum Sepolia** (421614) | `ProofSender` | [`0xC1eF…50FC`](https://arbitrum-sepolia.blockscout.com/address/0xC1eF7A81195538bc529b8Ed42182eC73764450FC) | Chainlink CCIP sender → Ethereum Sepolia |
| **Arbitrum Sepolia** (421614) | `PlaycePass` | [`0x6847…7904`](https://arbitrum-sepolia.blockscout.com/address/0x68476f79D46A3A7A0ce7cbA40E4eF77264c47904) | Direct win badge mint (Arbitrum-repped battles) |
| **Ethereum Sepolia** (11155111) | `ProofReceiverPass` | [`0x6847…7904`](https://eth-sepolia.blockscout.com/address/0x68476f79D46A3A7A0ce7cbA40E4eF77264c47904) | CCIP receiver — win badge mint (Ethereum-repped battles) |

**CCIP lane:** Arbitrum Sepolia → Ethereum Sepolia. `ProofSender` must hold LINK
on Arbitrum Sepolia for cross-chain sends (~4 LINK per message at current fees).

### Contract overview

#### `PlaycePass` (`contracts/src/PlaycePass.sol`)

- ERC-721 (`ERC721URIStorage` + `AccessControl`).
- **One claim per `(eventId, wallet)`** — enforced onchain.
- **Soulbound** — non-transferable proof *you* were there.
- `mintClaim(to, eventId, uri)` gated by `MINTER_ROLE`.

Used on **Base mainnet** for geofenced memory clips and on **Arbitrum Sepolia**
for direct chain-battle win badges.

#### `StakeEscrow` (`contracts/src/StakeEscrow.sol`)

- Holds Blink-deposited USDC on Base mainnet.
- Credits stakes per battle room; `settle(roomId, winner)` pays the pot to the
  winner when they claim via `/api/reward/claim`.

#### `ProofSender` / `ProofReceiverPass`

- Chainlink CCIP cross-chain mint path for **Ethereum-repped** chain-battle wins.
- Backend holds `SENDER_ROLE` on `ProofSender`; receiver mints soulbound badges
  on Ethereum Sepolia when the CCIP message arrives.

```bash
cd contracts
forge test
```

### Verify source code

Re-submit or refresh Sourcify verification (syncs to Blockscout):

```bash
bash contracts/verify-all.sh
```

Or verify one contract manually:

```bash
cd contracts
forge verify-contract 0xC1eF7A81195538bc529b8Ed42182eC73764450FC \
  src/PlaycePass.sol:PlaycePass \
  --chain base \
  --verifier sourcify \
  --constructor-args $(cast abi-encode "constructor(address,address)" \
    0x88cb5e1fAee0798E2780618CF4fD12933E385426 \
    0x88cb5e1fAee0798E2780618CF4fD12933E385426)
```

### Deploying locally / testnets

```bash
# Deploy PlaycePass + StakeEscrow to Base Sepolia (dev)
bash contracts/deploy.sh

# Deploy CCIP sender/receiver + badge contracts (testnets)
bash contracts/deploy-ccip.sh
bash contracts/deploy-badge.sh
```

Wire addresses into `.env.local` (see `.env.example`) and restart the dev server.

## The 67 game

`/play/67` is a full chain-battle mini-game: event-gated lobby, Blink USDC
staking, sponsor AR skins (Chainlink / Pyth / Arbitrum / Ethereum), camera-based
scoring, solo high-score mode, and onchain win badges + pot settlement via
`/api/reward/claim`.

---

Show up. Play. Earn.
