import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  CalendarDays,
  CalendarPlus,
  Code2,
  Globe,
  MapPin,
  Mic,
  PartyPopper,
  Trophy,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import type { PlaycesEvent } from "@/lib/types";
import { getAllEvents } from "@/lib/events-service";
import { SPONSORS } from "@/lib/mock/sponsors";
import { EventRow } from "@/components/event-row";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Discover events",
  description: "Find events on Playces, or create your own.",
};

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  hackathon: Code2,
  conference: Mic,
  meetup: Users,
  party: PartyPopper,
  tournament: Trophy,
};

function categoryIcon(kind: string): LucideIcon {
  return CATEGORY_ICONS[kind.toLowerCase()] ?? CalendarDays;
}

function eventCity(event: PlaycesEvent): string {
  const online = !event.venue.center.lat && !event.venue.center.lng;
  return online ? "Online" : event.venue.city || "Online";
}

function countBy(events: PlaycesEvent[], key: (e: PlaycesEvent) => string) {
  const map = new Map<string, number>();
  for (const e of events) {
    const k = key(e);
    if (!k) continue;
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

const FEATURED_SPONSORS = SPONSORS.slice(0, 6);

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; city?: string }>;
}) {
  const { category, city } = await searchParams;
  const allEvents = await getAllEvents();

  const categories = countBy(allEvents, (e) => e.kind);
  const cities = countBy(allEvents, eventCity);

  const filtered = allEvents.filter((e) => {
    if (category && e.kind.toLowerCase() !== category.toLowerCase()) return false;
    if (city && eventCity(e).toLowerCase() !== city.toLowerCase()) return false;
    return true;
  });

  const activeFilter = category || city || null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight">
            Discover Events
          </h1>
          <p className="mt-2 max-w-xl text-muted-foreground">
            Explore popular events near you, browse by category, or set up your
            own event page and let people play.
          </p>
        </div>
        <Link
          href="/events/create"
          className={cn(
            buttonVariants({ variant: "gradient" }),
            "shrink-0",
          )}
        >
          <CalendarPlus className="size-4" />
          Create event
        </Link>
      </div>

      {activeFilter && (
        <div className="mt-6 flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Filtered by</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brand)] bg-[color-mix(in_oklab,var(--brand)_12%,transparent)] px-3 py-1 text-sm font-medium">
            {activeFilter}
            <Link
              href="/events"
              aria-label="Clear filter"
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </Link>
          </span>
        </div>
      )}

      {/* Popular events */}
      <section className="mt-10">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="font-display text-xl font-bold tracking-tight">
              Popular Events
            </h2>
            <p className="text-sm text-muted-foreground">
              {activeFilter ?? "Everywhere"}
            </p>
          </div>
          <span className="text-sm text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? "event" : "events"}
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
            <p className="font-display font-semibold">No events here yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Be the first to host one.
            </p>
            <Link
              href="/events/create"
              className={cn(buttonVariants({ variant: "gradient" }), "mt-4")}
            >
              <CalendarPlus className="size-4" /> Create event
            </Link>
          </div>
        ) : (
          <div className="mt-5 grid gap-x-8 gap-y-1 sm:grid-cols-2">
            {filtered.map((event) => (
              <EventRow key={event.id} event={event} />
            ))}
          </div>
        )}
      </section>

      {/* Browse by category */}
      {categories.length > 0 && (
        <section className="mt-14">
          <h2 className="font-display text-xl font-bold tracking-tight">
            Browse by Category
          </h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map(([kind, count]) => {
              const Icon = categoryIcon(kind);
              return (
                <Link
                  key={kind}
                  href={`/events?category=${encodeURIComponent(kind)}`}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition hover:border-[var(--brand)] hover:card-glow"
                >
                  <span className="flex size-10 items-center justify-center rounded-xl bg-[color-mix(in_oklab,var(--brand)_14%,transparent)] text-[var(--brand-deep)] dark:text-[var(--brand)]">
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-display font-semibold">{kind}</p>
                    <p className="text-xs text-muted-foreground">
                      {count} {count === 1 ? "Event" : "Events"}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Featured chains (Luma "Featured Calendars" analog) */}
      <section className="mt-14">
        <h2 className="font-display text-xl font-bold tracking-tight">
          Featured Chains
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Rep a chain or product and play head-to-head for it.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {FEATURED_SPONSORS.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4"
            >
              <span
                className="flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                style={{ backgroundColor: s.brandColor }}
              >
                {s.name.charAt(0)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-display font-semibold">{s.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {s.tagline}
                </p>
              </div>
              <Link
                href={`/play/67?rep=${s.id}`}
                className="shrink-0 rounded-full border border-border bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground transition hover:bg-accent"
              >
                Rep
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Explore local events */}
      {cities.length > 0 && (
        <section className="mt-14">
          <h2 className="font-display text-xl font-bold tracking-tight">
            Explore Local Events
          </h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cities.map(([name, count]) => {
              const online = name === "Online";
              return (
                <Link
                  key={name}
                  href={`/events?city=${encodeURIComponent(name)}`}
                  className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 transition hover:border-[var(--brand)] hover:card-glow"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                      {online ? (
                        <Globe className="size-5" />
                      ) : (
                        <MapPin className="size-5" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-display font-semibold">
                        {name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {count} {count === 1 ? "Event" : "Events"}
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="size-4 text-muted-foreground" />
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
