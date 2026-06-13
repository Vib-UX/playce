"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Claim } from "@/lib/types";

interface PlayceState {
  claims: Claim[];
  addClaim: (claim: Claim) => void;
  getClaimById: (id: string) => Claim | undefined;
  getClaimByTokenId: (tokenId: string) => Claim | undefined;
  hasClaimedEvent: (eventId: string) => boolean;
  reset: () => void;
}

export const usePlayceStore = create<PlayceState>()(
  persist(
    (set, get) => ({
      claims: [],
      addClaim: (claim) =>
        set((state) =>
          state.claims.some((c) => c.id === claim.id)
            ? state
            : { claims: [claim, ...state.claims] },
        ),
      getClaimById: (id) => get().claims.find((c) => c.id === id),
      getClaimByTokenId: (tokenId) =>
        get().claims.find((c) => c.metadata.tokenId === tokenId),
      hasClaimedEvent: (eventId) =>
        get().claims.some((c) => c.eventId === eventId),
      reset: () => set({ claims: [] }),
    }),
    { name: "playce-state-v1" },
  ),
);
