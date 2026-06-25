"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePlaycesAuth } from "@/lib/auth/context";
import { ThemeToggle } from "@/components/theme-toggle";
import { AccountChip } from "@/components/account-chip";
import { PrivyAuthButton } from "@/components/privy-auth-button";
import { BrandMark, BrandWordmark } from "@/components/brand-logo";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/events", label: "Events" },
  { href: "/play", label: "Play" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/claim", label: "Check in" },
  { href: "/profile", label: "Rewards" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const { ready, authenticated } = usePlaycesAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 glass">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <BrandMark />
            <BrandWordmark />
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-full px-3.5 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-secondary text-secondary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2.5">
          <ThemeToggle />
          {!ready ? (
            <Skeleton className="h-10 w-32 rounded-full" />
          ) : authenticated ? (
            <AccountChip />
          ) : (
            <PrivyAuthButton size="sm" label="Sign in" />
          )}
        </div>
      </div>
    </header>
  );
}
