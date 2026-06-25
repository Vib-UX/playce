import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getGameBySlug } from "@/lib/mock/games";
import { ComingSoonGame } from "@/components/coming-soon-game";

export const metadata: Metadata = {
  title: "Knicks Buzzer Beater",
  description:
    "A camera-powered basketball mini-game themed for the New York Knicks — coming soon to Playces.",
};

export default function BasketballPage() {
  const game = getGameBySlug("basketball");
  if (!game) notFound();
  return <ComingSoonGame game={game} />;
}
