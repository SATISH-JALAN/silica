"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { gsap, useGSAP, MOTION_OK } from "@/animations/gsap";
import { NumberRoll } from "@/components/ui/motion";
import { DemoBadge } from "@/components/ui/kit";
import { getSeries, SERIES } from "@/lib/mock";
import { useLiveMarket, useNow } from "@/lib/live";
import { countdown, int, price, signedPct, usd, utcDay } from "@/lib/format";
import { PriceChart } from "./PriceChart";
import { OrderBook } from "./OrderBook";
import { RecentTrades } from "./RecentTrades";
import { OrderForm } from "./OrderForm";
import { BondRiskPanel } from "./BondRiskPanel";

export function TradeView({ seriesId }: { seriesId: string }) {
  const series = getSeries(seriesId)!;
  const { mark, book, trades, addTrade } = useLiveMarket(series);
  const now = useNow();
  const [picked, setPicked] = useState<{ price: number; side: "buy" | "sell"; n: number }>();
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
        {SERIES.map((s) => (
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
          <p className={`num text-[11px] ${series.change24h >= 0 ? "text-bid" : "text-ask"}`}>{signedPct(series.change24h)} 24h</p>
        </div>
        <HeadStat k="Delivery window" v={`${utcDay(series.deliveryStart)} → ${utcDay(series.deliveryEnd)}`} sub={windowLabel} />
        <HeadStat k="Open interest" v={`${int(series.openInterestHours)} h`} />
        <HeadStat k="Bond locked" v={usd(series.bondLocked, 0)} />
        <HeadStat k="Bond ratio · slash" v={`${series.bondRatioBps / 100}% · ${series.slashMultBps / 10000}×`} />
        <div className="ml-auto">
          <DemoBadge>Simulated liquidity</DemoBadge>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          <section className="tv-panel panel h-[440px] overflow-hidden p-2">
            <PriceChart series={series} lastTrade={trades[0]} />
          </section>
          <section className="tv-panel panel overflow-hidden">
            <p className="label px-4 pt-4">Recent trades</p>
            <RecentTrades trades={trades} />
          </section>
        </div>
        <section className="tv-panel panel overflow-hidden xl:self-start">
          <p className="label px-4 pt-4">Order book</p>
          <OrderBook book={book} mark={mark} onPick={(p, side) => setPicked({ price: p, side, n: Date.now() })} />
        </section>
        <div className="flex flex-col gap-4">
          <section className="tv-panel panel">
            <OrderForm
              series={series}
              mark={mark}
              bestAsk={book.asks[0]?.price ?? mark}
              bestBid={book.bids[0]?.price ?? mark}
              picked={picked}
              onFill={(side, hours, p) => addTrade({ price: p, hours, takerBuys: side === "buy" })}
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
