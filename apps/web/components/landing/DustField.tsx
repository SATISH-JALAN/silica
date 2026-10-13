"use client";

import { useRef } from "react";
import { gsap, useGSAP, ScrollSmoother, MOTION_OK } from "@/animations/gsap";
import { rng } from "@/lib/mock";

/**
 * Warm dust drifting in depth behind the whole page. Near motes move faster
 * than far ones as you scroll, and stretch into light streaks at speed.
 */
export function DustField() {
  const ref = useRef<HTMLCanvasElement>(null);

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add(MOTION_OK, () => {
      const c = ref.current!;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      let w = 0;
      let h = 0;
      const resize = () => {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        w = window.innerWidth;
        h = window.innerHeight;
        c.width = w * dpr;
        c.height = h * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      };
      resize();
      window.addEventListener("resize", resize);

      const r = rng(42);
      const motes = Array.from({ length: w < 768 ? 45 : 110 }, () => ({
        x: r() * w,
        y: r() * h,
        z: 0.15 + r() * 0.85, // depth: 1 is nearest
        s: 0.5 + r() * 1.1,
        t: r() * Math.PI * 2,
      }));

      const pos = () => ScrollSmoother.get()?.scrollTop() ?? window.scrollY;
      let last = pos();
      let vel = 0;

      const tick = () => {
        const y = pos();
        vel += (y - last - vel) * 0.18;
        last = y;
        ctx.clearRect(0, 0, w, h);
        // motes only streak once you really move; gentle scrolling keeps them points
        const streak = Math.min(40, Math.max(0, Math.abs(vel) - 8) * 0.7);
        for (const m of motes) {
          m.t += 0.006;
          m.y -= vel * m.z * 0.45 + 0.1 * m.z;
          m.x += Math.sin(m.t) * 0.06;
          if (m.y < -50) {
            m.y = h + 50;
            m.x = Math.random() * w;
          } else if (m.y > h + 50) {
            m.y = -50;
            m.x = Math.random() * w;
          }
          const a = (0.12 + 0.5 * m.z) * (0.65 + 0.35 * Math.sin(m.t * 4));
          const len = streak * m.z;
          if (len > 1.5) {
            const g = ctx.createLinearGradient(m.x, m.y, m.x, m.y + len * Math.sign(vel));
            g.addColorStop(0, `rgba(255,217,161,${a})`);
            g.addColorStop(1, "rgba(255,217,161,0)");
            ctx.strokeStyle = g;
            ctx.lineWidth = m.s * m.z * 1.2;
            ctx.beginPath();
            ctx.moveTo(m.x, m.y);
            ctx.lineTo(m.x, m.y + len * Math.sign(vel));
            ctx.stroke();
          } else {
            ctx.fillStyle = `rgba(255,217,161,${a})`;
            ctx.beginPath();
            ctx.arc(m.x, m.y, m.s * m.z, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      };
      gsap.ticker.add(tick);
      return () => {
        gsap.ticker.remove(tick);
        window.removeEventListener("resize", resize);
        ctx.clearRect(0, 0, w, h);
      };
    });
  });

  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 -z-10 h-full w-full" />;
}
