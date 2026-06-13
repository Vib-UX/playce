import type { EIP1193Provider } from "@privy-io/react-auth";
import { ACTIVE_CHAIN, explorerBaseUrl } from "@/lib/chain";

const ACTIVE_CHAIN_HEX = `0x${ACTIVE_CHAIN.id.toString(16)}` as const;

type EthereumProvider = Pick<EIP1193Provider, "request">;

function activeChainRpcUrl(): string {
  return (
    process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL ??
    process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ??
    ACTIVE_CHAIN.rpcUrls.default.http[0]
  );
}

function isMetaMaskAnnouncement(detail: unknown): boolean {
  if (!detail || typeof detail !== "object") return false;
  const info = (detail as { info?: { rdns?: string; name?: string } }).info;
  const provider = (detail as { provider?: EthereumProvider }).provider;
  if (!info || typeof provider?.request !== "function") return false;
  return info.rdns === "io.metamask" || info.name === "MetaMask";
}

/** Resolve the in-browser MetaMask EIP-1193 provider (EIP-6963, then window.ethereum). */
export async function discoverMetaMaskProvider(): Promise<EthereumProvider | null> {
  if (typeof window === "undefined") return null;

  let provider: EthereumProvider | null = null;

  await new Promise<void>((resolve) => {
    const onAnnounce = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (isMetaMaskAnnouncement(detail)) {
        provider = (detail as { provider: EthereumProvider }).provider;
      }
    };

    window.addEventListener("eip6963:announceProvider", onAnnounce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));

    window.setTimeout(() => {
      window.removeEventListener("eip6963:announceProvider", onAnnounce);
      resolve();
    }, 400);
  });

  if (provider) return provider;

  const legacy = (window as Window & { ethereum?: EthereumProvider }).ethereum;
  if (legacy && typeof legacy.request === "function") return legacy;

  return null;
}

async function addActiveChainNetwork(provider: EthereumProvider): Promise<void> {
  await provider.request({
    method: "wallet_addEthereumChain",
    params: [
      {
        chainId: ACTIVE_CHAIN_HEX,
        chainName: ACTIVE_CHAIN.name,
        nativeCurrency: {
          name: ACTIVE_CHAIN.nativeCurrency.name,
          symbol: ACTIVE_CHAIN.nativeCurrency.symbol,
          decimals: ACTIVE_CHAIN.nativeCurrency.decimals,
        },
        rpcUrls: [activeChainRpcUrl()],
        blockExplorerUrls: [explorerBaseUrl()],
      },
    ],
  });
}

/**
 * Blink's iframe talks to MetaMask directly via EIP-6963 — not Privy's wrapper.
 * Switch network + confirm account on the native provider before opening Blink.
 */
export async function prepareNativeMetaMaskForBlink(
  expectedAddress: string,
): Promise<void> {
  const provider = await discoverMetaMaskProvider();
  if (!provider) {
    throw new Error("MetaMask extension not found. Install it or refresh the page.");
  }

  const accounts = (await provider.request({
    method: "eth_requestAccounts",
  })) as string[];

  const active = accounts[0]?.toLowerCase();
  const expected = expectedAddress.toLowerCase();

  if (!active || active !== expected) {
    throw new Error(
      `In MetaMask, switch to account ${expectedAddress.slice(0, 6)}…${expectedAddress.slice(-4)} (linked to Playce), then stake again.`,
    );
  }

  const chainId = (await provider.request({ method: "eth_chainId" })) as string;
  if (chainId.toLowerCase() !== ACTIVE_CHAIN_HEX.toLowerCase()) {
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: ACTIVE_CHAIN_HEX }],
      });
    } catch (err: unknown) {
      const code = (err as { code?: number })?.code;
      if (code === 4902) {
        await addActiveChainNetwork(provider);
      } else {
        throw new Error(
          `Approve the ${ACTIVE_CHAIN.name} network switch in MetaMask, then try staking again.`,
        );
      }
    }
  }

  const afterSwitch = (await provider.request({ method: "eth_chainId" })) as string;
  if (afterSwitch.toLowerCase() !== ACTIVE_CHAIN_HEX.toLowerCase()) {
    throw new Error(`MetaMask must be on ${ACTIVE_CHAIN.name} before authorizing USDC.`);
  }
}
