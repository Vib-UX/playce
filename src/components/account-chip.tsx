"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, LogOut, User, Wallet, Check, ChevronDown } from "lucide-react";
import { usePlaycesAuth } from "@/lib/auth/context";
import { Avatar } from "@/components/ui/avatar";
import { shortenAddress } from "@/lib/utils";
import { explorerAddressUrl } from "@/lib/chain";

export function AccountChip() {
  const { email, wallet, logout, embedded } = usePlaycesAuth();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const copy = async () => {
    if (!wallet) return;
    await navigator.clipboard.writeText(wallet);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  const display = email ?? "Account";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 py-1 pl-1 pr-3 text-sm transition hover:bg-muted"
      >
        <Avatar name={display} className="size-7 text-[10px]" />
        <span className="hidden max-w-[140px] truncate font-medium sm:inline">
          {email ?? shortenAddress(wallet)}
        </span>
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-border bg-popover p-1.5 shadow-xl"
          >
            <div className="rounded-xl bg-muted/50 p-3">
              <div className="flex items-center gap-3">
                <Avatar name={display} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{display}</p>
                  <p className="text-xs text-muted-foreground">
                    {embedded ? "Embedded wallet" : "Connected wallet"}
                  </p>
                </div>
              </div>
              {wallet && (
                <button
                  onClick={copy}
                  className="mt-3 flex w-full items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono transition hover:bg-muted"
                >
                  <span className="flex items-center gap-2">
                    <Wallet className="size-3.5 text-muted-foreground" />
                    {shortenAddress(wallet, 5)}
                  </span>
                  {copied ? (
                    <Check className="size-3.5 text-[var(--success)]" />
                  ) : (
                    <Copy className="size-3.5 text-muted-foreground" />
                  )}
                </button>
              )}
            </div>

            <div className="p-1">
              <Link
                href="/profile"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition hover:bg-muted"
              >
                <User className="size-4 text-muted-foreground" />
                My collectibles
              </Link>
              {wallet && (
                <a
                  href={explorerAddressUrl(wallet)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition hover:bg-muted"
                >
                  <Wallet className="size-4 text-muted-foreground" />
                  View on explorer
                </a>
              )}
              <button
                onClick={() => {
                  logout();
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-[var(--destructive)] transition hover:bg-[color-mix(in_oklab,var(--destructive)_12%,transparent)]"
              >
                <LogOut className="size-4" />
                Sign out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
