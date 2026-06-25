"use client";

import { useCallback, useMemo, useState } from "react";
import { PlaycesAuthContext, type PlaycesAuthValue } from "./context";

function randomWallet(): string {
  const chars = "0123456789abcdef";
  let out = "0x";
  for (let i = 0; i < 40; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

/**
 * Demo auth: a faithful stand-in for the Privy email → embedded wallet flow so
 * the whole app is explorable without Privy credentials. Persists nothing
 * sensitive; the "wallet" is a deterministic-looking random address.
 */
export function DemoAuthProvider({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [email, setEmail] = useState<string>();
  const [wallet, setWallet] = useState<string>();

  const login = useCallback(async (inputEmail?: string) => {
    const finalEmail = inputEmail?.trim() || "guest@playces.fun";
    setEmail(finalEmail);
    // Simulate embedded wallet provisioning latency.
    await new Promise((r) => setTimeout(r, 650));
    setWallet(randomWallet());
    setAuthenticated(true);
  }, []);

  const logout = useCallback(() => {
    setAuthenticated(false);
    setEmail(undefined);
    setWallet(undefined);
  }, []);

  const value = useMemo<PlaycesAuthValue>(
    () => ({
      ready: true,
      authenticated,
      email,
      wallet,
      embedded: true,
      mode: "demo",
      login,
      logout,
      getAccessToken: async () => null,
    }),
    [authenticated, email, wallet, login, logout],
  );

  return (
    <PlaycesAuthContext.Provider value={value}>
      {children}
    </PlaycesAuthContext.Provider>
  );
}
