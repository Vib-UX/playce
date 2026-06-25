import {
  getEmbeddedConnectedWallet,
  type ConnectedWallet,
} from "@privy-io/react-auth";

/** External wallets (MetaMask, etc.) are visible to Blink via EIP-6963. */
export function isExternalWallet(wallet: ConnectedWallet): boolean {
  return wallet.walletClientType !== "privy";
}

/**
 * Wallet used for Blink staking. Prefers a connected external wallet (e.g.
 * MetaMask) because Blink's picker surfaces those; falls back to embedded.
 */
export function getBlinkStakingWallet(
  wallets: ConnectedWallet[],
  preferredAddress?: string,
): ConnectedWallet | null {
  const ethereumWallets = wallets.filter((w) => w.type === "ethereum");
  if (ethereumWallets.length === 0) return null;

  if (preferredAddress) {
    const match = ethereumWallets.find(
      (w) => w.address.toLowerCase() === preferredAddress.toLowerCase(),
    );
    if (match) return match;
  }

  const external = ethereumWallets.find((w) => isExternalWallet(w));
  return external ?? getEmbeddedConnectedWallet(wallets) ?? ethereumWallets[0] ?? null;
}

export function stakingWalletLabel(wallet: ConnectedWallet): string {
  if (wallet.walletClientType === "metamask") return "MetaMask";
  if (wallet.walletClientType === "privy") return "Playces Wallet";
  return wallet.meta.name || "Wallet";
}
