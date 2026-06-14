"use client";

import { useEffect, useState } from "react";
import {
  Mail,
  Wallet,
  Sparkles,
  Clock,
  Globe,
  Crown,
  BadgeCheck,
  ExternalLink,
} from "lucide-react";
import { usePlayceStore } from "@/lib/store";
import { useEnsTicketStore } from "@/lib/ens-ticket-store";
import { usePlayceAuth } from "@/lib/auth/context";
import { AttendanceGallery } from "@/components/attendance-gallery";
import { EmbeddedWalletCard } from "@/components/embedded-wallet-card";
import { PrivyAuthButton } from "@/components/privy-auth-button";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProfilePage() {
  const claims = usePlayceStore((s) => s.claims);
  const ensTickets = useEnsTicketStore((s) => s.tickets);
  const { authenticated, email, ready } = usePlayceAuth();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const showLoading = !mounted || !ready;

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar name={email ?? "Guest"} className="size-14 text-base" />
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">
              {authenticated ? "Your rewards" : "Your profile"}
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {authenticated
                ? "Every onchain reward you've earned at Playce venues."
                : "Sign in to view your rewards and check-in history."}
            </p>
          </div>
        </div>
        {!showLoading && !authenticated && <PrivyAuthButton label="Sign in" />}
      </div>

      {showLoading ? (
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
      ) : (
        <>
          {/* Account + stats */}
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {authenticated ? (
              <EmbeddedWalletCard />
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-card/40 p-5 text-sm text-muted-foreground">
                <Wallet className="size-5" />
                <p className="mt-2">No wallet connected yet.</p>
              </div>
            )}

            <div className="rounded-2xl border border-border bg-card p-5">
              <Sparkles className="size-5 text-[var(--brand)]" />
              <p className="mt-2 font-display text-2xl font-semibold">
                {claims.length}
              </p>
              <p className="text-sm text-muted-foreground">Moments claimed</p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5">
              <Mail className="size-5 text-[var(--brand)]" />
              <p className="mt-2 truncate font-medium">
                {email ?? "Not signed in"}
              </p>
              <p className="text-sm text-muted-foreground">Account email</p>
            </div>
          </div>

          {/* ENS tickets */}
          {ensTickets.length > 0 && (
            <section className="mt-12">
              <h2 className="font-display text-xl font-semibold">
                Your ENS tickets
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Event subnames of playce.eth, issued to your wallet.
              </p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {ensTickets.map((t) => (
                  <div
                    key={t.name}
                    className="rounded-2xl border border-border bg-card p-5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex size-9 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
                        <Globe className="size-4" />
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                          t.tier === "vip"
                            ? "bg-[var(--brand)] text-white"
                            : "bg-secondary text-secondary-foreground"
                        }`}
                      >
                        {t.tier === "vip" ? (
                          <Crown className="size-3" />
                        ) : (
                          <BadgeCheck className="size-3" />
                        )}
                        {t.tier === "vip" ? "VIP" : "General"}
                      </span>
                    </div>
                    <code className="mt-3 block truncate font-mono text-sm font-semibold text-[var(--brand-deep)] dark:text-[var(--brand)]">
                      {t.name}
                    </code>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t.eventTitle}
                    </p>
                    {t.explorerUrl && (
                      <a
                        href={t.explorerUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                      >
                        View registration <ExternalLink className="size-3.5" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Gallery */}
          <section className="mt-12">
            <h2 className="font-display text-xl font-semibold">Your moments</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Onchain rewards earned at venues. Showcasing your 3D collectible
              moment assets.
            </p>
            <div className="mt-6">
              <AttendanceGallery claims={claims} />
            </div>
          </section>

          {/* Attendance history */}
          {claims.length > 0 && (
            <section className="mt-12">
              <h2 className="font-display text-xl font-semibold">
                Attendance history
              </h2>
              <div className="mt-5 overflow-hidden rounded-2xl border border-border">
                {claims.map((claim, i) => (
                  <div
                    key={claim.id}
                    className={`flex items-center justify-between gap-4 p-4 ${
                      i % 2 ? "bg-card/40" : "bg-card"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex size-9 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                        <Clock className="size-4" />
                      </span>
                      <div>
                        <p className="text-sm font-medium">{claim.eventTitle}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(claim.claimedAtISO).toLocaleString(undefined, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </p>
                      </div>
                    </div>
                    <a
                      href={claim.blockExplorerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 text-sm font-medium text-primary hover:underline"
                    >
                      View tx
                    </a>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
