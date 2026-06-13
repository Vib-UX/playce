"use client";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import type { CollectibleArt } from "@/lib/types";
import { COLLECTIBLE_MODEL_URL } from "@/lib/three-config";
import { cn } from "@/lib/utils";

// The three.js scene is only pulled in when a collectible actually has a `.glb`
// model — pages that use the lightweight CSS artifact never load it, keeping
// their compile/initial-load fast.
const CollectibleScene = dynamic(
  () => import("@/components/three/collectible-scene"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    ),
  },
);

interface Props {
  art: CollectibleArt;
  reveal?: boolean;
  interactive?: boolean;
  className?: string;
  /** Show the "drag to explore" hint. */
  hint?: boolean;
  /** Optional captured-moment image rendered behind the artifact. */
  imageUrl?: string;
  /** Optional captured-moment video clip rendered behind the artifact. */
  videoUrl?: string;
  /** Explicit `.glb` to render (in /public/models). Falls back to the art's
   *  model, then the global default, then the lightweight CSS artifact. */
  modelUrl?: string;
  /** Multiplier on the artifact's size. */
  modelScale?: number;
  /** Auto-rotate speed (radians/sec) for a `.glb` model. */
  spin?: number;
}

function hsl(h: number, s: number, l: number, a = 1): string {
  const hue = ((h % 360) + 360) % 360;
  return `hsl(${hue} ${s}% ${l}% / ${a})`;
}

/**
 * Lightweight "memory capsule" — a glowing faceted core wrapped by orbital
 * rings, rendered with pure CSS + framer-motion. Replaces the heavy
 * three.js/react-three-fiber scene so pages compile and load instantly.
 */
function Artifact({
  art,
  reveal,
  scale,
}: {
  art: CollectibleArt;
  reveal: boolean;
  scale: number;
}) {
  const core = hsl(art.hue, 85, 62);
  const accent = hsl(art.accentHue, 90, 60);
  const shell = hsl(art.hue, 70, 60);

  return (
    <motion.div
      className="absolute inset-0 grid place-items-center"
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: reveal ? 1 : 0, scale: reveal ? scale : 0.6 }}
      transition={{ duration: 0.7, ease: "easeOut" }}
    >
      <div className="relative aspect-square w-[68%]">
        {/* Outer orbital ring */}
        <motion.div
          className="absolute inset-0 rounded-full border"
          style={{ borderColor: accent, opacity: 0.55 }}
          animate={{ rotate: 360 }}
          transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
        >
          <span
            className="absolute -top-1 left-1/2 size-2 -translate-x-1/2 rounded-full"
            style={{ background: accent, boxShadow: `0 0 12px 2px ${accent}` }}
          />
        </motion.div>

        {/* Inner tilted ring */}
        <motion.div
          className="absolute inset-[14%] rounded-full border"
          style={{
            borderColor: shell,
            opacity: 0.45,
            transform: "rotateX(68deg)",
          }}
          animate={{ rotate: -360 }}
          transition={{ duration: 16, repeat: Infinity, ease: "linear" }}
        />

        {/* Glass capsule + faceted core */}
        <motion.div
          className="absolute inset-[24%] grid place-items-center rounded-[42%]"
          style={{
            background: `radial-gradient(60% 60% at 40% 35%, ${hsl(
              art.hue,
              80,
              72,
              0.45,
            )}, ${hsl(art.hue, 70, 30, 0.25)})`,
            boxShadow: `inset 0 0 24px ${hsl(art.hue, 80, 70, 0.5)}, 0 0 40px ${hsl(
              art.hue,
              85,
              60,
              0.35,
            )}`,
            backdropFilter: "blur(2px)",
          }}
          animate={{ scale: [1, 1.04, 1] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        >
          <motion.div
            className="size-[58%] rounded-[28%]"
            style={{
              background: `linear-gradient(135deg, ${core}, ${accent})`,
              boxShadow: `0 0 28px ${core}`,
              border: `1px solid ${hsl(art.accentHue, 90, 80, 0.6)}`,
            }}
            animate={{ rotate: 360 }}
            transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
          />
        </motion.div>

        {/* Sparkles */}
        {[
          { top: "8%", left: "18%", d: 0 },
          { top: "22%", left: "84%", d: 0.6 },
          { top: "80%", left: "76%", d: 1.1 },
          { top: "72%", left: "12%", d: 1.6 },
        ].map((s, i) => (
          <motion.span
            key={i}
            className="absolute size-1.5 rounded-full"
            style={{
              top: s.top,
              left: s.left,
              background: accent,
              boxShadow: `0 0 8px ${accent}`,
            }}
            animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.3, 0.8] }}
            transition={{
              duration: 2.6,
              repeat: Infinity,
              ease: "easeInOut",
              delay: s.d,
            }}
          />
        ))}
      </div>
    </motion.div>
  );
}

export function Collectible3DViewer({
  art,
  reveal = true,
  interactive = true,
  className,
  hint = true,
  imageUrl,
  videoUrl,
  modelUrl,
  modelScale = 1,
  spin,
}: Props) {
  const model = modelUrl ?? art.modelUrl ?? COLLECTIBLE_MODEL_URL;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className={cn(
        "relative aspect-square w-full overflow-hidden rounded-3xl",
        className,
      )}
    >
      {/* Ambient aura that adapts to the collectible hue */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(60% 60% at 50% 45%, ${hsl(
            art.hue,
            85,
            60,
            0.28,
          )}, transparent 70%)`,
        }}
      />
      {/* Captured moment behind the artifact, when provided. */}
      {videoUrl ? (
        <video
          src={videoUrl}
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt="Your captured moment"
            className="absolute inset-0 h-full w-full object-cover"
          />
        )
      )}

      {model ? (
        <div className="absolute inset-0">
          <CollectibleScene
            art={art}
            reveal={reveal}
            interactive={interactive}
            modelUrl={model}
            modelScale={modelScale}
            spin={spin}
          />
        </div>
      ) : (
        <Artifact art={art} reveal={reveal} scale={modelScale} />
      )}

      {hint && interactive && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
          <span className="rounded-full bg-background/70 px-3 py-1 text-[11px] font-medium text-muted-foreground backdrop-blur">
            {model ? "Drag to explore your collectible" : "Your memory artifact"}
          </span>
        </div>
      )}
    </motion.div>
  );
}
