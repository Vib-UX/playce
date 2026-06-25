"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { EnsTicket } from "@/lib/ens";

interface EnsTicketState {
  tickets: EnsTicket[];
  addTicket: (ticket: EnsTicket) => void;
  getTicketByEventId: (eventId: string) => EnsTicket | undefined;
  reset: () => void;
}

export const useEnsTicketStore = create<EnsTicketState>()(
  persist(
    (set, get) => ({
      tickets: [],
      addTicket: (ticket) =>
        set((state) => {
          // De-dupe by name; newest ticket for an event replaces the old one.
          const others = state.tickets.filter(
            (t) => t.name !== ticket.name && t.eventId !== ticket.eventId,
          );
          return { tickets: [ticket, ...others] };
        }),
      getTicketByEventId: (eventId) =>
        get().tickets.find((t) => t.eventId === eventId),
      reset: () => set({ tickets: [] }),
    }),
    { name: "playces-ens-tickets-v1" },
  ),
);
