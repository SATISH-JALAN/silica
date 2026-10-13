"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { gsap, useGSAP, MOTION_OK } from "@/animations/gsap";
import { NumberRoll } from "@/components/ui/motion";
import { DemoBadge } from "@/components/ui/kit";
import { getSeriesBySlug, LIVE, SERIES_LIST } from "@/lib/series";
import { useNow } from "@/lib/live";
import { useMarket } from "@/lib/market";
import { useKuruBook } from "@/lib/onchain";
import { HAS_ENVIO, useSeriesStats } from "@/lib/envio";
import { countdown, int, price, signedPct, usd, utcDay } from "@/lib/format";
import { PriceChart } from "./PriceChart";
import { OrderBook } from "./OrderBook";
import { RecentTrades } from "./RecentTrades";
import { OrderForm } from "./OrderForm";
import { BondRiskPanel } from "./BondRiskPanel";

export function TradeView({ seriesId }: { seriesId: string }) {
  const base = getSeriesBySlug(seriesId)!;
  const { mark, book, trades, tape, candles, addTrade, refresh, source } = useMarket(base);
  // live series numbers from Envio (open interest, bond); demo values otherwise
  const stats = useSeriesStats().data?.Series.find((x) => Number(x.id) === base.seriesId);
  const series = stats
    ? { ...base, mark, openInterestHours: Number(stats.openInterestHours), volumeHours: Number(stats.volumeHours), bondLocked: Number(stats.bondLocked) / 1e6 }
    : { ...base, mark };
  const now = useNow();
  const [picked, setPicked] = useState<{ price: number; side: "buy" | "sell"; n: number }>();
  const kuruBook = useKuruBook(series.seriesId);
  const [venue, setVenue] = useState<"silica" | "kuru">("silica");
  const onKuru = venue === "kuru" && kuruBook.live;
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.from(".tv-head > *", { y: 14, opacity: 0, stagger: 0.05, duration: 0.6, delay: 0.1 });
        gsap.from(".tv-panel", { y: 24, opacity: 0, stagger: 0.07, duration: 0.7, delay: 0.25, ease: "power3.out" });
      });
    },
    { scope: root },
  );

  const toStart = series.deliveryStart.getTime() - now;
  const windowLabel = now === 0 ? "" : toStart > 0 ? `opens in ${countdown(toStart)}` : series.deliveryEnd.getTime() > now ? "redeemable now" : "expired";

  return (
    <div ref={root}>
      {/* series switcher */}
      <div className="flex gap-2 overflow-x-auto pb-4">
        {SERIES_LIST.map((s) => (
          <Link
            key={s.id}
            href={`/markets/${s.id}`}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 font-display text-[10px] tracking-[0.18em] transition-colors ${
              s.id === series.id ? "border-gold/50 bg-gold/10 text-cream" : "border-line text-dust hover:text-cream"
            }`}
          >
            {s.code}
          </Link>
        ))}
      </div>

      {/* header */}
      <div className="tv-head panel flex flex-wrap items-center gap-x-8 gap-y-4 px-5 py-4">
        <div>
          <p className="font-display text-sm tracking-[0.2em] text-cream">{series.code}</p>
          <p className="num mt-1 text-[11px] text-dust">{series.symbol} / USDC</p>
        </div>
        <div>
          <p className="num text-2xl text-cream">
            $<NumberRoll value={mark} format={price} duration={0.4} />
          </p>
          {source === "demo" ? (
            <p className={`num text-[11px] ${series.change24h >= 0 ? "text-bid" : "text-ask"}`}>{signedPct(series.change24h)} 24h</p>
          ) : (
            <p className="num text-[11px] text-dust">mark · CRE Mark &amp; Margin</p>
          )}
        </div>
        <HeadStat k="Delivery window" v={`${utcDay(series.deliveryStart)} → ${utcDay(series.deliveryEnd)}`} sub={windowLabel} />
        <HeadStat k="Open interest" v={`${int(series.openInterestHours)} h`} />
        <HeadStat k="Bond locked" v={usd(series.bondLocked, 0)} />
        <HeadStat k="Bond ratio · slash" v={`${series.bondRatioBps / 100}% · ${series.slashMultBps / 10000}×`} />
        <div className="ml-auto">
          <DemoBadge>{LIVE ? "Monad Testnet · simulated liquidity" : "Demo data · not deployed"}</DemoBadge>
          {LIVE && !HAS_ENVIO && <p className="num mt-1 text-right text-[10px] text-ash">history needs the Envio indexer</p>}
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          <section className="tv-panel panel h-[440px] overflow-hidden p-2">
            <PriceChart series={base} lastTrade={trades[0]} history={candles} tape={tape} mark={mark} />
          </section>
          <section className="tv-panel panel overflow-hidden">
            <p className="label px-4 pt-4">Recent trades</p>
            <RecentTrades trades={trades} />
          </section>
        </div>
        <section className="tv-panel panel overflow-hidden xl:self-start">
          <div className="flex items-center justify-between gap-2 px-4 pt-4">
            <p className="label whitespace-nowrap">Order book</p>
            {kuruBook.live && (
              <div className="flex shrink-0 rounded-full border border-line p-0.5 text-[10px]">
                {(["silica", "kuru"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setVenue(v)}
                    className={`whitespace-nowrap rounded-full px-2.5 py-1 transition-colors ${venue === v ? "bg-gold/15 text-cream" : "text-ash hover:text-cream"}`}
                  >
                    {v === "silica" ? "SilicaBook" : "Kuru"}
                  </button>
                ))}
              </div>
            )}
          </div>
          {!kuruBook.live && LIVE && kuruBook.market && <p className="px-4 pt-1 text-[10px] text-ash">SilicaBook · Kuru Spot V2 listing requested</p>}
          <OrderBook book={onKuru ? { bids: kuruBook.bids, asks: kuruBook.asks } : book} mark={mark} onPick={(p, side) => setPicked({ price: p, side, n: Date.now() })} />
          {onKuru && (
            <p className="px-4 pb-4 pt-2 text-[10px] text-ash">
              Live Kuru book for this series (read onchain). Orders on Kuru settle through your Kuru AccountCore balance; the form trades on SilicaBook.
            </p>
          )}
        </section>
        <div className="flex flex-col gap-4">
          <section className="tv-panel panel">
            <OrderForm
              series={series}
              mark={mark}
              bestAsk={book.asks[0]?.price ?? mark}
              bestBid={book.bids[0]?.price ?? mark}
              picked={picked}
              onFill={(side, hours, p) => {
                addTrade({ price: p, hours, takerBuys: side === "buy" });
                refresh();
              }}
            />
          </section>
          <section className="tv-panel panel">
            <BondRiskPanel series={series} mark={mark} />
          </section>
        </div>
      </div>
    </div>
  );
}

function HeadStat({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <div>
      <p className="label !text-[9px]">{k}</p>
      <p className="num mt-1 text-[13px] text-sand">{v}</p>
      {sub !== undefined && <p className="num text-[10px] text-gold">{sub || " "}</p>}
    </div>
  );
}
