"use client";

import { useEffect } from "react";
import { getEmbeddedConnectedWallet, useWallets } from "@privy-io/react-auth";
import { announcePrivyWallet } from "@/lib/blink/announce-privy-wallet";

/**
 * Announces the user's Privy embedded wallet via EIP-6963 so Blink's iframe
 * wallet bridge can discover it for USDC authorize + transfer on the active chain.
 *
 * Does not call switchChain here — that updates the wallets array and retriggers
 * this effect in a loop. Chain switching happens once on stake click instead.
 */
export function PrivyWalletBridge() {
  const { ready, wallets } = useWallets();
  const walletAddress = ready
    ? getEmbeddedConnectedWallet(wallets)?.address
    : undefined;

  useEffect(() => {
    if (!ready || !walletAddress) return;

    const wallet = getEmbeddedConnectedWallet(wallets);
    if (!wallet || wallet.address !== walletAddress) return;

    let cancelled = false;
    let teardown: (() => void) | undefined;

    (async () => {
      try {
        const provider = await wallet.getEthereumProvider();
        if (cancelled) return;
        teardown = announcePrivyWallet(provider, walletAddress);
      } catch (err) {
        if (process.env.NODE_ENV === "development") {
          console.warn("[blink-bridge] could not announce Privy wallet", err);
        }
      }
    })();

    return () => {
      cancelled = true;
      teardown?.();
    };
    // wallets intentionally omitted — only re-announce when the address changes
  }, [ready, walletAddress]);

  return null;
}
