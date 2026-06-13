"use client";

import { motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import type { MintStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STEPS: { key: MintStatus; label: string }[] = [
  { key: "preparing", label: "Preparing claim" },
  { key: "signing", label: "Signing securely" },
  { key: "submitting", label: "Submitting to Base" },
  { key: "confirming", label: "Confirming onchain" },
];

const ORDER: MintStatus[] = [
  "idle",
  "preparing",
  "signing",
  "submitting",
  "confirming",
  "success",
];

export function MintProgress({ status }: { status: MintStatus }) {
  const currentIdx = ORDER.indexOf(status);

  return (
    <ol className="space-y-2.5">
      {STEPS.map((step) => {
        const stepIdx = ORDER.indexOf(step.key);
        const done = currentIdx > stepIdx || status === "success";
        const active = status === step.key;
        return (
          <li key={step.key} className="flex items-center gap-3">
            <span
              className={cn(
                "flex size-6 items-center justify-center rounded-full text-xs transition-colors",
                done
                  ? "bg-[var(--success)] text-white"
                  : active
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-muted-foreground",
              )}
            >
              {done ? (
                <Check className="size-3.5" strokeWidth={3} />
              ) : active ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <span className="size-1.5 rounded-full bg-current opacity-50" />
              )}
            </span>
            <span
              className={cn(
                "text-sm transition-colors",
                done || active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {step.label}
            </span>
            {active && (
              <motion.span
                layout
                className="ml-auto text-xs text-muted-foreground"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                working…
              </motion.span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
