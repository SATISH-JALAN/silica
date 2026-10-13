"use client";

import { useRef } from "react";
import { gsap, useGSAP, MOTION_OK } from "@/animations/gsap";
import { SplitReveal } from "@/components/ui/motion";
import { SectionLabel } from "./SectionLabel";

const STEPS = [
  { t: "Bond", d: "The provider locks USDC before it can sell a single hour.", rule: "bond ≥ open hours × mark × 30%" },
  { t: "Mint", d: "One ERC-20 token per H100 GPU-hour, only as many as the bond supports.", rule: "1 token = 1 H100-80GB hour" },
  { t: "Trade", d: "Tokens trade on Kuru's onchain order book. Fills land in about 800 ms.", rule: "tick $0.01 · min order 10 USDC" },
  { t: "Redeem", d: "Burn tokens in the delivery week. Access arrives encrypted to your key.", rule: "posted within 30 min, or slashed" },
  { t: "Verify", d: "Provider node and an independent probe check the GPU. Chainlink CRE decides.", rule: "both ≥ 11 of 12 checks → confirmed" },
  { t: "Settle", d: "Confirmed hours build the record. Missed hours slash the bond to you.", rule: "missed hour pays 1.5 × priceAtOpen" },
];

const C = 300;
const R = 225;
const station = (i: number) => {
  const a = ((i * 60 - 90) * Math.PI) / 180;
  return { x: C + R * Math.cos(a), y: C + R * Math.sin(a), a };
};

const TAIL_FROM = (() => {
  const a = ((-90 - 40) * Math.PI) / 180;
  return { x: +(C + R * Math.cos(a)).toFixed(2), y: +(C + R * Math.sin(a)).toFixed(2) };
})();
const TAIL = `M ${TAIL_FROM.x} ${TAIL_FROM.y} A ${R} ${R} 0 0 1 ${C} ${C - R}`;

