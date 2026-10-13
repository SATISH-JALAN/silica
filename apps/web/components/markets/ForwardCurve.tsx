"use client";

import { useMemo, useRef } from "react";
import { gsap, useGSAP, MOTION_OK } from "@/animations/gsap";

type Point = { label: string; sub?: string; value: number };

type Props = {
  points: Point[];
  /** "scroll" draws when scrolled into view, "load" draws on mount */
  trigger?: "scroll" | "load";
  className?: string;
  height?: number;
};

const VW = 800;
const PAD = { l: 56, r: 40, t: 40, b: 54 };

function smoothPath(xy: [number, number][]) {
  if (xy.length < 2) return "";
  let d = `M${xy[0][0]},${xy[0][1]}`;
  for (let i = 0; i < xy.length - 1; i++) {
    const p0 = xy[i - 1] ?? xy[i];
    const p1 = xy[i];
    const p2 = xy[i + 1];
    const p3 = xy[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
  }
  return d;
}

/** The compute price curve across delivery weeks */
export function ForwardCurve({ points, trigger = "scroll", className = "", height = 320 }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const ys = useRef<number[] | null>(null);
  const drawn = useRef(false);

  const vals = points.map((p) => p.value);
  const lo = Math.floor((Math.min(...vals) - 0.05) * 20) / 20;
  const hi = Math.ceil((Math.max(...vals) + 0.05) * 20) / 20;
  const ih = height - PAD.t - PAD.b;
  const x = (i: number) => PAD.l + (i * (VW - PAD.l - PAD.r)) / Math.max(1, points.length - 1);
  const y = (v: number) => PAD.t + ((hi - v) / (hi - lo)) * ih;

  const ticks = useMemo(() => {
    const out: number[] = [];
    for (let v = lo; v <= hi + 1e-9; v += 0.05) out.push(+v.toFixed(2));
    return out;
  }, [lo, hi]);

  const target = points.map((p) => y(p.value));
  const xy = (arr: number[]) => arr.map((yy, i) => [x(i), yy] as [number, number]);
  const line = smoothPath(xy(target));
  const area = `${line} L${x(points.length - 1)},${height - PAD.b} L${x(0)},${height - PAD.b} Z`;
  // React owns the first frame only; afterwards GSAP moves the geometry
  const initial = useRef({ line, area, target });

  useGSAP(
    () => {
      const el = root.current!;
      const lineEl = el.querySelector<SVGPathElement>(".fc-line")!;
      const areaEl = el.querySelector<SVGPathElement>(".fc-area")!;
      const dots = el.querySelectorAll<SVGGElement>(".fc-pos");

      const render = (arr: number[]) => {
        const d = smoothPath(xy(arr));
        lineEl.setAttribute("d", d);
        areaEl.setAttribute("d", `${d} L${x(points.length - 1)},${height - PAD.b} L${x(0)},${height - PAD.b} Z`);
        dots.forEach((g, i) => g.setAttribute("transform", `translate(${x(i)},${arr[i]})`));
      };

      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: reduce)", () => render(target));
      mm.add(MOTION_OK, () => {
        if (!drawn.current) {
          drawn.current = true;
          ys.current = [...target];
          const tl = gsap.timeline({
            scrollTrigger: trigger === "scroll" ? { trigger: el, start: "top 80%", toggleActions: "play none none none" } : undefined,
          });
          tl.from(".fc-grid", { opacity: 0, duration: 0.6, stagger: 0.04 })
            .from(lineEl, { drawSVG: "0%", duration: 1.0, ease: "power2.inOut" }, 0.1)
            .from(areaEl, { opacity: 0, duration: 0.8 }, 0.6)
            .from(".fc-pt", { scale: 0, opacity: 0, transformOrigin: "center", stagger: 0.12, duration: 0.45, ease: "back.out(2.5)" }, 0.5)
            .from(".fc-lbl", { opacity: 0, y: 6, stagger: 0.08, duration: 0.4 }, 0.8);
          return;
        }
        // points glide to new marks
        const from = ys.current ?? target;
        const proxy = [...from];
        gsap.to(proxy, {
          ...Object.fromEntries(target.map((t, i) => [i, t])),
          duration: 0.4,
          ease: "power2.out",
          onUpdate: () => render(proxy),
          onComplete: () => {
            ys.current = [...target];
          },
        });
      });
    },
    { scope: root, dependencies: [vals.join(",")], revertOnUpdate: false },
  );

  return (
    <div ref={root} className={className}>
      <svg viewBox={`0 0 ${VW} ${height}`} className="h-auto w-full overflow-visible" role="img" aria-label={`Forward curve: ${points.map((p) => `${p.label} ${p.value.toFixed(2)}`).join(", ")}`}>
        <defs>
          <linearGradient id="fc-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#e2b36e" stopOpacity="0.22" />
            <stop offset="1" stopColor="#e2b36e" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="fc-stroke" x1="0" x2="1">
            <stop offset="0" stopColor="#b9813e" />
            <stop offset="0.5" stopColor="#ffd9a1" />
            <stop offset="1" stopColor="#e2b36e" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t} className="fc-grid">
            <line x1={PAD.l} x2={VW - PAD.r} y1={y(t)} y2={y(t)} stroke="rgba(232,205,160,0.07)" />
            <text x={PAD.l - 12} y={y(t) + 4} textAnchor="end" fill="#655a4b" fontSize="11" fontFamily="var(--font-jetbrains)">
              {t.toFixed(2)}
            </text>
          </g>
        ))}
        <path className="fc-area" d={initial.current.area} fill="url(#fc-area)" />
        <path className="fc-line" d={initial.current.line} fill="none" stroke="url(#fc-stroke)" strokeWidth="2" style={{ filter: "drop-shadow(0 0 8px rgba(255,200,130,0.45))" }} />
        {points.map((p, i) => (
          <g key={p.label}>
            <line x1={x(i)} x2={x(i)} y1={PAD.t - 8} y2={height - PAD.b} stroke="rgba(232,205,160,0.05)" className="fc-grid" />
            <g className="fc-pos" transform={`translate(${x(i)},${initial.current.target[i] ?? target[i]})`}>
              <g className="fc-pt">
                <circle r="11" fill="#e2b36e" opacity="0.15" />
                <circle r="4.5" fill="#fff3dd" />
              </g>
              <text className="fc-lbl" y="-20" textAnchor="middle" fill="#f3ead9" fontSize="12" fontFamily="var(--font-jetbrains)">
                {p.value.toFixed(2)}
              </text>
            </g>
            <text className="fc-lbl" x={x(i)} y={height - PAD.b + 24} textAnchor="middle" fill="#cdbfa6" fontSize="11" letterSpacing="2" fontFamily="var(--font-michroma)">
              {p.label}
            </text>
            {p.sub && (
              <text className="fc-lbl" x={x(i)} y={height - PAD.b + 42} textAnchor="middle" fill="#655a4b" fontSize="10" fontFamily="var(--font-jetbrains)">
                {p.sub}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}
