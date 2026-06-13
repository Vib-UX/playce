"use client";

import { useState } from "react";
import { Copy, Check, ShieldCheck, Mail } from "lucide-react";
import { usePlayceAuth } from "@/lib/auth/context";
import { shortenAddress } from "@/lib/utils";
import { ACTIVE_CHAIN } from "@/lib/chain";
import { Badge } from "@/components/ui/badge";

export function EmbeddedWalletCard() {
  const { email, wallet, embedded } = usePlayceAuth();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!wallet) return;
    await navigator.clipboard.writeText(wallet);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-[linear-gradient(135deg,color-mix(in_oklab,var(--brand)_14%,var(--card)),var(--card))] p-5">
      <div
        className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full opacity-40 blur-2xl"
        style={{ background: "var(--brand)" }}
      />
      <div className="relative flex items-center justify-between">
        <Badge variant="brand">
          <ShieldCheck className="size-3.5" />
          {embedded ? "Embedded wallet" : "Wallet"}
        </Badge>
        <span className="text-xs text-muted-foreground">{ACTIVE_CHAIN.name}</span>
      </div>

      <div className="relative mt-6 flex items-center justify-between">
        <button
          onClick={copy}
          className="group inline-flex items-center gap-2 font-mono text-sm"
        >
          {shortenAddress(wallet, 6)}
          {copied ? (
            <Check className="size-3.5 text-[var(--success)]" />
          ) : (
            <Copy className="size-3.5 text-muted-foreground transition group-hover:text-foreground" />
          )}
        </button>
      </div>

      {email && (
        <p className="relative mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Mail className="size-3.5" />
          {email}
        </p>
      )}
    </div>
  );
}
