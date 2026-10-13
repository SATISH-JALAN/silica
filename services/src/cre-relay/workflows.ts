import type { Address, Hex } from "viem";
import {
  bondVaultAbi,
  buildVerdicts,
  dueHours,
  emptyReport,
  kuru,
  kuruLiveMarkets,
  kuruOrderBookAbi,
  kuruPriceToUsdc6,
  markAndMargin,
  redemptionManagerAbi,
  seriesList,
  seriesRegistryAbi,
  signedSummarySchema,
  silicaBookAbi,
  type Deployment,
  type HourEvidence,
  type Report,
  type SignedSummary,
} from "@silica/shared";
import type { clients } from "../lib/chain";

type Pc = ReturnType<typeof clients>["publicClient"];

/**
 * In-process mirror of the two CRE workflows (cre/delivery-verifier, cre/mark-and-margin),
 * built from the same shared decision code. Used when RELAY_MODE=local (anvil, or when the
 * CRE CLI is unavailable). In RELAY_MODE=cre the report bytes come from `cre workflow
 * simulate` instead and this file is not used.
 */

async function fetchSummary(base: string, ticketId: bigint, hour: number): Promise<SignedSummary | null> {
  try {
    const r = await fetch(`${base}/summary/${ticketId}/${hour}`, { signal: AbortSignal.timeout(5_000) });
    if (!r.ok) return null;
    const parsed = signedSummarySchema.safeParse(await r.json());
    return parsed.success ? (parsed.data as SignedSummary) : null;
  } catch {
    return null;
  }
}

export async function deliveryVerifier(o: { pc: Pc; d: Deployment; agentUrl: string; probeUrl: string; scheduledAt: bigint; maxVerdicts?: number }) {
  const { pc, d } = o;
  const rm = d.RedemptionManager as Address;
  const [ids, tickets] = await pc.readContract({ address: rm, abi: redemptionManagerAbi, functionName: "getOpenTickets", args: [0n, 200n] });
  const block = await pc.getBlock();
  const now = block.timestamp;
  const hourSeconds = BigInt(d.hourSeconds);

  const evidence: HourEvidence[] = [];
  for (let i = 0; i < ids.length; i++) {
    const t = tickets[i];
    if (t.status !== 1) continue;
    const candidates = dueHours({ accessPostedAt: t.accessPostedAt, hrs: t.hrs, now, hourSeconds, applied: () => false });
    if (!candidates.length) continue;
    const applied = await pc.multicall({
      contracts: candidates.map((h) => ({ address: rm, abi: redemptionManagerAbi, functionName: "verdictApplied", args: [ids[i], h] }) as const),
      allowFailure: false,
    });
    const due = candidates.filter((_, k) => !applied[k]);
    for (const h of due) {
      if (evidence.length >= (o.maxVerdicts ?? 60)) break;
      const [provider, probe] = await Promise.all([fetchSummary(o.agentUrl, ids[i], h), fetchSummary(o.probeUrl, ids[i], h)]);
      evidence.push({ ticketId: ids[i], hour: h, provider, probe });
    }
  }

  const report: Report = { ...emptyReport(BigInt(d.chainSelector), o.scheduledAt), verdicts: buildVerdicts(evidence) };
  return { report, evidence };
}

async function envioRecords(envioUrl: string | undefined): Promise<{ address: Address; confirmed: number; missed: number }[]> {
  if (!envioUrl) return [];
  try {
    const r = await fetch(envioUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "{ Provider { id hoursConfirmed hoursMissed } }" }),
      signal: AbortSignal.timeout(6_000),
    });
    const j = (await r.json()) as { data?: { Provider?: { id: string; hoursConfirmed: string; hoursMissed: string }[] } };
    return (j.data?.Provider ?? []).map((p) => ({ address: p.id as Address, confirmed: Number(p.hoursConfirmed), missed: Number(p.hoursMissed) }));
  } catch {
    return [];
  }
}

