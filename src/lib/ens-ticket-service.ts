"use client";

import type { PlayceEvent } from "@/lib/types";
import type { EnsTicket, TicketTier } from "@/lib/ens";

interface ClaimTicketArgs {
  event: PlayceEvent;
  wallet: string;
  email?: string;
  tier?: TicketTier;
  getAccessToken: () => Promise<string | null>;
}

/**
 * Claims an ENS subname ticket for the signed-in attendee via /api/ens/ticket.
 * The backend issues `<label>.playce.eth` to the wallet (gasless) and sets its
 * resolver records. Returns the resulting ticket (onchain or mock fallback).
 */
export async function claimEnsTicket({
  event,
  wallet,
  email,
  tier,
  getAccessToken,
}: ClaimTicketArgs): Promise<EnsTicket> {
  const accessToken = await getAccessToken().catch(() => null);

  const res = await fetch("/api/ens/ticket", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({
      slug: event.slug,
      address: wallet,
      email,
      tier,
      accessToken,
    }),
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "Could not issue your ENS ticket");
  }

  const data = (await res.json()) as { ticket: EnsTicket };
  return data.ticket;
}
