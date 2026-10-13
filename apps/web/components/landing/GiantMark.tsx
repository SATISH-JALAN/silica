"use client";

import { useRef } from "react";
import { gsap, useGSAP, MOTION_OK } from "@/animations/gsap";
import { Wordmark } from "@/components/brand/Wordmark";

/** The page signs off: a full-width SILICA engraves itself, then fills with light */
export function GiantMark() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const tl = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: { trigger: root.current, start: "top 90%", end: "bottom bottom", scrub: 0.8 },
        });
        tl.from(".gm-outline .wm-stroke", { drawSVG: "0%", stagger: 0.12, duration: 1 })
          // negative insets leave room for the glow to bleed past the letters
          .fromTo(".gm-fill", { clipPath: "inset(-30% 100% -30% -8%)" }, { clipPath: "inset(-30% -8% -30% -8%)", duration: 1.2, ease: "power1.inOut" }, 0.5)
          .fromTo(".gm-sweep", { xPercent: -150, opacity: 1 }, { xPercent: 620, opacity: 0, duration: 1.2, ease: "power1.in" }, 0.6)
          .from(".gm-meta > *", { opacity: 0, y: 16, stagger: 0.1, duration: 0.4 }, 1.1);
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} className="relative overflow-hidden bg-void px-4 pb-12 pt-24 sm:px-6" aria-label="Silica">
      <div className="relative mx-auto max-w-[1400px]">
        <Wordmark className="gm-outline w-full text-gold/40" strokeWidth={0.6} title="" />
        <div className="gm-fill absolute inset-0">
          {/* glow as a blurred twin: drop-shadow on clipped SVG renders in tiles */}
          <Wordmark className="absolute inset-0 w-full text-gold opacity-50 blur-xl" strokeWidth={5} title="" />
          <Wordmark className="relative w-full text-gold-hot" strokeWidth={2.2} title="" />
        </div>
        <div className="pointer-events-none absolute inset-0 overflow-hidden mix-blend-screen">
          <div className="gm-sweep absolute inset-y-0 left-0 w-1/5 -skew-x-12 bg-gradient-to-r from-transparent via-[rgba(255,236,205,0.35)] to-transparent" />
        </div>
      </div>
      <div className="gm-meta mx-auto mt-10 flex max-w-[1400px] flex-wrap items-center justify-between gap-3 text-[11px]">
        <span className="label !text-[9px]">Real compute · Real possibilities</span>
        <span className="num text-ash">Monad Testnet · chain 10143</span>
      </div>
    </section>
  );
}
