"use client";

import { useRef } from "react";
import { gsap, useGSAP, ScrollTrigger } from "@/animations/gsap";

/**
 * Fixed progress rail on the right edge (desktop): page progress fills the
 * line, the current chapter number and name roll into place.
 * Sections opt in with `data-chapter="Name"`, in page order.
 */
export function ChapterRail({ chapters }: { chapters: string[] }) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(min-width: 1024px)", () => {
        const sections = gsap.utils.toArray<HTMLElement>("[data-chapter]", document.body);
        if (!sections.length) return;
        const fill = root.current!.querySelector(".cr-fill");
        gsap.set(root.current, { autoAlpha: 0 });

        // sections contain pinned stages: measure after those pins add their spacing
        ScrollTrigger.create({ start: 0, end: "max", refreshPriority: -1, onUpdate: (s) => gsap.set(fill, { scaleY: s.progress }) });
        ScrollTrigger.create({
          trigger: sections[0],
          start: "top 55%",
          endTrigger: sections[sections.length - 1],
          end: "bottom 45%",
          refreshPriority: -1,
          onToggle: (s) => gsap.to(root.current, { autoAlpha: s.isActive ? 1 : 0, duration: 0.5 }),
        });
        sections.forEach((sec, i) =>
          ScrollTrigger.create({
            trigger: sec,
            start: "top 55%",
            end: "bottom 55%",
            refreshPriority: -1,
            onToggle: (s) => {
              if (!s.isActive) return;
              gsap.to(".cr-num-col, .cr-name-col", { yPercent: (-100 / chapters.length) * i, duration: 0.7, ease: "expo.out" });
            },
          }),
        );
      });
    },
    { scope: root },
  );

  return (
    <div ref={root} aria-hidden className="pointer-events-none invisible fixed right-5 top-1/2 z-40 hidden -translate-y-1/2 flex-col items-center gap-4 opacity-0 lg:flex">
      <div className="h-4 overflow-hidden">
        <div className="cr-num-col">
          {chapters.map((_, i) => (
            <p key={i} className="num h-4 text-[11px] leading-4 text-gold">
              0{i + 1}
            </p>
          ))}
        </div>
      </div>
      <div className="relative h-32 w-px bg-line">
        <div className="cr-fill absolute inset-0 origin-top bg-gold shadow-[0_0_8px_rgba(255,205,140,0.7)]" />
      </div>
      <div className="h-[120px] w-4 overflow-hidden">
        <div className="cr-name-col">
          {chapters.map((c) => (
            <p key={c} className="label flex h-[120px] w-4 items-start justify-center !text-[9px] [writing-mode:vertical-rl]">
              {c}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
