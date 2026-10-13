"use client";

import Link from "next/link";
import { useRef } from "react";
import { gsap, useGSAP, MOTION_OK } from "@/animations/gsap";
import { ForwardCurve } from "./ForwardCurve";
import { BondGauge, DemoBadge, PageHeader, Sparkline } from "@/components/ui/kit";
import { NumberRoll } from "@/components/ui/motion";
import { candlesFor, PLANNED, type Series } from "@/lib/mock";
import { useLiveMarks } from "@/lib/live";
import { LIVE, SERIES_LIST as SERIES } from "@/lib/series";
import { useSeriesLive } from "@/lib/onchain";
import { useCandles, useSeriesStats } from "@/lib/envio";

/** Live marks from the chain when deployed; the drifting demo marks otherwise */
function useMarks() {
  const demo = useLiveMarks(SERIES);
  const live = useSeriesLive();
  return LIVE ? SERIES.map((s) => live.map.get(s.seriesId)?.mark ?? s.mark) : demo;
}

function Spark({ s, up }: { s: Series; up: boolean }) {
  const c = useCandles(s.seriesId).data?.Candle;
  const values = LIVE ? (c ?? []).slice(-48).map((x) => Number(x.close) / 1e6) : candlesFor(s, 48).map((x) => x.close);
  return values.length > 1 ? <Sparkline values={values} up={up} className="h-10 w-28" /> : <span className="num text-[10px] text-ash">no trades yet</span>;
}
import { compact, int, price, signedPct, usd, utcDay } from "@/lib/format";

export function MarketsView() {
  const marks = useMarks();
  const stats = useSeriesStats().data?.Series;
  const statOf = (s: Series) => stats?.find((x) => Number(x.id) === s.seriesId);
  const supply = useSeriesLive().map;
  // live numbers: open interest from token supply (chain), volume and bond from Envio
  const view = SERIES.map((s) => {
    const e = statOf(s);
    return {
      ...s,
      openInterestHours: LIVE ? (supply.get(s.seriesId)?.supplyHours ?? 0) : s.openInterestHours,
      volumeHours: LIVE ? Number(e?.volumeHours ?? 0) : s.volumeHours,
      bondLocked: LIVE ? Number(e?.bondLocked ?? 0) / 1e6 : s.bondLocked,
      volumeUsdc: LIVE ? Number(e?.volumeUsdc ?? 0) / 1e6 : s.volumeHours * s.mark,
    };
  });
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.from(".mk-stat", { y: 20, opacity: 0, stagger: 0.06, duration: 0.6, delay: 0.2 });
        gsap.from(".mk-card", { y: 40, opacity: 0, stagger: 0.08, duration: 0.8, delay: 0.35, ease: "power3.out" });
        gsap.from(".spark-line", { drawSVG: "0%", duration: 1.2, stagger: 0.08, delay: 0.6, ease: "power2.inOut" });
        gsap.from(".mk-planned", { opacity: 0, y: 16, stagger: 0.05, duration: 0.6, scrollTrigger: { trigger: ".mk-planned-wrap", start: "top 90%", toggleActions: "play none none none" } });
      });
    },
    { scope: root },
  );

  const totalOI = view.reduce((a, s) => a + s.openInterestHours, 0);
  const totalVol = view.reduce((a, s) => a + s.volumeUsdc, 0);
  const totalBond = view.reduce((a, s) => a + s.bondLocked, 0);

  return (
    <div ref={root}>
      <PageHeader label="Markets · H100-80GB · APAC" title="The compute forward curve">
        <DemoBadge>{LIVE ? "Monad Testnet · simulated liquidity" : "Demo data · not deployed"}</DemoBadge>
      </PageHeader>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-4">
        {[
          ["Open interest", `${compact(totalOI)} h`],
          [LIVE ? "Volume traded" : "24h volume", usd(totalVol, 0)],
          ["Bond locked", usd(totalBond, 0)],
          ["Series live", `${SERIES.length} weeks`],
        ].map(([k, v]) => (
          <div key={k} className="mk-stat bg-night px-5 py-4">
            <p className="label !text-[9px]">{k}</p>
            <p className="num mt-2 text-xl text-cream">{v}</p>
          </div>
        ))}
      </div>

      <section id="curve" className="panel relative mt-6 overflow-hidden p-4 sm:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_100%,rgba(226,179,110,0.1),transparent_60%)]" />
        <div className="relative mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="label">Forward curve · USDC per GPU-hour</p>
          <p className="num text-[11px] text-dust">mark = order-book mid, posted hourly by CRE Mark &amp; Margin</p>
        </div>
        <ForwardCurve trigger="load" height={300} points={SERIES.map((s, i) => ({ label: `W${s.week}`, sub: utcDay(s.deliveryStart), value: marks[i] }))} />
      </section>

      <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {view.map((s, i) => {
          const coverage = s.openInterestHours > 0 ? s.bondLocked / (s.openInterestHours * marks[i] * 1.5) : 1;
          return (
            <Link key={s.id} href={`/markets/${s.id}`} className="mk-card panel group relative block overflow-hidden p-6 transition-colors duration-500 hover:border-gold/40">
              <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(226,179,110,0.16),transparent_65%)] opacity-0 transition-opacity duration-700 group-hover:opacity-100" />
              <div className="relative flex items-start justify-between">
                <div>
                  <p className="font-display text-xs tracking-[0.2em] text-cream">{s.code}</p>
                  <p className="num mt-1.5 text-[11px] text-dust">
                    {utcDay(s.deliveryStart)} → {utcDay(s.deliveryEnd)} UTC
                  </p>
                </div>
                <span className="rounded-full border border-line px-2 py-0.5 text-[10px] text-dust">W{s.week}</span>
              </div>
              <div className="relative mt-8 flex items-end justify-between gap-4">
                <div>
                  <p className="num text-3xl text-cream">
                    $<NumberRoll value={marks[i]} format={price} duration={0.4} />
                  </p>
                  {LIVE ? (
                    <p className="num mt-1 text-xs text-dust" suppressHydrationWarning>{Date.now() >= s.deliveryStart.getTime() && Date.now() <= s.deliveryEnd.getTime() ? "delivering now" : "forward"}</p>
                  ) : (
                    <p className={`num mt-1 text-xs ${s.change24h >= 0 ? "text-bid" : "text-ask"}`}>{signedPct(s.change24h)} 24h</p>
                  )}
                </div>
                <Spark s={s} up={s.change24h >= 0} />
              </div>
              <div className="relative mt-6 grid grid-cols-2 gap-3 text-[11px]">
                <div>
                  <p className="text-dust">Open interest</p>
                  <p className="num mt-0.5 text-sand">{int(s.openInterestHours)} h</p>
                </div>
                <div>
                  <p className="text-dust">{LIVE ? "Volume" : "Volume 24h"}</p>
                  <p className="num mt-0.5 text-sand">{int(s.volumeHours)} h</p>
                </div>
              </div>
              <div className="relative mt-5">
                <BondGauge coverage={coverage} label="Bond covers open hours at 1.5× slash" />
              </div>
              <p className="relative mt-5 text-[12px] text-gold transition-colors group-hover:text-gold-hot">Trade →</p>
            </Link>
          );
        })}
      </div>

      <div className="mk-planned-wrap mt-14">
        <p className="label">Planned series</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PLANNED.map((p) => (
            <div key={p.code} className="mk-planned rounded-xl border border-dashed border-line px-5 py-4">
              <p className="font-display text-[11px] tracking-[0.2em] text-dust">{p.code}</p>
              <p className="mt-1 text-[11px] text-ash">{p.note}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
