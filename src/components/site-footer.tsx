import Link from "next/link";
import { BrandMark } from "@/components/brand-logo";
import { ACTIVE_CHAIN, explorerBaseUrl } from "@/lib/chain";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/70">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-8 md:flex-row">
          <div className="max-w-sm">
            <div className="flex items-center gap-2">
              <BrandMark />
              <span className="font-display text-lg font-semibold">Playces</span>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Show up, play, and earn at real-world venues. Check in, win
              mini-games, rep your chain, and collect onchain rewards.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm sm:grid-cols-3">
            <Link href="/" className="text-muted-foreground hover:text-foreground">
              Home
            </Link>
            <Link
              href="/event/ethglobal-nyc"
              className="text-muted-foreground hover:text-foreground"
            >
              Featured venue
            </Link>
            <Link href="/play/pvp" className="text-muted-foreground hover:text-foreground">
              PvP
            </Link>
            <Link href="/claim" className="text-muted-foreground hover:text-foreground">
              Check in
            </Link>
            <Link
              href="/profile"
              className="text-muted-foreground hover:text-foreground"
            >
              Rewards
            </Link>
            <a
              href={explorerBaseUrl()}
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground hover:text-foreground"
            >
              Explorer
            </a>
          </div>
        </div>
        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-border/70 pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} Playces. Built on {ACTIVE_CHAIN.name}.</p>
          <p>Show up. Play. Earn.</p>
        </div>
      </div>
    </footer>
  );
}
