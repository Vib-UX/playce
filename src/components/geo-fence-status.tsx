"use client";

import { motion } from "framer-motion";
import { MapPin, Navigation, ShieldCheck, ShieldAlert, Loader2 } from "lucide-react";
import type { GeoStatus, Venue } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  status: GeoStatus;
  distanceMeters?: number;
  error?: string;
  venue: Venue;
  onRequest: () => void;
}

const COPY: Record<
  GeoStatus,
  { title: string; tone: "idle" | "ok" | "bad" | "pending" }
> = {
  idle: { title: "Verify your presence", tone: "idle" },
  requesting: { title: "Checking your location…", tone: "pending" },
  inside: { title: "You're inside the event zone", tone: "ok" },
  outside: { title: "You're outside the event zone", tone: "bad" },
  denied: { title: "Location access blocked", tone: "bad" },
  unavailable: { title: "Location unavailable", tone: "bad" },
};

export function GeoFenceStatus({
  status,
  distanceMeters,
  error,
  venue,
  onRequest,
}: Props) {
  const copy = COPY[status];

  const ring =
    copy.tone === "ok"
      ? "border-[color-mix(in_oklab,var(--success)_45%,transparent)] bg-[color-mix(in_oklab,var(--success)_8%,transparent)]"
      : copy.tone === "bad"
        ? "border-[color-mix(in_oklab,var(--destructive)_40%,transparent)] bg-[color-mix(in_oklab,var(--destructive)_7%,transparent)]"
        : "border-border bg-muted/40";

  return (
    <div className={cn("rounded-2xl border p-4 transition-colors", ring)}>
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl",
            copy.tone === "ok"
              ? "bg-[color-mix(in_oklab,var(--success)_18%,transparent)] text-[var(--success)]"
              : copy.tone === "bad"
                ? "bg-[color-mix(in_oklab,var(--destructive)_16%,transparent)] text-[var(--destructive)]"
                : "bg-secondary text-secondary-foreground",
          )}
        >
          {status === "requesting" ? (
            <Loader2 className="size-5 animate-spin" />
          ) : copy.tone === "ok" ? (
            <ShieldCheck className="size-5" />
          ) : copy.tone === "bad" ? (
            <ShieldAlert className="size-5" />
          ) : (
            <MapPin className="size-5" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium">{copy.title}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {status === "idle" &&
              `Claims are geofenced to ${venue.name}. Share your location to confirm you're here.`}
            {status === "requesting" && "Pinpointing you within the venue radius…"}
            {status === "inside" &&
              distanceMeters !== undefined &&
              `~${distanceMeters}m from the venue center · within ${venue.radiusMeters}m zone.`}
            {status === "outside" &&
              distanceMeters !== undefined &&
              `~${distanceMeters}m away · you need to be within ${venue.radiusMeters}m.`}
            {(status === "denied" || status === "unavailable") &&
              (error ?? "We couldn't verify your location.")}
          </p>

          {status === "inside" && (
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: "100%" }}
              className="mt-3 h-1 overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--success)_25%,transparent)]"
            >
              <div className="h-full w-full bg-[var(--success)]" />
            </motion.div>
          )}
        </div>
      </div>

      {(status === "idle" ||
        status === "outside" ||
        status === "denied" ||
        status === "unavailable") && (
        <Button
          variant={status === "idle" ? "secondary" : "outline"}
          size="sm"
          className="mt-3 w-full"
          onClick={onRequest}
        >
          <Navigation className="size-4" />
          {status === "idle" ? "Share my location" : "Try again"}
        </Button>
      )}
    </div>
  );
}
