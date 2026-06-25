import type { Metadata } from "next";
import Link from "next/link";
import { Gamepad2 } from "lucide-react";
import { GAMES } from "@/lib/mock/games";
import { GamesHub } from "@/components/games-hub";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Play",
  description:
    "Play head-to-head games on Playces — online for fun, or at an event.",
};

export default function PlayPage() {
  return (
    <div>
      <section className="mx-auto max-w-7xl px-4 pt-12 sm:px-6 lg:px-8">
        <Badge variant="brand">
          <Gamepad2 className="size-3" /> Games
        </Badge>
        <h1 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
          <span className="aurora-text">Pick a game and play</span>
        </h1>
        <p className="mt-2 max-w-xl text-muted-foreground">
          Challenge a friend with a room code. Play online just for fun, or rep a
          chain and stake head-to-head. The 67 also runs at events when you check
          in at the venue.
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Looking for an event?{" "}
          <Link href="/events" className="text-primary hover:underline">
            Browse events
          </Link>
        </p>
      </section>

      <GamesHub
        games={GAMES}
        title="Head-to-head games"
        subtitle="Create a room, share the code, and play — online or at a venue."
      />
    </div>
  );
}
