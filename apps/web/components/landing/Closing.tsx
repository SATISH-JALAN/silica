"use client";

import Link from "next/link";
import { useRef } from "react";
import { gsap, useGSAP, MOTION_OK } from "@/animations/gsap";
import { Starfield } from "@/components/brand/Starfield";
import { Sparkle } from "@/components/brand/Sparkle";
import { SplitReveal } from "@/components/ui/motion";
import { Magnetic } from "@/components/ui/pointer";

const STACK = [
  ["Monad", "settlement · 400ms blocks"],
  ["Kuru Spot V2", "onchain order book"],
  ["Chainlink CRE", "delivery verdicts · marks · margin"],
  ["Envio HyperIndex", "reliability · candles · curve"],
  ["OpenZeppelin v5", "ERC-20 · AccessControl · SafeERC20"],
];

export function BuiltOn() {
  const root = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const loop = gsap.to(".bo-track", { xPercent: -50, duration: 36, repeat: -1, ease: "none" });
        // scroll velocity nudges the marquee
        let last = 0;
        gsap.ticker.add(tick);
        function tick() {
          const v = Math.abs(window.scrollY - last);
          last = window.scrollY;
          loop.timeScale(gsap.utils.clamp(1, 6, 1 + v * 0.12));
        }
        return () => gsap.ticker.remove(tick);
      });
    },
    { scope: root },
  );
  const items = [...STACK, ...STACK];
  return (
    <div ref={root} className="relative overflow-hidden border-y border-line py-8" aria-label="Built on">
      <div className="bo-track flex w-max items-center">
        {items.map(([n, d], i) => (
          <div key={i} className="flex items-center gap-5 px-10">
            <Sparkle size={12} className="opacity-70" />
            <span className="font-display text-sm tracking-[0.2em] text-cream">{n.toUpperCase()}</span>
            <span className="num text-[11px] text-ash">{d}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Closing() {
  const root = useRef<HTMLElement>(null);
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const st = { trigger: root.current, start: "top bottom", end: "bottom bottom", scrub: true };
        gsap.fromTo(".cl-sun", { yPercent: 60, scale: 0.8 }, { yPercent: 0, scale: 1, ease: "none", scrollTrigger: st });
        gsap.fromTo(".cl-horizon", { yPercent: 25 }, { yPercent: 0, ease: "none", scrollTrigger: st });
        gsap.fromTo(".cl-rays", { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, ease: "none", scrollTrigger: st });
        gsap.to(".cl-rays", { rotation: 360, duration: 160, repeat: -1, ease: "none" });
        gsap.from(".cl-cta > *", { y: 20, opacity: 0, stagger: 0.1, duration: 0.8, scrollTrigger: { trigger: ".cl-cta", start: "top 85%", toggleActions: "play none none none" } });
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden px-4 pb-[34vh] pt-32 text-center">
      <Starfield count={60} sparkles={4} seed={23} />
      <div className="cl-sun pointer-events-none absolute bottom-[22vh] left-1/2 h-[46vh] w-[46vh] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,214,150,0.45),rgba(226,179,110,0.12)_40%,transparent_68%)] blur-xl" />
      {/* fine sun rays turning slowly behind the horizon */}
      <div className="cl-rays pointer-events-none absolute bottom-[8vh] left-1/2 -ml-[60vh] h-[120vh] w-[120vh] rounded-full bg-[repeating-conic-gradient(from_0deg,rgba(255,214,150,0.07)_0deg_0.6deg,transparent_0.6deg_9deg)] [mask-image:radial-gradient(circle,black_10%,transparent_62%)]" />
      <div className="cl-horizon pointer-events-none absolute inset-x-0 bottom-0 h-[44vh] min-h-[260px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/art/horizon.webp" alt="" className="h-full w-full object-cover object-bottom [mask-image:linear-gradient(to_bottom,transparent,black_40%)]" />
        <div className="absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-void to-transparent" />
      </div>

      <p className="label relative">Lock next month&apos;s GPU price today</p>
      <SplitReveal className="relative mt-8 max-w-4xl text-5xl font-light leading-[1.05] tracking-tight text-cream md:text-7xl">
        Real compute. Real possibilities.
      </SplitReveal>
      <p className="relative mt-8 max-w-md text-base leading-relaxed text-sand">
        Buy GPU hours forward. Redeem them for real compute. If delivery fails, the bond pays you.
      </p>
      <div className="cl-cta relative mt-12 flex flex-wrap justify-center gap-3">
        <Magnetic>
        <Link href="/markets" data-cursor="Trade" className="rounded-full bg-cream px-7 py-3.5 text-sm font-semibold text-void transition-[color,background-color,border-color,box-shadow] hover:shadow-[0_0_50px_rgba(255,205,140,0.4)]">
          Trade the curve
        </Link>
        </Magnetic>
        <Magnetic>
        <Link href="/provider" className="rounded-full border border-line-strong bg-void/40 px-7 py-3.5 text-sm text-cream backdrop-blur transition-[color,background-color,border-color,box-shadow] hover:border-gold/60">
          Become a provider
        </Link>
        </Magnetic>
        <Link href="/status" className="rounded-full px-7 py-3.5 text-sm text-sand transition-[color,background-color,border-color,box-shadow] hover:text-cream">
          See the proof →
        </Link>
      </div>
    </section>
  );
}
