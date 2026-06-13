import { cn } from "@/lib/utils";

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-muted",
        "after:absolute after:inset-0 after:-translate-x-full after:bg-[linear-gradient(90deg,transparent,color-mix(in_oklab,var(--foreground)_8%,transparent),transparent)] after:[animation:shimmer_1.6s_infinite]",
        className,
      )}
      {...props}
    />
  );
}
