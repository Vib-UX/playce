/**
 * The "67" hand-tracking core.
 *
 * Loads the self-hosted MediaPipe Tasks Vision runtime (see
 * `scripts/setup-mediapipe.mjs`) and exposes the seesaw gesture classifier: two
 * open palms tilting up/down, where each alternating tilt is a "swap". The room
 * UI runs the detect loop and reports swaps to the authoritative WS server.
 *
 * Browser-only — guard usage behind a client component / effect.
 */

export type LandmarkPoint = { x: number; y: number; z: number };
export type DetectionResult = { landmarks: LandmarkPoint[][] };
export type HandLandmarkerInstance = {
  detectForVideo: (
    video: HTMLVideoElement,
    timestamp: number,
  ) => DetectionResult;
  close: () => void;
};

export type HandSide = "left" | "right";
export type SeesawStatus =
  | { kind: "waiting" }
  | { kind: "closed" }
  | { kind: "level" }
  | { kind: "tilt"; higher: HandSide };

const VISION_BUNDLE = "/mediapipe/vision_bundle.mjs";
const WASM_BASE = "/mediapipe/wasm";
const MODEL_URL = "/models/hand_landmarker.task";

/** Minimum gap between two scored swaps from one player (ms). */
export const SCORE_COOLDOWN_MS = 220;
/** How far the palms must diverge (normalized Y) to count as a tilt. */
export const TILT_THRESHOLD = 0.07;

// Avoid the bundler trying to resolve/transform the MediaPipe ESM bundle: load
// it at runtime from the public path with a real dynamic import.
const dynamicImport = new Function("u", "return import(u)") as (
  u: string,
) => Promise<{
  FilesetResolver: {
    forVisionTasks: (wasmBase: string) => Promise<unknown>;
  };
  HandLandmarker: {
    createFromOptions: (
      fileset: unknown,
      opts: unknown,
    ) => Promise<HandLandmarkerInstance>;
  };
}>;

export async function createHandLandmarker(): Promise<HandLandmarkerInstance> {
  const vision = await dynamicImport(VISION_BUNDLE);
  const fileset = await vision.FilesetResolver.forVisionTasks(WASM_BASE);
  const opts = {
    baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" as const },
    runningMode: "VIDEO" as const,
    numHands: 2,
  };
  try {
    return await vision.HandLandmarker.createFromOptions(fileset, opts);
  } catch {
    return await vision.HandLandmarker.createFromOptions(fileset, {
      ...opts,
      baseOptions: { ...opts.baseOptions, delegate: "CPU" as const },
    });
  }
}

export function detectFingers(landmarks: LandmarkPoint[]): boolean[] {
  const tipIds = [4, 8, 12, 16, 20];
  const pipIds = [3, 6, 10, 14, 18];
  const wrist = landmarks[0];
  const dist = (i: number) =>
    Math.hypot(landmarks[i].x - wrist.x, landmarks[i].y - wrist.y);
  return tipIds.map((t, i) => dist(t) > dist(pipIds[i]) * 1.1);
}

export function isPalmOpen(landmarks: LandmarkPoint[]): boolean {
  const fingers = detectFingers(landmarks);
  let extended = 0;
  for (let i = 1; i < 5; i++) if (fingers[i]) extended++;
  return extended >= 3;
}

export function classifySeesaw(hands: LandmarkPoint[][]): SeesawStatus {
  if (hands.length < 2) return { kind: "waiting" };
  const sorted = [...hands].sort((a, b) => a[0].x - b[0].x);
  const leftHand = sorted[0];
  const rightHand = sorted[1];
  if (!isPalmOpen(leftHand) || !isPalmOpen(rightHand)) {
    return { kind: "closed" };
  }
  const leftY = leftHand[0].y;
  const rightY = rightHand[0].y;
  const diff = leftY - rightY;
  if (Math.abs(diff) < TILT_THRESHOLD) return { kind: "level" };
  return { kind: "tilt", higher: diff < 0 ? "left" : "right" };
}

export const HAND_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];
