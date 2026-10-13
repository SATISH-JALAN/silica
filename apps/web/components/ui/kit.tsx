"use client";

import { useRef } from "react";
import { gsap, useGSAP, MOTION_OK, MOTION_REDUCED } from "@/animations/gsap";
import { SplitReveal } from "./motion";

export function PageHeader({ label, title, children }: { label: string; title: string; children?: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.from(".ph-fade", { opacity: 0, y: 12, duration: 0.7, stagger: 0.08, delay: 0.1 });
        gsap.from(".ph-line", { scaleX: 0, transformOrigin: "left center", duration: 1, ease: "expo.inOut" });
      });
    },
    { scope: root },
  );
  return (
    <div ref={root} className="flex flex-col gap-6 pb-10 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="ph-fade label flex items-center gap-3">
          <span className="ph-line h-px w-8 bg-gold/60" /> {label}
        </p>
        <SplitReveal as="h1" immediate className="mt-5 text-4xl font-light tracking-tight text-cream md:text-5xl">
          {title}
        </SplitReveal>
      </div>
      {children && <div className="ph-fade">{children}</div>}
    </div>
  );
}

export function Sparkline({ values, up, className = "" }: { values: number[]; up: boolean; className?: string }) {
  const w = 120;
  const h = 36;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - 2 - ((v - lo) / (hi - lo || 1)) * (h - 4)}`).join(" ");
  const color = up ? "#82c49c" : "#e2715d";
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} preserveAspectRatio="none" aria-hidden>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.4" vectorEffect="non-scaling-stroke" className="spark-line" />
    </svg>
  );
}

/** Coverage bar: fill eases to new coverage; a margin call pulses amber */
export function BondGauge({ coverage, marginCall = false, label }: { coverage: number; marginCall?: boolean; label?: string }) {
  const root = useRef<HTMLDivElement>(null);
  const c = Math.max(0, Math.min(1, coverage));
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.to(".gauge-fill", { scaleX: c, transformOrigin: "left center", duration: 0.5 });
        if (marginCall) gsap.to(".gauge-pulse", { opacity: 0.9, duration: 1.2, repeat: -1, yoyo: true, ease: "sine.inOut" });
      });
      mm.add(MOTION_REDUCED, () => {
        gsap.set(".gauge-fill", { scaleX: c, transformOrigin: "left center" });
      });
    },
    { scope: root, dependencies: [c, marginCall] },
  );
  return (
    <div ref={root}>
      {label && (
        <div className="mb-2 flex items-baseline justify-between text-[11px]">
          <span className="text-dust">{label}</span>
          <span className={`num ${marginCall ? "text-warn" : "text-sand"}`}>{(c * 100).toFixed(0)}%</span>
        </div>
      )}
      <div className="relative h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div className={`gauge-fill absolute inset-0 rounded-full ${marginCall ? "bg-warn" : "bg-gradient-to-r from-gold-deep to-gold-hot"}`} style={{ transform: "scaleX(0)" }} />
        {marginCall && <div className="gauge-pulse absolute inset-0 bg-warn opacity-0 blur-[2px]" />}
      </div>
    </div>
  );
}

export function Field({
  label,
  suffix,
  hint,
  error,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; suffix?: string; hint?: React.ReactNode; error?: string | null }) {
  return (
    <label className="block">
      <span className="label !text-[9px]">{label}</span>
      <span
        className={`mt-2 flex items-center rounded-lg border bg-void/60 px-3 transition-colors focus-within:border-gold/60 ${
          error ? "border-ask/60" : "border-line"
        }`}
      >
        <input {...props} className="num w-full bg-transparent py-2.5 text-sm text-cream outline-none placeholder:text-ash" />
        {suffix && <span className="ml-2 text-[11px] text-dust">{suffix}</span>}
      </span>
      {error ? <span className="mt-1.5 block text-[11px] text-ask">{error}</span> : hint ? <span className="mt-1.5 block text-[11px] text-dust">{hint}</span> : null}
    </label>
  );
}

export function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <label className="block">
      <span className="label !text-[9px]">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="num mt-2 w-full rounded-lg border border-line bg-void/60 px-3 py-2.5 text-sm text-cream outline-none transition-colors focus:border-gold/60"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-night">
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Row({ k, v, tone = "text-sand" }: { k: React.ReactNode; v: React.ReactNode; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 text-[12px]">
      <span className="text-dust">{k}</span>
      <span className={`num text-right ${tone}`}>{v}</span>
    </div>
  );
}

export function DemoBadge({ children = "Testnet demo · simulated" }: { children?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-warn/30 bg-warn/[0.07] px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-warn">
      <span className="h-1 w-1 rounded-full bg-warn" />
      {children}
    </span>
  );
}

export function Toast({ show, tone = "ok", children }: { show: boolean; tone?: "ok" | "err"; children: React.ReactNode }) {
  const el = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      if (!show) return;
      gsap.fromTo(el.current, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35 });
    },
    { dependencies: [show] },
  );
  if (!show) return null;
  return (
    <div ref={el} className={`mt-3 rounded-lg border px-3 py-2.5 text-[12px] ${tone === "ok" ? "border-bid/30 bg-bid/[0.08] text-bid" : "border-ask/30 bg-ask/[0.08] text-ask"}`}>
      {children}
    </div>
  );
}
