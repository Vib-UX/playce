"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Ticket } from "lucide-react";
import type { Claim } from "@/lib/types";
import { CollectibleTile } from "@/components/collectible-tile";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AttendanceGallery({ claims }: { claims: Claim[] }) {
  if (claims.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-card/40 p-12 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground">
          <Ticket className="size-6" />
        </span>
        <h3 className="mt-4 font-display text-lg font-semibold">
          No moments yet
        </h3>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          Check in at a Playces venue, play a game, and earn your first onchain
          reward. Your collected moments will live here.
        </p>
        <Link
          href="/claim"
          className={cn(buttonVariants({ variant: "gradient", className: "mt-5" }))}
        >
          Check in &amp; earn
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {claims.map((claim, i) => (
        <motion.div
          key={claim.id}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
        >
          <Link
            href={`/collectible/${claim.metadata.tokenId}`}
            className="group block overflow-hidden rounded-2xl border border-border bg-card transition-all hover:-translate-y-1 hover:card-glow"
          >
            <CollectibleTile art={claim.art} className="rounded-none" />
            <div className="p-3">
              <p className="truncate text-sm font-medium">{claim.eventTitle}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                #{claim.metadata.tokenId} ·{" "}
                {new Date(claim.claimedAtISO).toLocaleDateString()}
              </p>
            </div>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}
