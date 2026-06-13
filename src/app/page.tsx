import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { EVENTS, FEATURED_EVENT } from "@/lib/mock/events";
import { GAMES } from "@/lib/mock/games";
import { Hero } from "@/components/hero";
import { HowItWorks } from "@/components/how-it-works";
import { WhyPlayce } from "@/components/why-playce";
import { GamesHub } from "@/components/games-hub";
import { AirdropsList } from "@/components/airdrops-list";
import { EventCard } from "@/components/event-card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function HomePage() {
  return (
    <>
      <Hero event={FEATURED_EVENT} />

      {/* Featured venues */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--brand)]">Featured</p>
            <h2 className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl">
              Venues on Playce
            </h2>
          </div>
          <Link
            href={`/event/${FEATURED_EVENT.slug}`}
            className="hidden text-sm font-medium text-primary hover:underline sm:inline"
          >
            View all
          </Link>
        </div>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {EVENTS.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
          <Link
            href={`/event/${FEATURED_EVENT.slug}`}
            className="flex min-h-[260px] flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card/40 p-6 text-center transition hover:bg-card"
          >
            <p className="font-display font-semibold">Hosting a venue?</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Turn your event into a play-and-earn arena.
            </p>
            <span className="mt-3 text-sm font-medium text-primary">
              Get started →
            </span>
          </Link>
        </div>
      </section>

      <GamesHub
        games={GAMES}
        title="Pick a game"
        subtitle="Head-to-head, staked, and skinned with your favorite chain."
      />

      <HowItWorks />

      <AirdropsList airdrops={FEATURED_EVENT.airdrops} />

      <WhyPlayce />

      {/* Closing CTA */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-border p-10 text-center sm:p-16">
          <div
            className="pointer-events-none absolute inset-0 -z-10 opacity-80"
            style={{
              background:
                "radial-gradient(60% 80% at 50% 0%, color-mix(in oklab, var(--brand) 28%, transparent), transparent 65%)",
            }}
          />
          <h2 className="font-display text-3xl font-bold tracking-tight text-balance sm:text-5xl">
            <span className="aurora-text">Show up. Play. Earn.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Check in at the venue, throw the 67, rep your chain, and walk away
            with onchain rewards and sponsor airdrops.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/play/67"
              className={cn(buttonVariants({ variant: "gradient", size: "lg" }))}
            >
              Play the 67
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href={`/event/${FEATURED_EVENT.slug}`}
              className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
            >
              Explore the venue
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
