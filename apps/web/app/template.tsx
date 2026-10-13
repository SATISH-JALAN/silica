"use client";

import { useRef } from "react";
import { gsap, useGSAP, MOTION_OK } from "@/animations/gsap";

/** Route change: content fades and lifts in (0.35s) */
export default function Template({ children }: { children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.from(root.current, { opacity: 0, y: 14, duration: 0.35, ease: "power2.out", clearProps: "transform,opacity" });
      });
    },
    { scope: root },
  );
  return <div ref={root}>{children}</div>;
}
