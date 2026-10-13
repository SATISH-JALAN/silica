"use client";

import { Fragment, useRef } from "react";
import { gsap, useGSAP, ScrollTrigger, MOTION_OK } from "@/animations/gsap";
import { Sparkle } from "@/components/brand/Sparkle";

const STEPS = ["Bond", "Mint", "Trade", "Redeem", "Verify", "Settle"];

/** Two rows of giant lifecycle words sliding against each other, skewed by scroll speed */
export function KineticBand() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const st = { trigger: root.current, start: "top bottom", end: "bottom top", scrub: 0.6 };
        gsap.fromTo(".kb-a", { xPercent: 0 }, { xPercent: -22, ease: "none", scrollTrigger: st });
        gsap.fromTo(".kb-b", { xPercent: -22 }, { xPercent: 0, ease: "none", scrollTrigger: st });

        const skew = gsap.quickTo(".kb-rows", "skewX", { duration: 0.6, ease: "power3.out" });
        ScrollTrigger.create({
          trigger: root.current,
          start: "top bottom",
          end: "bottom top",
          onUpdate: (s) => skew(gsap.utils.clamp(-9, 9, s.getVelocity() / -250)),
        });
        const settle = () => skew(0);
        ScrollTrigger.addEventListener("scrollEnd", settle);
        return () => ScrollTrigger.removeEventListener("scrollEnd", settle);
      });
    },
    { scope: root },
  );

  const row = (offset: number) =>
    [...STEPS, ...STEPS].map((w, i) => (
      <Fragment key={i}>
        <span className={(i + offset) % 2 ? "kb-outline" : "text-gradient-gold"}>{w.toUpperCase()}</span>
        <Sparkle size={34} className="mx-[3vw] shrink-0 opacity-80" />
      </Fragment>
    ));

  return (
    <section ref={root} className="relative overflow-hidden py-20 md:py-28" aria-label="Bond, mint, trade, redeem, verify, settle">
      <div className="kb-rows space-y-3 font-display text-[15vw] leading-none tracking-[0.02em] md:text-[11vw]">
        <div className="kb-a flex w-max items-center whitespace-nowrap">{row(0)}</div>
        <div className="kb-b flex w-max items-center whitespace-nowrap">{row(1)}</div>
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-[12vw] bg-gradient-to-r from-void to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-[12vw] bg-gradient-to-l from-void to-transparent" />
    </section>
  );
}
