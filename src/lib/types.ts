/**
 * Core data model for Playce.
 * These types are intentionally backend-agnostic: the mock layer in
 * `lib/mock/*` returns these shapes, and a real API / indexer can return the
 * exact same ones later with no UI changes.
 */

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface Host {
  id: string;
  name: string;
  role: string;
  avatarUrl?: string;
  handle?: string;
}

export interface Speaker {
  id: string;
  name: string;
  title: string;
  avatarUrl?: string;
}

export interface ScheduleItem {
  id: string;
  startISO: string;
  endISO: string;
  title: string;
  description?: string;
  track?: string;
}

export interface Venue {
  name: string;
  addressLine: string;
  city: string;
  country: string;
  center: GeoPoint;
  /** Eligibility radius in meters for the geofence gate. */
  radiusMeters: number;
}

export interface CollectibleArt {
  /** Drives the 3D viewer look. */
  hue: number; // 0-360
  accentHue: number; // 0-360
  /** Short label etched onto the artifact. */
  edition: string;
  variant: "capsule" | "prism" | "core";
  /** Optional per-collectible .glb (in /public/models). Falls back to the
   *  global model, then the procedural artifact, when absent. */
  modelUrl?: string;
}

/** A chain / product / oracle repping at a venue (e.g. Chainlink, Pyth, Blink). */
export interface Sponsor {
  id: string;
  name: string;
  /** What the sponsor is, for the "rep your chain/product" framing. */
  kind: "chain" | "oracle" | "product";
  tagline: string;
  /** Brand accent used for chips, AR skins, and gradients. */
  brandColor: string;
  /** Optional logo (SVG/PNG in /public). Falls back to an initial chip. */
  logoUrl?: string;
  /** 3D AR skin (.glb in /public/models) shown over the camera in games. */
  arModelUrl?: string;
}

/** A reward an attendee can unlock at a venue, usually backed by a sponsor. */
export interface Airdrop {
  id: string;
  sponsorId: string;
  title: string;
  /** Human-readable reward (e.g. "250 pts", "Mystery box"). */
  reward: string;
  /** What you must do to unlock it. */
  requirement: string;
  claimed: number;
  total: number;
}

/** A mini-game playable at a venue. */
export interface MiniGame {
  /** Stable id, e.g. "67". */
  id: string;
  /** Route under /play. */
  slug: string;
  name: string;
  tagline: string;
  description: string;
  /** 1 = solo, 2 = head-to-head. */
  players: number;
  /** Whether players stake p2p before playing. */
  staked: boolean;
  /** Sponsor AR skins available for this game. */
  sponsorIds: string[];
  status: "live" | "soon";
}

export interface PlayceEvent {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  description: string;
  coverImageColor: string;
  /** Optional cover artwork; falls back to a brand gradient when absent. */
  coverImageUrl?: string;
  /** Short label for the kind of venue (e.g. "Playce Night", "Conference"). */
  kind: string;
  startISO: string;
  endISO: string;
  timezone: string;
  venue: Venue;
  hosts: Host[];
  speakers: Speaker[];
  schedule: ScheduleItem[];
  rsvpCount: number;
  claimCount: number;
  verifiedCount: number;
  capacity: number;
  /** Chains / products repping at this venue. */
  sponsorIds: string[];
  /** Mini-games playable at this venue. */
  gameIds: string[];
  /** Sponsor airdrops/rewards available at this venue. */
  airdrops: Airdrop[];
  /** Reward NFT metadata template for this venue. */
  collectible: {
    name: string;
    symbol: string;
    description: string;
    art: CollectibleArt;
    /** Optional models shown only in the camera/AR overlay (rendered side by
     *  side). Everything else (home, viewer, reveal) uses the standard art
     *  model. */
    arModelUrls?: string[];
  };
  chainId: number;
}

export type EligibilityState = "idle" | "checking" | "pass" | "fail";

export interface AttendanceVerification {
  emailVerified: boolean;
  insideGeoZone: boolean;
  whitelisted: boolean;
  alreadyClaimed: boolean;
  distanceMeters?: number;
}

export type GeoStatus =
  | "idle"
  | "requesting"
  | "inside"
  | "outside"
  | "denied"
  | "unavailable";

export type MintStatus =
  | "idle"
  | "preparing"
  | "signing"
  | "submitting"
  | "confirming"
  | "success"
  | "error";

/** A photo or video clip pinned to IPFS via Pinata (the captured "moment"). */
export interface PinnedImage {
  cid: string;
  /** Canonical `ipfs://<cid>` reference (used in onchain metadata). */
  ipfsUri: string;
  /** HTTP gateway URL for rendering the media in a browser. */
  gatewayUrl: string;
  /** Whether the pinned moment is a still image or a short video clip. */
  mediaType?: "image" | "video";
}

export interface NFTMetadata {
  tokenId: string;
  name: string;
  description: string;
  image: string;
  /** Optional video clip (ERC-721 `animation_url`) when the moment was a clip. */
  animationUrl?: string;
  eventId: string;
  attributes: { trait_type: string; value: string }[];
  metadataURI: string;
}

export interface Claim {
  id: string;
  eventId: string;
  eventSlug: string;
  eventTitle: string;
  wallet: string;
  email?: string;
  txHash: string;
  blockExplorerUrl: string;
  claimedAtISO: string;
  metadata: NFTMetadata;
  art: CollectibleArt;
}

export interface UserProfile {
  email?: string;
  wallet?: string;
  embedded: boolean;
}
