import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getGameBySlug } from "@/lib/mock/games";
import { ComingSoonGame } from "@/components/coming-soon-game";

export const metadata: Metadata = {
  title: "Rep Race",
  description:
    "Tap to rep your chain up the venue leaderboard — coming soon to Playce.",
};

export default function RepRacePage() {
  const game = getGameBySlug("rep-race");
  if (!game) notFound();
  return <ComingSoonGame game={game} />;
}
