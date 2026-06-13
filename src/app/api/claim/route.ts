import { NextResponse } from "next/server";
import { isAddress, parseEventLogs } from "viem";
import type { Claim, NFTMetadata } from "@/lib/types";
import { getEventBySlug } from "@/lib/mock/events";
import { checkGeofence, DEMO_FORCE_INSIDE_ZONE } from "@/lib/mock/geofence";
import { checkWhitelist } from "@/lib/mock/whitelist";
import { mintReward } from "@/lib/mock/mint";
import { explorerTxUrl } from "@/lib/chain";
import { playceAbi, onchainEventId } from "@/lib/poap-abi";
import { ALLOW_MULTIPLE_CLAIMS } from "@/lib/config";
import {
  ONCHAIN_ENABLED,
  PLAYCE_ADDRESS,
  publicClient,
  getMinterWallet,
} from "@/lib/server/minter";
import { PINATA_ENABLED, pinJSON } from "@/lib/server/pinata";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET ?? "";

interface ClaimBody {
  slug: string;
  address: string;
  email?: string;
  coords?: { lat: number; lng: number };
  accessToken?: string;
  /** Captured "moment" pinned to IPFS (ipfs://… + gateway URL). */
  imageIpfsUri?: string;
  imageGatewayUrl?: string;
  /** Whether the captured moment is a still image or a video clip. */
  imageMediaType?: "image" | "video";
}

