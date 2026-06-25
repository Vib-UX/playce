import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const out = (name) => join(root, "public", name);

const brandDefs = `
  <linearGradient id="brand" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#ff2e88" />
    <stop offset="55%" stop-color="#18d9c0" />
    <stop offset="100%" stop-color="#c2ff3d" />
  </linearGradient>`;

// Reusable pin + play mark (32x32 artboard)
const mark = (s = 32) => `
  <g transform="scale(${s / 32})">
    <rect x="2" y="2" width="28" height="28" rx="9" fill="url(#brand)" />
    <path d="M16 7.4a6.1 6.1 0 0 1 6.1 6.1c0 4.3-6.1 10.8-6.1 10.8S9.9 17.8 9.9 13.5A6.1 6.1 0 0 1 16 7.4z" fill="#ffffff" />
    <path d="M14.4 10.9v5.2l4.4-2.6z" fill="#ff2e88" />
  </g>`;

const FONT = "'Bricolage Grotesque', 'Helvetica Neue', Helvetica, Arial, sans-serif";

// 1) Horizontal lockup, light text (for dark backgrounds), transparent
const lockup = (textFill) => `<svg xmlns="http://www.w3.org/2000/svg" width="840" height="200" viewBox="0 0 420 100" fill="none">
  <defs>${brandDefs}</defs>
  <g transform="translate(6 26)">${mark(48)}</g>
  <text x="68" y="64" font-family="${FONT}" font-size="58" font-weight="800" letter-spacing="-2.5" fill="${textFill}">Playces</text>
</svg>`;

// 2) Just the mark (square, transparent)
const markOnly = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 32 32" fill="none">
  <defs>${brandDefs}</defs>
  ${mark(32)}
</svg>`;

// 3) App logo on brand-dark rounded tile (square)
const appTile = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024" fill="none">
  <defs>${brandDefs}
    <radialGradient id="glow" cx="50%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#18d9c0" stop-opacity="0.25" />
      <stop offset="100%" stop-color="#18d9c0" stop-opacity="0" />
    </radialGradient>
  </defs>
  <rect width="1024" height="1024" rx="225" fill="#0a0912" />
  <rect width="1024" height="1024" rx="225" fill="url(#glow)" />
  <g transform="translate(212 212) scale(20)">
    <rect x="2" y="2" width="28" height="28" rx="9" fill="url(#brand)" />
    <path d="M16 7.4a6.1 6.1 0 0 1 6.1 6.1c0 4.3-6.1 10.8-6.1 10.8S9.9 17.8 9.9 13.5A6.1 6.1 0 0 1 16 7.4z" fill="#ffffff" />
    <path d="M14.4 10.9v5.2l4.4-2.6z" fill="#ff2e88" />
  </g>
</svg>`;

const jobs = [
  [lockup("#ffffff"), "logo.png", "png"],
  [lockup("#15121f"), "logo-dark.png", "png"],
  [markOnly, "logo-mark.png", "png"],
  [appTile, "logo-app.png", "png"],
  [appTile, "logo-app.jpg", "jpg"],
];

for (const [svg, name, fmt] of jobs) {
  let pipe = sharp(Buffer.from(svg), { density: 240 });
  pipe = fmt === "jpg" ? pipe.jpeg({ quality: 92 }) : pipe.png();
  await pipe.toFile(out(name));
  console.log("wrote public/" + name);
}
