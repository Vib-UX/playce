"use client";

import { motion } from "framer-motion";
import {
  Navigation,
  Wallet,
  Swords,
  Gift,
  Flag,
  Bot,
} from "lucide-react";

const FEATURES = [
  {
    icon: Navigation,
    title: "You have to be there",
    desc: "Geofencing gates every game and reward to the venue — presence is the point.",
  },
  {
    icon: Wallet,
    title: "Embedded wallets",
    desc: "Email check-in provisions a wallet instantly. Onboarding without the jargon.",
  },
  {
    icon: Swords,
    title: "Head-to-head games",
    desc: "Throw the 67 against other attendees, stake p2p, and win the pot.",
  },
  {
    icon: Flag,
    title: "Rep your chain",
    desc: "Pick a sponsor AR skin — Chainlink, Pyth, Blink — and rep it in every match.",
  },
  {
    icon: Gift,
    title: "Airdrops & rewards",
    desc: "Unlock sponsor airdrops at the venue and collect a memorable onchain reward.",
  },
  {
    icon: Bot,
    title: "Humans & agents",
    desc: "A play-and-earn loop designed for people and autonomous agents to join.",
  },
];

export function WhyPlayces() {
  return (
    <section className="relative overflow-hidden border-y border-border bg-card/40">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-[var(--brand)]">Why Playces</p>
          <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            The venue is the game.
          </h2>
          <p className="mt-3 text-muted-foreground">
            A consumer-grade arena with onchain stakes underneath — fun on the
            surface, verifiable to the core.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ delay: i * 0.06 }}
              className="rounded-2xl border border-border bg-card p-5"
            >
              <f.icon className="size-5 text-[var(--brand)]" />
              <h3 className="mt-3 font-display font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
