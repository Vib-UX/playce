/**
 * Self-host the MediaPipe Tasks Vision runtime + the hand-landmarker model so
 * the "67" game has no external CDN dependency at runtime.
 *
 *   public/mediapipe/vision_bundle.mjs   (copied from @mediapipe/tasks-vision)
 *   public/mediapipe/wasm/*              (copied from @mediapipe/tasks-vision)
 *   public/models/hand_landmarker.task   (downloaded from Google storage)
 *
 * Idempotent: skips files that already exist. Run via `npm run setup:mediapipe`.
 */
import { cp, mkdir, copyFile, access, stat } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = path.join(root, "node_modules", "@mediapipe", "tasks-vision");
const publicMediapipe = path.join(root, "public", "mediapipe");
const publicModels = path.join(root, "public", "models");

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const MODEL_DEST = path.join(publicModels, "hand_landmarker.task");

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function copyRuntime() {
  await mkdir(publicMediapipe, { recursive: true });

  const bundleSrc = path.join(pkg, "vision_bundle.mjs");
  const bundleDest = path.join(publicMediapipe, "vision_bundle.mjs");
  if (!(await exists(bundleSrc))) {
    throw new Error(
      `Missing ${bundleSrc}. Run \`npm install @mediapipe/tasks-vision\` first.`,
    );
  }
  await copyFile(bundleSrc, bundleDest);
  console.log("✓ vision_bundle.mjs");

  const wasmDest = path.join(publicMediapipe, "wasm");
  await cp(path.join(pkg, "wasm"), wasmDest, { recursive: true });
  console.log("✓ wasm/");
}

async function downloadModel() {
  await mkdir(publicModels, { recursive: true });
  if (await exists(MODEL_DEST)) {
    const { size } = await stat(MODEL_DEST);
    if (size > 0) {
      console.log("✓ hand_landmarker.task (already present)");
      return;
    }
  }
  console.log("… downloading hand_landmarker.task");
  const res = await fetch(MODEL_URL);
  if (!res.ok || !res.body) {
    throw new Error(`Model download failed: HTTP ${res.status}`);
  }
  await pipeline(Readable.fromWeb(res.body), createWriteStream(MODEL_DEST));
  const { size } = await stat(MODEL_DEST);
  console.log(`✓ hand_landmarker.task (${(size / 1e6).toFixed(1)} MB)`);
}

await copyRuntime();
await downloadModel();
console.log("MediaPipe assets ready.");
