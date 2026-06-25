"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Claim } from "@/lib/types";

interface PlaycesState {
  claims: Claim[];
  addClaim: (claim: Claim) => void;
  getClaimById: (id: string) => Claim | undefined;
  getClaimByTokenId: (tokenId: string) => Claim | undefined;
  hasClaimedEvent: (eventId: string) => boolean;
  reset: () => void;
}

export const usePlaycesStore = create<PlaycesState>()(
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
    { name: "playces-state-v1" },
  ),
);
