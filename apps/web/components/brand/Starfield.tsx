"use client";

import { useRef } from "react";
import { gsap, useGSAP, MOTION_OK } from "@/animations/gsap";
import { rng } from "@/lib/mock";
import { Sparkle } from "./Sparkle";

type Props = { count?: number; sparkles?: number; seed?: number; className?: string };

/** Sparse warm stars plus a few four-point sparkles, twinkling out of phase */
export function Starfield({ count = 70, sparkles = 5, seed = 7, className = "" }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const r = rng(seed);
  const stars = Array.from({ length: count }, () => ({
    x: r() * 100,
    y: r() * 100,
    s: r() < 0.85 ? 1 + r() : 2 + r() * 1.5,
    o: 0.2 + r() * 0.6,
  }));
  const sp = Array.from({ length: sparkles }, () => ({ x: 6 + r() * 88, y: 6 + r() * 70, s: 12 + r() * 16 }));

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.utils.toArray<HTMLElement>(".star").forEach((el) => {
          gsap.to(el, {
            opacity: () => 0.1 + Math.random() * 0.3,
            duration: () => 1.6 + Math.random() * 3,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut",
            delay: Math.random() * 3,
          });
        });
        gsap.utils.toArray<HTMLElement>(".sparkle").forEach((el) => {
          gsap.fromTo(
            el,
            { scale: 0.6, rotate: 0, opacity: 0.5 },
            { scale: 1.05, rotate: 45, opacity: 1, duration: 2.6 + Math.random() * 2, repeat: -1, yoyo: true, ease: "sine.inOut", delay: Math.random() * 2 },
          );
        });
      });
    },
    { scope: root },
  );

  return (
    <div ref={root} className={`pointer-events-none absolute inset-0 ${className}`} aria-hidden>
      {stars.map((st, i) => (
        <span
          key={i}
          className="star absolute rounded-full bg-[#ffe9c7]"
          style={{ left: `${st.x}%`, top: `${st.y}%`, width: st.s, height: st.s, opacity: st.o }}
        />
      ))}
      {sp.map((s, i) => (
        <span key={`s${i}`} className="sparkle absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${s.x}%`, top: `${s.y}%` }}>
          <Sparkle size={s.s} />
        </span>
      ))}
    </div>
  );
}