export async function markAndMarginWorkflow(o: { pc: Pc; d: Deployment; providers: Address[]; envioUrl?: string; scheduledAt: bigint }) {
  const { pc, d } = o;
  const series = seriesList(d);
  const reads = await pc.multicall({
    contracts: series.flatMap((s) => [
      { address: d.SeriesRegistry as Address, abi: seriesRegistryAbi, functionName: "getSeries", args: [BigInt(s.seriesId)] } as const,
      { address: d.SilicaBook as Address, abi: silicaBookAbi, functionName: "bestBidAsk", args: [BigInt(s.seriesId)] } as const,
    ]),
    allowFailure: false,
  });
  // a verified, two-sided Kuru Spot V2 book sets the mid; otherwise SilicaBook does
  const live = await kuruLiveMarkets(pc).catch(() => ({}) as Record<string, Address>);
  const kuruQuotes = Object.fromEntries(
    await Promise.all(
      Object.entries(live).map(async ([id, market]) => {
        const [bid, ask] = await pc.readContract({ address: market, abi: kuruOrderBookAbi, functionName: "bestBidAsk" });
        return [id, { bid: kuruPriceToUsdc6(bid, kuru.params.pricePrecision), ask: kuruPriceToUsdc6(ask, kuru.params.pricePrecision) }] as const;
      }),
    ),
  );
  const quotes = series.map((s, i) => {
    const info = reads[i * 2] as { markPrice: bigint };
    const [bid, ask] = reads[i * 2 + 1] as readonly [bigint, bigint];
    const k = kuruQuotes[String(s.seriesId)];
    return k && k.bid > 0n && k.ask > 0n
      ? { seriesId: BigInt(s.seriesId), mark: info.markPrice, bid: k.bid, ask: k.ask, source: "Kuru" }
      : { seriesId: BigInt(s.seriesId), mark: info.markPrice, bid, ask, source: "SilicaBook" };
  });

  const fromEnvio = await envioRecords(o.envioUrl);
  const records = o.providers.map(
    (p) => fromEnvio.find((r) => r.address.toLowerCase() === p.toLowerCase()) ?? { address: p, confirmed: 0, missed: 0 },
  );

  // only check positions that exist
  const positions: { provider: Address; seriesId: bigint }[] = [];
  const pos = await pc.multicall({
    contracts: o.providers.flatMap((p) =>
      series.map((s) => ({ address: d.BondVault as Address, abi: bondVaultAbi, functionName: "positionOf", args: [p, BigInt(s.seriesId)] }) as const),
    ),
    allowFailure: false,
  });
  o.providers.forEach((p, i) =>
    series.forEach((s, j) => {
      const position = pos[i * series.length + j] as { minted: bigint };
      if (position.minted > 0n) positions.push({ provider: p, seriesId: BigInt(s.seriesId) });
    }),
  );

  const parts = markAndMargin({ series: quotes, providers: records, positions });
  // only write ratios that change, so each report stays small (Monad bills the gas limit)
  const current = await pc.multicall({
    contracts: parts.ratios.map((r) => ({ address: d.BondVault as Address, abi: bondVaultAbi, functionName: "bondRatioOf", args: [r.provider, r.seriesId] }) as const),
    allowFailure: false,
  });
  parts.ratios = parts.ratios.filter((r, i) => Number(current[i]) !== r.bondRatioBps);
  // likewise only check a position whose mark or ratio moves in this report, or whose
  // margin-call flag disagrees with its bond right now (e.g. after a slash)
  const touched = new Set([...parts.marks.map((m) => `*:${m.seriesId}`), ...parts.ratios.map((r) => `${r.provider.toLowerCase()}:${r.seriesId}`)]);
  const state = await pc.multicall({
    contracts: parts.checks.flatMap((c) => [
      { address: d.BondVault as Address, abi: bondVaultAbi, functionName: "positionOf", args: [c.provider, c.seriesId] } as const,
      { address: d.BondVault as Address, abi: bondVaultAbi, functionName: "requiredBond", args: [c.provider, c.seriesId] } as const,
    ]),
    allowFailure: false,
  });
  parts.checks = parts.checks.filter((c, i) => {
    if (touched.has(`*:${c.seriesId}`) || touched.has(`${c.provider.toLowerCase()}:${c.seriesId}`)) return true;
    const p = state[i * 2] as { bond: bigint; marginCalled: boolean };
    return p.bond < (state[i * 2 + 1] as bigint) !== p.marginCalled;
  });
  const report: Report = { ...emptyReport(BigInt(d.chainSelector), o.scheduledAt), ...parts, verdicts: [] };
  return { report, quotes, records, reliabilitySource: fromEnvio.length ? "envio" : "default" };
}

export type RelayResult = { report: Report; hex?: Hex };
