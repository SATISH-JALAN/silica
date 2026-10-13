"use client";

import Link from "next/link";
import { useRef } from "react";
import { gsap, useGSAP, SplitText, MOTION_OK } from "@/animations/gsap";
import { Starfield } from "@/components/brand/Starfield";
import { Wordmark } from "@/components/brand/Wordmark";
import { Sparkle } from "@/components/brand/Sparkle";
import { scrollToId } from "@/components/ui/motion";
import { Magnetic } from "@/components/ui/pointer";
import { whenIntroDone } from "@/animations/intro";
import { LIVE, SERIES_LIST as SERIES } from "@/lib/series";
import { useCurveMarks } from "@/lib/market";
import { price, signedPct } from "@/lib/format";

// Orbit paths sweep across the frame like the hairlines in the key art
const ORBITS = [
  "M -80 250 C 300 120, 640 110, 980 330 S 1500 640, 1780 560",
  "M -60 720 C 260 520, 520 380, 820 360 S 1340 300, 1760 120",
  "M 120 980 C 360 700, 660 560, 980 540 S 1500 600, 1800 820",
];

// 120 engraved ticks, every tenth one longer and brighter
const RING_TICKS = Array.from({ length: 120 }, (_, i) => {
  const a = (i * 3 * Math.PI) / 180;
  const major = i % 10 === 0;
  const r1 = major ? 85.5 : 87;
  return {
    x1: +(100 + r1 * Math.cos(a)).toFixed(2),
    y1: +(100 + r1 * Math.sin(a)).toFixed(2),
    x2: +(100 + 88.5 * Math.cos(a)).toFixed(2),
    y2: +(100 + 88.5 * Math.sin(a)).toFixed(2),
    strokeOpacity: major ? 0.5 : 0.2,
  };
});

