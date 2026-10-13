"use client";

// Writes: explicit, tight gas (Monad bills the gas *limit*), optimistic UI for under a
// second, then confirmation from the receipt. Contract custom errors become readable text.

import { useCallback, useState } from "react";
import { useConfig } from "wagmi";
import { getAccount, getPublicClient, waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { BaseError, ContractFunctionRevertedError, type Abi, type Address, type Hash } from "viem";
import { monadTestnet } from "./wagmi";

const FRIENDLY: Record<string, string> = {
  BondTooLow: "Bond too low for this mint",
  MarginCalled: "Margin call: top up this series before minting",
  NotProvider: "This wallet isn't a registered provider",
  OutsideDeliveryWindow: "Outside this series' delivery week",
  NotTickAligned: "Price must be on the $0.01 tick",
  BelowMinNotional: "Below the 10 USDC minimum order",
  SelfTrade: "That would trade against your own order",
  Slippage: "Price moved; nothing filled at your limit",
  FaucetCooldown: "Faucet: one draw per hour",
  ERC20InsufficientBalance: "Insufficient balance",
  ERC20InsufficientAllowance: "Approval needed",
  InsufficientCapacity: "Not enough minted capacity to assign",
  DeadlineNotPassed: "Access deadline hasn't passed",
  AccessAlreadyPosted: "Access already posted",
};

export function explain(e: unknown): string {
  if (e instanceof BaseError) {
    const revert = e.walk((x) => x instanceof ContractFunctionRevertedError) as ContractFunctionRevertedError | null;
    const name = revert?.data?.errorName;
    if (name) return FRIENDLY[name] ?? name;
    if (/User rejected|denied/i.test(e.message)) return "Rejected in wallet";
    return e.shortMessage;
  }
  return String(e).slice(0, 140);
}

export type Call = { address: Address; abi: Abi; functionName: string; args?: readonly unknown[] };

export function useSend() {
  const config = useConfig();
  const [pending, setPending] = useState<string | null>(null);

  const send = useCallback(
    async (label: string, call: Call): Promise<{ hash: Hash; ok: boolean }> => {
      setPending(label);
      try {
        const account = getAccount(config).address;
        if (!account) throw new Error("Connect a wallet first");
        const pc = getPublicClient(config, { chainId: monadTestnet.id })!;
        const est = await pc.estimateContractGas({ ...call, account } as never);
        const hash = await writeContract(config, { ...call, gas: (est * 120n) / 100n, chainId: monadTestnet.id } as never);
        const receipt = await waitForTransactionReceipt(config, { hash, chainId: monadTestnet.id });
        return { hash, ok: receipt.status === "success" };
      } finally {
        setPending(null);
      }
    },
    [config],
  );

  return { send, pending };
}

export const txUrl = (hash: string) => `https://testnet.monadvision.com/tx/${hash}`;
