"use client";

import { useRef } from "react";
import { gsap, useGSAP, MOTION_OK } from "@/animations/gsap";
import { NumberRoll, SplitReveal } from "@/components/ui/motion";
import { SectionLabel } from "./SectionLabel";
import { int } from "@/lib/format";

const STATS = [
  { v: 400, unit: "ms", label: "Block time" },
  { v: 800, unit: "ms", label: "Finality" },
  { v: 10752, unit: "", label: "Verdicts / week · 64-GPU provider" },
  { v: 4, unit: "+", label: "Books in parallel" },
];

export function WhyMonad() {
  const root = useRef<HTMLElement>(null);
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const inView = { trigger: ".wm-grid", start: "top 80%", toggleActions: "play none none none" } as const;
        gsap.from(".wm-stat", { y: 60, opacity: 0, stagger: 0.12, duration: 1.1, ease: "expo.out", scrollTrigger: inView });
        gsap.from(".wm-bar", { scaleX: 0, transformOrigin: "left center", stagger: 0.12, duration: 1.4, ease: "expo.inOut", scrollTrigger: inView });
        // block pulse: one tick every 400ms
        const blocks = gsap.timeline({ repeat: -1 });
        gsap.utils.toArray<HTMLElement>(".wm-block").forEach((b, i) =>
          blocks.fromTo(b, { opacity: 1, scaleY: 1.4 }, { opacity: 0.12, scaleY: 1, duration: 1.6, ease: "power2.out" }, i * 0.4),
        );
        // a light beam sweeps across the stats as they scroll past
        gsap.fromTo(".wm-beam", { xPercent: -100 }, { xPercent: 260, ease: "none", scrollTrigger: { trigger: ".wm-grid", start: "top bottom", end: "bottom top", scrub: true } });
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} data-chapter="Why Monad" className="relative overflow-hidden border-y border-line bg-night/60">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_80%_0%,rgba(226,179,110,0.08),transparent_55%)]" />
      <div className="relative mx-auto max-w-[1400px] px-4 py-28 sm:px-6 md:py-40">
        <div className="flex flex-col justify-between gap-8 md:flex-row md:items-end">
          <div>
            <SectionLabel index="05" title="Why Monad" />
            <SplitReveal className="mt-8 max-w-2xl text-4xl font-light leading-[1.08] tracking-tight text-cream md:text-6xl">
              Fast enough to put every GPU-hour onchain.
            </SplitReveal>
          </div>
          <div className="flex items-end gap-1.5" aria-hidden>
            {Array.from({ length: 12 }, (_, i) => (
              <span key={i} className="wm-block h-7 w-2 origin-bottom rounded-sm bg-gold opacity-15" />
            ))}
            <span className="num ml-3 text-[11px] text-dust">blocks</span>
          </div>
        </div>
        <div className="wm-grid relative mt-20 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          <div className="wm-beam pointer-events-none absolute inset-y-0 left-0 z-10 w-1/3 bg-gradient-to-r from-transparent via-[rgba(255,220,170,0.06)] to-transparent" />
          {STATS.map((s) => (
            <div key={s.label} className="wm-stat spot bg-void px-8 pb-10 pt-12">
              <p className="num text-6xl font-extralight text-cream md:text-7xl">
                <NumberRoll value={s.v} mode="view" format={int} />
                <span className="text-gold">{s.unit}</span>
              </p>
              <div className="wm-bar mt-8 h-px w-full bg-gradient-to-r from-gold/70 to-transparent" />
              <p className="label mt-6">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
