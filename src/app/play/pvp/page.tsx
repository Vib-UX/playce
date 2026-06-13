import type { Metadata } from "next";
import Link from "next/link";
import { Swords } from "lucide-react";
import { getPvpGames } from "@/lib/mock/games";
import { GamesHub } from "@/components/games-hub";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "PvP",
  description:
    "Head-to-head, staked, camera-powered games on Playce. Challenge a friend and earn onchain.",
};

export default function PvpHubPage() {
  const games = getPvpGames();

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(60%_60%_at_50%_0%,color-mix(in_oklab,var(--brand)_20%,transparent),transparent)]" />

      <section className="mx-auto max-w-7xl px-4 pt-12 sm:px-6 lg:px-8">
        <Badge variant="brand">
          <Swords className="size-3" /> PvP arena
        </Badge>
        <h1 className="mt-4 font-display text-4xl font-bold tracking-tight text-balance sm:text-5xl">
          <span className="aurora-text">Player vs player.</span>
        </h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          Head-to-head games you play in real life, scored live from your camera.
          Pick a game, share a room code, and challenge a friend — more PvP games
          drop soon.
        </p>
      </section>

      <GamesHub
        games={games}
        title="Pick a game"
        subtitle="Two players, staked head-to-head, skinned with your favorite chain."
      />

      <div className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to Playce
        </Link>
      </div>
    </div>
  );
}
