"use client";

import { createContext, useContext } from "react";

export type AuthMode = "privy" | "demo";

export interface PlayceAuthValue {
  /** Provider finished initializing. */
  ready: boolean;
  authenticated: boolean;
  email?: string;
  /** Active wallet address (embedded or connected). */
  wallet?: string;
  /** True when the wallet was provisioned for the user (email onboarding). */
  embedded: boolean;
  mode: AuthMode;
  /** Begin sign-in. Demo mode accepts an email; Privy opens its modal. */
  login: (email?: string) => void | Promise<void>;
  logout: () => void | Promise<void>;
  /** Privy access token for authenticating backend calls (null in demo mode). */
  getAccessToken: () => Promise<string | null>;
}

export const PlayceAuthContext = createContext<PlayceAuthValue | null>(null);

export function usePlayceAuth(): PlayceAuthValue {
  const ctx = useContext(PlayceAuthContext);
  if (!ctx) {
    throw new Error("usePlayceAuth must be used within a PlayceAuthProvider");
  }
  return ctx;
}

export const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";
export const PRIVY_ENABLED =
  PRIVY_APP_ID.length > 0 && PRIVY_APP_ID !== "demo";
