"use client";

import { useRef } from "react";
import { gsap, useGSAP, ScrollTrigger, ScrollSmoother, SplitText, MOTION_OK, MOTION_REDUCED } from "@/animations/gsap";

/**
 * Must be the first child inside the smooth content so ScrollSmoother is
 * created before any sibling's ScrollTriggers (layout effects run in order).
 */
export function SmoothScroll({ children }: { children: React.ReactNode }) {
  return (
    <div id="smooth-wrapper">
      <div id="smooth-content">
        <SmootherInit />
        {children}
      </div>
    </div>
  );
}

function SmootherInit() {
  useGSAP(() => {
    // The story always starts at the top (or at an #anchor). Browser scroll
    // restoration races ScrollTrigger's first refresh and the pinned scenes,
    // so a reload would otherwise land at a random, half-initialised frame.
    const prev = history.scrollRestoration;
    history.scrollRestoration = "manual";
    const hash = decodeURIComponent(location.hash.slice(1));
    if (!hash) window.scrollTo(0, 0);

    const mm = gsap.matchMedia();
    mm.add(`${MOTION_OK} and (pointer: fine)`, () => {
      const s = ScrollSmoother.create({ wrapper: "#smooth-wrapper", content: "#smooth-content", smooth: 1.15, effects: true, normalizeScroll: false });
      return () => s.kill();
    });

    // jump to the anchor once pins have added their spacing
    const t = hash ? window.setTimeout(() => scrollToId(hash), 200) : 0;
    return () => {
      window.clearTimeout(t);
      history.scrollRestoration = prev;
    };
  });
  return null;
}

/** Smoothly scroll to an in-page anchor, with or without the smoother */
export function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const s = ScrollSmoother.get();
  if (s) s.scrollTo(el, true, "top 64px");
  else el.scrollIntoView({ behavior: "smooth", block: "start" });
}

type RevealProps = {
  children: React.ReactNode;
  className?: string;
  /** selector of children to stagger; defaults to direct children */
  items?: string;
  y?: number;
  stagger?: number;
  delay?: number;
  as?: "div" | "section" | "ul" | "ol";
};

/** Fades and lifts children in when they scroll into view */
export function Reveal({ children, className = "", items, y = 28, stagger = 0.08, delay = 0, as: Tag = "div" }: RevealProps) {
  const root = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const targets = items ? gsap.utils.toArray<HTMLElement>(items, root.current) : Array.from(root.current!.children);
        gsap.from(targets, {
          y,
          opacity: 0,
          duration: 0.9,
          stagger,
          delay,
          ease: "power3.out",
          scrollTrigger: { trigger: root.current, start: "top 85%", toggleActions: "play none none none" },
        });
      });
    },
    { scope: root },
  );
  return (
    <Tag ref={root as React.RefObject<never>} className={className}>
      {children}
    </Tag>
  );
}

type SplitProps = {
  children: React.ReactNode;
  className?: string;
  as?: "h1" | "h2" | "h3" | "p";
  /** play on load instead of on scroll */
  immediate?: boolean;
  delay?: number;
};

/** Headline whose lines rise in from a mask, staggered (0.8s, 0.06s) */
export function SplitReveal({ children, className = "", as: Tag = "h2", immediate = false, delay = 0 }: SplitProps) {
  const root = useRef<HTMLHeadingElement>(null);
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        // The ScrollTrigger lives outside onSplit: autoSplit re-splits on font
        // load and resize, and creating triggers there feeds a refresh loop.
        let played = immediate;
        let anim: gsap.core.Tween | null = null;
        const split = SplitText.create(root.current, {
          type: "lines,words",
          mask: "lines",
          linesClass: "split-line",
          autoSplit: true,
          onSplit: (self) => {
            const progress = anim ? anim.progress() : 0;
            anim?.kill();
            anim = gsap.from(self.words, {
              yPercent: 110,
              rotationX: -65,
              transformOrigin: "50% 100%",
              transformPerspective: 700,
              opacity: 0,
              duration: 0.9,
              stagger: 0.06,
              delay: progress ? 0 : delay,
              ease: "power4.out",
              paused: !played,
            });
            if (progress) anim.progress(progress);
          },
        });
        const st = immediate
          ? null
          : ScrollTrigger.create({
              trigger: root.current,
              start: "top 85%",
              toggleActions: "play none none none",
              onEnter: () => {
                played = true;
                anim?.play();
              },
            });
        return () => {
          st?.kill();
          anim?.kill();
          split.revert();
        };
      });
    },
    { scope: root },
  );
  return (
    <Tag ref={root as React.RefObject<never>} className={className}>
      {children}
    </Tag>
  );
}

/** Words brighten from dim to cream as the paragraph is scrolled through */
export function ScrubText({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const root = useRef<HTMLParagraphElement>(null);
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const split = SplitText.create(root.current, { type: "words" });
        gsap.fromTo(
          split.words,
          { opacity: 0.14 },
          {
            opacity: 1,
            stagger: 0.1,
            ease: "none",
            scrollTrigger: { trigger: root.current, start: "top 80%", end: "bottom 45%", scrub: true },
          },
        );
        return () => split.revert();
      });
    },
    { scope: root },
  );
  return (
    <p ref={root} className={className}>
      {children}
    </p>
  );
}

type RollProps = {
  value: number;
  format: (n: number) => string;
  className?: string;
  /** "view": count up from `from` once in view; "change": roll whenever value changes */
  mode?: "view" | "change";
  from?: number;
  duration?: number;
  snap?: number;
};

/** Number that rolls to its new value (tween on a proxy object) */
export function NumberRoll({ value, format, className = "", mode = "change", from = 0, duration = 0.6, snap }: RollProps) {
  const el = useRef<HTMLSpanElement>(null);
  const proxy = useRef({ v: mode === "view" ? from : value });

  useGSAP(
    () => {
      const render = () => {
        if (el.current) el.current.textContent = format(proxy.current.v);
      };
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.to(proxy.current, {
          v: value,
          duration: mode === "view" ? 1.6 : duration,
          ease: mode === "view" ? "power2.out" : "power3.out",
          snap: snap ? { v: snap } : undefined,
          onUpdate: render,
          scrollTrigger: mode === "view" ? { trigger: el.current, start: "top 90%", toggleActions: "play none none none" } : undefined,
        });
      });
      mm.add(MOTION_REDUCED, () => {
        proxy.current.v = value;
        render();
      });
    },
    { dependencies: [value] },
  );

  return (
    <span ref={el} className={className}>
      {format(mode === "view" ? from : value)}
    </span>
  );
}

export { ScrollTrigger };
