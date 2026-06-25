import sharp from "sharp";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const W = 1200;
const H = 630;

const FONT_DISPLAY =
  "'Bricolage Grotesque', 'Helvetica Neue', Helvetica, Arial, sans-serif";

const defs = (w, h) => `
  <defs>
    <linearGradient id="brand" x1="0" y1="0" x2="${w}" y2="${h}" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#ff2e88" />
      <stop offset="55%" stop-color="#18d9c0" />
      <stop offset="100%" stop-color="#c2ff3d" />
    </linearGradient>
    <linearGradient id="mark" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#ff2e88" />
      <stop offset="55%" stop-color="#18d9c0" />
      <stop offset="100%" stop-color="#c2ff3d" />
    </linearGradient>
    <radialGradient id="glowPink" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ff2e88" stop-opacity="0.4" />
      <stop offset="100%" stop-color="#ff2e88" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="glowLime" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#c2ff3d" stop-opacity="0.32" />
      <stop offset="100%" stop-color="#c2ff3d" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="glowTeal" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#18d9c0" stop-opacity="0.3" />
      <stop offset="100%" stop-color="#18d9c0" stop-opacity="0" />
    </radialGradient>
    <pattern id="tri" width="30" height="30" patternUnits="userSpaceOnUse">
      <path d="M11 9 L19 14 L11 19 Z" fill="#ffffff" fill-opacity="0.035" />
    </pattern>
  </defs>`;

// Aurora-coloured "action" tag, Bento-style: a tilted rounded pill with a soft
// shadow. `dark` flips the label colour for the light-on-light lime tag.
const tag = (cx, cy, rot, w, label, fill, dark = false) => `
  <g transform="translate(${cx} ${cy}) rotate(${rot})">
    <rect x="${-w / 2}" y="-26" width="${w}" height="56" rx="16" fill="#000000" fill-opacity="0.35" transform="translate(0 6)" />
    <rect x="${-w / 2}" y="-26" width="${w}" height="56" rx="16" fill="${fill}" />
    <text x="0" y="9" text-anchor="middle" font-family="${FONT_DISPLAY}" font-size="28" font-weight="800" letter-spacing="-0.5" fill="${dark ? "#0a0912" : "#ffffff"}">${label}</text>
  </g>`;

// Mark + "Playces" wordmark + gradient accent dot. `scale` sizes the mark;
// `font` the wordmark; `dotX` positions the trailing square.
const lockup = (scale, font, dotX, dotY, dotS) => `
  <g transform="scale(${scale})">
    <rect x="0" y="0" width="32" height="32" rx="9" fill="url(#mark)" />
    <path d="M16 7.4a6.1 6.1 0 0 1 6.1 6.1c0 4.3-6.1 10.8-6.1 10.8S9.9 17.8 9.9 13.5A6.1 6.1 0 0 1 16 7.4z" fill="#ffffff" />
    <path d="M14.4 10.9v5.2l4.4-2.6z" fill="#ff2e88" />
  </g>
  <text x="${36 * scale + 8}" y="${21 * scale + font * 0.34}" font-family="${FONT_DISPLAY}" font-size="${font}" font-weight="800" letter-spacing="-2" fill="#ffffff">Playces</text>
  <rect x="${dotX}" y="${dotY}" width="${dotS}" height="${dotS}" rx="3" fill="url(#brand)" />`;

// ── Social cover (1200x630) ──────────────────────────────────────────────────
const cover = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" fill="none">
  ${defs(W, H)}
  <rect width="${W}" height="${H}" fill="#0a0912" />
  <rect width="${W}" height="${H}" fill="url(#tri)" />

  <circle cx="140" cy="110" r="320" fill="url(#glowPink)" />
  <circle cx="1080" cy="540" r="340" fill="url(#glowLime)" />
  <circle cx="1060" cy="90" r="280" fill="url(#glowTeal)" />

  <rect x="0" y="0" width="${W}" height="6" fill="url(#brand)" />

  ${tag(190, 120, -8, 168, "Show up", "#ff2e88")}
  ${tag(1010, 100, 7, 110, "Play", "#18d9c0")}
  ${tag(300, 500, -7, 110, "Earn", "#c2ff3d", true)}
  ${tag(880, 485, 8, 150, "Collect", "#ff7a3d")}

  <g transform="translate(${W / 2} 300)">
    <rect x="-450" y="-58" width="900" height="116" rx="34" fill="#15121f" stroke="#ffffff" stroke-opacity="0.06" stroke-width="1" />
    <text x="0" y="14" text-anchor="middle" font-family="${FONT_DISPLAY}" font-size="48" font-weight="800" letter-spacing="-1.5" fill="#ffffff">Turn venues into onchain arenas.</text>
  </g>

  <g transform="translate(${W / 2 - 132} 540)">
    ${lockup(1.625, 44, 218, 34, 13)}
  </g>
</svg>`;

// ── X / Twitter header banner (1500x500, 3:1) ────────────────────────────────
// Bottom-left is the profile-avatar safe zone, so it is kept clear.
const BW = 1500;
const BH = 500;
const banner = `<svg xmlns="http://www.w3.org/2000/svg" width="${BW}" height="${BH}" viewBox="0 0 ${BW} ${BH}" fill="none">
  ${defs(BW, BH)}
  <rect width="${BW}" height="${BH}" fill="#0a0912" />
  <rect width="${BW}" height="${BH}" fill="url(#tri)" />

  <circle cx="220" cy="70" r="300" fill="url(#glowPink)" />
  <circle cx="1350" cy="60" r="280" fill="url(#glowTeal)" />
  <circle cx="1320" cy="470" r="320" fill="url(#glowLime)" />

  <rect x="0" y="0" width="${BW}" height="6" fill="url(#brand)" />

  ${tag(330, 110, -8, 168, "Show up", "#ff2e88")}
  ${tag(1200, 110, 7, 110, "Play", "#18d9c0")}
  ${tag(1330, 300, -7, 110, "Earn", "#c2ff3d", true)}
  ${tag(1070, 400, 8, 150, "Collect", "#ff7a3d")}

  <g transform="translate(${BW / 2 - 188} 168)">
    ${lockup(2.4, 66, 350, 48, 18)}
  </g>

  <text x="${BW / 2}" y="340" text-anchor="middle" font-family="${FONT_DISPLAY}" font-size="40" font-weight="700" letter-spacing="-1" fill="#ffffff" fill-opacity="0.92">Turn venues into onchain arenas.</text>
</svg>`;

async function emit(svg, name, fmt = "png", resize) {
  let pipe = sharp(Buffer.from(svg), { density: 200 });
  if (resize) pipe = pipe.resize(resize.w, resize.h, { fit: "cover", position: "centre" });
  pipe = fmt === "jpg" ? pipe.jpeg({ quality: 92 }) : pipe.png();
  await pipe.toFile(join(root, "public", name));
}

await emit(cover, "cover.png");
await emit(cover, "cover.jpg", "jpg");

// Square variant (good for app stores / social avatars)
const SQ = 1080;
const coverSquare = cover.replace(
  `width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"`,
  `width="${SQ}" height="${SQ}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice"`,
);
await emit(coverSquare, "cover-square.png", "png", { w: SQ, h: SQ });

await emit(banner, "banner.png");
await emit(banner, "banner.jpg", "jpg");

await writeFile(join(root, "public", "cover.svg"), cover);
await writeFile(join(root, "public", "banner.svg"), banner);

console.log(
  "Wrote public/cover.{png,jpg,svg}, public/cover-square.png, public/banner.{png,jpg,svg}",
);
