"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { CalendarDays, MapPin, ArrowRight } from "lucide-react";
import type { PlayceEvent } from "@/lib/types";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { formatDateRange } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function EventHero({ event }: { event: PlayceEvent }) {
  return (
    <section className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-70"
        style={{
          background: `radial-gradient(60% 50% at 20% 0%, ${event.coverImageColor}33, transparent 60%), radial-gradient(50% 50% at 90% 10%, var(--brand)22, transparent 55%)`,
        }}
      />
      <div className="mx-auto max-w-7xl px-4 pb-10 pt-10 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-3xl border border-border"
        >
          {/* Cover band */}
          <div
            className="relative h-44 sm:h-56"
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
                  priority
                  sizes="(max-width: 1024px) 100vw, 1024px"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
              </>
            ) : (
              <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:22px_22px]" />
            )}
            <div className="absolute bottom-4 left-4 flex flex-wrap items-center gap-2 sm:left-6">
              <Badge variant="outline" className="border-white/30 bg-black/20 text-white">
                {event.kind}
              </Badge>
              <Badge variant="outline" className="border-white/30 bg-black/20 text-white">
                Play &amp; earn
              </Badge>
            </div>
          </div>

          <div className="bg-card p-5 sm:p-8">
            <h1 className="font-display text-3xl font-bold tracking-tight text-balance sm:text-4xl">
              {event.title}
            </h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">{event.tagline}</p>

            <div className="mt-5 flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:gap-6">
              <span className="inline-flex items-center gap-2">
                <CalendarDays className="size-4 text-muted-foreground" />
                {formatDateRange(event.startISO, event.endISO, event.timezone)}
              </span>
              <span className="inline-flex items-center gap-2">
                <MapPin className="size-4 text-muted-foreground" />
                {event.venue.name}, {event.venue.city}
              </span>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2">
                  {event.hosts.map((h) => (
                    <Avatar
                      key={h.id}
                      name={h.name}
                      className="size-8 ring-2 ring-card"
                    />
                  ))}
                </div>
                <span className="text-sm text-muted-foreground">
                  Hosted by{" "}
                  <span className="font-medium text-foreground">
                    {event.hosts[0]?.name}
                  </span>
                  {event.hosts.length > 1 && ` +${event.hosts.length - 1}`}
                </span>
              </div>

              <Link
                href="/claim"
                className={cn(buttonVariants({ variant: "gradient" }))}
              >
                Check in &amp; earn
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
