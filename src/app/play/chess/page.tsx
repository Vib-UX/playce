import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getGameBySlug } from "@/lib/mock/games";
import { ComingSoonGame } from "@/components/coming-soon-game";

export const metadata: Metadata = {
  title: "Chess Blitz",
  description: "Speed chess, head-to-head, repping your chain — coming soon to Playce.",
};

export default function ChessPage() {
  const game = getGameBySlug("chess");
  if (!game) notFound();
  return <ComingSoonGame game={game} />;
}
