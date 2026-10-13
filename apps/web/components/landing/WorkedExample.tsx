"use client";

import { useRef } from "react";
import { gsap, useGSAP, MOTION_OK } from "@/animations/gsap";
import { SplitReveal } from "@/components/ui/motion";
import { SectionLabel } from "./SectionLabel";
import { usd, int } from "@/lib/format";

const STEPS = [
  { t: "Mint", d: "NeoGPU locks $600 and mints 1,000 H100 hours." },
  { t: "Trade", d: "A startup buys 100 hours at $2.05." },
  { t: "Redeem", d: "Week 44: it burns them and a ticket opens." },
  { t: "Deliver", d: "Encrypted access arrives. CRE confirms each hour." },
  { t: "Miss", d: "The node goes dark for 10 of the 100 hours." },
  { t: "Slash", d: "10 h × 1.5 × $2.05 = $30.75, paid from the bond." },
  { t: "Release", d: "NeoGPU gets back $600 − $30.75 = $569.25." },
];

const MISSED = new Set([41, 42, 43, 44, 45, 46, 47, 48, 49, 50]);
const T0 = 2.4; // hour cells start filling
const EACH = 0.03;
const STEP_AT = [0, 1, 1.9, T0, T0 + 41 * EACH, 5.6, 6.5];