export function Hero() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      // One context for intro and scroll motion, so a revert (resize
      // across the breakpoint, StrictMode remount) unwinds them in reverse
      // order and the intro's hidden states never stick.
      mm.add({ ok: MOTION_OK, desktop: "(min-width: 768px)" }, (ctx) => {
        const { ok, desktop } = ctx.conditions as Record<string, boolean>;
        if (!ok) return;

        // waits for the intro curtain; the from() states render underneath it
        const tl = gsap.timeline({ paused: true, defaults: { ease: "power3.out" } });

        // Planet rises out of the dark, its arc catching the light
        tl.from(".hero-planet", { yPercent: 18, scale: 0.86, opacity: 0, filter: "blur(18px)", duration: 2.2, ease: "expo.out" }, 0)
          .from(".hero-halo", { opacity: 0, scale: 0.6, duration: 2.4, ease: "expo.out" }, 0.1)
          .from(".hero-orbit", { drawSVG: "0%", duration: 2.4, stagger: 0.25, ease: "power2.inOut" }, 0.2)
          .from(".hero-moon", { opacity: 0, scale: 0, duration: 0.8, stagger: 0.2 }, 1.4)
          .from(".hero-ring", { opacity: 0, scale: 0.9, rotate: -25, duration: 2.4, ease: "expo.out" }, 0.4)
          .from(".hero-horizon-inner", { yPercent: 14, opacity: 0, duration: 2, ease: "expo.out" }, 0.2)
          .from(".hero-label", { y: 12, opacity: 0, duration: 0.8 }, 0.5)
          .from(".hero-wm .wm-stroke", { drawSVG: "0%", duration: 1.4, stagger: 0.09, ease: "power2.inOut" }, 0.55)
          .from(".hero-tag span", { opacity: 0, letterSpacing: "0.9em", duration: 1.4, stagger: 0.12, ease: "expo.out" }, 1.1)
          .from(".hero-rule", { scaleX: 0, transformOrigin: "left center", duration: 1.2, ease: "expo.inOut" }, 1.3)
          .from(".hero-cta > *", { y: 16, opacity: 0, stagger: 0.08, duration: 0.7 }, 1.9)
          .from(".hero-ticker", { opacity: 0, y: 20, duration: 1 }, 2.1)
          .from(".hero-scroll", { opacity: 0, duration: 1 }, 2.4)
          .add(() => {
            played = true;
            headline?.play();
          }, 1.45);

        let played = false;
        let headline: gsap.core.Tween | undefined;
        const split = SplitText.create(".hero-headline", {
          type: "lines,words",
          mask: "lines",
          linesClass: "split-line",
          autoSplit: true,
          onSplit: (self) => {
            const progress = headline?.progress() ?? 0;
            headline?.kill();
            headline = gsap.from(self.words, { yPercent: 110, opacity: 0, duration: 0.8, stagger: 0.06, ease: "power4.out", paused: !played });
            if (progress) headline.progress(progress);
          },
        });
        const unsub = whenIntroDone(() => tl.play());

        // Ambient life: planet floats, halo breathes, arc shimmers
        gsap.to(".hero-planet-inner", { y: -14, rotate: 1.5, duration: 6, repeat: -1, yoyo: true, ease: "sine.inOut" });
        gsap.to(".hero-halo", { opacity: 0.55, scale: 1.08, duration: 4.5, repeat: -1, yoyo: true, ease: "sine.inOut" });
        gsap.to(".hero-sheen", { xPercent: 160, duration: 5.5, repeat: -1, repeatDelay: 2.5, ease: "power2.inOut" });
        gsap.to(".hero-ring-text", { rotation: 360, svgOrigin: "100 100", duration: 90, repeat: -1, ease: "none" });
        gsap.to(".hero-ring-ticks", { rotation: -360, svgOrigin: "100 100", duration: 140, repeat: -1, ease: "none" });

        // Moons travel their orbits
        gsap.utils.toArray<SVGCircleElement>(".hero-moon").forEach((moon, i) => {
          const path = root.current!.querySelectorAll<SVGPathElement>(".hero-orbit")[i];
          const len = path.getTotalLength();
          const p = { t: [0.18, 0.62, 0.4][i] };
          gsap.to(p, {
            t: `+=1`,
            duration: [70, 90, 110][i],
            repeat: -1,
            ease: "none",
            onUpdate: () => {
              const pt = path.getPointAtLength((p.t % 1) * len);
              moon.setAttribute("cx", String(pt.x));
              moon.setAttribute("cy", String(pt.y));
            },
          });
        });

        // Ticker marquee
        gsap.to(".hero-ticker-track", { xPercent: -50, duration: 40, repeat: -1, ease: "none" });

        if (desktop) {
          // Exit: the hero pins and the camera flies through the planet.
          const tl = gsap.timeline({
            defaults: { ease: "none" },
            scrollTrigger: { trigger: root.current, start: "top top", end: "+=110%", pin: true, scrub: 0.7 },
          });
          // Ownership rule: the intro animates inner nodes, scroll animates
          // wrappers. Two systems on one node snapshot each other's
          // states, and a revert (remount, breakpoint change) restores the
          // intro's hidden frame. Explicit fromTo starts keep it deterministic.
          const at = (sel: string, from: gsap.TweenVars, to: gsap.TweenVars, pos: number) =>
            tl.fromTo(sel, from, { ...to, immediateRender: false }, pos + 0.001);
          at(".hero-copy", { yPercent: 0, opacity: 1, filter: "blur(0px)" }, { yPercent: -30, opacity: 0, filter: "blur(10px)", duration: 0.45, ease: "power1.in" }, 0);
          at(".hero-scroll > *", { opacity: 1 }, { opacity: 0, duration: 0.15 }, 0);
          at(".hero-ticker-fly", { yPercent: 0, opacity: 1 }, { yPercent: 120, opacity: 0, duration: 0.4, ease: "power1.in" }, 0);
          at(".hero-horizon", { yPercent: 0, opacity: 1 }, { yPercent: 55, opacity: 0, duration: 0.9, ease: "power1.in" }, 0);
          at(".hero-ring-fly", { scale: 1, opacity: 1 }, { scale: 1.6, opacity: 0, duration: 0.75, ease: "power2.in" }, 0);
          at(".hero-orbits", { scale: 1, opacity: 1 }, { scale: 1.8, opacity: 0, duration: 0.8, ease: "power2.in" }, 0);
          at(".hero-stars", { scale: 1, opacity: 1 }, { scale: 1.5, opacity: 0.25, duration: 1 }, 0);
          at(".hero-planet-wrap", { xPercent: 0, yPercent: 0, scale: 1 }, { xPercent: 42, yPercent: 6, scale: 2.6, duration: 1, ease: "power2.in" }, 0);
          at(".hero-veil", { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "power1.in" }, 0.5);
          at(".hero-planet-wrap", { opacity: 1 }, { opacity: 0, duration: 0.2 }, 0.72);
          at(".hero-veil", { opacity: 1 }, { opacity: 0, duration: 0.18 }, 0.8);
        } else {
          // Phones: a lighter parallax instead of a pin
          const tl = gsap.timeline({ defaults: { ease: "none", immediateRender: false }, scrollTrigger: { trigger: root.current, start: "top top", end: "bottom top", scrub: true } });
          tl.fromTo(".hero-planet-wrap", { yPercent: 0, scale: 1 }, { yPercent: -28, scale: 0.82, duration: 1 }, 0.001)
            .fromTo(".hero-horizon", { yPercent: 0 }, { yPercent: 22, duration: 1 }, 0.001)
            .fromTo(".hero-copy", { yPercent: 0, opacity: 1 }, { yPercent: -18, opacity: 0, duration: 0.7 }, 0.001)
            .fromTo(".hero-orbits", { yPercent: 0, opacity: 1 }, { yPercent: -10, opacity: 0.2, duration: 1 }, 0.001);
        }

        return () => {
          unsub();
          split.revert();
        };
      });
    },
    { scope: root },
  );

  const marks = useCurveMarks();
  const tickerItems = [...SERIES, ...SERIES].map((s, i) => ({ ...s, mark: marks[i % SERIES.length] }));

  return (
    <section ref={root} className="relative flex min-h-[100svh] flex-col overflow-hidden" aria-label="Silica">
      <div className="hero-stars absolute inset-0">
        <Starfield count={90} sparkles={6} seed={11} />
      </div>

      {/* Orbit hairlines */}
      <svg className="hero-orbits pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1680 1000" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <defs>
          <linearGradient id="orbit-fade" x1="0" x2="1">
            <stop offset="0" stopColor="#e2b36e" stopOpacity="0" />
            <stop offset="0.3" stopColor="#e2b36e" stopOpacity="0.55" />
            <stop offset="0.7" stopColor="#e2b36e" stopOpacity="0.55" />
            <stop offset="1" stopColor="#e2b36e" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ORBITS.map((d, i) => (
          <path key={i} d={d} className="hero-orbit" fill="none" stroke="url(#orbit-fade)" strokeWidth={i === 1 ? 1.1 : 0.8} />
        ))}
        <circle className="hero-moon" r="9" fill="#a99a84" />
        <circle className="hero-moon" r="4" fill="#e9d7b8" />
        <circle className="hero-moon" r="5.5" fill="#cbb79a" />
        {/* vertical hairlines with sparkles, as in the art */}
        <line x1="330" y1="40" x2="330" y2="520" stroke="#e2b36e" strokeOpacity="0.25" strokeWidth="0.8" />
        <line x1="1528" y1="160" x2="1528" y2="560" stroke="#e2b36e" strokeOpacity="0.2" strokeWidth="0.8" />
      </svg>
      <Sparkle size={26} className="pointer-events-none absolute left-[19.6%] top-[36%] hidden opacity-80 md:block" />

      <div className="relative z-10 mx-auto grid w-full max-w-[1400px] flex-1 items-center gap-6 px-4 pb-28 pt-24 sm:px-6 md:grid-cols-[1.1fr_1fr] md:pb-32 md:pt-20">
        {/* Planet */}
        <div className="hero-planet-wrap relative mx-auto aspect-square w-[min(78vw,600px,62svh)]">
          {/* engraved instrument ring with the tagline orbiting the planet */}
          <div className="hero-ring-fly pointer-events-none absolute -inset-[9%]">
          <svg viewBox="0 0 200 200" className="hero-ring h-full w-full overflow-visible" aria-hidden>
            <defs>
              <path id="hero-ring-path" d="M100,100 m-93,0 a93,93 0 1,1 186,0 a93,93 0 1,1 -186,0" />
            </defs>
            <g className="hero-ring-ticks">
              {RING_TICKS.map((t, i) => (
                <line key={i} {...t} stroke="#e2b36e" strokeWidth="0.25" />
              ))}
            </g>
            <g className="hero-ring-text">
              <text fontSize="3.6" letterSpacing="2.15" fill="#cdbfa6" fillOpacity="0.36" fontFamily="var(--font-michroma)">
                <textPath href="#hero-ring-path">REAL COMPUTE · REAL POSSIBILITIES · BOND-BACKED GPU HOURS · DELIVERED ON MONAD ·</textPath>
              </text>
            </g>
          </svg>
          </div>
          <div className="hero-planet relative h-full w-full">
          <div className="hero-halo absolute inset-[6%] rounded-full bg-[radial-gradient(circle_at_62%_40%,rgba(255,196,120,0.35),rgba(226,179,110,0.08)_45%,transparent_70%)] blur-2xl" />
          <div className="hero-planet-inner relative h-full w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/art/emblem.webp" alt="" className="h-full w-full select-none object-contain" draggable={false} fetchPriority="high" />
            {/* a slow sheen gliding across the sphere */}
            <div className="absolute inset-[12%] overflow-hidden rounded-full mix-blend-screen">
              <div className="hero-sheen absolute inset-y-0 -left-full w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-[rgba(255,226,180,0.13)] to-transparent" />
            </div>
          </div>
          </div>
        </div>

        {/* Copy */}
        <div className="hero-copy relative max-w-xl md:pl-4">
          <p className="hero-label label mb-8 flex items-center gap-3">
            <span className="h-px w-8 bg-gold/60" /> Deliverable GPU compute on Monad
          </p>
          <h1 className="sr-only">Silica</h1>
          <Wordmark className="hero-wm glow-text h-auto w-[min(100%,420px)] text-cream" strokeWidth={3} />
          <p className="hero-tag mt-6 flex flex-col gap-1 font-display text-[11px] tracking-[0.42em] text-sand sm:text-xs">
            <span>REAL COMPUTE</span>
            <span>REAL POSSIBILITIES</span>
          </p>
          <div className="hero-rule rule mt-6 w-24" />
          <p className="hero-headline mt-8 text-2xl font-light leading-[1.25] text-cream sm:text-[2rem]">
            GPU time as a commodity you can buy forward, trade, and rely on.
          </p>
          <div className="hero-cta mt-10 flex flex-wrap items-center gap-3">
            <Magnetic>
            <Link
              href="/markets"
              data-cursor="Enter"
              className="group relative overflow-hidden rounded-full bg-cream px-6 py-3 text-sm font-semibold text-void transition-[color,background-color,border-color,box-shadow] hover:shadow-[0_0_40px_rgba(255,205,140,0.35)]"
            >
              <span className="relative z-10">Enter the market</span>
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/70 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
            </Link>
            </Magnetic>
            <Magnetic>
            <button
              onClick={() => scrollToId("lifecycle")}
              className="rounded-full border border-line-strong px-6 py-3 text-sm text-sand transition-[color,background-color,border-color,box-shadow] hover:border-gold/60 hover:text-cream"
            >
              How it works
            </button>
            </Magnetic>
          </div>
        </div>
      </div>

      {/* Engraved horizon from the key art */}
      <div className="hero-horizon pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[42vh] min-h-[260px]">
        <div className="hero-horizon-inner relative h-full w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/art/horizon.webp"
            alt=""
            className="h-full w-full object-cover object-bottom [mask-image:linear-gradient(to_bottom,transparent,black_38%)]"
          />
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-void to-transparent" />
        </div>
      </div>

      {/* warm light the camera passes through on the way out */}
      <div className="hero-veil pointer-events-none absolute inset-0 z-20 bg-[radial-gradient(circle_at_40%_45%,rgba(255,214,150,0.55),rgba(185,129,62,0.25)_35%,rgba(6,5,4,0.95)_75%)] opacity-0" />

      {/* Live marks ticker */}
      <div className="hero-ticker-fly relative z-10">
      <div className="hero-ticker relative border-y border-line bg-void/60 backdrop-blur-md">
        <div className="overflow-hidden">
          <div className="hero-ticker-track flex w-max">
            {tickerItems.map((s, i) => (
              <Link key={i} href={`/markets/${s.id}`} className="flex items-center gap-4 border-r border-line px-8 py-3 text-xs transition-[color,background-color,border-color,box-shadow] hover:bg-white/[0.02]">
                <span className="font-display text-[10px] tracking-[0.2em] text-sand">{s.code}</span>
                <span className="num text-cream">${price(s.mark)}</span>
                {LIVE ? (
                  <span className="num text-dust">mark</span>
                ) : (
                  <span className={`num ${s.change24h >= 0 ? "text-bid" : "text-ask"}`}>{signedPct(s.change24h)}</span>
                )}
              </Link>
            ))}
          </div>
        </div>
      </div>
      </div>

      <div className="hero-scroll pointer-events-none absolute bottom-20 left-1/2 z-10 hidden -translate-x-1/2 flex-col items-center gap-2 md:flex">
        <span className="label !text-[9px]">Scroll</span>
        <span className="relative h-10 w-px overflow-hidden bg-line">
          <span className="absolute inset-x-0 top-0 h-1/2 animate-[scrollcue_2s_ease-in-out_infinite] bg-gold" />
        </span>
      </div>
    </section>
  );
}
