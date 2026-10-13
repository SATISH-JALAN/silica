"use client";

import { useEffect, useRef } from "react";
import type { IChartApi, ISeriesApi, UTCTimestamp } from "lightweight-charts";
import { candlesFor, type Series, type Trade } from "@/lib/mock";

/** Hourly candles (TradingView lightweight-charts), themed to the Silica palette */
export function PriceChart({ series, lastTrade }: { series: Series; lastTrade?: Trade }) {
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const candles = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const last = useRef<{ time: number; open: number; high: number; low: number; close: number } | null>(null);

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

      // anchor the seeded history to "now"
      const nowH = Math.floor(Date.now() / 3_600_000) * 3600;
      const data = candlesFor(series, 168, nowH + 3600);
      cs.setData(data.map((d) => ({ time: d.time as UTCTimestamp, open: d.open, high: d.high, low: d.low, close: d.close })));
      vol.setData(data.map((d) => ({ time: d.time as UTCTimestamp, value: d.volume, color: d.close >= d.open ? "rgba(130,196,156,0.25)" : "rgba(226,113,93,0.25)" })));
      c.timeScale().setVisibleLogicalRange({ from: data.length - 72, to: data.length + 2 });
      last.current = { ...data[data.length - 1] };
      chart.current = c;
      candles.current = cs;
    })();
    return () => {
      disposed = true;
      chart.current?.remove();
      chart.current = null;
    };
  }, [series]);

  // live trades extend the current candle
  useEffect(() => {
    if (!lastTrade || !candles.current || !last.current) return;
    const b = last.current;
    b.close = lastTrade.price;
    b.high = Math.max(b.high, lastTrade.price);
    b.low = Math.min(b.low, lastTrade.price);
    candles.current.update({ ...b, time: b.time as UTCTimestamp });
  }, [lastTrade]);

  return <div ref={el} className="h-full min-h-[320px] w-full" />;
}
