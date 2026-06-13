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
- **Geofenced check-in** — location permission → "inside / outside zone" → check
  in, with clear fallback states.
- **Mini-games hub** — including the **67**: two players stake p2p, the camera
  opens with a sponsor AR skin (Chainlink / Pyth / Blink), and they throw the 67
  — best score wins the pot.
- **Rep your chain + airdrops** — sponsors drop rewards to attendees at the
  venue.
- **Onchain reward mint** — viem/wagmi-shaped states (preparing → signing →
  submitting → confirming → success), gasless via a backend minter.
- **3D reward reveal** + shareable collectible page + rewards gallery.

## Tech stack

| Area        | Choice |
| ----------- | ------ |
| Framework   | Next.js (App Router) + TypeScript |
| Styling     | Tailwind CSS v4 + shadcn-style UI primitives |
| Motion      | Framer Motion |
| Auth/Wallet | Privy embedded wallets (`@privy-io/react-auth`, `@privy-io/wagmi`) |
| Chain       | viem + wagmi, **Base Sepolia** (chain `84532`) |
| 3D          | Three.js via React Three Fiber + drei |
| State       | Zustand (persisted rewards) |

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. (Optional) configure Privy — the app runs without it in demo mode
cp .env.example .env.local
# then set NEXT_PUBLIC_PRIVY_APP_ID=... from https://dashboard.privy.io

# 3. Run the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Demo mode vs. real Privy

- **No `NEXT_PUBLIC_PRIVY_APP_ID`** → Playce uses a faithful **demo auth**: an
  email modal provisions a mock embedded wallet so the full flow works
  immediately.
- **With a Privy app id** → real email login + embedded wallet creation on Base
  Sepolia, wired through `@privy-io/wagmi`.

### Geofence demo override

The flow is explorable anywhere thanks to a demo override. To exercise the real
browser geolocation + distance check, set `DEMO_FORCE_INSIDE_ZONE = false` in
`src/lib/mock/geofence.ts`.

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

The onchain reward is a real OpenZeppelin-based contract in `contracts/`.

### `PlaycePass` (`contracts/src/PlaycePass.sol`)

- ERC-721 (`ERC721URIStorage` + `AccessControl`).
- **One claim per `(eventId, wallet)`** — enforced onchain.
- **Soulbound** — non-transferable, because a pass is proof *you* were there.
- `mintClaim(to, eventId, uri)` is gated by `MINTER_ROLE`.

```bash
cd contracts
forge test
```

### Trust model (why a backend minter?)

Geofencing, identity checks, and game results are verified **off-chain**. The
backend holds `MINTER_ROLE` and mints directly to the user's embedded wallet, so
collecting is **gasless** for users.

If no contract/minter is configured, `/api/claim` falls back to a mock mint so
the flow still works locally.

### Deploying to Base Sepolia

```bash
# 1. Fund the deployer address with Base Sepolia ETH (e.g. a Base faucet).
# 2. Deploy + auto-wire NEXT_PUBLIC_PLAYCE_CONTRACT_ADDRESS into .env.local
bash contracts/deploy.sh
# 3. Verify on Basescan:
cd contracts && forge verify-contract <ADDR> src/PlaycePass.sol:PlaycePass \
  --chain 84532 --constructor-args $(cast abi-encode "constructor(address,address)" <DEPLOYER> <DEPLOYER>)
# 4. Restart the dev server — rewards now mint for real.
```

## The 67 game (placeholder)

`/play/67` ships a **playable placeholder**: lobby + p2p stake, a camera view
with a sponsor AR overlay, a round timer, and **manual tap scoring**. The real
gesture detection and onchain stake escrow are stubbed behind clear interfaces
in `src/lib/games/six-seven.ts` so they can be swapped in.

## Remaining mock surfaces

- **Eligibility** — `lib/mock/whitelist.ts` and `lib/mock/geofence.ts` are stubs.
- **Data** — back `lib/mock/events.ts`, `lib/mock/sponsors.ts`, and
  `lib/mock/games.ts` with a CMS or onchain registry; the types stay the same.
- **67 game** — gesture scoring + stake escrow are placeholders.

---

Show up. Play. Earn.
