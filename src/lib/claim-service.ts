"use client";

import type { PlaycesEvent, Claim, MintStatus, PinnedImage } from "@/lib/types";
import { sleep } from "@/lib/utils";

interface ClaimArgs {
  event: PlaycesEvent;
  wallet: string;
  email?: string;
  coords?: { lat: number; lng: number };
  /** The captured "moment" photo pinned to IPFS, used as the NFT image. */
  capturedImage?: PinnedImage;
  getAccessToken: () => Promise<string | null>;
  onProgress?: (phase: Exclude<MintStatus, "idle" | "success" | "error">) => void;
}

/**
 * Drives the claim against the backend (/api/claim), which verifies eligibility
 * and mints the POAP to the user's wallet (gasless). Falls back to a mock mint
 * server-side when no contract is configured. The progress phases mirror a real
 * sign → submit → confirm sequence for the UI.
 */
export async function claimMoment({
  event,
  wallet,
  email,
  coords,
  capturedImage,
  getAccessToken,
  onProgress,
}: ClaimArgs): Promise<Claim> {
  onProgress?.("preparing");
  const accessToken = await getAccessToken().catch(() => null);

  onProgress?.("signing");
  await sleep(300);

  onProgress?.("submitting");
  const res = await fetch("/api/claim", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      slug: event.slug,
      address: wallet,
      email,
      coords,
      accessToken,
      imageIpfsUri: capturedImage?.ipfsUri,
      imageGatewayUrl: capturedImage?.gatewayUrl,
      imageMediaType: capturedImage?.mediaType ?? "image",
    }),
  });

  onProgress?.("confirming");

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "Claim failed");
  }

  const data = (await res.json()) as { claim: Claim };
  return data.claim;
}
