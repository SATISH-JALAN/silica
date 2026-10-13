"use client";

import Link from "next/link";
import { useRef } from "react";
import { gsap, useGSAP, MOTION_OK } from "@/animations/gsap";
import { ForwardCurve } from "@/components/markets/ForwardCurve";
import { SplitReveal } from "@/components/ui/motion";
import { Magnetic } from "@/components/ui/pointer";
import { SectionLabel } from "./SectionLabel";
import { SERIES_LIST as SERIES } from "@/lib/series";
import { useCurveMarks } from "@/lib/market";
import { utcDay } from "@/lib/format";

export function CurveSection() {
  const root = useRef<HTMLElement>(null);
  const marks = useCurveMarks();

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        // the chart panel unfolds from a narrow window as it rises into view
        gsap.fromTo(
          ".cv-panel",
          { clipPath: "inset(18% 22% 18% 22% round 28px)", scale: 0.94 },
          { clipPath: "inset(0% 0% 0% 0% round 14px)", scale: 1, ease: "power1.out", scrollTrigger: { trigger: ".cv-panel", start: "top 95%", end: "top 40%", scrub: true } },
        );
        gsap.from(".cv-cta > *", { y: 20, opacity: 0, stagger: 0.1, duration: 0.8, scrollTrigger: { trigger: ".cv-cta", start: "top 90%", toggleActions: "play none none none" } });
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} data-chapter="Forward curve" className="relative mx-auto max-w-[1400px] px-4 py-28 sm:px-6 md:py-40">
      <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-end">
        <div>
          <SectionLabel index="04" title="Forward curve" />
          <SplitReveal className="mt-8 max-w-2xl text-4xl font-light leading-[1.08] tracking-tight text-cream md:text-6xl">
            A public price for future compute.
          </SplitReveal>
        </div>
        <div className="cv-cta flex flex-wrap gap-3">
          <Magnetic>
            <Link href="/markets" data-cursor="Open" className="rounded-full border border-gold/40 bg-gold/10 px-6 py-3 text-sm text-cream transition-[color,background-color,border-color,box-shadow] hover:border-gold hover:bg-gold/20">
              Open the markets
            </Link>
          </Magnetic>
        </div>
      </div>

      <div className="cv-panel spot panel relative mt-16 overflow-hidden p-4 sm:p-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_100%,rgba(226,179,110,0.12),transparent_60%)]" />
        <div className="relative mb-2 flex items-center justify-between">
          <p className="label">H100-80GB · APAC · USDC per GPU-hour</p>
          <p className="num text-[11px] text-dust">W{SERIES[0].week} → W{SERIES[SERIES.length - 1].week} · mark via CRE</p>
        </div>
        <ForwardCurve height={360} points={SERIES.map((s, i) => ({ label: `W${s.week}`, sub: utcDay(s.deliveryStart), value: marks[i] }))} />
      </div>
    </section>
  );
}
