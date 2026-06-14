"use client";

import { useEffect, useState } from "react";
import { Loader2, Swords, Target, Trophy } from "lucide-react";
import { getSponsorById } from "@/lib/mock/sponsors";
import { cn } from "@/lib/utils";

interface PlayerRow {
  wallet: string;
  label: string;
  wins: number;
  battles: number;
  sponsorId: string | null;
}

interface ChainRow {
  sponsorId: string;
  wins: number;
}

interface HighScoreRow {
  wallet: string;
  label: string;
  score: number;
  sponsorId: string | null;
}

interface Board {
  players: PlayerRow[];
  chains: ChainRow[];
  highScores: HighScoreRow[];
  totalBattles: number;
}

const RANK_ACCENT = ["text-amber-400", "text-zinc-300", "text-orange-400"];

/**
 * Live "The 67" chain-battle standings, fetched from `/api/leaderboard`.
 * Used full-width on `/leaderboard` and compact on the event page.
 */
export function LeaderboardBoard({
  limit,
  showChains = true,
  showHighScores = true,
  pollMs = 15000,
  className,
}: {
  /** Cap the number of players shown (e.g. top 5 in the compact card). */
  limit?: number;
  showChains?: boolean;
  /** Show the solo high-score board. */
  showHighScores?: boolean;
  /** Re-fetch interval; set 0 to fetch once. */
  pollMs?: number;
  className?: string;
}) {
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/leaderboard", { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as Board;
        if (!cancelled) {
          setBoard(data);
          setError(false);
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    const id = pollMs > 0 ? setInterval(load, pollMs) : null;
    return () => {
      cancelled = true;
      if (id) clearInterval(id);
    };
  }, [pollMs]);

  if (loading) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-2xl border border-border bg-card p-8 text-muted-foreground",
          className,
        )}
      >
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  const players = board?.players ?? [];
  const chains = board?.chains ?? [];
  const highScores = board?.highScores ?? [];
  const shownPlayers = limit ? players.slice(0, limit) : players;
  const shownHighScores = limit ? highScores.slice(0, limit) : highScores;

  if (error || (players.length === 0 && highScores.length === 0)) {
    return (
      <div
        className={cn(
          "rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center",
          className,
        )}
      >
        <Swords className="mx-auto size-6 text-muted-foreground" />
        <p className="mt-3 text-sm font-medium">No battles yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Throw the 67 head-to-head — winners climb the board and rack up wins
          for the chain they rep.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {players.length > 0 && (
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="inline-flex items-center gap-2 font-display font-semibold">
            <Trophy className="size-4 text-[var(--brand)]" /> Top players
          </h3>
          <span className="text-xs text-muted-foreground">
            {board?.totalBattles ?? 0} battles
          </span>
        </div>
        <ul className="divide-y divide-border">
          {shownPlayers.map((p, i) => {
            const sponsor = p.sponsorId ? getSponsorById(p.sponsorId) : null;
            return (
              <li
                key={p.wallet}
                className="flex items-center gap-3 px-4 py-3 text-sm"
              >
                <span
                  className={cn(
                    "w-6 shrink-0 text-center font-display font-bold tabular-nums",
                    RANK_ACCENT[i] ?? "text-muted-foreground",
                  )}
                >
                  {i + 1}
                </span>
                <span className="flex-1 truncate font-mono text-foreground">
                  {p.label}
                </span>
                {sponsor && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: sponsor.brandColor }}
                    />
                    {sponsor.name}
                  </span>
                )}
                <span className="ml-2 shrink-0 tabular-nums">
                  <span className="font-semibold text-foreground">{p.wins}</span>
                  <span className="text-muted-foreground"> / {p.battles}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
      )}

      {showHighScores && highScores.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="inline-flex items-center gap-2 font-display font-semibold">
              <Target className="size-4 text-[var(--brand)]" /> Solo high scores
            </h3>
            <span className="text-xs text-muted-foreground">no-stake runs</span>
          </div>
          <ul className="divide-y divide-border">
            {shownHighScores.map((p, i) => {
              const sponsor = p.sponsorId ? getSponsorById(p.sponsorId) : null;
              return (
                <li
                  key={p.wallet}
                  className="flex items-center gap-3 px-4 py-3 text-sm"
                >
                  <span
                    className={cn(
                      "w-6 shrink-0 text-center font-display font-bold tabular-nums",
                      RANK_ACCENT[i] ?? "text-muted-foreground",
                    )}
                  >
                    {i + 1}
                  </span>
                  <span className="flex-1 truncate font-mono text-foreground">
                    {p.label}
                  </span>
                  {sponsor && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span
                        className="size-2.5 rounded-full"
                        style={{ backgroundColor: sponsor.brandColor }}
                      />
                      {sponsor.name}
                    </span>
                  )}
                  <span className="ml-2 shrink-0 font-semibold tabular-nums text-foreground">
                    {p.score}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {showChains && chains.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h3 className="font-display font-semibold">Chains by wins</h3>
          </div>
          <ul className="divide-y divide-border">
            {chains.map((c) => {
              const sponsor = getSponsorById(c.sponsorId);
              return (
                <li
                  key={c.sponsorId}
                  className="flex items-center gap-3 px-4 py-3 text-sm"
                >
                  <span
                    className="size-3 shrink-0 rounded-full"
                    style={{ backgroundColor: sponsor?.brandColor ?? "var(--brand)" }}
                  />
                  <span className="flex-1 truncate">
                    {sponsor?.name ?? c.sponsorId}
                    {sponsor && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {sponsor.category}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums text-foreground">
                    {c.wins}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
