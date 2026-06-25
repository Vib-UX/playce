import Link from "next/link";
import Image from "next/image";
import type { PlaycesEvent } from "@/lib/types";
import { formatTime } from "@/lib/utils";

/** Compact Luma-style discover row: thumbnail + date + title + venue. */
export function EventRow({ event }: { event: PlaycesEvent }) {
  const start = new Date(event.startISO);
  const dateLabel = start.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: event.timezone,
  });
  const timeLabel = formatTime(event.startISO, event.timezone);
  const isOnline = !event.venue.center.lat && !event.venue.center.lng;
  const place = isOnline
    ? "Online"
    : event.venue.name
      ? `${event.venue.name}`
      : event.venue.city;

  return (
    <Link
      href={`/event/${event.slug}`}
      className="group flex items-start gap-4 rounded-2xl p-2 transition hover:bg-card"
    >
      <div
        className="relative size-16 shrink-0 overflow-hidden rounded-xl sm:size-[72px]"
        style={{
          background: `linear-gradient(135deg, ${event.coverImageColor}, var(--brand-deep))`,
        }}
      >
        {event.coverImageUrl ? (
          <Image
            src={event.coverImageUrl}
            alt={event.title}
            fill
            sizes="72px"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:14px_14px]" />
        )}
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-xs font-medium text-muted-foreground">
          {dateLabel} · {timeLabel}
        </p>
        <h3 className="mt-1 truncate font-display font-semibold text-foreground group-hover:text-[var(--brand)]">
          {event.title}
        </h3>
        <p className="mt-0.5 truncate text-sm text-muted-foreground">{place}</p>
      </div>
    </Link>
  );
}
