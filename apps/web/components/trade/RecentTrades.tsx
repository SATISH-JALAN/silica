"use client";

import { useLayoutEffect, useRef } from "react";
import { gsap, MOTION_OK } from "@/animations/gsap";
import type { Trade } from "@/lib/mock";
import { int, price } from "@/lib/format";

export function RecentTrades({ trades }: { trades: Trade[] }) {
  const root = useRef<HTMLDivElement>(null);
  const seen = useRef<Set<string> | null>(null);

  useLayoutEffect(() => {
    const el = root.current!;
    const rows = el.querySelectorAll<HTMLElement>(".rt-row");
    if (!seen.current) {
      seen.current = new Set(trades.map((t) => t.id));
      return;
    }
    const ok = window.matchMedia(MOTION_OK).matches;
    rows.forEach((row) => {
      const id = row.dataset.id!;
      if (seen.current!.has(id)) return;
      seen.current!.add(id);
      if (ok) {
        gsap.from(row, { y: -14, opacity: 0, duration: 0.35, ease: "power2.out" });
        gsap.fromTo(row.querySelector(".rt-flash"), { opacity: 0.5 }, { opacity: 0, duration: 0.8 });
      }
    });
  }, [trades]);

  return (
    <div ref={root}>
      <div className="label grid grid-cols-3 px-4 pb-2 pt-4 !text-[9px]">
        <span>Price</span>
        <span className="text-right">Hours</span>
        <span className="text-right">Time UTC</span>
      </div>
      <div className="max-h-[260px] overflow-hidden">
        {trades.slice(0, 14).map((t) => (
          <div key={t.id} data-id={t.id} className="rt-row relative grid grid-cols-3 px-4 py-[5px] text-[12px]">
            <span className={`rt-flash pointer-events-none absolute inset-0 opacity-0 ${t.takerBuys ? "bg-bid/25" : "bg-ask/25"}`} />
            <span className={`num relative ${t.takerBuys ? "text-bid" : "text-ask"}`}>{price(t.price)}</span>
            <span className="num relative text-right text-sand">
              {int(t.hours)}
              {t.id.startsWith("me-") && <span className="ml-1 text-gold">•</span>}
            </span>
            <span className="num relative text-right text-dust" suppressHydrationWarning>
              {new Date(t.at).toLocaleTimeString("en-GB", { hour12: false, timeZone: "UTC" })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
