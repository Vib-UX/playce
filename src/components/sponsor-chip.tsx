import type { Sponsor } from "@/lib/types";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<Sponsor["kind"], string> = {
  chain: "Chain",
  oracle: "Oracle",
  product: "Product",
};

export function SponsorChip({
  sponsor,
  className,
}: {
  sponsor: Sponsor;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium",
        className,
      )}
      title={`${sponsor.name} — ${KIND_LABEL[sponsor.kind]}`}
    >
      <span
        className="size-3 rounded-full"
        style={{ backgroundColor: sponsor.brandColor }}
        aria-hidden
      />
      {sponsor.name}
      <span className="text-xs font-normal text-muted-foreground">
        {KIND_LABEL[sponsor.kind]}
      </span>
    </span>
  );
}
