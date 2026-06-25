import Link from "next/link";
import { ArrowRight, Lock, Swords, Users } from "lucide-react";
import type { MiniGame } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function GameCard({ game }: { game: MiniGame }) {
  const live = game.status === "live";
  const body = (
    <div
      className={cn(
        "relative flex h-full flex-col rounded-2xl border border-border bg-card p-5 transition",
        live ? "hover:border-[var(--brand)] hover:card-glow" : "opacity-80",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="flex size-11 items-center justify-center rounded-xl bg-[color-mix(in_oklab,var(--brand)_14%,transparent)] text-[var(--brand-deep)] dark:text-[var(--brand)]">
          <Swords className="size-5" />
        </span>
        {live ? (
          <Badge variant="brand">Live</Badge>
        ) : (
          <Badge variant="outline" className="gap-1">
            <Lock className="size-3" /> Soon
          </Badge>
        )}
      </div>
      <h3 className="mt-4 font-display text-lg font-semibold">{game.name}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{game.tagline}</p>
      <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Users className="size-3.5" />
          {game.players === 1 ? "Solo" : `${game.players}P`}
        </span>
        {game.staked && (
          <span className="inline-flex items-center gap-1">· Staked p2p</span>
        )}
      </div>
      <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
        {live ? "Play now" : "Preview"} <ArrowRight className="size-4" />
      </span>
    </div>
  );

  return (
    <Link href={`/play/${game.slug}`} className="block h-full">
      {body}
    </Link>
  );
}

export function GamesHub({
  games,
  title = "Head-to-head games",
  subtitle = "Play head-to-head and earn — online or at a venue.",
}: {
  games: MiniGame[];
  title?: string;
  subtitle?: string;
}) {
  if (games.length === 0) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-2xl">
        <p className="text-sm font-medium text-[var(--brand)]">Mini-games</p>
        <h2 className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl">
          {title}
        </h2>
        <p className="mt-2 text-muted-foreground">{subtitle}</p>
      </div>
      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {games.map((game) => (
          <GameCard key={game.id} game={game} />
        ))}
      </div>
    </section>
  );
}
