"use client";

import { useRef } from "react";
import { gsap, useGSAP, MOTION_OK } from "@/animations/gsap";

/** "02 —— Lifecycle": index, a hairline that draws, then the title */
export function SectionLabel({ index, title, className = "" }: { index: string; title: string; className?: string }) {
  const el = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const tl = gsap.timeline({ scrollTrigger: { trigger: el.current, start: "top 88%", toggleActions: "play none none none" } });
        tl.from(".sl-line", { scaleX: 0, transformOrigin: "left center", duration: 0.9, ease: "expo.inOut" })
          .from(".sl-text", { opacity: 0, x: -10, duration: 0.6 }, "-=0.4")
          // the title decodes like a terminal readout
          .to(".sl-title", { duration: 1.1, scrambleText: { text: title, chars: "ΛSILC0123456789·", revealDelay: 0.25, speed: 0.5 }, ease: "none" }, "<");
      });
    },
    { scope: el },
  );
  return (
    <div ref={el} className={`flex items-center gap-4 ${className}`}>
      <span className="num sl-text text-xs text-gold">{index}</span>
      <span className="sl-line h-px w-12 bg-gold/50" />
      <span className="label sl-text sl-title">{title}</span>
    </div>
  );
}
