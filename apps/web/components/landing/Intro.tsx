"use client";

import { useRef } from "react";
import { gsap, useGSAP, ScrollSmoother, MOTION_REDUCED } from "@/animations/gsap";
import { finishIntro } from "@/animations/intro";
import { Wordmark } from "@/components/brand/Wordmark";

const KEY = "silica:intro";

/**
 * Once per session: the emblem lights up, a ring and counter fill, the
 * wordmark writes itself, then a gold horizon splits the curtain open.
 * Later visits (and reduced motion) just fade the cover away.
 */
export function Intro() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = root.current!;
      let seen = false;
      try {
        seen = sessionStorage.getItem(KEY) === "1";
      } catch {}
      const reduced = window.matchMedia(MOTION_REDUCED).matches;

      if (seen || reduced || window.scrollY > 40) {
        finishIntro();
        gsap.to(el, { autoAlpha: 0, duration: reduced ? 0 : 0.6, ease: "power2.out", onComplete: () => gsap.set(el, { display: "none" }) });
        return;
      }

      const smoother = ScrollSmoother.get();
      smoother?.paused(true);
      const html = document.documentElement;
      const prevOverflow = html.style.overflow;
      html.style.overflow = "hidden";
      const release = () => {
        html.style.overflow = prevOverflow;
        smoother?.paused(false);
      };

      const count = { v: 0 };
      const num = el.querySelector<HTMLElement>(".in-count")!;
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      // the cover renders blank on the server so nothing flashes before hydration
      tl.set(".in-center", { opacity: 1 }, 0)
        .from(".in-emblem", { opacity: 0, scale: 0.82, filter: "blur(14px)", duration: 1.4, ease: "expo.out" }, 0)
        .fromTo(".in-ring", { drawSVG: "0%" }, { drawSVG: "100%", duration: 1.9, ease: "power2.inOut" }, 0.1)
        .to(count, { v: 100, duration: 1.9, ease: "power2.inOut", onUpdate: () => (num.textContent = String(Math.round(count.v)).padStart(3, "0")) }, 0.1)
        .fromTo(".in-meta", { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.1 }, 0.2)
        .from(".in-wm .wm-stroke", { drawSVG: "0%", duration: 1.1, stagger: 0.07, ease: "power2.inOut" }, 0.45)
        .to(".in-center", { scale: 1.06, opacity: 0, duration: 0.45, ease: "power2.in" }, 2.05)
        .to(".in-meta", { opacity: 0, duration: 0.3 }, 2.05)
        .fromTo(".in-line", { scaleX: 0 }, { scaleX: 1, duration: 0.6, ease: "expo.inOut" }, 2.4)
        .add(() => {
          try {
            sessionStorage.setItem(KEY, "1");
          } catch {}
          release();
          finishIntro();
        }, 2.95)
        .to(".in-top", { yPercent: -100, duration: 1.2, ease: "expo.inOut" }, 2.9)
        .to(".in-bot", { yPercent: 100, duration: 1.2, ease: "expo.inOut" }, 2.9)
        .to(".in-line", { opacity: 0, duration: 0.5 }, 3.1)
        .set(el, { display: "none" });

      return release;
    },
    { scope: root },
  );

  return (
    <div ref={root} className="intro fixed inset-0 z-[55]" aria-hidden>
      <noscript>
        <style>{`.intro{display:none}`}</style>
      </noscript>
      <div className="in-top absolute inset-x-0 top-0 h-1/2 bg-void" />
      <div className="in-bot absolute inset-x-0 bottom-0 h-1/2 bg-void" />
      <div className="in-line rule absolute inset-x-0 top-1/2 !opacity-90 shadow-[0_0_24px_rgba(255,205,140,0.8)]" />

      <div className="in-center absolute inset-0 flex opacity-0 flex-col items-center justify-center">
        <div className="in-emblem relative h-36 w-36">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/art/emblem.webp" alt="" className="h-full w-full object-contain" />
          <svg viewBox="0 0 100 100" className="absolute -inset-6 h-[calc(100%+3rem)] w-[calc(100%+3rem)] -rotate-90">
            <circle cx="50" cy="50" r="48" fill="none" stroke="#e8cda0" strokeOpacity="0.1" strokeWidth="0.4" />
            <circle className="in-ring" cx="50" cy="50" r="48" fill="none" stroke="#e2b36e" strokeWidth="0.6" />
          </svg>
        </div>
        <Wordmark className="in-wm mt-14 w-44 text-cream" strokeWidth={3} />
      </div>

      <p className="in-meta label absolute opacity-0 bottom-8 left-6 !text-[9px] sm:left-10">Monad Testnet · chain 10143</p>
      <p className="in-meta num absolute opacity-0 bottom-7 right-6 text-sm text-gold sm:right-10">
        <span className="in-count">000</span>
      </p>
    </div>
  );
}
