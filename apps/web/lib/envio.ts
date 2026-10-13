"use client";

// Envio HyperIndex GraphQL. History and derived data (trades, candles, tickets with per-hour
// verdicts, provider reliability, CRE reports) come from here; polled every 2 seconds.
// Without NEXT_PUBLIC_ENVIO_URL the hooks stay idle and views fall back to labelled demo data.

import { useQuery } from "@tanstack/react-query";

export const ENVIO_URL = process.env.NEXT_PUBLIC_ENVIO_URL;
export const HAS_ENVIO = Boolean(ENVIO_URL);

async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const r = await fetch(ENVIO_URL!, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const j = (await r.json()) as { data?: T; errors?: { message: string }[] };
  if (j.errors?.length) throw new Error(j.errors[0].message);
  return j.data as T;
}

export function useEnvio<T>(key: unknown[], query: string, variables?: Record<string, unknown>, refetchMs = 2_000) {
  return useQuery({
    queryKey: ["envio", ...key],
    queryFn: () => gql<T>(query, variables),
    enabled: HAS_ENVIO,
    refetchInterval: refetchMs,
  });
}

// ───────────────────────── typed queries ─────────────────────────

export type ESeries = {
  id: string;
  week: number;
  mark: string;
  openInterestHours: string;
  volumeHours: string;
  volumeUsdc: string;
  tradeCount: number;
  lastPrice: string;
  bondLocked: string;
};
export const useSeriesStats = () =>
  useEnvio<{ Series: ESeries[] }>(
    ["series"],
    `{ Series(order_by: {week: asc}) { id week mark openInterestHours volumeHours volumeUsdc tradeCount lastPrice bondLocked } }`,
  );

export type ETrade = { id: string; price: string; hours: number; takerBuys: boolean; at: string; txHash: string; taker: string; maker: string };
export const useTrades = (seriesId: number, limit = 30) =>
  useEnvio<{ Trade: ETrade[] }>(
    ["trades", seriesId, limit],
    `query($s: String!, $n: Int!) { Trade(where: {series_id: {_eq: $s}}, order_by: {at: desc}, limit: $n) { id price hours takerBuys at txHash taker maker } }`,
    { s: String(seriesId), n: limit },
  );

export type ECandle = { bucketStart: string; open: string; high: string; low: string; close: string; volumeHours: string };
export const useCandles = (seriesId: number) =>
  useEnvio<{ Candle: ECandle[] }>(
    ["candles", seriesId],
    `query($s: String!) { Candle(where: {series_id: {_eq: $s}}, order_by: {bucketStart: asc}, limit: 500) { bucketStart open high low close volumeHours } }`,
    { s: String(seriesId) },
    10_000,
  );

export type EProvider = {
  id: string;
  bondLocked: string;
  bondSlashed: string;
  hoursMinted: string;
  hoursConfirmed: string;
  hoursMissed: string;
  hoursDisputed: string;
  reliabilityBps: number;
  marginCalls: number;
  openMarginCalls: number;
  positions: { series_id: string; bond: string; minted: string; settled: string; marginCalled: boolean; bondRatioBps: number }[];
};
export const useProviders = () =>
  useEnvio<{ Provider: EProvider[] }>(
    ["providers"],
    `{ Provider(order_by: {id: asc}) { id bondLocked bondSlashed hoursMinted hoursConfirmed hoursMissed hoursDisputed reliabilityBps marginCalls openMarginCalls positions { series_id bond minted settled marginCalled bondRatioBps } } }`,
    undefined,
    5_000,
  );

export type ETicket = {
  id: string;
  series_id: string;
  provider_id: string;
  holder: string;
  hours: number;
  confirmed: number;
  missed: number;
  disputed: number;
  priceAtOpen: string;
  slashPaid: string;
  status: "Open" | "AccessPosted" | "Settled";
  openedAt: string;
  accessDeadline: string;
  accessPostedAt: string;
  ciphertext: string;
  redeemTx: string;
  accessTx: string;
  verdicts: { hour: number; kind: "confirmed" | "missed" | "disputed"; txHash: string }[];
};
const TICKET_FIELDS = `id series_id provider_id holder hours confirmed missed disputed priceAtOpen slashPaid status openedAt accessDeadline accessPostedAt ciphertext redeemTx accessTx verdicts(order_by: {hour: asc}) { hour kind txHash }`;
export const useTicketsOf = (holder?: string | null) =>
  useEnvio<{ Ticket: ETicket[] }>(
    ["tickets", holder ?? "all"],
    holder
      ? `query($h: String!) { Ticket(where: {holder: {_eq: $h}}, order_by: {openedAt: desc}, limit: 20) { ${TICKET_FIELDS} } }`
      : `{ Ticket(order_by: {openedAt: desc}, limit: 6) { ${TICKET_FIELDS} } }`,
    holder ? { h: holder.toLowerCase() } : undefined,
  );

export type EReport = { id: string; scheduledAt: string; verdicts: number; applied: number; marks: number; ratios: number; checks: number; relayed: boolean; at: string; txHash: string };
export const useCreReports = () =>
  useEnvio<{ CreReport: EReport[] }>(
    ["reports"],
    `{ CreReport(order_by: {at: desc}, limit: 8) { id scheduledAt verdicts applied marks ratios checks relayed at txHash } }`,
    undefined,
    5_000,
  );

export type EStats = { tickets: number; hoursRedeemed: string; hoursConfirmed: string; hoursMissed: string; slashedUsdc: string; trades: number; volumeUsdc: string; reports: number };
export const useStats = () =>
  useEnvio<{ Stats: EStats[] }>(["stats"], `{ Stats(where: {id: {_eq: "global"}}) { tickets hoursRedeemed hoursConfirmed hoursMissed slashedUsdc trades volumeUsdc reports } }`, undefined, 5_000);

export const usd6 = (v: string | bigint | number) => Number(v) / 1e6;
