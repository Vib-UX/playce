"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, ImageOff, Loader2, Sparkles } from "lucide-react";
import type { Claim } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { buttonVariants } from "@/components/ui/button";
import { cn, shortenAddress } from "@/lib/utils";

export function ClaimSuccessModal({
  open,
  onClose,
  claim,
}: {
  open: boolean;
  onClose: () => void;
  claim: Claim | null;
}) {
  const [reveal, setReveal] = useState(false);
  const [imgStatus, setImgStatus] = useState<"loading" | "loaded" | "error">(
    "loading",
  );
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => setReveal(true), 250);
      return () => clearTimeout(t);
    }
    setReveal(false);
  }, [open]);

  // Reset the media loading state whenever the moment changes; surface cached
  // images immediately so the spinner doesn't flash.
  const mediaSrc = claim?.metadata.animationUrl ?? claim?.metadata.image;
  useEffect(() => {
    setImgStatus(imgRef.current?.complete ? "loaded" : "loading");
  }, [mediaSrc]);

  if (!claim) return null;

  return (
    <Modal open={open} onClose={onClose} className="max-w-md">
      <div className="relative">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-48"
          style={{
            background: `radial-gradient(70% 100% at 50% 0%, hsl(${claim.art.hue} 85% 60% / 0.35), transparent 70%)`,
          }}
        />
        <div className="relative px-6 pt-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_oklab,var(--brand)_16%,transparent)] px-3 py-1 text-xs font-medium text-[var(--brand-deep)] dark:text-[var(--brand)]"
          >
            <Sparkles className="size-3.5" />
            Claimed onchain
          </motion.div>

          {/* The captured moment pinned to IPFS (already composited with the
              collectible). Falls back to the generated collectible artwork when
              the attendee claimed without a photo. */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={reveal ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="relative mx-auto mt-3 flex aspect-[4/5] w-full max-w-[230px] items-center justify-center overflow-hidden rounded-2xl border border-border/60 bg-muted/40 p-1.5 shadow-lg"
          >
            {imgStatus === "loading" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="size-6 animate-spin" />
                <span className="text-[11px] font-medium">
                  Loading your moment…
                </span>
              </div>
            )}
            {imgStatus === "error" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <ImageOff className="size-6" />
                <span className="text-[11px] font-medium">
                  Pinning to IPFS…
                </span>
              </div>
            )}
            {claim.metadata.animationUrl ? (
              <video
                src={claim.metadata.animationUrl}
                autoPlay
                loop
                muted
                playsInline
                onLoadedData={() => setImgStatus("loaded")}
                onError={() => setImgStatus("error")}
                className={cn(
                  "block max-h-full w-auto rounded-xl object-contain transition-opacity duration-300",
                  imgStatus === "loaded" ? "opacity-100" : "opacity-0",
                )}
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                ref={imgRef}
                src={claim.metadata.image}
                alt={`Your captured moment at ${claim.eventTitle}`}
                onLoad={() => setImgStatus("loaded")}
                onError={() => setImgStatus("error")}
                className={cn(
                  "block max-h-full w-auto rounded-xl object-contain transition-opacity duration-300",
                  imgStatus === "loaded" ? "opacity-100" : "opacity-0",
                )}
              />
            )}
            {imgStatus === "loaded" && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-1 bg-gradient-to-t from-black/55 to-transparent px-2.5 pb-2 pt-6">
                <Sparkles className="size-3 text-white/90" />
                <span className="text-[10px] font-medium text-white/90">
                  You were there
                </span>
              </div>
            )}
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="aurora-text font-display text-2xl font-bold"
          >
            You earned it.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.45 }}
            className="mx-auto mt-1.5 max-w-xs text-sm text-muted-foreground"
          >
            Your reward from{" "}
            <span className="font-medium text-foreground">{claim.eventTitle}</span>{" "}
            is now a verified onchain moment.
          </motion.p>
        </div>

        <div className="mt-6 space-y-3 px-6 pb-7">
          <div className="rounded-2xl border border-border bg-muted/40 p-3 text-left text-xs">
            <div className="flex items-center justify-between py-1">
              <span className="text-muted-foreground">Token</span>
              <span className="font-mono">#{claim.metadata.tokenId}</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-muted-foreground">Wallet</span>
              <span className="font-mono">{shortenAddress(claim.wallet)}</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-muted-foreground">Transaction</span>
              <a
                href={claim.blockExplorerUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-mono text-primary hover:underline"
              >
                {shortenAddress(claim.txHash)}
                <ArrowUpRight className="size-3" />
              </a>
            </div>
          </div>

          <div className="flex gap-2">
            <Link
              href="/profile"
              onClick={onClose}
              className={buttonVariants({ variant: "outline", className: "flex-1" })}
            >
              Done
            </Link>
            <Link
              href={`/collectible/${claim.metadata.tokenId}`}
              className={buttonVariants({ variant: "gradient", className: "flex-1" })}
            >
              View collectible
            </Link>
          </div>
        </div>
      </div>
    </Modal>
  );
}
