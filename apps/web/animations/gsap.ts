"use client";

import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollSmoother } from "gsap/ScrollSmoother";
import { SplitText } from "gsap/SplitText";
import { Flip } from "gsap/Flip";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { ScrambleTextPlugin } from "gsap/ScrambleTextPlugin";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";

gsap.registerPlugin(useGSAP, ScrollTrigger, ScrollSmoother, SplitText, Flip, DrawSVGPlugin, ScrambleTextPlugin, MotionPathPlugin);
gsap.defaults({ ease: "power3.out", duration: 0.5 });

// dev-only handle for inspecting timelines from the console
if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
  (window as unknown as { gsap: typeof gsap }).gsap = gsap;
}

export const MOTION_OK = "(prefers-reduced-motion: no-preference)";
export const MOTION_REDUCED = "(prefers-reduced-motion: reduce)";

export { gsap, useGSAP, ScrollTrigger, ScrollSmoother, SplitText, Flip, DrawSVGPlugin };
