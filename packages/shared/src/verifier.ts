import type { Address } from "viem";
import type { SignedSummary } from "./eip712";
import { ZERO32, type Report, type ReportVerdict } from "./report";
import { TICK, ratioFor } from "./units";

/**
 * Pure decision logic shared by the CRE workflows and the testnet relay. The contract
 * re-derives every verdict from the signatures, so this only assembles evidence; it can
 * never make a bad hour pass.
 */

export type HourEvidence = { ticketId: bigint; hour: number; provider: SignedSummary | null; probe: SignedSummary | null };

export function buildVerdicts(evidence: HourEvidence[]): ReportVerdict[] {
  return evidence
    .filter((e) => e.provider || e.probe)
    .map((e) => ({
      ticketId: e.ticketId,
      hour: e.hour,
      providerOk: e.provider?.okChecks ?? 0,
      providerGpu: e.provider?.gpuIdHash ?? ZERO32,
      providerSig: e.provider?.signature ?? "0x",
      probeOk: e.probe?.okChecks ?? 0,
      probeGpu: e.probe?.gpuIdHash ?? ZERO32,
      probeSig: e.probe?.signature ?? "0x",
    }));
}

/** Hours of a ticket that are due for a verdict and not yet applied. */
export function dueHours(o: { accessPostedAt: bigint; hrs: number; now: bigint; hourSeconds: bigint; applied: (h: number) => boolean }) {
  if (o.accessPostedAt === 0n) return [];
  const elapsed = Number((o.now - o.accessPostedAt) / o.hourSeconds);
  const out: number[] = [];
  for (let h = 0; h < Math.min(elapsed, o.hrs); h++) if (!o.applied(h)) out.push(h);
  return out;
}

export type SeriesQuote = { seriesId: bigint; mark: bigint; bid: bigint; ask: bigint };
export type ProviderRecord = { address: Address; confirmed: number; missed: number };

/**
 * Mark & Margin: new mark = order-book mid (snapped to the tick) when both sides quote;
 * bond ratio per provider from its Envio delivery record; a margin check for every
 * provider position so under-bonded providers are flagged.
 */
export function markAndMargin(input: {
  series: SeriesQuote[];
  providers: ProviderRecord[];
  positions: { provider: Address; seriesId: bigint }[];
}): Pick<Report, "marks" | "ratios" | "checks"> {
  const marks = input.series.flatMap((s) => {
    if (s.bid === 0n || s.ask === 0n || s.ask <= s.bid) return [];
    const mid = ((s.bid + s.ask) / 2n / TICK) * TICK;
    return mid !== s.mark ? [{ seriesId: s.seriesId, price: mid }] : [];
  });
  const ratios = input.providers.flatMap((p) =>
    input.positions
      .filter((x) => x.provider.toLowerCase() === p.address.toLowerCase())
      .map((x) => ({ provider: p.address, seriesId: x.seriesId, bondRatioBps: ratioFor(p.confirmed, p.missed) })),
  );
  return { marks, ratios, checks: input.positions };
}
