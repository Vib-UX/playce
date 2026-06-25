"use client";

import Link from "next/link";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Hero() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="relative flex min-h-[calc(100svh-4rem)] items-center overflow-hidden">
      {/* Ambient aurora background — subtle, plenty of negative space */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 left-1/4 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--brand)_22%,transparent),transparent)] blur-3xl opacity-45" />
      </div>

      <div className="mx-auto grid w-full max-w-7xl items-center gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:gap-8 lg:px-8 lg:py-24">
        {/* Copy */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="max-w-xl"
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="size-3.5 text-[var(--brand)]" />
            Play-and-earn events, online or at the venue
          </span>

          <h1 className="mt-7 font-display text-6xl font-bold leading-[0.95] tracking-tight text-balance sm:text-7xl">
            Show up. Play.
            <br />
            <span className="aurora-text">Earn.</span>
          </h1>

          <p className="mt-7 max-w-md text-lg text-muted-foreground text-balance">
            Set up an event page, invite friends, and play head-to-head. Host a
            memorable event today.
          </p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/events/create"
              className={cn(buttonVariants({ variant: "gradient", size: "lg" }))}
            >
              Create your first event
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/events"
              className={cn(buttonVariants({ variant: "ghost", size: "lg" }))}
            >
              Discover events
            </Link>
          </div>
        </motion.div>

        {/* Floating 3D asset — circular window into the scene (dark theme) */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
          className="relative mx-auto hidden aspect-square w-full max-w-[540px] lg:block"
        >
          {/* Ambient glow behind the disc */}
          <div className="pointer-events-none absolute -inset-4 -z-10 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--brand)_36%,transparent),transparent)] blur-2xl opacity-60" />

          <motion.div
            animate={reduceMotion ? undefined : { y: [0, -14, 0] }}
            transition={{ duration: 6, ease: "easeInOut", repeat: Infinity }}
            className="relative size-full"
          >
            <div className="relative size-full overflow-hidden rounded-full ring-1 ring-white/10 shadow-[0_30px_90px_-20px_color-mix(in_oklab,var(--brand)_45%,transparent)]">
              {reduceMotion ? (
                <Image
                  src="/hero_sq_poster.png"
                  alt="A Playces game event on a phone, surrounded by dice, a chess knight, an onchain coin and a location pin"
                  width={1280}
                  height={720}
                  priority
                  className="absolute inset-0 size-full select-none object-cover"
                />
              ) : (
                <video
                  src="/hero_sq.mp4"
                  autoPlay
                  muted
                  loop
                  playsInline
                  aria-hidden
                  className="absolute inset-0 size-full select-none object-cover"
                />
              )}

              {/* Soft rim so the circle edge blends into the page */}
              <div className="pointer-events-none absolute inset-0 rounded-full shadow-[inset_0_0_60px_16px_rgba(6,5,12,0.7)]" />
              <div className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-[color-mix(in_oklab,var(--brand)_28%,transparent)]" />
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
