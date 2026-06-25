"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  BadgeCheck,
  Check,
  Copy,
  Crown,
  ExternalLink,
  Globe,
  Loader2,
  Lock,
} from "lucide-react";
import type { PlaycesEvent } from "@/lib/types";
import { usePlaycesAuth } from "@/lib/auth/context";
import { useEnsTicketStore } from "@/lib/ens-ticket-store";
import { claimEnsTicket } from "@/lib/ens-ticket-service";
import {
  ENS_PARENT_NAME,
  resolveEnsTicket,
  type TicketTier,
} from "@/lib/ens";
import { PrivyAuthButton } from "@/components/privy-auth-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Phase = "idle" | "claiming" | "done" | "error";

export function EnsTicketCard({ event }: { event: PlaycesEvent }) {
  const { authenticated, email, wallet, ready, getAccessToken } =
    usePlaycesAuth();
  const tickets = useEnsTicketStore((s) => s.tickets);
  const addTicket = useEnsTicketStore((s) => s.addTicket);

  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [tier, setTier] = useState<TicketTier>("ga");
  const [copied, setCopied] = useState(false);
  const [resolvesTo, setResolvesTo] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  const existing = useMemo(
    () => tickets.find((t) => t.eventId === event.id),
    [tickets, event.id],
  );

  // Verify the subname resolves to the owner once a ticket exists.
  useEffect(() => {
    if (!existing?.onchain) return;
    let cancelled = false;
    resolveEnsTicket(existing.name)
      .then((r) => {
        if (!cancelled) setResolvesTo(r.address);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [existing?.name, existing?.onchain]);

  const handleClaim = async () => {
    if (!authenticated || !wallet) return;
    setPhase("claiming");
    setError(null);
    try {
      const ticket = await claimEnsTicket({
        event,
        wallet,
        email,
        tier,
        getAccessToken,
      });
      addTicket(ticket);
      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not issue ticket");
      setPhase("error");
    }
  };

  const copyName = (name: string) => {
    navigator.clipboard?.writeText(name).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="rounded-3xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
            <Globe className="size-4" />
          </span>
          <div>
            <p className="font-display font-semibold leading-none">
              Your ENS ticket
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              A subname of {ENS_PARENT_NAME}
            </p>
          </div>
        </div>
        <Badge variant="outline" className="gap-1">
          <BadgeCheck className="size-3" /> ENS
        </Badge>
      </div>

      {/* Existing ticket */}
      {mounted && existing ? (
        <div className="mt-5 rounded-2xl border border-[color-mix(in_oklab,var(--brand)_30%,transparent)] bg-[color-mix(in_oklab,var(--brand)_6%,transparent)] p-4">
          <div className="flex items-center justify-between gap-2">
            <code className="truncate font-mono text-sm font-semibold text-[var(--brand-deep)] dark:text-[var(--brand)]">
              {existing.name}
            </code>
            <button
              type="button"
              onClick={() => copyName(existing.name)}
              className="shrink-0 text-muted-foreground transition hover:text-foreground"
              aria-label="Copy ENS name"
            >
              {copied ? (
                <Check className="size-4" />
              ) : (
                <Copy className="size-4" />
              )}
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant={existing.tier === "vip" ? "brand" : "outline"}>
              {existing.tier === "vip" ? (
                <Crown className="size-3" />
              ) : (
                <BadgeCheck className="size-3" />
              )}
              {existing.tier === "vip" ? "VIP" : "General"}
            </Badge>
            {existing.onchain ? (
              resolvesTo ? (
                <span className="inline-flex items-center gap-1 text-xs text-[var(--success)]">
                  <Check className="size-3" /> Resolves onchain
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Loader2 className="size-3 animate-spin" /> Propagating…
                </span>
              )
            ) : (
              <span className="text-xs text-muted-foreground">Preview</span>
            )}
          </div>
          {existing.explorerUrl && (
            <a
              href={existing.explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              View registration <ExternalLink className="size-3.5" />
            </a>
          )}
        </div>
      ) : !mounted ? (
        <div className="mt-5 h-24 animate-pulse rounded-2xl bg-muted/40" />
      ) : !authenticated ? (
        <div className="mt-5 rounded-2xl border border-dashed border-border bg-muted/30 p-5 text-center">
          <Lock className="mx-auto size-5 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">Sign in to claim</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Get a personal ENS subname as your ticket, soulbound to your wallet.
          </p>
          <PrivyAuthButton
            className="mt-4 w-full"
            size="lg"
            label="Sign in to claim"
            disabled={!ready}
          />
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          <div>
            <p className="mb-1.5 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Tier
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(["ga", "vip"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTier(t)}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition ${
                    tier === t
                      ? "border-[var(--brand)] bg-[color-mix(in_oklab,var(--brand)_10%,transparent)] text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t === "vip" ? (
                    <Crown className="size-3.5" />
                  ) : (
                    <BadgeCheck className="size-3.5" />
                  )}
                  {t === "vip" ? "VIP" : "General"}
                </button>
              ))}
            </div>
          </div>

          <motion.div layout>
            <Button
              variant="gradient"
              size="lg"
              className="w-full"
              disabled={phase === "claiming" || !wallet}
              onClick={handleClaim}
            >
              {phase === "claiming" ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Issuing subname…
                </>
              ) : (
                <>
                  <Globe className="size-4" /> Claim your ENS ticket
                </>
              )}
            </Button>
            {phase === "error" && error && (
              <p className="mt-2 text-center text-sm text-[var(--destructive)]">
                {error}
              </p>
            )}
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Gas sponsored · a subname of playce.eth, yours to keep
            </p>
          </motion.div>
        </div>
      )}
    </div>
  );
}
