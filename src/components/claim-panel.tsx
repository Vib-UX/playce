"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { PartyPopper, Sparkles, Lock, Ticket, Camera } from "lucide-react";
import type { PlaycesEvent, Claim, MintStatus, PinnedImage } from "@/lib/types";
import { usePlaycesAuth } from "@/lib/auth/context";
import { usePlaycesStore } from "@/lib/store";
import { useGeofence } from "@/hooks/use-geofence";
import { checkWhitelist } from "@/lib/mock/whitelist";
import { claimMoment } from "@/lib/claim-service";
import { ALLOW_MULTIPLE_CLAIMS } from "@/lib/config";
import { ACTIVE_CHAIN } from "@/lib/chain";
import {
  EligibilityChecklist,
  type CheckState,
  type EligibilityItem,
} from "@/components/eligibility-checklist";
import { GeoFenceStatus } from "@/components/geo-fence-status";
import { EmbeddedWalletCard } from "@/components/embedded-wallet-card";
import { MintProgress } from "@/components/mint-progress";
import { PrivyAuthButton } from "@/components/privy-auth-button";
import { ClaimSuccessModal } from "@/components/claim-success-modal";
import { CaptureMoment } from "@/components/capture-moment";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function ClaimPanel({ event }: { event: PlaycesEvent }) {
  const { authenticated, email, wallet, ready, getAccessToken } = usePlaycesAuth();
  const claims = usePlaycesStore((s) => s.claims);
  const addClaim = usePlaycesStore((s) => s.addClaim);

  const geo = useGeofence(event.venue);
  const [whitelist, setWhitelist] = useState<CheckState>("pending");
  const [mintStatus, setMintStatus] = useState<MintStatus>("idle");
  const [successOpen, setSuccessOpen] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [lastClaim, setLastClaim] = useState<Claim | null>(null);

  const existingClaim = claims.find((c) => c.eventId === event.id);
  const alreadyClaimed = Boolean(existingClaim);
  // In testing mode a wallet may re-claim, so a prior claim never blocks.
  const claimBlocked = alreadyClaimed && !ALLOW_MULTIPLE_CLAIMS;

  // Run whitelist / email-verification check once signed in.
  useEffect(() => {
    let cancelled = false;
    if (authenticated) {
      setWhitelist("checking");
      checkWhitelist(email).then((res) => {
        if (!cancelled) setWhitelist(res.whitelisted ? "pass" : "fail");
      });
    } else {
      setWhitelist("pending");
    }
    return () => {
      cancelled = true;
    };
  }, [authenticated, email]);

  const items: EligibilityItem[] = useMemo(() => {
    const geoState: CheckState =
      geo.status === "inside"
        ? "pass"
        : geo.status === "requesting"
          ? "checking"
          : geo.status === "outside" ||
              geo.status === "denied" ||
              geo.status === "unavailable"
            ? "fail"
            : "pending";

    return [
      {
        key: "email",
        label: "Email verified",
        description: authenticated
          ? `Signed in as ${email ?? "your account"}`
          : "Sign in with email to continue",
        state: authenticated ? "pass" : "pending",
      },
      {
        key: "geo",
        label: "Inside the event zone",
        description: "Geofenced to the venue at claim time",
        state: geoState,
      },
      {
        key: "whitelist",
        label: "On the guest list",
        description: "Verified against the event RSVP list",
        state: whitelist,
      },
      {
        key: "claimed",
        label: ALLOW_MULTIPLE_CLAIMS ? "Ready to claim" : "Not yet claimed",
        description: ALLOW_MULTIPLE_CLAIMS
          ? "Testing mode — multiple claims allowed"
          : alreadyClaimed
            ? "You've already claimed this moment"
            : "One collectible per attendee",
        state: claimBlocked ? "fail" : authenticated ? "pass" : "pending",
      },
    ];
  }, [authenticated, email, geo.status, whitelist, alreadyClaimed, claimBlocked]);

  const eligible =
    authenticated &&
    geo.status === "inside" &&
    whitelist === "pass" &&
    !claimBlocked;

  const minting =
    mintStatus !== "idle" &&
    mintStatus !== "success" &&
    mintStatus !== "error";

  const handleClaim = async (capturedImage?: PinnedImage) => {
    if (!eligible || !wallet) return;
    setCaptureOpen(false);
    setMintStatus("preparing");
    try {
      const claim = await claimMoment({
        event,
        wallet,
        email,
        coords: geo.coords,
        capturedImage,
        getAccessToken,
        onProgress: (phase) => setMintStatus(phase),
      });
      setMintStatus("success");
      addClaim(claim);
      setLastClaim(claim);
      setSuccessOpen(true);
    } catch {
      setMintStatus("error");
    }
  };

  return (
    <div className="rounded-3xl border border-border bg-card p-5 card-glow sm:p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
            <Ticket className="size-4" />
          </span>
          <div>
            <p className="font-display font-semibold leading-none">Check in &amp; earn</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Be there, play, earn
            </p>
          </div>
        </div>
        <Badge variant="brand">
          <Sparkles className="size-3" />
          Onchain reward
        </Badge>
      </div>

      {/* Already claimed state */}
      {claimBlocked && existingClaim ? (
        <div className="mt-5 rounded-2xl border border-[color-mix(in_oklab,var(--success)_40%,transparent)] bg-[color-mix(in_oklab,var(--success)_7%,transparent)] p-4 text-center">
          <PartyPopper className="mx-auto size-6 text-[var(--success)]" />
          <p className="mt-2 font-medium">You earned this moment</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Your reward is minted onchain.
          </p>
          <a
            href={`/collectible/${existingClaim.metadata.tokenId}`}
            className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
          >
            View your collectible →
          </a>
        </div>
      ) : (
        <>
          {/* Step 1: auth */}
          {!authenticated ? (
            <div className="mt-5">
              <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-5 text-center">
                <Lock className="mx-auto size-5 text-muted-foreground" />
                <p className="mt-2 text-sm font-medium">Sign in to begin</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Continue with email or Google — an embedded wallet is created
                  instantly. No seed phrases.
                </p>
                <PrivyAuthButton
                  className="mt-4 w-full"
                  size="lg"
                  label="Sign in to check in"
                  disabled={!ready}
                />
              </div>
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              <EmbeddedWalletCard />
              <GeoFenceStatus
                status={geo.status}
                distanceMeters={geo.distanceMeters}
                error={geo.error}
                venue={event.venue}
                onRequest={geo.request}
              />
            </div>
          )}

          {/* Eligibility */}
          <div className="mt-5">
            <p className="mb-1.5 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Eligibility
            </p>
            <EligibilityChecklist items={items} />
          </div>

          {/* Mint progress / CTA */}
          {minting ? (
            <div className="mt-5 rounded-2xl border border-border bg-muted/30 p-4">
              <MintProgress status={mintStatus} />
            </div>
          ) : (
            <motion.div layout className="mt-5">
              <Button
                variant="gradient"
                size="lg"
                className="w-full"
                disabled={!eligible}
                onClick={() => setCaptureOpen(true)}
              >
                {eligible ? <Camera className="size-4" /> : <Sparkles className="size-4" />}
                {eligible ? "Capture your moment" : "Complete steps to check in"}
              </Button>
              {mintStatus === "error" && (
                <p className="mt-2 text-center text-sm text-[var(--destructive)]">
                  Something went wrong. Please try again.
                </p>
              )}
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Gas sponsored on {ACTIVE_CHAIN.name} · proof you were there
              </p>
            </motion.div>
          )}
        </>
      )}

      <CaptureMoment
        open={captureOpen}
        onClose={() => setCaptureOpen(false)}
        art={event.collectible.art}
        eventTitle={event.title}
        modelUrls={event.collectible.arModelUrls}
        defaultFacing="user"
        onContinue={handleClaim}
      />

      <ClaimSuccessModal
        open={successOpen}
        onClose={() => setSuccessOpen(false)}
        claim={lastClaim}
      />
    </div>
  );
}
