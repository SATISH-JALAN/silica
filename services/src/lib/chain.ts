import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  type Abi,
  type Account,
  type Address,
  type ContractFunctionArgs,
  type ContractFunctionName,
  type Hash,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { monadTestnet } from "viem/chains";
import type { Deployment } from "@silica/shared";

export function chainFor(d: Deployment, rpc: string) {
  if (d.chainId === monadTestnet.id) return { ...monadTestnet, rpcUrls: { default: { http: [rpc] } } };
  // local anvil: Multicall3 is copied to its canonical address before running services
  return defineChain({
    id: d.chainId,
    name: `local-${d.chainId}`,
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpc] } },
    contracts: { multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" } },
  });
}

export function clients(d: Deployment, rpc = process.env.RPC_URL ?? "https://testnet-rpc.monad.xyz") {
  const chain = chainFor(d, rpc);
  const publicClient = createPublicClient({ chain, transport: http(rpc, { retryCount: 4, retryDelay: 400 }), pollingInterval: 1_000 });
  const wallet = (key: string) =>
    createWalletClient({ chain, account: privateKeyToAccount(key as `0x${string}`), transport: http(rpc, { retryCount: 2 }) });
  return { chain, publicClient, wallet };
}

type Wallet = ReturnType<ReturnType<typeof clients>["wallet"]>;
type Public = ReturnType<typeof clients>["publicClient"];

/**
 * Write with a tight explicit gas limit: Monad charges the limit, not the gas used, so we
 * estimate and pad 20% instead of sending a blanket high limit. Waits for the receipt.
 */
export async function send<const abi extends Abi, fn extends ContractFunctionName<abi, "nonpayable" | "payable">>(
  pc: Public,
  w: Wallet,
  req: { address: Address; abi: abi; functionName: fn; args: ContractFunctionArgs<abi, "nonpayable" | "payable", fn> },
): Promise<{ hash: Hash; status: "success" | "reverted" }> {
  const account = w.account as Account;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = req as any;
  const est = await pc.estimateContractGas({ ...r, account });
  const hash = await w.writeContract({ ...r, account, chain: w.chain, gas: (est * 120n) / 100n });
  const receipt = await pc.waitForTransactionReceipt({ hash, timeout: 60_000 });
  return { hash, status: receipt.status };
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
