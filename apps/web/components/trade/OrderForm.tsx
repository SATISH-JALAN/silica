"use client";

import { useEffect, useRef, useState } from "react";
import { gsap, useGSAP } from "@/animations/gsap";
import { Field, Row, Toast } from "@/components/ui/kit";
import { NumberRoll } from "@/components/ui/motion";
import type { Series } from "@/lib/mock";
import { MIN_NOTIONAL_USDC, minOrderHours, slashPayout } from "@/lib/units";
import { int, price, usd } from "@/lib/format";
import { useWallet } from "@/lib/wallet";

type Side = "buy" | "sell";

export function OrderForm({
  series,
  mark,
  bestAsk,
  bestBid,
  picked,
  onFill,
}: {
  series: Series;
  mark: number;
  bestAsk: number;
  bestBid: number;
  picked?: { price: number; side: Side; n: number };
  onFill: (side: Side, hours: number, price: number) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const { address, connect } = useWallet();
  const [side, setSide] = useState<Side>("buy");
  const [type, setType] = useState<"limit" | "market">("limit");
  const [px, setPx] = useState(price(series.mark));
  const [hrs, setHrs] = useState("20");
  const [bal, setBal] = useState({ usdc: 1_000, hours: 40 });
  const [status, setStatus] = useState<{ tone: "ok" | "err"; msg: string } | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!picked) return;
    setSide(picked.side);
    setType("limit");
    setPx(price(picked.price));
  }, [picked]);

  const { contextSafe } = useGSAP({ scope: root });
  useGSAP(
    () => {
      gsap.to(".of-ind", { xPercent: side === "buy" ? 0 : 100, duration: 0.35, ease: "power3.out" });
    },
    { scope: root, dependencies: [side] },
  );

  const p = type === "market" ? (side === "buy" ? bestAsk : bestBid) : Number(px);
  const h = Number(hrs);
  const notional = p * h;
  const minH = minOrderHours(p);
  const hoursErr = !Number.isInteger(h) || h <= 0 ? "Whole GPU-hours only" : notional < MIN_NOTIONAL_USDC ? `Min order ${MIN_NOTIONAL_USDC} USDC (≥ ${minH} h at this price)` : null;
  const priceErr = type === "limit" && (!(p > 0) || Math.abs(p * 100 - Math.round(p * 100)) > 1e-6) ? "Price must be on the $0.01 tick" : null;
  const fundsErr = side === "buy" ? (notional > bal.usdc ? "Insufficient USDC" : null) : h > bal.hours ? "Insufficient tokens" : null;
  const err = hoursErr ?? priceErr ?? fundsErr;
  const crosses = type === "market" || (side === "buy" ? p >= bestAsk : p <= bestBid);
  const fillPx = type === "market" ? p : side === "buy" ? Math.min(p, bestAsk) : Math.max(p, bestBid);

  const submit = contextSafe(async () => {
    if (!address) return connect();
    if (err) return;
    setPending(true);
    setStatus(null);
    // optimistic for < 1s, then confirm, as on Monad
    gsap.fromTo(".of-submit", { scale: 0.98 }, { scale: 1, duration: 0.4, ease: "back.out(3)" });
    await new Promise((r) => setTimeout(r, 800));
    setPending(false);
    if (crosses) {
      setBal((b) => (side === "buy" ? { usdc: b.usdc - h * fillPx, hours: b.hours + h } : { usdc: b.usdc + h * fillPx, hours: b.hours - h }));
      onFill(side, h, fillPx);
      setStatus({ tone: "ok", msg: `Filled ${int(h)} h @ $${price(fillPx)} · confirmed in 0.8s (simulated)` });
    } else {
      setStatus({ tone: "ok", msg: `Resting ${side} ${int(h)} h @ $${price(p)} placed on the book (simulated)` });
    }
  });

  const sideBtn = (s: Side) => (
    <button
      type="button"
      onClick={() => setSide(s)}
      className={`relative z-10 flex-1 py-2.5 text-[13px] font-medium transition-colors ${side === s ? "text-void" : "text-dust hover:text-cream"}`}
    >
      {s === "buy" ? "Buy GPU-hours" : "Sell GPU-hours"}
    </button>
  );

  return (
    <div ref={root} className="p-5">
      <div className="relative flex overflow-hidden rounded-full border border-line p-1">
        <span className={`of-ind absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full ${side === "buy" ? "bg-bid" : "bg-ask"} transition-colors duration-300`} />
        {sideBtn("buy")}
        {sideBtn("sell")}
      </div>

      <div className="mt-4 flex gap-4 text-[12px]">
        {(["limit", "market"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setType(t)} className={`capitalize transition-colors ${type === t ? "text-cream" : "text-dust hover:text-sand"}`}>
            {t}
            {type === t && <span className="mt-1 block h-px bg-gold" />}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {type === "limit" ? (
          <Field label="Price per GPU-hour" suffix="USDC" type="number" step="0.01" min="0.01" value={px} onChange={(e) => setPx(e.target.value)} error={priceErr} />
        ) : (
          <Field label="Price" suffix="USDC" value={`${price(p)} (best ${side === "buy" ? "ask" : "bid"})`} readOnly />
        )}
        <Field label="Amount" suffix="GPU-hours" type="number" step="1" min="1" value={hrs} onChange={(e) => setHrs(e.target.value)} error={hoursErr ?? fundsErr} hint={`1 token = 1 ${series.gpu} hour · min ${minH} h`} />
      </div>

      <div className="mt-3 flex gap-2">
        {[10, 25, 50, 100].map((n) => (
          <button key={n} type="button" onClick={() => setHrs(String(n))} className="num flex-1 rounded-md border border-line py-1.5 text-[11px] text-dust transition-colors hover:border-gold/40 hover:text-cream">
            {n}h
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-lg border border-line bg-void/40 px-3 py-2">
        <Row k="Notional" v={Number.isFinite(notional) ? usd(notional) : "—"} tone="text-cream" />
        <Row k="Delivery window" v={`W${series.week} · Mon–Sun UTC`} />
        <Row k="If an hour is missed" v={`you get ${usd(slashPayout(1, Number.isFinite(p) ? p : mark))} / h`} tone="text-gold-hot" />
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={pending || (!!address && !!err)}
        className={`of-submit mt-4 w-full rounded-full py-3 text-sm font-semibold transition-[background-color,opacity,box-shadow] disabled:cursor-not-allowed disabled:opacity-40 ${
          side === "buy" ? "bg-bid text-void hover:shadow-[0_0_30px_rgba(130,196,156,0.35)]" : "bg-ask text-void hover:shadow-[0_0_30px_rgba(226,113,93,0.35)]"
        }`}
      >
        {!address ? "Connect wallet to trade" : pending ? "Confirming on Monad…" : `${side === "buy" ? "Buy" : "Sell"} ${Number.isFinite(h) ? int(h) : 0} h ${series.code}`}
      </button>
      <Toast show={!!status} tone={status?.tone}>
        {status?.msg}
      </Toast>

      <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line text-[11px]">
        <div className="bg-night px-3 py-2.5">
          <p className="text-dust">USDC</p>
          <p className="num mt-0.5 text-sm text-cream">
            <NumberRoll value={bal.usdc} format={(n) => usd(n)} />
          </p>
        </div>
        <div className="bg-night px-3 py-2.5">
          <p className="text-dust">{series.code}</p>
          <p className="num mt-0.5 text-sm text-cream">
            <NumberRoll value={bal.hours} format={(n) => `${int(n)} h`} snap={1} />
          </p>
        </div>
      </div>
      <p className="mt-3 text-[10px] leading-relaxed text-ash">Demo balances. Orders are simulated locally until Silica&apos;s contracts and Kuru markets are live on Monad Testnet.</p>
    </div>
  );
}

