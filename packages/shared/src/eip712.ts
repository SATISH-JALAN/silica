import type { Address, Hex } from "viem";

/** EIP-712 typed data for hourly delivery evidence, verified onchain by DeliveryOracle. */
export const hourSummaryTypes = {
  HourSummary: [
    { name: "ticketId", type: "uint256" },
    { name: "hour", type: "uint32" },
    { name: "okChecks", type: "uint8" },
    { name: "gpuIdHash", type: "bytes32" },
  ],
} as const;

export const silicaDomain = (chainId: number, verifyingContract: Address) =>
  ({ name: "Silica", version: "1", chainId, verifyingContract }) as const;

export type HourSummary = { ticketId: bigint; hour: number; okChecks: number; gpuIdHash: Hex };

export type SignedSummary = {
  ticketId: string;
  hour: number;
  okChecks: number;
  gpuIdHash: Hex;
  signer: Address;
  signature: Hex;
};
