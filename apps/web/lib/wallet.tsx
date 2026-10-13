"use client";

// Wallet layer: wagmi + RainbowKit on Monad Testnet. `useWallet()` keeps the small shape
// the components were written against (address, chainOk, connect, disconnect).

import "@rainbow-me/rainbowkit/styles.css";
import { RainbowKitProvider, darkTheme, useConnectModal } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { WagmiProvider, useAccount, useDisconnect, useSwitchChain } from "wagmi";
import { monadTestnet, wagmiConfig } from "./wagmi";

export const MONAD_TESTNET = {
  chainId: monadTestnet.id,
  hex: "0x279f",
  name: "Monad Testnet",
  rpc: process.env.NEXT_PUBLIC_RPC_URL ?? "https://testnet-rpc.monad.xyz",
  explorer: "https://testnet.monadvision.com",
};

const theme = darkTheme({
  accentColor: "#e2b36e",
  accentColorForeground: "#060504",
  borderRadius: "large",
  fontStack: "system",
  overlayBlur: "small",
});
theme.colors.modalBackground = "#110e0b";
theme.colors.modalBorder = "rgba(232,205,160,0.12)";
theme.colors.profileForeground = "#110e0b";
theme.colors.connectButtonBackground = "#110e0b";
theme.fonts.body = "var(--font-manrope), system-ui, sans-serif";

export function WalletProvider({ children }: { children: React.ReactNode }) {
  // keep polling when the tab is in the background: a market screen left open on a second
  // monitor (or recorded for the demo) must not freeze
  const [qc] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 1_500, refetchOnWindowFocus: false, refetchIntervalInBackground: true } } }));
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={qc}>
        <RainbowKitProvider theme={theme} modalSize="compact" initialChain={monadTestnet}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export function useWallet() {
  const { address, isConnecting, chainId } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  return {
    address: (address ?? null) as `0x${string}` | null,
    chainOk: chainId === monadTestnet.id,
    connecting: isConnecting,
    error: null as string | null,
    connect: async () => openConnectModal?.(),
    disconnect: () => disconnect(),
    switchToMonad: () => switchChain({ chainId: monadTestnet.id }),
  };
}
