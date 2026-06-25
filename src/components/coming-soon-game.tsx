import Link from "next/link";
import { ArrowLeft, Lock, Swords, Users } from "lucide-react";
import type { MiniGame } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

/** Placeholder screen for catalog games that aren't playable yet. */
export function ComingSoonGame({ game }: { game: MiniGame }) {
  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(60%_60%_at_50%_0%,color-mix(in_oklab,var(--brand)_18%,transparent),transparent)]" />
      <section className="mx-auto flex max-w-3xl flex-col items-start px-4 pt-16 pb-24 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to Playces
        </Link>

        <span className="mt-8 flex size-14 items-center justify-center rounded-2xl bg-[color-mix(in_oklab,var(--brand)_14%,transparent)] text-[var(--brand-deep)] dark:text-[var(--brand)]">
          <Swords className="size-6" />
        </span>

        <Badge variant="outline" className="mt-5 gap-1">
          <Lock className="size-3" /> Coming soon
        </Badge>

        <h1 className="mt-4 font-display text-4xl font-bold tracking-tight text-balance sm:text-5xl">
          {game.name}
        </h1>
        <p className="mt-3 max-w-xl text-lg text-muted-foreground">
          {game.tagline}
        </p>
        <p className="mt-4 max-w-xl text-muted-foreground">{game.description}</p>

        <div className="mt-6 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Users className="size-3.5" />
            {game.players === 1 ? "Solo" : `${game.players}P`}
          </span>
          {game.staked && (
            <span className="inline-flex items-center gap-1">· Staked p2p</span>
          )}
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/play/67"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            Play The 67 instead
          </Link>
          <Link
            href="/leaderboard"
            className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm font-semibold transition hover:border-[var(--brand)]"
          >
            View leaderboard
          </Link>
        </div>
      </section>
    </div>
  );
}
