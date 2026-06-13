import type { CollectibleArt } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Lightweight, GPU-cheap representation of the 3D artifact for grids and cards
 * (where mounting many WebGL canvases would be wasteful). Mirrors the hue
 * language of the real 3D viewer.
 */
export function CollectibleTile({
  art,
  className,
}: {
  art: CollectibleArt;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative aspect-square overflow-hidden rounded-2xl",
        className,
      )}
      style={{
        background: `radial-gradient(80% 80% at 50% 30%, hsl(${art.hue} 70% 22%), hsl(${art.hue} 60% 8%))`,
      }}
    >
      {/* glow */}
      <div
        className="absolute left-1/2 top-1/2 size-2/3 -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl"
        style={{ background: `hsl(${art.hue} 90% 60% / 0.55)` }}
      />
      {/* core */}
      <div
        className="absolute left-1/2 top-1/2 size-2/5 -translate-x-1/2 -translate-y-1/2 rotate-12 rounded-[28%]"
        style={{
          background: `linear-gradient(135deg, hsl(${art.hue} 90% 70%), hsl(${art.accentHue} 90% 60%))`,
          boxShadow: `0 0 40px hsl(${art.hue} 90% 60% / 0.7)`,
        }}
      />
      {/* ring */}
      <div
        className="absolute left-1/2 top-1/2 size-3/4 -translate-x-1/2 -translate-y-1/2 rounded-full border"
        style={{ borderColor: `hsl(${art.accentHue} 90% 65% / 0.6)` }}
      />
      <span className="absolute bottom-2 right-2.5 font-mono text-[10px] tracking-wide text-white/80">
        {art.edition}
      </span>
    </div>
  );
}
