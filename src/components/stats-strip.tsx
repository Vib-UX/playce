"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { Users, BadgeCheck, Sparkles } from "lucide-react";
import type { PlaycesEvent } from "@/lib/types";

function Counter({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const duration = 900;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(eased * value));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value]);

  return <span ref={ref}>{display.toLocaleString()}</span>;
}

export function StatsStrip({ event }: { event: PlaycesEvent }) {
  const stats = [
    { label: "RSVPs", value: event.rsvpCount, icon: Users },
    { label: "Verified attendees", value: event.verifiedCount, icon: BadgeCheck },
    { label: "Moments claimed", value: event.claimCount, icon: Sparkles },
  ];
  return (
    <div className="grid grid-cols-3 gap-3 rounded-2xl border border-border bg-card/60 p-4">
      {stats.map((s, i) => (
        <motion.div
          key={s.label}
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.08 }}
          className="text-center"
        >
          <s.icon className="mx-auto size-4 text-muted-foreground" />
          <p className="mt-1.5 font-display text-xl font-semibold sm:text-2xl">
            <Counter value={s.value} />
          </p>
          <p className="text-[11px] text-muted-foreground sm:text-xs">{s.label}</p>
        </motion.div>
      ))}
    </div>
  );
}