async function verifyPrivyToken(accessToken?: string): Promise<boolean> {
  // Only enforce when both Privy server credentials and a token are present.
  if (!PRIVY_APP_ID || !PRIVY_APP_SECRET || !accessToken) return true;
  try {
    const { PrivyClient } = await import("@privy-io/server-auth");
    const privy = new PrivyClient(PRIVY_APP_ID, PRIVY_APP_SECRET);
    await privy.verifyAuthToken(accessToken);
    return true;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  let body: ClaimBody;
  try {
    body = (await req.json()) as ClaimBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const {
    slug,
    address,
    email,
    coords,
    accessToken,
    imageIpfsUri,
    imageGatewayUrl,
    imageMediaType,
  } = body;
  const isVideo = imageMediaType === "video";

  if (!address || !isAddress(address)) {
    return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
  }

  const event = getEventBySlug(slug);
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // 1. Identity
  if (!(await verifyPrivyToken(accessToken))) {
    return NextResponse.json({ error: "Identity verification failed" }, { status: 401 });
  }

  // 2. Geofence — require verified coordinates within the venue radius.
  if (!DEMO_FORCE_INSIDE_ZONE) {
    if (!coords) {
      return NextResponse.json(
        { error: "Location is required to verify your presence" },
        { status: 403 },
      );
    }
    const { inside, distanceMeters } = checkGeofence(
      coords,
      event.venue.center,
      event.venue.radiusMeters,
    );
    if (!inside) {
      return NextResponse.json(
        {
          error: `You're ~${Math.round(distanceMeters)}m away — claims are limited to within ${event.venue.radiusMeters}m of ${event.venue.name}.`,
        },
        { status: 403 },
      );
    }
  }

  // 3. Whitelist / email verification
  const wl = await checkWhitelist(email);
  if (!wl.whitelisted) {
    return NextResponse.json({ error: wl.reason }, { status: 403 });
  }

  const origin = new URL(req.url).origin;

  // Default token metadata: per-event endpoint + generated SVG artwork.
  let tokenURI = `${origin}/api/metadata/${event.slug}`;
  let image = `${origin}/api/collectible/${event.slug}`;
  // Video clips populate the ERC-721 `animation_url` (image stays a poster).
  let animationUrl: string | undefined;

  // When the attendee captured a moment and it was pinned to IPFS, pin a fresh
  // ERC-721 metadata JSON pointing at their media and use it as the tokenURI so
  // the NFT reflects the captured moment (permanently on IPFS).
  if (imageIpfsUri && PINATA_ENABLED) {
    try {
      const metadataJson: Record<string, unknown> = {
        name: event.collectible.name,
        description: event.collectible.description,
        // For a clip, keep the generated artwork as the still poster and add the
        // video as animation_url; for a photo, use it directly as the image.
        image: isVideo ? image : imageIpfsUri,
        external_url: `${origin}/event/${event.slug}`,
        attributes: [
          { trait_type: "Event", value: event.title },
          { trait_type: "Edition", value: event.collectible.art.edition },
          { trait_type: "City", value: event.venue.city },
          { trait_type: "Variant", value: event.collectible.art.variant },
          { trait_type: "Network", value: "Base Sepolia" },
          { trait_type: "Verification", value: "Geo + Email" },
          { trait_type: "Media", value: isVideo ? "Video" : "Photo" },
        ],
      };
      if (isVideo) {
        metadataJson.animation_url = imageIpfsUri;
        animationUrl = imageGatewayUrl;
      } else {
        image = imageGatewayUrl ?? image;
      }
      const pinnedMeta = await pinJSON(
        metadataJson,
        `playce-${event.slug}-${Date.now()}.json`,
      );
      tokenURI = pinnedMeta.ipfsUri;
    } catch (err) {
      // Pinning failed — fall back to the generated artwork so the claim still
      // succeeds.
      console.error("[claim] metadata pin failed; using generated art", err);
    }
  }

  // 4a. Mock fallback (no contract / minter configured yet) — keeps the flow
  // working before deployment.
  if (!ONCHAIN_ENABLED || !PLAYCE_ADDRESS) {
    const result = await mintReward(event, address, email);
    const claim: Claim = {
      ...result.claim,
      metadata: {
        ...result.claim.metadata,
        image,
        animationUrl,
        metadataURI: tokenURI,
      },
    };
    return NextResponse.json({ claim, onchain: false });
  }

  // 4b. Real onchain mint.
  // When multiple claims are allowed (testing), derive a unique on-chain event
  // id per mint so the soulbound contract never reverts with AlreadyClaimed.
  const eventIdHash = ALLOW_MULTIPLE_CLAIMS
    ? onchainEventId(
        `${event.id}#${Date.now()}-${Math.random().toString(36).slice(2)}`,
      )
    : onchainEventId(event.id);

  try {
    if (!ALLOW_MULTIPLE_CLAIMS) {
      const already = await publicClient.readContract({
        address: PLAYCE_ADDRESS,
        abi: playceAbi,
        functionName: "hasClaimed",
        args: [eventIdHash, address],
      });
      if (already) {
        return NextResponse.json(
          { error: "This wallet already claimed this event" },
          { status: 409 },
        );
      }
    }

    const { walletClient } = getMinterWallet();
    const hash = await walletClient.writeContract({
      address: PLAYCE_ADDRESS,
      abi: playceAbi,
      functionName: "mintClaim",
      args: [address, eventIdHash, tokenURI],
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    const logs = parseEventLogs({
      abi: playceAbi,
      logs: receipt.logs,
      eventName: "Claimed",
    });
    const tokenId =
      logs.length > 0 ? String(logs[0].args.tokenId) : "0";

    const metadata: NFTMetadata = {
      tokenId,
      name: `${event.collectible.name} #${tokenId}`,
      description: event.collectible.description,
      image,
      animationUrl,
      eventId: event.id,
      metadataURI: tokenURI,
      attributes: [
        { trait_type: "Event", value: event.title },
        { trait_type: "Edition", value: event.collectible.art.edition },
        { trait_type: "City", value: event.venue.city },
        { trait_type: "Variant", value: event.collectible.art.variant },
        { trait_type: "Network", value: "Base Sepolia" },
        { trait_type: "Verification", value: "Geo + Email" },
      ],
    };

    const claim: Claim = {
      id: `claim_${tokenId}`,
      eventId: event.id,
      eventSlug: event.slug,
      eventTitle: event.title,
      wallet: address,
      email,
      txHash: hash,
      blockExplorerUrl: explorerTxUrl(hash),
      claimedAtISO: new Date().toISOString(),
      metadata,
      art: event.collectible.art,
    };

    return NextResponse.json({ claim, onchain: true });
  } catch (err) {
    console.error("[claim] mint failed", err);
    return NextResponse.json(
      { error: "Mint failed. Please try again." },
      { status: 500 },
    );
  }
}
