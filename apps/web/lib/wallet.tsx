"use client";

// Minimal injected-wallet connection for Monad Testnet. This is a stand-in for
// the wagmi + RainbowKit stack in the architecture doc; the context shape
// (address, connect, disconnect) is what the components depend on.

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export const MONAD_TESTNET = {
  chainId: 10143,
  hex: "0x279f",
  name: "Monad Testnet",
  rpc: process.env.NEXT_PUBLIC_RPC_URL ?? "https://testnet-rpc.monad.xyz",
  explorer: "https://testnet.monadvision.com",
};

type Eip1193 = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, cb: (...a: unknown[]) => void) => void;
  removeListener?: (event: string, cb: (...a: unknown[]) => void) => void;
};

type WalletCtx = {
  address: string | null;
  chainOk: boolean;
  connecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
};

const Ctx = createContext<WalletCtx | null>(null);

const eth = () => (typeof window !== "undefined" ? (window as unknown as { ethereum?: Eip1193 }).ethereum : undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [chainOk, setChainOk] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const p = eth();
    if (!p?.on) return;
    const onAccounts = (a: unknown) => setAddress((a as string[])[0] ?? null);
    const onChain = (c: unknown) => setChainOk(parseInt(c as string, 16) === MONAD_TESTNET.chainId);
    p.on("accountsChanged", onAccounts);
    p.on("chainChanged", onChain);
    return () => {
      p.removeListener?.("accountsChanged", onAccounts);
      p.removeListener?.("chainChanged", onChain);
    };
  }, []);

  const connect = useCallback(async () => {
    const p = eth();
    setError(null);
    if (!p) {
      setError("No browser wallet found");
      return;
    }
    setConnecting(true);
    try {
      const accounts = (await p.request({ method: "eth_requestAccounts" })) as string[];
      setAddress(accounts[0] ?? null);
      try {
        await p.request({ method: "wallet_switchEthereumChain", params: [{ chainId: MONAD_TESTNET.hex }] });
      } catch {
        await p.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: MONAD_TESTNET.hex,
            chainName: MONAD_TESTNET.name,
            nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
            rpcUrls: [MONAD_TESTNET.rpc],
            blockExplorerUrls: [MONAD_TESTNET.explorer],
          }],
        });
      }
      const chain = (await p.request({ method: "eth_chainId" })) as string;
      setChainOk(parseInt(chain, 16) === MONAD_TESTNET.chainId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection rejected");
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => setAddress(null), []);

  return <Ctx.Provider value={{ address, chainOk, connecting, error, connect, disconnect }}>{children}</Ctx.Provider>;
}

export function useWallet() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useWallet outside WalletProvider");
  return c;
}
