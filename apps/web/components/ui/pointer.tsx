"use client";

import { useRef } from "react";
import { gsap, useGSAP, MOTION_OK } from "@/animations/gsap";

const FINE = `${MOTION_OK} and (pointer: fine)`;

/**
 * A gold dot that tracks the pointer exactly and a hairline ring that trails
 * it. The ring opens over links and buttons; `data-cursor="Label"` on any
 * element shows that word inside it.
 */
export function Cursor() {
  const ring = useRef<HTMLDivElement>(null);
  const dot = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add(FINE, () => {
      const html = document.documentElement;
      html.classList.add("has-cursor");
      gsap.set([ring.current, dot.current], { xPercent: -50, yPercent: -50 });

      const dx = gsap.quickSetter(dot.current, "x", "px");
      const dy = gsap.quickSetter(dot.current, "y", "px");
      const rx = gsap.quickTo(ring.current, "x", { duration: 0.5, ease: "power3.out" });
      const ry = gsap.quickTo(ring.current, "y", { duration: 0.5, ease: "power3.out" });

      let shown = false;
      let hovered: Element | null = null;

      const move = (e: PointerEvent) => {
        if (e.pointerType !== "mouse") return;
        if (!shown) {
          shown = true;
          gsap.set(ring.current, { x: e.clientX, y: e.clientY });
          gsap.to([ring.current, dot.current], { autoAlpha: 1, duration: 0.3 });
        }
        dx(e.clientX);
        dy(e.clientY);
        const spot = (e.target as Element | null)?.closest?.<HTMLElement>(".spot");
        if (spot) {
          const r = spot.getBoundingClientRect();
          spot.style.setProperty("--mx", `${e.clientX - r.left}px`);
          spot.style.setProperty("--my", `${e.clientY - r.top}px`);
        }
        rx(e.clientX);
        ry(e.clientY);
      };

      const over = (e: PointerEvent) => {
        const t = (e.target as Element | null)?.closest?.("a, button, [data-cursor]") ?? null;
        if (t === hovered) return;
        hovered = t;
        const text = t?.getAttribute("data-cursor") ?? "";
        if (label.current) label.current.textContent = text;
        if (t) {
          const size = text ? 76 : 54;
          gsap.to(ring.current, { width: size, height: size, backgroundColor: "rgba(226,179,110,0.10)", borderColor: "rgba(255,217,161,0.75)", duration: 0.4, ease: "power3.out" });
          gsap.to(dot.current, { scale: 0, duration: 0.25 });
          gsap.to(label.current, { autoAlpha: text ? 1 : 0, duration: 0.25 });
        } else {
          gsap.to(ring.current, { width: 34, height: 34, backgroundColor: "rgba(226,179,110,0)", borderColor: "rgba(226,179,110,0.45)", duration: 0.4, ease: "power3.out" });
          gsap.to(dot.current, { scale: 1, duration: 0.25 });
          gsap.to(label.current, { autoAlpha: 0, duration: 0.2 });
        }
      };

      const out = () => {
        shown = false;
        gsap.to([ring.current, dot.current], { autoAlpha: 0, duration: 0.3 });
      };
      const down = () => gsap.to(ring.current, { scale: 0.82, duration: 0.2 });
      const up = () => gsap.to(ring.current, { scale: 1, duration: 0.5, ease: "elastic.out(1, 0.5)" });

      window.addEventListener("pointermove", move, { passive: true });
      document.addEventListener("pointerover", over, { passive: true });
      document.documentElement.addEventListener("pointerleave", out);
      window.addEventListener("pointerdown", down);
      window.addEventListener("pointerup", up);
      return () => {
        html.classList.remove("has-cursor");
        window.removeEventListener("pointermove", move);
        document.removeEventListener("pointerover", over);
        document.documentElement.removeEventListener("pointerleave", out);
        window.removeEventListener("pointerdown", down);
        window.removeEventListener("pointerup", up);
      };
    });
  });

  return (
    <>
      <div
        ref={ring}
        aria-hidden
        className="pointer-events-none invisible fixed left-0 top-0 z-[70] flex h-[34px] w-[34px] items-center justify-center rounded-full border border-gold/45 opacity-0 backdrop-blur-[1px]"
      >
        <span ref={label} className="invisible font-display text-[8px] uppercase tracking-[0.24em] text-cream opacity-0" />
      </div>
      <div ref={dot} aria-hidden className="pointer-events-none invisible fixed left-0 top-0 z-[70] h-[6px] w-[6px] rounded-full bg-gold-hot opacity-0 shadow-[0_0_10px_rgba(255,217,161,0.9)]" />
    </>
  );
}

/** Pulls its child toward the pointer while hovered, then eases it home */
export function Magnetic({ children, strength = 0.3 }: { children: React.ReactNode; strength?: number }) {
  const el = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(FINE, () => {
        const wrap = el.current!;
        const target = wrap.firstElementChild as HTMLElement | null;
        if (!target) return;
        const xTo = gsap.quickTo(target, "x", { duration: 0.6, ease: "power3.out" });
        const yTo = gsap.quickTo(target, "y", { duration: 0.6, ease: "power3.out" });
        const move = (e: PointerEvent) => {
          const r = wrap.getBoundingClientRect();
          xTo((e.clientX - (r.left + r.width / 2)) * strength);
          yTo((e.clientY - (r.top + r.height / 2)) * strength);
        };
        const leave = () => {
          xTo(0);
          yTo(0);
        };
        wrap.addEventListener("pointermove", move);
        wrap.addEventListener("pointerleave", leave);
        return () => {
          wrap.removeEventListener("pointermove", move);
          wrap.removeEventListener("pointerleave", leave);
        };
      });
    },
    { scope: el },
  );

  return (
    <span ref={el} className="-m-4 inline-flex p-4">
      {children}
    </span>
  );
}
