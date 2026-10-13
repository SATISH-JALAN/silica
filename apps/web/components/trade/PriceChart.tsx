"use client";

import { useEffect, useRef } from "react";
import type { IChartApi, ISeriesApi, UTCTimestamp } from "lightweight-charts";
import { candlesFor, type Candle, type Series, type Trade } from "@/lib/mock";

/**
 * Hourly candles (TradingView lightweight-charts), themed to the Silica palette.
 * `history` comes from Envio's Candle entities when live; without it the seeded demo
 * history is drawn. Live trades extend (or open) the current hourly candle.
 */
export function PriceChart({ series, lastTrade, history }: { series: Series; lastTrade?: Trade; history?: Candle[] | null }) {
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const candles = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const last = useRef<{ time: number; open: number; high: number; low: number; close: number } | null>(null);
  const vols = useRef<ISeriesApi<"Histogram"> | null>(null);
  const live = history !== undefined;

  useEffect(() => {
    let disposed = false;
    (async () => {
      const lc = await import("lightweight-charts");
      if (disposed || !el.current) return;
      const c = lc.createChart(el.current, {
        autoSize: true,
        layout: {
          background: { type: lc.ColorType.Solid, color: "transparent" },
          textColor: "#9a8b74",
          fontFamily: "var(--font-jetbrains), monospace",
          fontSize: 11,
          attributionLogo: false,
        },
        grid: { vertLines: { color: "rgba(232,205,160,0.04)" }, horzLines: { color: "rgba(232,205,160,0.05)" } },
        rightPriceScale: { borderColor: "rgba(232,205,160,0.1)", scaleMargins: { top: 0.12, bottom: 0.26 } },
        timeScale: { borderColor: "rgba(232,205,160,0.1)", timeVisible: true, secondsVisible: false, rightOffset: 4 },
        crosshair: {
          vertLine: { color: "rgba(226,179,110,0.4)", labelBackgroundColor: "#b9813e" },
          horzLine: { color: "rgba(226,179,110,0.4)", labelBackgroundColor: "#b9813e" },
        },
      });
      const cs = c.addSeries(lc.CandlestickSeries, {
        upColor: "#82c49c",
        downColor: "#e2715d",
        borderVisible: false,
        wickUpColor: "rgba(130,196,156,0.7)",
        wickDownColor: "rgba(226,113,93,0.7)",
        priceFormat: { type: "price", precision: 2, minMove: 0.01 },
      });
      const vol = c.addSeries(lc.HistogramSeries, { priceScaleId: "vol", priceFormat: { type: "volume" }, color: "rgba(226,179,110,0.25)" });
      c.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

      chart.current = c;
      candles.current = cs;
      vols.current = vol;
      if (!live) {
        // anchor the seeded demo history to "now"
        const nowH = Math.floor(Date.now() / 3_600_000) * 3600;
        draw(candlesFor(series, 168, nowH + 3600));
      }
    })();
    return () => {
      disposed = true;
      chart.current?.remove();
      chart.current = null;
      candles.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, live]);

  function draw(data: Candle[]) {
    if (!candles.current || !vols.current || !chart.current) return;
    candles.current.setData(data.map((d) => ({ time: d.time as UTCTimestamp, open: d.open, high: d.high, low: d.low, close: d.close })));
    vols.current.setData(data.map((d) => ({ time: d.time as UTCTimestamp, value: d.volume, color: d.close >= d.open ? "rgba(130,196,156,0.25)" : "rgba(226,113,93,0.25)" })));
    if (data.length) chart.current.timeScale().setVisibleLogicalRange({ from: Math.max(0, data.length - 72), to: data.length + 2 });
    last.current = data.length ? { ...data[data.length - 1] } : null;
  }

  // Envio history (polled) replaces the series data
  const historyKey = history ? `${history.length}:${history.at(-1)?.time}:${history.at(-1)?.close}` : "";
  useEffect(() => {
    if (!history) return;
    const id = setInterval(() => {
      if (!candles.current) return;
      clearInterval(id);
      draw(history);
    }, 50);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyKey]);

  // live trades extend the current candle, or open the next hour's
  useEffect(() => {
    if (!lastTrade || !candles.current) return;
    const bucket = Math.floor(lastTrade.at / 3_600_000) * 3600;
    const b = last.current;
    if (!b || bucket > b.time) {
      last.current = { time: bucket, open: b?.close ?? lastTrade.price, high: lastTrade.price, low: lastTrade.price, close: lastTrade.price };
    } else {
      b.close = lastTrade.price;
      b.high = Math.max(b.high, lastTrade.price);
      b.low = Math.min(b.low, lastTrade.price);
    }
    const c = last.current!;
    candles.current.update({ ...c, time: c.time as UTCTimestamp, open: Math.min(Math.max(c.open, c.low), c.high) });
  }, [lastTrade]);

  return (
    <div className="relative h-full w-full">
      <div ref={el} className="h-full min-h-[320px] w-full" />
      {live && history && history.length === 0 && !lastTrade && (
        <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-[12px] text-dust">No trades yet in this series: the first fill opens the first candle.</p>
      )}
    </div>
  );

}
