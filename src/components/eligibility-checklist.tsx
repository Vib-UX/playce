"use client";

import { motion } from "framer-motion";
import { Check, X, Loader2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

export type CheckState = "pending" | "checking" | "pass" | "fail";

export interface EligibilityItem {
  key: string;
  label: string;
  description: string;
  state: CheckState;
}

function StateIcon({ state }: { state: CheckState }) {
  const base = "flex size-7 items-center justify-center rounded-full";
  switch (state) {
    case "pass":
      return (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 18 }}
          className={cn(base, "bg-[var(--success)] text-white")}
        >
          <Check className="size-4" strokeWidth={3} />
        </motion.span>
      );
    case "fail":
      return (
        <span className={cn(base, "bg-[var(--destructive)] text-white")}>
          <X className="size-4" strokeWidth={3} />
        </span>
      );
    case "checking":
      return (
        <span className={cn(base, "bg-secondary text-secondary-foreground")}>
          <Loader2 className="size-4 animate-spin" />
        </span>
      );
    default:
      return (
        <span className={cn(base, "border border-border text-muted-foreground")}>
          <Circle className="size-3 fill-current opacity-40" />
        </span>
      );
  }
}

export function EligibilityChecklist({ items }: { items: EligibilityItem[] }) {
  return (
    <ul className="space-y-1">
      {items.map((item) => (
        <li
          key={item.key}
          className={cn(
            "flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors",
            item.state === "pass" && "bg-[color-mix(in_oklab,var(--success)_6%,transparent)]",
            item.state === "fail" && "bg-[color-mix(in_oklab,var(--destructive)_6%,transparent)]",
          )}
        >
          <StateIcon state={item.state} />
          <div className="min-w-0">
            <p
              className={cn(
                "text-sm font-medium",
                item.state === "pending" && "text-muted-foreground",
              )}
            >
              {item.label}
            </p>
            <p className="text-xs text-muted-foreground">{item.description}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
