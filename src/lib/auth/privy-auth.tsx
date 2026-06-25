"use client";

import { useCallback, useMemo } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { PlaycesAuthContext, type PlaycesAuthValue } from "./context";

/**
 * Bridges Privy's hooks into the app-wide PlaycesAuth context. Rendered only
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
  const externalWallet = wallets.find(
    (w) => w.type === "ethereum" && w.walletClientType !== "privy",
  );
  // Prefer MetaMask / external wallets for onchain actions — Blink surfaces them in its picker.
  const activeWallet =
    externalWallet ?? embeddedWallet ?? wallets.find((w) => w.type === "ethereum");

  const login = useCallback(() => {
    privyLogin();
  }, [privyLogin]);

  const value = useMemo<PlaycesAuthValue>(
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
    <PlaycesAuthContext.Provider value={value}>
      {children}
    </PlaycesAuthContext.Provider>
  );
}