export function WorkedExample() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      const build = (pinned: boolean) => {
        const el = root.current!;
        if (pinned) el.dataset.pinned = "true";
        const q = gsap.utils.selector(el);
        const v = { bond: 0, tokens: 0, delivered: 0, missed: 0, slash: 0 };
        const out = {
          bond: q(".we-bond")[0], tokens: q(".we-tokens")[0], delivered: q(".we-delivered")[0],
          missed: q(".we-missed")[0], slash: q(".we-slash")[0],
        };
        const render = () => {
          out.bond.textContent = usd(v.bond);
          out.tokens.textContent = int(v.tokens);
          out.delivered.textContent = int(v.delivered);
          out.missed.textContent = int(v.missed);
          out.slash.textContent = usd(v.slash);
        };
        render();

        const caps = q(".we-cap");
        const ticks = q(".we-tick-fill");
        if (pinned) {
          gsap.set(caps.slice(1), { autoAlpha: 0, y: 40 });
          gsap.set(ticks.slice(1), { scaleX: 0 });
        }

        const tl = gsap.timeline({
          defaults: { ease: "none" },
          onUpdate: render,
          scrollTrigger: pinned
            ? { trigger: ".we-stage", start: "top top", end: "+=360%", pin: true, scrub: 0.6 }
            : { trigger: ".we-ticket", start: "top 75%", toggleActions: "play none none none" },
        });
        if (!pinned) tl.timeScale(0.9);

        tl.to(v, { bond: 600, tokens: 1000, duration: 0.8, ease: "power2.out" }, 0.05);
        tl.from(".we-ticket", { opacity: 0.25, y: 30, duration: 0.6, ease: "power2.out" }, STEP_AT[2] - 0.5);

        // hour cells fill; the outage run turns red and shakes
        const cells = q(".we-cell");
        cells.forEach((c, i) => {
          const at = T0 + i * EACH;
          tl.from(c, { backgroundColor: "rgba(232,205,160,0.06)", scale: 0.4, duration: 0.12, ease: "back.out(2)" }, at);
          if (MISSED.has(i)) tl.to(c, { keyframes: { x: [-3, 3, -2, 2, 0] }, duration: 0.15 }, at + 0.1);
        });
        tl.to(v, { delivered: 41, duration: 41 * EACH }, T0);
        tl.to(v, { missed: 10, duration: 10 * EACH }, T0 + 41 * EACH);
        tl.to(v, { delivered: 90, duration: 49 * EACH }, T0 + 51 * EACH);

        tl.to(v, { slash: 30.75, duration: 0.7, ease: "power2.out" }, STEP_AT[5]);
        tl.from(".we-flow", { scaleX: 0, transformOrigin: "right center", duration: 0.5, ease: "power2.inOut" }, STEP_AT[5]);
        // the slash streams out of the bond to the buyer
        tl.to(".we-coin", { keyframes: { left: ["100%", "0%"], opacity: [0, 1, 1, 0] }, duration: 0.6, stagger: 0.08, ease: "none" }, STEP_AT[5] + 0.1);

        // a verifier scanline sweeps the grid as hours are checked
        tl.set(".we-scan", { opacity: 1 }, T0)
          .fromTo(".we-scan", { top: "0%" }, { top: "100%", duration: 100 * EACH, ease: "none", immediateRender: false }, T0)
          .to(".we-scan", { opacity: 0, duration: 0.15 }, T0 + 100 * EACH);
        tl.to(v, { bond: 569.25, duration: 0.6, ease: "power2.out" }, STEP_AT[6]);
        tl.from(".we-released", { autoAlpha: 0, y: 10, duration: 0.3 }, STEP_AT[6]);

        STEP_AT.forEach((at, i) => {
          if (i === 0 || !pinned) return;
          tl.to(caps[i - 1], { autoAlpha: 0, y: -40, duration: 0.2, ease: "power2.in" }, at - 0.18)
            .to(caps[i], { autoAlpha: 1, y: 0, duration: 0.25, ease: "power2.out" }, at)
            .to(ticks[i], { scaleX: 1, duration: 0.25, ease: "power2.out" }, at);
        });
        tl.to({}, { duration: 0.6 }); // hold the final frame

        return () => {
          delete el.dataset.pinned;
        };
      };
      mm.add(`(min-width: 1024px) and ${MOTION_OK}`, () => build(true));
      mm.add(`(max-width: 1023px) and ${MOTION_OK}`, () => build(false));
    },
    { scope: root },
  );

  return (
    <section ref={root} data-chapter="Worked example" className="group/we relative">
      <div className="mx-auto max-w-[1400px] px-4 pt-28 sm:px-6 md:pt-36">
        <SectionLabel index="03" title="Worked example" />
        <SplitReveal className="mt-8 max-w-3xl text-4xl font-light leading-[1.1] tracking-tight text-cream md:text-5xl">
          10 hours missed. The buyer still got paid.
        </SplitReveal>
      </div>

      <div className="we-stage relative group-data-[pinned=true]/we:h-screen">
        <div className="mx-auto grid h-full max-w-[1400px] items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 group-data-[pinned=true]/we:pb-4 group-data-[pinned=true]/we:pt-20">
          {/* Narrative: one beat at a time while pinned, a short list otherwise */}
          <div>
            <div className="relative space-y-6 group-data-[pinned=true]/we:h-[230px] group-data-[pinned=true]/we:space-y-0">
              {STEPS.map((s, i) => (
                <div key={s.t} className="we-cap group-data-[pinned=true]/we:absolute group-data-[pinned=true]/we:inset-x-0 group-data-[pinned=true]/we:top-0">
                  <p className="label">
                    <span className="num text-gold">0{i + 1}</span> / 07
                  </p>
                  <h3 className="mt-3 text-2xl font-light text-cream group-data-[pinned=true]/we:mt-5 group-data-[pinned=true]/we:text-7xl">{s.t}</h3>
                  <p className="mt-2 max-w-sm text-base leading-relaxed text-sand group-data-[pinned=true]/we:mt-6 group-data-[pinned=true]/we:text-xl group-data-[pinned=true]/we:font-light">{s.d}</p>
                </div>
              ))}
            </div>
            <div className="mt-10 hidden gap-2 group-data-[pinned=true]/we:flex" aria-hidden>
              {STEPS.map((s) => (
                <span key={s.t} className="relative h-px w-10 bg-line-strong">
                  <span className="we-tick-fill absolute inset-0 origin-left bg-gold shadow-[0_0_6px_rgba(255,205,140,0.7)]" />
                </span>
              ))}
            </div>
          </div>

          {/* Ticket */}
          <div className="we-ticket spot panel relative overflow-hidden p-5 sm:p-7">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_90%_0%,rgba(226,179,110,0.12),transparent_55%)]" />
            <div className="relative flex flex-wrap items-baseline justify-between gap-2">
              <p className="label">Ticket #1042 · H100·APAC·W44</p>
              <p className="num text-xs text-dust">NeoGPU → startup · 100 h @ $2.05</p>
            </div>

            <div className="relative mx-auto mt-5 grid grid-cols-10 gap-1.5 group-data-[pinned=true]/we:max-w-[min(100%,calc(100svh-500px))]">
              {Array.from({ length: 100 }, (_, i) => (
                <span
                  key={i}
                  className={`we-cell aspect-square rounded-[3px] ${MISSED.has(i) ? "bg-ask shadow-[0_0_10px_rgba(226,113,93,0.5)]" : "bg-bid/70"}`}
                />
              ))}
              <span className="we-scan pointer-events-none absolute -inset-x-3 top-0 h-[2px] rounded-full bg-gradient-to-r from-transparent via-gold-hot to-transparent opacity-0 shadow-[0_0_18px_rgba(255,217,161,0.85)]" />
            </div>

            <div className="relative mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-dust">
              <span className="flex items-center gap-2"><i className="h-2 w-2 rounded-sm bg-bid/70" /> confirmed</span>
              <span className="flex items-center gap-2"><i className="h-2 w-2 rounded-sm bg-ask" /> missed → slashed</span>
            </div>

            <div className="relative mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
              <Stat label="Bond locked" cls="we-bond" value={usd(569.25)} />
              <Stat label="Tokens minted" cls="we-tokens" value="1,000" />
              <Stat label="Hours delivered" cls="we-delivered" value="90" tone="text-bid" />
              <Stat label="Hours missed" cls="we-missed" value="10" tone="text-ask" />
            </div>

            <div className="relative mt-4 flex items-center gap-4 rounded-xl border border-gold/25 bg-gold/[0.06] px-5 py-4">
              <div>
                <p className="label !text-[9px]">Slash paid to buyer</p>
                <p className="we-slash num mt-1 text-2xl text-gold-hot">{usd(30.75)}</p>
              </div>
              <div className="relative h-px flex-1">
                <div className="we-flow absolute inset-0 bg-gradient-to-l from-gold/70 to-gold/10" />
                {Array.from({ length: 5 }, (_, i) => (
                  <span key={i} className="we-coin absolute -top-[3px] h-[7px] w-[7px] rounded-full bg-gold-hot opacity-0 shadow-[0_0_10px_rgba(255,217,161,0.95)]" />
                ))}
              </div>
              <div className="we-released text-right">
                <p className="label !text-[9px]">Bond released</p>
                <p className="num mt-1 text-sm text-cream">$569.25</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, cls, tone = "text-cream" }: { label: string; value: string; cls: string; tone?: string }) {
  return (
    <div className="bg-night px-4 py-3.5">
      <p className="label !text-[9px]">{label}</p>
      <p className={`${cls} num mt-1.5 text-lg ${tone}`}>{value}</p>
    </div>
  );
}
