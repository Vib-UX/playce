import type { Sponsor } from "@/lib/types";
import { cn } from "@/lib/utils";

export function SponsorChip({
  sponsor,
  className,
  showCategory = true,
}: {
  sponsor: Sponsor;
  className?: string;
  /** Show the category label after the name (hidden when chips are already
   *  grouped under a category heading). */
  showCategory?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium",
        className,
      )}
      title={`${sponsor.name} — ${sponsor.category}`}
    >
      <span
        className="size-3 rounded-full"
        style={{ backgroundColor: sponsor.brandColor }}
        aria-hidden
      />
      {sponsor.name}
      {showCategory && (
        <span className="text-xs font-normal text-muted-foreground">
          {sponsor.category}
        </span>
      )}
    </span>
  );
}
