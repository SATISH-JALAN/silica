"use client";

import { useEffect, useRef, useState } from "react";
import type { IChartApi, IPriceLine, ISeriesApi, UTCTimestamp } from "lightweight-charts";
import { candlesFor, type Candle, type Series, type Trade } from "@/lib/mock";

const THEME = {
  text: "#9a8b74",
  grid: "rgba(232,205,160,0.04)",
  border: "rgba(232,205,160,0.1)",
  cross: "rgba(226,179,110,0.4)",
  crossLabel: "#b9813e",
  gold: "#e2b36e",
};

async function makeChart(el: HTMLDivElement) {
  const lc = await import("lightweight-charts");
  const chart = lc.createChart(el, {
    autoSize: true,
    layout: {
      background: { type: lc.ColorType.Solid, color: "transparent" },
      textColor: THEME.text,
      fontFamily: "var(--font-jetbrains), monospace",
      fontSize: 11,
      attributionLogo: false,
    },
    grid: { vertLines: { color: THEME.grid }, horzLines: { color: "rgba(232,205,160,0.05)" } },
    rightPriceScale: { borderColor: THEME.border, scaleMargins: { top: 0.14, bottom: 0.24 } },
    timeScale: { borderColor: THEME.border, timeVisible: true, secondsVisible: false, rightOffset: 4 },
    crosshair: {
      vertLine: { color: THEME.cross, labelBackgroundColor: THEME.crossLabel },
      horzLine: { color: THEME.cross, labelBackgroundColor: THEME.crossLabel },
    },
  });
  return { lc, chart };
}

/**
 * Price chart (TradingView lightweight-charts) in the Silica palette. Live: the trade tape from
 * Envio (plus fills streamed from the chain), resampled to even time buckets and drawn as a
 * stepped price line with volume and the CRE mark. Demo: the seeded hourly candles.
 */
export function PriceChart({
  series,
  lastTrade,
  history,
  tape,
  mark,
}: {
  series: Series;
  lastTrade?: Trade;
  history?: Candle[] | null;
  tape?: Trade[];
  mark?: number;
}) {
  return history !== undefined ? <TapeChart tape={tape ?? []} mark={mark ?? series.mark} /> : <CandleChart series={series} lastTrade={lastTrade} />;
}

// ───────────────────────── live: trade tape ─────────────────────────

const STEPS = [60, 300, 900, 3600, 4 * 3600, 24 * 3600]; // bucket sizes, seconds
const MAX_BUCKETS = 240;

/** Even time buckets from the first fill to now; price carries forward between fills */
function resample(tape: Trade[], nowMs: number) {
  const fills = [...tape].sort((a, b) => a.at - b.at);
  if (!fills.length) return null;
  const t0 = fills[0].at / 1000;
  const t1 = Math.max(nowMs / 1000, t0);
  const step = STEPS.find((s) => (t1 - t0) / s <= 160) ?? STEPS.at(-1)!;
  const start = Math.floor(t0 / step) * step;
  const end = Math.floor(t1 / step) * step;
  const price: { time: UTCTimestamp; value: number }[] = [];
  const volume: { time: UTCTimestamp; value: number; color: string }[] = [];
  let i = 0;
  let last = fills[0].price;
  for (let t = start; t <= end; t += step) {
    let hours = 0;
    let buys = 0;
    while (i < fills.length && fills[i].at / 1000 < t + step) {
      last = fills[i].price;
      hours += fills[i].hours;
      buys += fills[i].takerBuys ? fills[i].hours : 0;
      i++;
    }
    price.push({ time: t as UTCTimestamp, value: last });
    if (hours > 0) volume.push({ time: t as UTCTimestamp, value: hours, color: buys >= hours / 2 ? "rgba(130,196,156,0.45)" : "rgba(226,113,93,0.45)" });
  }
  return { step, price: price.slice(-MAX_BUCKETS), volume: volume.filter((v) => v.time >= price.slice(-MAX_BUCKETS)[0].time) };
}

