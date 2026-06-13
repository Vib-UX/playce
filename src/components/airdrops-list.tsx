import { Gift } from "lucide-react";
import type { Airdrop } from "@/lib/types";
import { getSponsorById } from "@/lib/mock/sponsors";

function AirdropRow({ airdrop }: { airdrop: Airdrop }) {
  const sponsor = getSponsorById(airdrop.sponsorId);
  const pct = Math.min(
    100,
    Math.round((airdrop.claimed / Math.max(1, airdrop.total)) * 100),
  );
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="flex size-10 items-center justify-center rounded-xl text-white"
            style={{ backgroundColor: sponsor?.brandColor ?? "var(--brand)" }}
          >
            <Gift className="size-5" />
          </span>
          <div>
            <p className="font-display font-semibold">{airdrop.title}</p>
            <p className="text-xs text-muted-foreground">
              {sponsor?.name ?? "Sponsor"} · {airdrop.requirement}
            </p>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
          {airdrop.reward}
        </span>
      </div>
      <div className="mt-4">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-[var(--brand)]"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {airdrop.claimed} / {airdrop.total} unlocked
        </p>
      </div>
    </div>
  );
}

export function AirdropsList({ airdrops }: { airdrops: Airdrop[] }) {
  if (airdrops.length === 0) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-2xl">
        <p className="text-sm font-medium text-[var(--brand)]">Airdrops</p>
        <h2 className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl">
          Rep a chain, unlock the drop
        </h2>
        <p className="mt-2 text-muted-foreground">
          Sponsors drop rewards to attendees at the venue. Play to unlock.
        </p>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {airdrops.map((a) => (
          <AirdropRow key={a.id} airdrop={a} />
        ))}
      </div>
    </section>
  );
}
