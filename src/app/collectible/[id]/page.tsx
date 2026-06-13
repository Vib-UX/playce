"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, BadgeCheck, CalendarDays } from "lucide-react";
import { usePlayceStore } from "@/lib/store";
import { getEventBySlug } from "@/lib/mock/events";
import { Collectible3DViewer } from "@/components/collectible-3d-viewer";
import { ShareCard } from "@/components/share-card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { shortenAddress, cn } from "@/lib/utils";

export default function CollectiblePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const claims = usePlayceStore((s) => s.claims);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const claim = claims.find((c) => c.metadata.tokenId === id);
  // The event's Blitz collectible model (the plush is listed last) rotates over
  // the captured moment on the hero.
  const heroModelUrl = claim
    ? (getEventBySlug(claim.eventSlug)?.collectible.arModelUrls?.at(-1) ??
      claim.art.modelUrl)
    : undefined;

  if (!mounted) {
    return (
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:px-8">
        <Skeleton className="mx-auto aspect-[4/5] w-full max-w-sm rounded-3xl" />
        <div className="space-y-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!claim) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="font-display text-2xl font-bold">Moment not found</h1>
        <p className="mt-2 text-muted-foreground">
          This moment isn&apos;t in your gallery yet. Check in and play to earn
          it onchain.
        </p>
        <Link
          href="/claim"
          className={cn(buttonVariants({ variant: "gradient", className: "mt-6" }))}
        >
          Check in &amp; earn
        </Link>
      </div>
    );
  }

  return (
    <div className="relative">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-96"
        style={{
          background: `radial-gradient(60% 60% at 50% 0%, hsl(${claim.art.hue} 80% 55% / 0.22), transparent 65%)`,
        }}
      />
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:px-8">
        {/* 3D hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="min-w-0 lg:sticky lg:top-20 lg:self-start"
        >
          <Collectible3DViewer
            art={claim.art}
            imageUrl={claim.metadata.image}
            videoUrl={claim.metadata.animationUrl}
            modelUrl={heroModelUrl}
            modelScale={0.6}
            hint={false}
            className="mx-auto aspect-[4/5] max-w-sm"
          />
        </motion.div>

        {/* Metadata */}
        <div className="min-w-0">
          <Badge variant="success">
            <BadgeCheck className="size-3.5" />
            Verified onchain
          </Badge>
          <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-balance">
            {claim.metadata.name}
          </h1>
          <p className="mt-2 text-muted-foreground">{claim.metadata.description}</p>

          <p className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarDays className="size-4" />
            Claimed{" "}
            {new Date(claim.claimedAtISO).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>

          {/* Attributes */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {claim.metadata.attributes.map((attr) => (
              <div
                key={attr.trait_type}
                className="min-w-0 rounded-xl border border-border bg-card p-3"
              >
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {attr.trait_type}
                </p>
                <p className="mt-0.5 truncate text-sm font-medium">{attr.value}</p>
              </div>
            ))}
          </div>

          {/* Onchain details */}
          <div className="mt-6 rounded-2xl border border-border bg-card p-4 text-sm">
            <div className="flex items-center justify-between gap-3 py-1.5">
              <span className="shrink-0 text-muted-foreground">Token ID</span>
              <span className="font-mono">#{claim.metadata.tokenId}</span>
            </div>
            <div className="flex items-center justify-between gap-3 py-1.5">
              <span className="shrink-0 text-muted-foreground">Owner</span>
              <span className="truncate font-mono">
                {shortenAddress(claim.wallet, 5)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 py-1.5">
              <span className="shrink-0 text-muted-foreground">Metadata</span>
              <span className="min-w-0 truncate font-mono text-xs">
                {claim.metadata.metadataURI}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 py-1.5">
              <span className="shrink-0 text-muted-foreground">Transaction</span>
              <a
                href={claim.blockExplorerUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-w-0 items-center gap-1 font-mono text-primary hover:underline"
              >
                <span className="truncate">{shortenAddress(claim.txHash)}</span>
                <ArrowUpRight className="size-3.5 shrink-0" />
              </a>
            </div>
          </div>

          <div className="mt-5">
            <ShareCard claim={claim} />
          </div>

          <div className="mt-5 flex gap-3">
            <Link
              href={`/event/${claim.eventSlug}`}
              className={cn(buttonVariants({ variant: "outline", className: "flex-1" }))}
            >
              View event
            </Link>
            <Link
              href="/profile"
              className={cn(buttonVariants({ variant: "secondary", className: "flex-1" }))}
            >
              My collectibles
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
