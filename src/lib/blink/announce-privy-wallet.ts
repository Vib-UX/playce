import type { EIP1193Provider } from "@privy-io/react-auth";

/** Stable EIP-6963 identity for Playce's Privy embedded wallet bridge. */
const PLAYCE_PRIVY_WALLET_UUID = "7f3c8b2a-9e41-4d5c-a8f6-2b1e0d9c4a73";
const PLAYCE_PRIVY_RDNS = "app.playce.privy";

export interface AnnouncedPrivyWallet {
  uuid: string;
  address: string;
  provider: EIP1193Provider;
}

function announce(
  provider: EIP1193Provider,
  address: string,
): void {
  const info = {
    uuid: PLAYCE_PRIVY_WALLET_UUID,
    name: "Playce Wallet",
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='16' fill='%23ff2e88'/%3E%3C/svg%3E",
    rdns: PLAYCE_PRIVY_RDNS,
  };

  window.dispatchEvent(
    new CustomEvent("eip6963:announceProvider", {
      detail: Object.freeze({ info, provider }),
    }),
  );

  if (process.env.NODE_ENV === "development") {
    console.debug("[blink-bridge] announced Privy wallet", {
      address: address.slice(0, 6) + "…" + address.slice(-4),
      rdns: PLAYCE_PRIVY_RDNS,
    });
  }
}

let activeTeardown: (() => void) | null = null;

/**
 * Expose the Privy embedded wallet to Blink's EIP-6963 wallet bridge so the
 * hosted flow can request USDC approvals and send transactions.
 */
export function announcePrivyWallet(
  provider: EIP1193Provider,
  address: string,
): () => void {
  activeTeardown?.();

  const onRequest = () => announce(provider, address);

  announce(provider, address);
  window.addEventListener("eip6963:requestProvider", onRequest);

  const teardown = () => {
    window.removeEventListener("eip6963:requestProvider", onRequest);
    if (activeTeardown === teardown) activeTeardown = null;
  };
  activeTeardown = teardown;
  return teardown;
}

export function getAnnouncedPrivyWalletUuid(): string {
  return PLAYCE_PRIVY_WALLET_UUID;
}
