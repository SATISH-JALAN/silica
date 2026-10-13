import { decodeAbiParameters, encodeAbiParameters, type Address, type Hex } from "viem";

/** ABI of DeliveryOracle.Report — the single payload both CRE workflows write. */
export const reportAbi = [
  {
    type: "tuple",
    components: [
      { name: "chainSelector", type: "uint64" },
      { name: "scheduledAt", type: "uint64" },
      {
        name: "verdicts",
        type: "tuple[]",
        components: [
          { name: "ticketId", type: "uint256" },
          { name: "hour", type: "uint32" },
          { name: "providerOk", type: "uint8" },
          { name: "providerGpu", type: "bytes32" },
          { name: "providerSig", type: "bytes" },
          { name: "probeOk", type: "uint8" },
          { name: "probeGpu", type: "bytes32" },
          { name: "probeSig", type: "bytes" },
        ],
      },
      { name: "marks", type: "tuple[]", components: [{ name: "seriesId", type: "uint256" }, { name: "price", type: "uint128" }] },
      {
        name: "ratios",
        type: "tuple[]",
        components: [
          { name: "provider", type: "address" },
          { name: "seriesId", type: "uint256" },
          { name: "bondRatioBps", type: "uint16" },
        ],
      },
      { name: "checks", type: "tuple[]", components: [{ name: "provider", type: "address" }, { name: "seriesId", type: "uint256" }] },
    ],
  },
] as const;

export type ReportVerdict = {
  ticketId: bigint;
  hour: number;
  providerOk: number;
  providerGpu: Hex;
  providerSig: Hex;
  probeOk: number;
  probeGpu: Hex;
  probeSig: Hex;
};

export type Report = {
  chainSelector: bigint;
  scheduledAt: bigint;
  verdicts: ReportVerdict[];
  marks: { seriesId: bigint; price: bigint }[];
  ratios: { provider: Address; seriesId: bigint; bondRatioBps: number }[];
  checks: { provider: Address; seriesId: bigint }[];
};

export const ZERO32 = `0x${"0".repeat(64)}` as Hex;

export const encodeReport = (r: Report): Hex => encodeAbiParameters(reportAbi, [r]);
export const decodeReport = (hex: Hex): Report => decodeAbiParameters(reportAbi, hex)[0] as unknown as Report;

export const emptyReport = (chainSelector: bigint, scheduledAt: bigint): Report => ({
  chainSelector,
  scheduledAt,
  verdicts: [],
  marks: [],
  ratios: [],
  checks: [],
});
