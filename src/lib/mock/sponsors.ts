import type { Sponsor } from "@/lib/types";

/**
 * Chains / products / oracles that "rep" at Playce venues. Attendees can rep
 * their favorite and play games skinned with the sponsor's AR model.
 *
 * AR skins reuse bundled placeholder .glb models for now — swap `arModelUrl`
 * with real sponsor assets when available.
 */
export const SPONSORS: Sponsor[] = [
  {
    id: "chainlink",
    name: "Chainlink",
    kind: "oracle",
    tagline: "The standard for onchain data & cross-chain.",
    brandColor: "#2a5ada",
    arModelUrl: "/models/chainlink.glb",
  },
  {
    id: "pyth",
    name: "Pyth",
    kind: "oracle",
    tagline: "Real-time market data, first-party sourced.",
    brandColor: "#7c3aed",
    arModelUrl: "/models/mascot-plush.glb",
  },
  {
    id: "blink",
    name: "Blink",
    kind: "product",
    tagline: "Actions you can play, anywhere.",
    brandColor: "#ff7a1a",
    arModelUrl: "/models/collectible.glb",
  },
  {
    id: "base",
    name: "Base",
    kind: "chain",
    tagline: "Bring the world onchain.",
    brandColor: "#0052ff",
    arModelUrl: "/models/mascot-plush.glb",
  },
];

export function getSponsorById(id: string): Sponsor | undefined {
  return SPONSORS.find((s) => s.id === id);
}

export function getSponsorsByIds(ids: string[]): Sponsor[] {
  return ids
    .map((id) => getSponsorById(id))
    .filter((s): s is Sponsor => Boolean(s));
}
