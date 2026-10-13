"use client";

import { useLayoutEffect, useRef } from "react";
import { gsap, Flip, MOTION_OK } from "@/animations/gsap";
import type { Book } from "@/lib/live";
import { int, price } from "@/lib/format";

const DEPTH = 9;

/**
 * L2 book. Levels re-sort with Flip when the mid moves; a level whose size
 * changes flashes its side's colour.
 */
export function OrderBook({ book, mark, onPick }: { book: Book; mark: number; onPick?: (p: number, side: "buy" | "sell") => void }) {
  const root = useRef<HTMLDivElement>(null);
  const prevSizes = useRef(new Map<string, number>());
  const flipState = useRef<Flip.FlipState | null>(null);

  const asks = book.asks.slice(0, DEPTH);
  const bids = book.bids.slice(0, DEPTH);
  const max = Math.max(...asks.map((l) => l.hours), ...bids.map((l) => l.hours), 1);
  const spread = asks[0] && bids[0] ? asks[0].price - bids[0].price : 0;

  // capture positions before React commits the new order
  if (root.current && typeof window !== "undefined") {
    flipState.current = Flip.getState(root.current.querySelectorAll(".ob-row"));
  }

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const ok = window.matchMedia(MOTION_OK).matches;
    if (ok && flipState.current) {
      Flip.from(flipState.current, { duration: 0.3, ease: "power2.out", targets: el.querySelectorAll(".ob-row"), simple: true });
    }
    el.querySelectorAll<HTMLElement>(".ob-row").forEach((row) => {
      const key = row.dataset.key!;
      const size = Number(row.dataset.size);
      const before = prevSizes.current.get(key);
      if (ok && before !== undefined && before !== size) {
        const flash = row.querySelector(".ob-flash");
        gsap.fromTo(flash, { opacity: 0.55 }, { opacity: 0, duration: 0.6, ease: "power2.out", overwrite: true });
      }
      prevSizes.current.set(key, size);
    });
  });

  const level = (p: number, h: number, side: "bid" | "ask") => (
    <button
      key={`${side}${p}`}
      type="button"
      onClick={() => onPick?.(p, side === "ask" ? "buy" : "sell")}
      data-flip-id={`${side}-${p.toFixed(2)}`}
      data-key={`${side}-${p.toFixed(2)}`}
      data-size={h}
      className="ob-row relative grid w-full grid-cols-3 px-4 py-[5px] text-left text-[12px] hover:bg-white/[0.03]"
    >
      <span
        className={`absolute inset-y-0 right-0 ${side === "ask" ? "bg-ask/10" : "bg-bid/10"}`}
        style={{ width: `${(h / max) * 100}%`, transition: "width 300ms ease" }}
      />
      <span className={`ob-flash pointer-events-none absolute inset-0 opacity-0 ${side === "ask" ? "bg-ask/40" : "bg-bid/40"}`} />
      <span className={`num relative ${side === "ask" ? "text-ask" : "text-bid"}`}>{price(p)}</span>
      <span className="num relative text-right text-sand">{int(h)}</span>
      <span className="num relative text-right text-dust">{int(h * p)}</span>
    </button>
  );

  return (
    <div ref={root} className="flex h-full flex-col">
      <div className="label grid grid-cols-3 px-4 pb-2 pt-4 !text-[9px]">
        <span>Price</span>
        <span className="text-right">Hours</span>
        <span className="text-right">USDC</span>
      </div>
      <div className="flex flex-col-reverse">
        {asks.map((l) => level(l.price, l.hours, "ask"))}
      </div>
      <div className="flex items-center justify-between border-y border-line bg-void/40 px-4 py-2.5">
        <span className="num text-base text-cream">${price(mark)}</span>
        <span className="num text-[11px] text-dust">spread {price(spread)}</span>
      </div>
      <div>
        {bids.map((l) => level(l.price, l.hours, "bid"))}
      </div>
    </div>
  );
}
