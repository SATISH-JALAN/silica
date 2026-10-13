"use client";

import { useRef } from "react";
import { gsap, useGSAP, MOTION_OK } from "@/animations/gsap";
import { Starfield } from "@/components/brand/Starfield";
import { Wordmark } from "@/components/brand/Wordmark";
import { SectionLabel } from "./SectionLabel";

const VENUES = ["CME", "ICE", "KALSHI", "INJECTIVE"];

const words = (s: string) =>
  s.split(" ").map((w, i) => (
    <span key={i} className="mf-w inline-block will-change-transform">
      {w}
      {" "}
    </span>
  ));

/**
 * Pinned three-beat statement that replaces the old problem/gap copy:
 * everyone prices compute (venues struck through), nobody delivers it,
 * Silica does.
 */
export function Manifesto() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add(`(min-width: 768px) and ${MOTION_OK}`, () => {
        const el = root.current!;
        el.dataset.pinned = "true";
        gsap.set([".mf-b", ".mf-c"], { autoAlpha: 0 });

        const tl = gsap.timeline({
          defaults: { ease: "power2.out" },
          scrollTrigger: { trigger: ".mf-stage", start: "top top", end: "+=280%", pin: true, scrub: 0.9 },
        });

        tl.from(".mf-a .mf-w", { opacity: 0.06, yPercent: 40, stagger: 0.12, duration: 0.5 })
          .from(".mf-v", { opacity: 0, y: 60, stagger: 0.1, duration: 0.5 }, "-=0.2")
          .from(".mf-strike", { scaleX: 0, stagger: 0.12, duration: 0.45, ease: "power2.inOut" }, "+=0.1")
          .to(".mf-v-text", { opacity: 0.25, stagger: 0.12, duration: 0.45 }, "<")
          .from(".mf-note", { opacity: 0, y: 12, duration: 0.3 }, "-=0.2")
          .to(".mf-a", { autoAlpha: 0, y: -80, filter: "blur(8px)", duration: 0.5, ease: "power2.in" }, "+=0.35")
          .set(".mf-b", { autoAlpha: 1 })
          .from(".mf-b .mf-w", { opacity: 0, yPercent: 70, filter: "blur(12px)", stagger: 0.12, duration: 0.5 })
          .to(".mf-b", { autoAlpha: 0, scale: 0.92, filter: "blur(8px)", duration: 0.5, ease: "power2.in" }, "+=0.35")
          .set(".mf-c", { autoAlpha: 1 })
          .from(".mf-halo", { scale: 0.3, opacity: 0, duration: 0.9 })
          .from(".mf-c .wm-stroke", { drawSVG: "0%", stagger: 0.08, duration: 0.6, ease: "power2.inOut" }, "<0.1")
          .from(".mf-c-line", { opacity: 0, y: 24, duration: 0.4 }, "-=0.2")
          .to({}, { duration: 0.5 });
        // the orbit lines behind turn slowly across the whole pinned scene
        tl.fromTo(".mf-orbits", { rotation: -12, scale: 0.9 }, { rotation: 48, scale: 1.12, ease: "none", duration: tl.duration(), immediateRender: false }, 0);

        return () => {
          delete el.dataset.pinned;
        };
      });

      mm.add(`(max-width: 767px) and ${MOTION_OK}`, () => {
        gsap.utils.toArray<HTMLElement>(".mf-phase").forEach((p) =>
          gsap.from(p.querySelectorAll(".mf-w, .mf-v, .mf-c-line"), {
            opacity: 0,
            y: 30,
            stagger: 0.06,
            duration: 0.7,
            scrollTrigger: { trigger: p, start: "top 80%", toggleActions: "play none none none" },
          }),
        );
        gsap.from(".mf-strike", { scaleX: 0, stagger: 0.12, duration: 0.5, delay: 0.5, ease: "power2.inOut", scrollTrigger: { trigger: ".mf-a", start: "top 70%", toggleActions: "play none none none" } });
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} data-chapter="The gap" className="group/mf relative">
      <div className="mf-stage relative flex items-center justify-center overflow-hidden px-4 py-32 sm:px-6 group-data-[pinned=true]/mf:h-[100svh] group-data-[pinned=true]/mf:py-0">
        <Starfield count={40} sparkles={3} seed={5} />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_55%,rgba(226,179,110,0.07),transparent_60%)]" />
        <svg viewBox="-500 -500 1000 1000" className="mf-orbits pointer-events-none absolute left-1/2 top-1/2 -ml-[65vmax] -mt-[65vmax] h-[130vmax] w-[130vmax]" aria-hidden>
          <ellipse rx="470" ry="150" fill="none" stroke="#e2b36e" strokeOpacity="0.1" strokeWidth="0.6" transform="rotate(-18)" />
          <ellipse rx="380" ry="230" fill="none" stroke="#e2b36e" strokeOpacity="0.07" strokeWidth="0.6" transform="rotate(24)" />
          <ellipse rx="300" ry="90" fill="none" stroke="#e2b36e" strokeOpacity="0.12" strokeWidth="0.6" transform="rotate(62)" />
          <circle r="3" cx="470" cy="0" fill="#ffd9a1" transform="rotate(-18)" />
          <circle r="2" cx="-300" cy="0" fill="#ffd9a1" fillOpacity="0.7" transform="rotate(62)" />
        </svg>

        <div className="relative grid w-full max-w-6xl gap-32 text-center group-data-[pinned=true]/mf:gap-0 group-data-[pinned=true]/mf:*:[grid-area:1/1]">
          {/* 1 · everyone prices it */}
          <div className="mf-phase mf-a flex flex-col items-center">
            <SectionLabel index="01" title="The gap" />
            <h2 className="mt-10 text-4xl font-light leading-[1.08] tracking-tight text-cream sm:text-6xl md:text-7xl">{words("Everyone is pricing compute.")}</h2>
            <div className="mt-16 flex flex-wrap justify-center gap-x-12 gap-y-6">
              {VENUES.map((v) => (
                <span key={v} className="mf-v relative inline-block px-1">
                  <span className="mf-v-text font-display text-xl tracking-[0.22em] text-sand md:text-3xl">{v}</span>
                  <i className="mf-strike absolute -inset-x-[8%] top-1/2 h-px origin-left bg-cream/80 shadow-[0_0_8px_rgba(255,230,190,0.6)]" />
                </span>
              ))}
            </div>
            <p className="mf-note num mt-10 text-xs tracking-wide text-dust">All cash-settled on a price index. No GPU changes hands.</p>
          </div>

          {/* 2 · nobody delivers it */}
          <div className="mf-phase mf-b flex items-center justify-center">
            <h2 className="text-[2.6rem] font-light leading-[1.02] tracking-tight text-cream sm:text-7xl md:text-[7.5rem]">{words("Nobody delivers it.")}</h2>
          </div>

          {/* 3 · Silica does */}
          <div className="mf-phase mf-c relative flex flex-col items-center justify-center">
            <div className="mf-halo pointer-events-none absolute left-1/2 top-1/2 h-[70vmin] w-[70vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,205,140,0.22),rgba(226,179,110,0.05)_45%,transparent_70%)]" />
            <Wordmark className="relative w-[min(82vw,620px)] text-gold-hot [filter:drop-shadow(0_0_22px_rgba(255,205,140,0.45))]" strokeWidth={2.4} />
            <p className="mf-c-line relative mt-12 max-w-xl text-lg font-light leading-relaxed text-sand md:text-2xl">
              delivers the GPU time itself, and a provider&apos;s bond backs every hour.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
