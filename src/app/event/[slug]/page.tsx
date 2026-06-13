import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Gift, Lock, Swords, Users } from "lucide-react";
import { getEventBySlug, EVENTS } from "@/lib/mock/events";
import { getSponsorsByIds, getSponsorById } from "@/lib/mock/sponsors";
import { getGamesByIds } from "@/lib/mock/games";
import { EventHero } from "@/components/event-hero";
import { EventSchedule } from "@/components/event-schedule";
import { EventHosts, EventSpeakers } from "@/components/event-people";
import { VenueMap } from "@/components/venue-map";
import { StatsStrip } from "@/components/stats-strip";
import { ClaimPanel } from "@/components/claim-panel";
import { SponsorChip } from "@/components/sponsor-chip";
import { Badge } from "@/components/ui/badge";

export function generateStaticParams() {
  return EVENTS.map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const event = getEventBySlug(slug);
  if (!event) return { title: "Venue not found" };
  return {
    title: event.title,
    description: event.tagline,
  };
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = getEventBySlug(slug);
  if (!event) notFound();

  const sponsors = getSponsorsByIds(event.sponsorIds);
  const games = getGamesByIds(event.gameIds);

  return (
    <>
      <EventHero event={event} />

      <div className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
          {/* Main column */}
          <div className="space-y-10">
            <section>
              <h2 className="font-display text-xl font-semibold">About</h2>
              <p className="mt-3 leading-relaxed text-muted-foreground">
                {event.description}
              </p>
            </section>

            {sponsors.length > 0 && (
              <section>
                <h2 className="font-display text-xl font-semibold">
                  Rep your chain
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pick a sponsor AR skin and rep it in every match.
                </p>
                <div className="mt-4 flex flex-wrap gap-2.5">
                  {sponsors.map((s) => (
                    <SponsorChip key={s.id} sponsor={s} />
                  ))}
                </div>
              </section>
            )}

            {games.length > 0 && (
              <section>
                <h2 className="font-display text-xl font-semibold">Games</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Play head-to-head — you have to be at the venue.
                </p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {games.map((game) => {
                    const live = game.status === "live";
                    const inner = (
                      <div
                        className={`relative flex h-full flex-col rounded-2xl border border-border bg-card p-5 transition ${
                          live
                            ? "hover:border-[var(--brand)] hover:card-glow"
                            : "opacity-80"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="flex size-10 items-center justify-center rounded-xl bg-[color-mix(in_oklab,var(--brand)_14%,transparent)] text-[var(--brand-deep)] dark:text-[var(--brand)]">
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
                        <h3 className="mt-3 font-display font-semibold">
                          {game.name}
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {game.tagline}
                        </p>
                        <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Users className="size-3.5" />
                            {game.players === 1 ? "Solo" : `${game.players}P`}
                          </span>
                          {game.staked && <span>· Staked p2p</span>}
                        </div>
                        {live && (
                          <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">
                            Play now <ArrowRight className="size-4" />
                          </span>
                        )}
                      </div>
                    );
                    return live ? (
                      <Link
                        key={game.id}
                        href={`/play/${game.slug}`}
                        className="block h-full"
                      >
                        {inner}
                      </Link>
                    ) : (
                      <div key={game.id}>{inner}</div>
                    );
                  })}
                </div>
              </section>
            )}

            {event.airdrops.length > 0 && (
              <section>
                <h2 className="font-display text-xl font-semibold">Airdrops</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Rep a chain, play, and unlock sponsor drops at the venue.
                </p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {event.airdrops.map((a) => {
                    const sponsor = getSponsorById(a.sponsorId);
                    const pct = Math.min(
                      100,
                      Math.round((a.claimed / Math.max(1, a.total)) * 100),
                    );
                    return (
                      <div
                        key={a.id}
                        className="rounded-2xl border border-border bg-card p-5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <span
                              className="flex size-10 items-center justify-center rounded-xl text-white"
                              style={{
                                backgroundColor:
                                  sponsor?.brandColor ?? "var(--brand)",
                              }}
                            >
                              <Gift className="size-5" />
                            </span>
                            <div>
                              <p className="font-display font-semibold">
                                {a.title}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {sponsor?.name ?? "Sponsor"} · {a.requirement}
                              </p>
                            </div>
                          </div>
                          <span className="shrink-0 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
                            {a.reward}
                          </span>
                        </div>
                        <div className="mt-4">
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-[var(--brand)]"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <p className="mt-1.5 text-xs text-muted-foreground">
                            {a.claimed} / {a.total} unlocked
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            <section>
              <h2 className="font-display text-xl font-semibold">Schedule</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {event.timezone.replace("_", " ")}
              </p>
              <div className="mt-5">
                <EventSchedule event={event} />
              </div>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold">Speakers</h2>
              <div className="mt-4">
                <EventSpeakers event={event} />
              </div>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold">Venue</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Check-ins and games are geofenced to this location.
              </p>
              <div className="mt-4">
                <VenueMap venue={event.venue} />
              </div>
            </section>
          </div>

          {/* Sticky check-in rail */}
          <aside className="space-y-5 lg:sticky lg:top-20 lg:self-start">
            <ClaimPanel event={event} />
            <StatsStrip event={event} />
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="font-display font-semibold">Hosts</h3>
              <div className="mt-4">
                <EventHosts event={event} />
              </div>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
