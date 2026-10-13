"use client";

// wagmi + RainbowKit for Monad Testnet (viem's built-in `monadTestnet`), with a primary and
// a fallback RPC. A dev-only burner wallet (local test key) is added on localhost when
// NEXT_PUBLIC_DEV_BURNER_KEY is set, so write flows can be tested without a real wallet.

import { connectorsForWallets, type Wallet } from "@rainbow-me/rainbowkit";
import { injectedWallet, metaMaskWallet, rabbyWallet, walletConnectWallet } from "@rainbow-me/rainbowkit/wallets";
import { createConfig, createConnector, fallback, http, injected } from "wagmi";
import { monadTestnet } from "wagmi/chains";
import { createPublicClient, createWalletClient, http as viemHttp, toHex, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

export const RPC = process.env.NEXT_PUBLIC_RPC_URL ?? "https://testnet-rpc.monad.xyz";
export const RPC_FALLBACK = process.env.NEXT_PUBLIC_RPC_FALLBACK ?? "https://rpc.ankr.com/monad_testnet";
const WC_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_ID;
const BURNER_KEY = process.env.NEXT_PUBLIC_DEV_BURNER_KEY as Hex | undefined;

/** EIP-1193 provider backed by a local test key (dev only, never shipped to production) */
function burnerProvider(key: Hex) {
  const account = privateKeyToAccount(key);
  const wc = createWalletClient({ account, chain: monadTestnet, transport: viemHttp(RPC) });
  const pc = createPublicClient({ chain: monadTestnet, transport: viemHttp(RPC) });
  return {
    async request({ method, params }: { method: string; params?: unknown[] }) {
      const p = (params ?? []) as never[];
      switch (method) {
        case "eth_requestAccounts":
        case "eth_accounts":
          return [account.address];
        case "eth_chainId":
          return toHex(monadTestnet.id);
        case "wallet_switchEthereumChain":
        case "wallet_addEthereumChain":
        case "wallet_requestPermissions":
          return null;
        case "personal_sign":
          return account.signMessage({ message: { raw: p[0] as Hex } });
        case "eth_signTypedData_v4":
          return account.signTypedData(JSON.parse(p[1] as string));
        case "eth_sendTransaction": {
          const tx = p[0] as { to: Hex; data?: Hex; value?: Hex; gas?: Hex };
          return wc.sendTransaction({
            to: tx.to,
            data: tx.data,
            value: tx.value ? BigInt(tx.value) : undefined,
            gas: tx.gas ? BigInt(tx.gas) : undefined,
          });
        }
        default:
          return pc.request({ method, params } as never);
      }
    },
    on() {},
    removeListener() {},
  };
}

const burnerWallet = (): Wallet => ({
  id: "silica-burner",
  name: "Dev burner (local test key)",
  iconUrl: "/icon.png",
  iconBackground: "#060504",
  installed: true,
  createConnector: (details) =>
    createConnector((config) => ({
      ...injected({ target: () => ({ id: "silica-burner", name: "Dev burner", provider: burnerProvider(BURNER_KEY!) as never }) })(config),
      ...details,
    })),
});

const isLocal = typeof window !== "undefined" && /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
const recommended = [metaMaskWallet, rabbyWallet, injectedWallet, ...(WC_ID ? [walletConnectWallet] : [])];

const connectors = connectorsForWallets(
  [
    { groupName: "Wallets", wallets: recommended },
    ...(BURNER_KEY && isLocal ? [{ groupName: "Development", wallets: [burnerWallet] }] : []),
  ],
  { appName: "Silica", projectId: WC_ID ?? "silica-no-walletconnect" },
);

export const wagmiConfig = createConfig({
  chains: [monadTestnet],
  connectors,
  transports: { [monadTestnet.id]: fallback([http(RPC), http(RPC_FALLBACK)]) },
  ssr: true,
  pollingInterval: 1_000,
});

export { monadTestnet };
