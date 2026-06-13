"use client";

import { useCallback, useMemo } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { PlayceAuthContext, type PlayceAuthValue } from "./context";

/**
 * Bridges Privy's hooks into the app-wide PlayceAuth context. Rendered only
 * when a Privy app id is configured (see Providers). Email login + embedded
 * wallet creation is configured on the PrivyProvider.
 */
export function PrivyAuthBridge({ children }: { children: React.ReactNode }) {
  const {
    ready,
    authenticated,
    user,
    login: privyLogin,
    logout,
    getAccessToken,
  } = usePrivy();
  const { wallets } = useWallets();

  const embeddedWallet = wallets.find((w) => w.walletClientType === "privy");
  const activeWallet = embeddedWallet ?? wallets[0];

  const login = useCallback(() => {
    privyLogin();
  }, [privyLogin]);

  const value = useMemo<PlayceAuthValue>(
    () => ({
      ready,
      authenticated,
      email: user?.email?.address ?? user?.google?.email ?? undefined,
      wallet: activeWallet?.address,
      embedded: Boolean(embeddedWallet),
      mode: "privy",
      login,
      logout,
      getAccessToken: async () => {
        try {
          return await getAccessToken();
        } catch {
          return null;
        }
      },
    }),
    [
      ready,
      authenticated,
      user,
      activeWallet,
      embeddedWallet,
      login,
      logout,
      getAccessToken,
    ],
  );

  return (
    <PlayceAuthContext.Provider value={value}>
      {children}
    </PlayceAuthContext.Provider>
  );
}
