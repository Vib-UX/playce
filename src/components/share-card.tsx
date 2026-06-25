"use client";

import { useState } from "react";
import { Check, Link2, Share2 } from "lucide-react";
import type { Claim } from "@/lib/types";
import { Button } from "@/components/ui/button";

export function ShareCard({ claim }: { claim: Claim }) {
  const [copied, setCopied] = useState(false);

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/collectible/${claim.metadata.tokenId}`
      : "";

  const copy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const nativeShare = async () => {
    const text = `I showed up and played at ${claim.eventTitle} — earned onchain on Playces.`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Playces", text, url: shareUrl });
      } catch {
        /* user cancelled */
      }
    } else {
      copy();
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-sm font-medium">Share this moment</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Showcase your collectible memory and prove you were there.
      </p>
      <div className="mt-3 flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={copy}>
          {copied ? (
            <>
              <Check className="size-4 text-[var(--success)]" />
              Copied
            </>
          ) : (
            <>
              <Link2 className="size-4" />
              Copy link
            </>
          )}
        </Button>
        <Button variant="gradient" size="sm" className="flex-1" onClick={nativeShare}>
          <Share2 className="size-4" />
          Share
        </Button>
      </div>
    </div>
  );
}
