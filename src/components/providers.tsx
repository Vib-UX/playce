"use client";

import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { http } from "viem";
import { PrivyProvider } from "@privy-io/react-auth";
import { WagmiProvider, createConfig } from "@privy-io/wagmi";
import { ACTIVE_CHAIN } from "@/lib/chain";
import { PRIVY_APP_ID, PRIVY_ENABLED } from "@/lib/auth/context";
import { PrivyAuthBridge } from "@/lib/auth/privy-auth";
import { DemoAuthProvider } from "@/lib/auth/demo-auth";

const wagmiConfig = createConfig({
  chains: [ACTIVE_CHAIN],
  transports: { [ACTIVE_CHAIN.id]: http() },
});

function Web3Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  if (!PRIVY_ENABLED) {
    // No Privy credentials → polished demo auth, app stays fully explorable.
    return (
      <QueryClientProvider client={queryClient}>
        <DemoAuthProvider>{children}</DemoAuthProvider>
      </QueryClientProvider>
    );
  }

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ["email", "google"],
        embeddedWallets: {
          ethereum: { createOnLogin: "users-without-wallets" },
        },
        defaultChain: ACTIVE_CHAIN,
        supportedChains: [ACTIVE_CHAIN],
        appearance: {
          theme: "dark",
          accentColor: "#ff2e88",
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>
          <PrivyAuthBridge>{children}</PrivyAuthBridge>
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <Web3Providers>{children}</Web3Providers>
    </ThemeProvider>
  );
}