function TapeChart({ tape, mark }: { tape: Trade[]; mark: number }) {
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const line = useRef<ISeriesApi<"Area"> | null>(null);
  const vol = useRef<ISeriesApi<"Histogram"> | null>(null);
  const markLine = useRef<IPriceLine | null>(null);
  const markRef = useRef(mark);
  const [ready, setReady] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  markRef.current = mark;

  // extend the line to "now" as time passes
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let disposed = false;
    (async () => {
      if (!el.current) return;
      const { lc, chart: c } = await makeChart(el.current);
      if (disposed) return void c.remove();
      const area = c.addSeries(lc.AreaSeries, {
        lineColor: THEME.gold,
        topColor: "rgba(226,179,110,0.26)",
        bottomColor: "rgba(226,179,110,0.02)",
        lineWidth: 2,
        lineType: lc.LineType.WithSteps,
        priceLineColor: "rgba(226,179,110,0.55)",
        priceFormat: { type: "price", precision: 2, minMove: 0.01 },
        crosshairMarkerBackgroundColor: THEME.gold,
        crosshairMarkerBorderColor: "#060504",
        // keep at least ±4% around the action (and the mark) so a one-tick move isn't a cliff
        autoscaleInfoProvider: (base: () => { priceRange: { minValue: number; maxValue: number } } | null) => {
          const r = base();
          if (!r) return r;
          const lo = Math.min(r.priceRange.minValue, markRef.current);
          const hi = Math.max(r.priceRange.maxValue, markRef.current);
          const mid = (lo + hi) / 2;
          const half = Math.max(((hi - lo) / 2) * 1.25, mid * 0.04);
          return { priceRange: { minValue: mid - half, maxValue: mid + half } };
        },
      });
      const v = c.addSeries(lc.HistogramSeries, { priceScaleId: "vol", priceFormat: { type: "volume" }, lastValueVisible: false, priceLineVisible: false });
      c.priceScale("vol").applyOptions({ scaleMargins: { top: 0.86, bottom: 0 } });
      markLine.current = area.createPriceLine({
        price: markRef.current,
        color: "rgba(232,205,160,0.45)",
        lineWidth: 1,
        lineStyle: lc.LineStyle.Dashed,
        axisLabelVisible: true,
        title: "mark",
      });
      chart.current = c;
      line.current = area;
      vol.current = v;
      setReady(true);
    })();
    return () => {
      disposed = true;
      chart.current?.remove();
      chart.current = null;
      line.current = null;
      vol.current = null;
      markLine.current = null;
    };
  }, []);

  const data = resample(tape, now);
  const key = `${tape.length}:${tape[0]?.id}:${Math.floor(now / 30_000)}`;
  useEffect(() => {
    if (!ready || !line.current || !vol.current || !chart.current) return;
    line.current.setData(data?.price ?? []);
    vol.current.setData(data?.volume ?? []);
    chart.current.timeScale().applyOptions({ secondsVisible: false, timeVisible: (data?.step ?? 60) < 24 * 3600 });
    chart.current.timeScale().applyOptions({ rightOffset: 1 });
    chart.current.timeScale().fitContent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, key]);

  useEffect(() => {
    markLine.current?.applyOptions({ price: mark });
  }, [mark, ready]);

  return (
    <div className="relative h-full w-full">
      <div ref={el} className="h-full min-h-[320px] w-full" />
      {!tape.length && (
        <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-[12px] text-dust">No trades yet in this series: the first fill starts the chart.</p>
      )}
    </div>
  );
}

// ───────────────────────── demo: seeded hourly candles ─────────────────────────

function CandleChart({ series, lastTrade }: { series: Series; lastTrade?: Trade }) {
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const candles = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const last = useRef<{ time: number; open: number; high: number; low: number; close: number } | null>(null);

  useEffect(() => {
    let disposed = false;
    (async () => {
      if (!el.current) return;
      const { lc, chart: c } = await makeChart(el.current);
      if (disposed) return void c.remove();
      const cs = c.addSeries(lc.CandlestickSeries, {
        upColor: "#82c49c",
        downColor: "#e2715d",
        borderVisible: false,
        wickUpColor: "rgba(130,196,156,0.7)",
        wickDownColor: "rgba(226,113,93,0.7)",
        priceFormat: { type: "price", precision: 2, minMove: 0.01 },
      });
      const vol = c.addSeries(lc.HistogramSeries, { priceScaleId: "vol", priceFormat: { type: "volume" } });
      c.priceScale("vol").applyOptions({ scaleMargins: { top: 0.84, bottom: 0 } });
      chart.current = c;
      candles.current = cs;
      // anchor the seeded demo history to "now"
      const nowH = Math.floor(Date.now() / 3_600_000) * 3600;
      const data = candlesFor(series, 168, nowH + 3600);
      cs.setData(data.map((d) => ({ time: d.time as UTCTimestamp, open: d.open, high: d.high, low: d.low, close: d.close })));
      vol.setData(data.map((d) => ({ time: d.time as UTCTimestamp, value: d.volume, color: d.close >= d.open ? "rgba(130,196,156,0.25)" : "rgba(226,113,93,0.25)" })));
      c.timeScale().setVisibleLogicalRange({ from: Math.max(0, data.length - 72), to: data.length + 2 });
      last.current = data.length ? { ...data[data.length - 1] } : null;
    })();
    return () => {
      disposed = true;
      chart.current?.remove();
      chart.current = null;
      candles.current = null;
    };
  }, [series]);

  // demo trades extend the current candle, or open the next hour's
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

  return <div ref={el} className="h-full min-h-[320px] w-full" />;
}
