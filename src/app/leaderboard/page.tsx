import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Swords } from "lucide-react";
import { LeaderboardBoard } from "@/components/leaderboard-board";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Leaderboard",
  description:
    "Live standings from The 67 chain battles — top players and the chains they rep.",
};

export default function LeaderboardPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex items-center gap-2">
        <Badge variant="brand">
          <Swords className="size-3" /> The 67
        </Badge>
        <Badge variant="outline">Live</Badge>
      </div>

      <h1 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
        <span className="aurora-text">Chain battle leaderboard</span>
      </h1>
      <p className="mt-2 max-w-xl text-muted-foreground">
        Every head-to-head 67 match is a chain battle. Winners climb the board
        and bank a win for the chain, wallet, or product they rep.
      </p>

      <div className="mt-8">
        <LeaderboardBoard />
      </div>

      <div className="mt-8 flex items-center justify-between rounded-2xl border border-border bg-card p-5">
        <div>
          <p className="font-display font-semibold">Want in?</p>
          <p className="text-sm text-muted-foreground">
            Throw the 67 head-to-head and rep your chain.
          </p>
        </div>
        <Link
          href="/play/67"
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:brightness-110"
        >
          Play now <ArrowRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}
