import { cn } from "@/lib/utils";

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function Avatar({
  name,
  className,
  hue,
}: {
  name: string;
  className?: string;
  hue?: number;
}) {
  const h = hue ?? (name.charCodeAt(0) * 7) % 360;
  return (
    <span
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-full text-xs font-semibold text-white select-none",
        className,
      )}
      style={{
        background: `linear-gradient(135deg, hsl(${h} 80% 60%), hsl(${(h + 40) % 360} 80% 52%))`,
      }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
