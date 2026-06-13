import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, MapPin } from "lucide-react";
import { getEventBySlug, FEATURED_EVENT } from "@/lib/mock/events";
import { Collectible3DViewer } from "@/components/collectible-3d-viewer";
import { ClaimPanel } from "@/components/claim-panel";
import { Badge } from "@/components/ui/badge";
import { formatDateRange } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Check in & earn",
  description: "Be there, play, earn. Check in and collect an onchain reward on Base.",
};

export default async function ClaimPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string }>;
}) {
  const { event: slug } = await searchParams;
  const event = (slug && getEventBySlug(slug)) || FEATURED_EVENT;

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-96 bg-[radial-gradient(60%_60%_at_50%_0%,color-mix(in_oklab,var(--brand)_22%,transparent),transparent)]" />

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="text-center">
          <Badge variant="brand" className="mx-auto">
            Show up. Play. Earn.
          </Badge>
          <h1 className="mt-4 font-display text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            <span className="aurora-text">Earn your moment onchain.</span>
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Be there, play head-to-head, and collect a reward — proof you showed
            up, earned onchain on Base.
          </p>
        </div>

        <div className="mt-12 grid items-start gap-10 lg:grid-cols-2">
          {/* Collectible preview */}
          <div className="lg:sticky lg:top-20">
            <Collectible3DViewer
              art={event.collectible.art}
              className="mx-auto max-w-md"
            />
            <div className="mx-auto mt-4 max-w-md rounded-2xl border border-border bg-card p-5">
              <Link
                href={`/event/${event.slug}`}
                className="font-display text-lg font-semibold hover:underline"
              >
                {event.title}
              </Link>
              <div className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                <p className="inline-flex items-center gap-2">
                  <CalendarDays className="size-4" />
                  {formatDateRange(event.startISO, event.endISO)}
                </p>
                <p className="inline-flex items-center gap-2">
                  <MapPin className="size-4" />
                  {event.venue.name}, {event.venue.city}
                </p>
              </div>
              <p className="mt-4 border-t border-border pt-4 text-sm text-muted-foreground">
                {event.collectible.description}
              </p>
            </div>
          </div>

          {/* Claim flow */}
          <div className="mx-auto w-full max-w-md lg:mx-0">
            <ClaimPanel event={event} />
          </div>
        </div>
      </div>
    </div>
  );
}
