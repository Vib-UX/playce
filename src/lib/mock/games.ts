import type { MiniGame } from "@/lib/types";

/**
 * Mini-games playable at Playce venues. The flagship is the 67 — a
 * head-to-head, p2p-staked camera game. Add more games here as they ship.
 */
export const GAMES: MiniGame[] = [
  {
    id: "67",
    slug: "67",
    name: "The 67",
    tagline: "Throw the 67. Best hand wins the pot.",
    description:
      "Two players stake head-to-head. The camera opens with a sponsor AR skin and you throw the 67 — whoever nails the motion more cleanly across the round wins the staked pot and an onchain reward.",
    players: 2,
    staked: true,
    sponsorIds: ["chainlink", "pyth", "blink"],
    status: "live",
  },
  {
    id: "reprace",
    slug: "rep-race",
    name: "Rep Race",
    tagline: "Tap to rep your chain up the leaderboard.",
    description:
      "A fast solo tapper where every tap reps your favorite chain. Climb the venue leaderboard to unlock sponsor airdrops.",
    players: 1,
    staked: false,
    sponsorIds: ["base", "chainlink"],
    status: "soon",
  },
];

/** Player-vs-player games — the head-to-head "PvP" category. */
export function getPvpGames(): MiniGame[] {
  return GAMES.filter((g) => g.players >= 2);
}

export function getGameBySlug(slug: string): MiniGame | undefined {
  return GAMES.find((g) => g.slug === slug);
}

export function getGameById(id: string): MiniGame | undefined {
  return GAMES.find((g) => g.id === id);
}

export function getGamesByIds(ids: string[]): MiniGame[] {
  return ids
    .map((id) => getGameById(id))
    .filter((g): g is MiniGame => Boolean(g));
}
