"use client";

// Client-side market simulation that stands in for the Kuru WebSocket feed
// (L2 deltas + trades) during the testnet demo. Labelled as simulated in the UI.

import { useCallback, useEffect, useState } from "react";
import { bookFor, tradesFor, type Level, type Series, type Trade } from "./mock";

export type Book = { bids: Level[]; asks: Level[] };
type Market = { mark: number; book: Book; trades: Trade[]; seq: number };

const round2 = (n: number) => Math.round(n * 100) / 100;

function deepen(side: Level[], dir: 1 | -1, anchor: number) {
  const out = [...side];
  while (out.length < 12) {
    const last = out[out.length - 1];
    out.push({ price: round2((last?.price ?? anchor) + 0.01 * dir), hours: Math.round(10 + Math.random() * 120) });
  }
  return out;
}

/** One simulated tick of the book. Pure apart from Math.random. */
function step(m: Market, seriesId: number): Market {
  const seq = m.seq + 1;
  let mark = m.mark;
  let bids = m.book.bids.map((l) => ({ ...l }));
  let asks = m.book.asks.map((l) => ({ ...l }));
  let trades = m.trades;
  const r = Math.random();

  for (let k = 0; k < 3; k++) {
    const side = Math.random() < 0.5 ? bids : asks;
    const lvl = side[Math.floor(Math.random() * Math.min(side.length, 8))];
    if (lvl) lvl.hours = Math.max(5, lvl.hours + Math.round((Math.random() - 0.45) * 30));
  }

  if (r < 0.45) {
    const takerBuys = Math.random() < 0.52;
    const side = takerBuys ? asks : bids;
    const top = side[0];
    if (top) {
      const hours = Math.min(top.hours, Math.round(5 + Math.random() * 40));
      trades = [{ id: `live-${seriesId}-${seq}`, price: top.price, hours, takerBuys, at: Date.now() }, ...trades].slice(0, 30);
      const left = top.hours - hours;
      const next = left >= 5 ? [{ ...top, hours: left }, ...side.slice(1)] : side.slice(1);
      if (takerBuys) asks = next;
      else bids = next;
    }
  } else if (r > 0.9) {
    mark = round2(mark + (Math.random() < 0.5 ? -0.01 : 0.01));
    const fresh = bookFor(mark, seriesId * 13 + seq);
    bids = fresh.bids;
    asks = fresh.asks;
  }

  return { mark, seq, trades, book: { asks: deepen(asks, 1, mark), bids: deepen(bids, -1, mark) } };
}

export function useLiveMarket(series: Series, intervalMs = 1100) {
  const [m, setM] = useState<Market>(() => ({
    mark: series.mark,
    book: bookFor(series.mark, series.seriesId * 13),
    trades: tradesFor(series.mark, series.seriesId),
    seq: 0,
  }));

  useEffect(() => {
    // re-anchor the seeded trade times to the client's clock
    setM((s) => ({ ...s, trades: s.trades.map((x, i) => ({ ...x, at: Date.now() - i * 37_000 })) }));
    const id = setInterval(() => setM((s) => step(s, series.seriesId)), intervalMs);
    return () => clearInterval(id);
  }, [series.seriesId, intervalMs]);

  /** Record the user's own (simulated) fill */
  const addTrade = useCallback((t: Omit<Trade, "id" | "at">) => {
    setM((s) => ({ ...s, trades: [{ ...t, id: `me-${Date.now()}`, at: Date.now() }, ...s.trades].slice(0, 30) }));
  }, []);

  return { mark: m.mark, book: m.book, trades: m.trades, addTrade };
}

/** Marks that drift a tick now and then, for the forward curve and series grid */
export function useLiveMarks(series: Series[], intervalMs = 4000) {
  const [marks, setMarks] = useState(() => series.map((s) => s.mark));
  useEffect(() => {
    const id = setInterval(() => {
      setMarks((m) => m.map((v) => (Math.random() < 0.35 ? round2(v + (Math.random() < 0.5 ? -0.01 : 0.01)) : v)));
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return marks;
}

/** Ticks on an interval; 0 during SSR so markup is stable */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}
