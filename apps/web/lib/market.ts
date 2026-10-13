"use client";

// One market hook for the trading screen. Live: book depth from SilicaBook (chain), trades
// and candles from Envio, with new fills streamed from Trade events when Envio is absent.
// Without a deployment the labelled client-side simulation in lib/live.ts is used.

import { useEffect, useMemo, useState } from "react";
import { usePublicClient } from "wagmi";
import { silicaBookAbi } from "@silica/shared/abis";
import { useLiveMarket } from "./live";
import { A, useBookLive, useSeriesLive } from "./onchain";
import { HAS_ENVIO, useCandles, useTrades } from "./envio";
import { LIVE, SERIES_LIST } from "./series";
import type { Candle, Series, Trade } from "./mock";

export type MarketView = {
  mark: number;
  book: { bids: { price: number; hours: number }[]; asks: { price: number; hours: number }[] };
  trades: Trade[];
  candles: Candle[] | null | undefined; // undefined = demo history
  addTrade: (t: Omit<Trade, "id" | "at">) => void;
  refresh: () => void;
  source: "live" | "demo";
};

function useMarketLive(series: Series): MarketView {
  const live = useSeriesLive().map.get(series.seriesId);
  const book = useBookLive(series.seriesId);
  const envioTrades = useTrades(series.seriesId);
  const envioCandles = useCandles(series.seriesId);
  const [streamed, setStreamed] = useState<Trade[]>([]);

  // new fills straight from the chain: poll the last ~90 blocks of Trade logs (works on
  // any RPC, unlike filters); Envio supplies the full history
  const pc = usePublicClient();
  useEffect(() => {
    if (!pc) return;
    let stop = false;
    const tick = async () => {
      try {
        const latest = await pc.getBlockNumber();
        const logs = await pc.getContractEvents({
          address: A.book,
          abi: silicaBookAbi,
          eventName: "Trade",
          args: { seriesId: BigInt(series.seriesId) },
          fromBlock: latest > 90n ? latest - 90n : 0n,
          toBlock: latest,
        });
        if (stop || !logs.length) return;
        setStreamed((prev) => {
          const have = new Set(prev.map((t) => t.id));
          const add = logs
            .map((l) => ({
              id: `${l.blockNumber}-${l.logIndex}`, // same key as the Envio Trade entity
              price: Number(l.args.price ?? 0n) / 1e6,
              hours: Number(l.args.hrs ?? 0),
              takerBuys: Boolean(l.args.takerBuys),
              at: Date.now(),
            }))
            .filter((t) => !have.has(t.id))
            .reverse();
          return add.length ? [...add, ...prev].slice(0, 30) : prev;
        });
      } catch {
        /* transient RPC errors: try again next tick */
      }
    };
    void tick();
    const id = setInterval(tick, 2_000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [pc, series.seriesId]);

  const trades = useMemo(() => {
    const indexed: Trade[] = (envioTrades.data?.Trade ?? []).map((t) => ({
      id: t.id,
      price: Number(t.price) / 1e6,
      hours: t.hours,
      takerBuys: t.takerBuys,
      at: Number(t.at) * 1000,
    }));
    const seen = new Set(indexed.map((t) => t.id));
    const fresh = streamed.filter((t) => !seen.has(t.id));
    return [...fresh, ...indexed].slice(0, 30);
  }, [envioTrades.data, streamed]);

  const candles = useMemo<Candle[] | null | undefined>(() => {
    if (!HAS_ENVIO) return undefined;
    if (!envioCandles.data) return null;
    return envioCandles.data.Candle.map((c) => ({
      time: Number(c.bucketStart),
      open: Number(c.open) / 1e6,
      high: Number(c.high) / 1e6,
      low: Number(c.low) / 1e6,
      close: Number(c.close) / 1e6,
      volume: Number(c.volumeHours),
    }));
  }, [envioCandles.data]);

  return {
    mark: live?.mark ?? series.mark,
    book: { bids: book.bids, asks: book.asks },
    trades,
    candles: HAS_ENVIO ? (candles ?? []) : [],
    addTrade: () => {},
    refresh: () => void book.refetch(),
    source: "live",
  };
}

function useMarketDemo(series: Series): MarketView {
  const m = useLiveMarket(series);
  return { ...m, candles: undefined, refresh: () => {}, source: "demo" };
}

/** Chosen once at build time from the deployment file, so hook order never changes. */
export const useMarket = LIVE ? useMarketLive : useMarketDemo;

/** Marks aligned with SERIES_LIST: live chain marks when deployed, seeded marks otherwise */
function useCurveMarksLive() {
  const live = useSeriesLive().map;
  return SERIES_LIST.map((s) => live.get(s.seriesId)?.mark ?? s.mark);
}
const useCurveMarksDemo = () => SERIES_LIST.map((s) => s.mark);
export const useCurveMarks = LIVE ? useCurveMarksLive : useCurveMarksDemo;
