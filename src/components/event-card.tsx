import Link from "next/link";
import Image from "next/image";
import { CalendarDays, MapPin, ArrowUpRight } from "lucide-react";
import type { PlaycesEvent } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { formatDateRange } from "@/lib/utils";

export function EventCard({ event }: { event: PlaycesEvent }) {
  return (
    <Link
      href={`/event/${event.slug}`}
      className="group block overflow-hidden rounded-3xl border border-border bg-card transition-all hover:-translate-y-1 hover:card-glow"
    >
      <div
        className="relative h-36"
        style={{
          background: `linear-gradient(120deg, ${event.coverImageColor}, var(--brand-deep))`,
        }}
      >
        {event.coverImageUrl ? (
          <>
            <Image
              src={event.coverImageUrl}
              alt={event.title}
              fill
              sizes="(max-width: 768px) 100vw, 400px"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          </>
        ) : (
          <div className="absolute inset-0 opacity-25 [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:20px_20px]" />
        )}
        <span className="absolute right-3 top-3 inline-flex size-8 items-center justify-center rounded-full bg-black/25 text-white opacity-0 transition group-hover:opacity-100">
          <ArrowUpRight className="size-4" />
        </span>
      </div>
      <div className="p-5">
        <div className="flex items-center gap-2">
          <Badge variant="brand">{event.kind}</Badge>
          <span className="text-xs text-muted-foreground">
            {event.claimCount} claimed
          </span>
        </div>
        <h3 className="mt-3 font-display text-lg font-semibold tracking-tight">
          {event.title}
        </h3>
        <div className="mt-2 space-y-1.5 text-sm text-muted-foreground">
          <p className="inline-flex items-center gap-2">
            <CalendarDays className="size-3.5" />
            {formatDateRange(event.startISO, event.endISO, event.timezone)}
          </p>
          <p className="inline-flex items-center gap-2">
            <MapPin className="size-3.5" />
            {event.venue.city}, {event.venue.country}
          </p>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <div className="flex -space-x-2">
            {event.hosts.slice(0, 3).map((h) => (
              <Avatar key={h.id} name={h.name} className="size-6 ring-2 ring-card" />
            ))}
          </div>
          <span className="text-xs text-muted-foreground">
            {event.hosts[0]?.name}
          </span>
        </div>
      </div>
    </Link>
  );
}