export function LifecycleStory() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add(`(min-width: 1024px) and ${MOTION_OK}`, () => {
        const el = root.current!;
        el.dataset.pinned = "true";

        // the stage opens like a card expanding to full bleed, then pins
        const enter = { trigger: ".lc-stage", start: "top 92%", end: "top top", scrub: true };
        gsap.fromTo(".lc-shell", { clipPath: "inset(10% 5% 0% 5% round 36px)" }, { clipPath: "inset(0% 0% 0% 0% round 0px)", ease: "none", scrollTrigger: enter });
        gsap.fromTo(".lc-content", { scale: 0.9, opacity: 0.2, y: 60 }, { scale: 1, opacity: 1, y: 0, ease: "power1.out", scrollTrigger: enter });

        const panels = gsap.utils.toArray<HTMLElement>(".lc-panel");
        const nums = gsap.utils.toArray<HTMLElement>(".lc-num");
        const nodes = gsap.utils.toArray<SVGGElement>(".lc-node");
        gsap.set([panels.slice(1), nums.slice(1)], { autoAlpha: 0, y: 40 });
        gsap.set(".lc-progress", { drawSVG: "0% 0%" });

        const tl = gsap.timeline({
          defaults: { ease: "power2.inOut" },
          scrollTrigger: {
            trigger: ".lc-stage",
            start: "top top",
            end: `+=${STEPS.length * 85}%`,
            pin: true,
            scrub: 0.8,
            snap: { snapTo: "labels", duration: { min: 0.2, max: 0.6 }, delay: 0.1, ease: "power2.inOut" },
          },
        });

        tl.addLabel("s0", 0);
        tl.to(".lc-token", { rotation: 300, svgOrigin: `${C} ${C}`, ease: "none", duration: STEPS.length - 1 }, 0);
        tl.fromTo(".lc-tail", { opacity: 0 }, { opacity: 1, duration: 0.35, immediateRender: false }, 0);
        tl.to(".lc-progress", { drawSVG: `0% ${(300 / 360) * 100}%`, ease: "none", duration: STEPS.length - 1 }, 0);
        tl.fromTo(".lc-bar", { scaleX: 0 }, { scaleX: 1, ease: "none", duration: STEPS.length - 1 }, 0);

        for (let i = 1; i < STEPS.length; i++) {
          const at = i - 0.4;
          tl.to(panels[i - 1], { autoAlpha: 0, y: -40, duration: 0.3 }, at)
            .to(panels[i], { autoAlpha: 1, y: 0, duration: 0.3 }, at + 0.15)
            .to(nums[i - 1], { autoAlpha: 0, y: -40, duration: 0.3 }, at)
            .to(nums[i], { autoAlpha: 1, y: 0, duration: 0.3 }, at + 0.15)
            .to(nodes[i].querySelector(".lc-dot"), { attr: { r: 9 }, fill: "#ffd9a1", duration: 0.25 }, i - 0.1)
            .to(nodes[i].querySelector(".lc-ring"), { attr: { r: 20 }, opacity: 1, duration: 0.25 }, i - 0.1)
            .to(nodes[i].querySelector("text"), { fill: "#f3ead9", duration: 0.25 }, i - 0.1)
            // a shockwave rings out as the token docks
            .fromTo(nodes[i].querySelector(".lc-burst"), { attr: { r: 12 }, opacity: 0.9 }, { attr: { r: 48 }, opacity: 0, duration: 0.45, ease: "power2.out", immediateRender: false }, i - 0.1)
            .addLabel(`s${i}`, i);
        }

        return () => {
          delete el.dataset.pinned;
        };
      });

      mm.add(`(max-width: 1023px) and ${MOTION_OK}`, () => {
        gsap.utils.toArray<HTMLElement>(".lc-panel").forEach((p) =>
          gsap.from(p, { y: 40, opacity: 0, duration: 0.8, scrollTrigger: { trigger: p, start: "top 85%", toggleActions: "play none none none" } }),
        );
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} id="lifecycle" data-chapter="Lifecycle" className="group/lc relative">
      <div className="mx-auto max-w-[1400px] px-4 pt-28 sm:px-6 md:pt-36">
        <SectionLabel index="02" title="Lifecycle" />
        <SplitReveal className="mt-8 max-w-3xl text-4xl font-light leading-[1.1] tracking-tight text-cream md:text-5xl">
          One GPU-hour. Six steps. One verdict.
        </SplitReveal>
      </div>

      <div className="lc-stage relative overflow-hidden lg:h-screen">
        <div className="lc-shell pointer-events-none absolute inset-0 hidden border-y border-line bg-night bg-[radial-gradient(ellipse_at_30%_50%,rgba(226,179,110,0.1),transparent_60%)] group-data-[pinned=true]/lc:block" />
        <div className="lc-content mx-auto grid h-full max-w-[1400px] items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:py-0">
          {/* Orbit diagram */}
          <div className="relative mx-auto hidden aspect-square w-full max-w-[min(600px,78vh)] group-data-[pinned=true]/lc:block">
            <svg viewBox="0 0 600 600" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
              <defs>
                <linearGradient id="lc-tail" gradientUnits="userSpaceOnUse" x1={TAIL_FROM.x} y1={TAIL_FROM.y} x2={C} y2={C - R}>
                  <stop offset="0" stopColor="#ffd9a1" stopOpacity="0" />
                  <stop offset="1" stopColor="#fff3dd" stopOpacity="0.95" />
                </linearGradient>
                <radialGradient id="lc-core" cx="50%" cy="50%" r="50%">
                  <stop offset="0" stopColor="#e2b36e" stopOpacity="0.18" />
                  <stop offset="1" stopColor="#e2b36e" stopOpacity="0" />
                </radialGradient>
              </defs>
              <circle cx={C} cy={C} r={R + 60} fill="url(#lc-core)" />
              <circle cx={C} cy={C} r={R} fill="none" stroke="#e8cda0" strokeOpacity="0.12" strokeDasharray="2 6" />
              <circle cx={C} cy={C} r={R - 70} fill="none" stroke="#e8cda0" strokeOpacity="0.06" />
              <circle
                className="lc-progress"
                cx={C}
                cy={C}
                r={R}
                fill="none"
                stroke="#e2b36e"
                strokeWidth="1.6"
                transform={`rotate(-90 ${C} ${C})`}
                style={{ filter: "drop-shadow(0 0 6px rgba(255,200,130,0.6))" }}
              />
              {STEPS.map((s, i) => {
                const p = station(i);
                const lx = C + (R + 46) * Math.cos(p.a);
                const ly = C + (R + 46) * Math.sin(p.a);
                return (
                  <g key={s.t} className="lc-node">
                    <circle className="lc-burst" cx={p.x} cy={p.y} r="12" fill="none" stroke="#ffd9a1" strokeWidth="1" opacity="0" />
                    <circle className="lc-ring" cx={p.x} cy={p.y} r={i === 0 ? 20 : 14} fill="none" stroke="#e2b36e" strokeOpacity="0.5" opacity={i === 0 ? 1 : 0.4} />
                    <circle className="lc-dot" cx={p.x} cy={p.y} r={i === 0 ? 9 : 5} fill={i === 0 ? "#ffd9a1" : "#655a4b"} />
                    <text
                      x={lx}
                      y={ly + 4}
                      textAnchor={Math.abs(Math.cos(p.a)) < 0.2 ? "middle" : Math.cos(p.a) > 0 ? "start" : "end"}
                      fontSize="12"
                      letterSpacing="3"
                      fontFamily="var(--font-michroma)"
                      fill={i === 0 ? "#f3ead9" : "#655a4b"}
                    >
                      {s.t.toUpperCase()}
                    </text>
                  </g>
                );
              })}
              {/* the token travelling its orbit */}
              <g className="lc-token">
                {/* comet tail trailing 40° behind the token */}
                <path className="lc-tail" d={TAIL} opacity="0" fill="none" stroke="url(#lc-tail)" strokeWidth="3" strokeLinecap="round" style={{ filter: "drop-shadow(0 0 6px rgba(255,210,150,0.7))" }} />
                <circle cx={C} cy={C - R} r="16" fill="#ffd9a1" opacity="0.18" />
                <circle cx={C} cy={C - R} r="6" fill="#fff3dd" style={{ filter: "drop-shadow(0 0 10px rgba(255,210,150,0.9))" }} />
              </g>
            </svg>
            {/* core: planet and step number */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative flex h-[40%] w-[40%] items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/art/emblem.webp" alt="" className="absolute inset-0 h-full w-full object-contain opacity-30" />
                {STEPS.map((s, i) => (
                  <span key={s.t} className="lc-num num absolute text-6xl font-light text-cream">
                    0{i + 1}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Step panels */}
          <div className="relative lg:h-[420px]">
            <div className="relative space-y-6 group-data-[pinned=true]/lc:h-full group-data-[pinned=true]/lc:space-y-0">
              {STEPS.map((s, i) => (
                <article
                  key={s.t}
                  className="lc-panel panel p-7 group-data-[pinned=true]/lc:absolute group-data-[pinned=true]/lc:inset-x-0 group-data-[pinned=true]/lc:top-0 group-data-[pinned=true]/lc:border-transparent group-data-[pinned=true]/lc:bg-none group-data-[pinned=true]/lc:p-0 group-data-[pinned=true]/lc:shadow-none"
                >
                  <p className="label flex items-center gap-3">
                    <span className="num text-gold">0{i + 1}</span> / 06
                  </p>
                  <h3 className="mt-5 text-4xl font-light text-cream md:text-6xl">{s.t}</h3>
                  <p className="mt-6 max-w-md text-lg font-light leading-relaxed text-sand md:text-xl">{s.d}</p>
                  <p className="num mt-8 w-fit rounded-full border border-gold/25 bg-gold/[0.06] px-3.5 py-1.5 text-[12px] text-gold-hot">{s.rule}</p>
                </article>
              ))}
            </div>
            <div className="mt-10 hidden h-px w-full bg-line group-data-[pinned=true]/lc:absolute group-data-[pinned=true]/lc:-bottom-10 group-data-[pinned=true]/lc:block">
              <div className="lc-bar h-full origin-left bg-gold" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
