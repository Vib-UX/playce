import type { CollectibleArt } from "@/lib/types";

/**
 * Server-renderable SVG of the collectible artifact — mirrors the 3D viewer's
 * hue language so the minted NFT shows real art in wallets/explorers.
 */
export function collectibleSvg(art: CollectibleArt, title: string): string {
  const { hue, accentHue, edition } = art;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
  <defs>
    <radialGradient id="bg" cx="50%" cy="38%" r="75%">
      <stop offset="0%" stop-color="hsl(${hue} 70% 20%)"/>
      <stop offset="100%" stop-color="hsl(${hue} 65% 6%)"/>
    </radialGradient>
    <linearGradient id="core" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="hsl(${hue} 90% 72%)"/>
      <stop offset="100%" stop-color="hsl(${accentHue} 90% 60%)"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="hsl(${hue} 90% 62%)" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="hsl(${hue} 90% 62%)" stop-opacity="0"/>
    </radialGradient>
    <filter id="blur"><feGaussianBlur stdDeviation="26"/></filter>
  </defs>

  <rect width="800" height="800" fill="url(#bg)"/>
  <circle cx="400" cy="380" r="230" fill="url(#glow)" filter="url(#blur)"/>

  <g transform="translate(400 380)">
    <ellipse cx="0" cy="0" rx="250" ry="92" fill="none" stroke="hsl(${accentHue} 90% 65%)" stroke-opacity="0.5" stroke-width="3"/>
    <ellipse cx="0" cy="0" rx="92" ry="250" fill="none" stroke="hsl(${hue} 90% 70%)" stroke-opacity="0.35" stroke-width="2"/>
    <g transform="rotate(15)">
      <rect x="-115" y="-115" width="230" height="230" rx="64" fill="url(#core)"/>
      <rect x="-115" y="-115" width="230" height="230" rx="64" fill="none" stroke="white" stroke-opacity="0.25" stroke-width="2"/>
    </g>
  </g>

  <text x="60" y="700" fill="white" font-family="ui-sans-serif, system-ui, sans-serif" font-size="34" font-weight="700">${escapeXml(
    title,
  )}</text>
  <text x="60" y="740" fill="white" fill-opacity="0.7" font-family="ui-monospace, monospace" font-size="22">${escapeXml(
    edition,
  )} · Playces Moment</text>
  <text x="740" y="72" text-anchor="end" fill="white" fill-opacity="0.65" font-family="ui-monospace, monospace" font-size="22">Playces · Base</text>
</svg>`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
