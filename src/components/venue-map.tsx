import { MapPin, Navigation } from "lucide-react";
import type { Venue } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

/**
 * Stylized venue + geofence visualization. Avoids external map API keys for the
 * MVP while still communicating "geofenced eligibility". Swap for a real map
 * (Mapbox/Google) by replacing the inner panel.
 */
export function VenueMap({ venue }: { venue: Venue }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border">
      <div className="relative h-52 bg-[linear-gradient(135deg,color-mix(in_oklab,var(--brand)_10%,var(--muted)),var(--muted))]">
        {/* Grid streets */}
        <div className="absolute inset-0 opacity-60 [background-image:linear-gradient(var(--border)_1px,transparent_1px),linear-gradient(90deg,var(--border)_1px,transparent_1px)] [background-size:34px_34px]" />
        <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(115deg,transparent_46%,color-mix(in_oklab,var(--brand)_35%,transparent)_47%,color-mix(in_oklab,var(--brand)_35%,transparent)_53%,transparent_54%)]" />

        {/* Geofence radius */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="relative flex items-center justify-center">
            <span className="absolute size-36 rounded-full border border-[color-mix(in_oklab,var(--brand)_50%,transparent)] bg-[color-mix(in_oklab,var(--brand)_12%,transparent)]" />
            <span className="absolute size-36 animate-ping rounded-full border border-[color-mix(in_oklab,var(--brand)_40%,transparent)] [animation-duration:3s]" />
            <span className="relative flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
              <MapPin className="size-5" />
            </span>
          </div>
        </div>

        <Badge
          variant="brand"
          className="absolute left-3 top-3"
        >
          <Navigation className="size-3" />
          {venue.radiusMeters}m geofence
        </Badge>
      </div>

      <div className="flex items-start justify-between gap-3 bg-card p-4">
        <div>
          <p className="font-medium">{venue.name}</p>
          <p className="text-sm text-muted-foreground">
            {venue.addressLine}, {venue.city}, {venue.country}
          </p>
        </div>
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${venue.center.lat},${venue.center.lng}`}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 text-sm font-medium text-primary hover:underline"
        >
          Directions
        </a>
      </div>
    </div>
  );
}
