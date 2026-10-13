"use client";

import { useLayoutEffect, useRef } from "react";
import { gsap, ScrollTrigger, MOTION_OK } from "@/animations/gsap";
import type { Ticket } from "@/lib/mock";

const CELL: Record<string, string> = {
  confirmed: "bg-bid/70",
  missed: "bg-ask shadow-[0_0_8px_rgba(226,113,93,0.55)]",
  disputed: "bg-warn",
  pending: "bg-white/[0.05]",
};

/**
 * One cell per redeemed hour. On first view the verified hours tick in
 * (0.04s per hour); afterwards each newly verified hour pops in, and a
 * slashed hour shakes and turns red.
 */
export function TicketTimeline({ ticket }: { ticket: Ticket }) {
  const root = useRef<HTMLDivElement>(null);
  const prev = useRef<Ticket["timeline"] | null>(null);

  useLayoutEffect(() => {
    const el = root.current!;
    const cells = Array.from(el.querySelectorAll<HTMLElement>(".tt-cell"));
    const ok = window.matchMedia(MOTION_OK).matches;

    if (!prev.current) {
      prev.current = ticket.timeline;
      if (!ok) return;
      const done = cells.filter((_, i) => ticket.timeline[i]);
      const missed = cells.filter((_, i) => ticket.timeline[i] === "missed");
      gsap.set(done, { scale: 0.3, opacity: 0.15 });
      const st = ScrollTrigger.create({
        trigger: el,
        start: "top 88%",
        toggleActions: "play none none none",
        onEnter: () => {
          const tl = gsap.timeline();
          tl.to(done, { scale: 1, opacity: 1, duration: 0.25, stagger: 0.04, ease: "back.out(2)" });
          missed.forEach((m) => {
            const at = done.indexOf(m) * 0.04 + 0.2;
            tl.to(m, { keyframes: { x: [-3, 3, -2, 2, 0] }, duration: 0.25 }, at);
          });
        },
      });
      return () => st.kill();
    }

    if (ok) {
      ticket.timeline.forEach((v, i) => {
        if (v && !prev.current![i]) {
          gsap.fromTo(cells[i], { scale: 0.2, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.35, ease: "back.out(2.5)" });
          if (v === "missed") gsap.to(cells[i], { keyframes: { x: [-4, 4, -3, 3, 0] }, duration: 0.3, delay: 0.25 });
        }
      });
    }
    prev.current = ticket.timeline;
  }, [ticket.timeline]);

  const cols = ticket.hours > 60 ? "grid-cols-[repeat(20,minmax(0,1fr))]" : "grid-cols-12";

  return (
    <div ref={root} className={`grid gap-1 ${cols}`}>
      {ticket.timeline.map((v, i) => (
        <span key={i} title={`Hour ${i + 1}: ${v ?? "pending"}`} className={`tt-cell aspect-square rounded-[3px] ${CELL[v ?? "pending"]}`} />
      ))}
    </div>
  );
}
