"use client";

import { useEffect, useRef, useState } from "react";
import { gsap, useGSAP, MOTION_OK } from "@/animations/gsap";
import { DemoBadge, Field, PageHeader, Row, Select, Toast } from "@/components/ui/kit";
import { NumberRoll } from "@/components/ui/motion";
import { SERIES, TICKETS, type Ticket } from "@/lib/mock";
import { useNow } from "@/lib/live";
import { ACCESS_DEADLINE_MIN, slashPayout, verdict } from "@/lib/units";
import { countdown, int, usd, utcDay } from "@/lib/format";
import { useWallet } from "@/lib/wallet";
import { TicketTimeline } from "./TicketTimeline";
import { AccessReveal } from "./AccessReveal";
import { LIVE } from "@/lib/series";
import { TicketsViewLive } from "./TicketsViewLive";

/** Live redemptions on a deployment; the seeded demo otherwise */
export function TicketsView() {
  return LIVE ? <TicketsViewLive /> : <TicketsViewDemo />;
}

type Mode = "healthy" | "outage" | "probe";
const DEMO_HOUR_MS = 1800;

function TicketsViewDemo() {
  const root = useRef<HTMLDivElement>(null);
  const now = useNow();
  const { address, connect } = useWallet();
  const [sel, setSel] = useState(SERIES[0].id);
  const [hours, setHours] = useState("24");
  const [demo, setDemo] = useState(true);
  const [balance, setBalance] = useState(120);
  const [live, setLive] = useState<Ticket[]>([]);
  const [mode, setMode] = useState<Mode>("healthy");
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const modeRef = useRef(mode);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const series = SERIES.find((s) => s.id === sel)!;
  const inWindow = demo || (now >= series.deliveryStart.getTime() && now <= series.deliveryEnd.getTime());
  const h = Number(hours);
  const err = !Number.isInteger(h) || h <= 0 ? "NotWholeHours: redeem whole GPU-hours" : h > balance ? "Insufficient tokens" : h > 48 && demo ? "Demo tickets are capped at 48 h" : null;

  // advance live demo tickets: access posts, then one verified hour per tick
  useEffect(() => {
    const id = setInterval(() => {
      setLive((ts) =>
        ts.map((t) => {
          if (t.status === "Settled") return t;
          if (t.status === "Open") return { ...t, status: "AccessPosted" };
          const i = t.timeline.findIndex((v) => v === null);
          if (i === -1) return { ...t, status: "Settled" };
          const m = modeRef.current;
          const providerOk = m === "outage" ? 2 : 12;
          const probeOk = m === "healthy" ? 12 - (Math.random() < 0.15 ? 1 : 0) : m === "outage" ? 0 : 3;
          const v = verdict(providerOk, probeOk);
          const timeline = [...t.timeline];
          timeline[i] = v;
          return {
            ...t,
            timeline,
            confirmed: t.confirmed + (v === "confirmed" ? 1 : 0),
            missed: t.missed + (v === "missed" ? 1 : 0),
            disputed: t.disputed + (v === "disputed" ? 1 : 0),
            status: i === t.hours - 1 ? "Settled" : t.status,
          };
        }),
      );
    }, DEMO_HOUR_MS);
    return () => clearInterval(id);
  }, []);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.from(".tk-panel", { y: 30, opacity: 0, stagger: 0.08, duration: 0.7, delay: 0.25 });
      });
    },
    { scope: root },
  );

  const redeem = () => {
    if (!address) return connect();
    if (!inWindow) return setMsg({ tone: "err", text: `OutsideDeliveryWindow: W${series.week} opens ${utcDay(series.deliveryStart)} 00:00 UTC` });
    if (err) return setMsg({ tone: "err", text: err });
    const ticket: Ticket = {
      id: 1100 + live.length,
      seriesCode: series.code,
      provider: "NeoGPU",
      hours: h,
      confirmed: 0,
      missed: 0,
      disputed: 0,
      priceAtOpen: series.mark,
      status: "Open",
      openedAt: "just now",
      timeline: Array.from({ length: h }, () => null),
    };
    setLive((ts) => [ticket, ...ts]);
    setBalance((b) => b - h);
    setMsg({ tone: "ok", text: `Burned ${int(h)} tokens · ticket #${ticket.id} opened · access due within ${ACCESS_DEADLINE_MIN} min (simulated)` });
  };

  const all = [...live, ...TICKETS];

  return (
    <div ref={root}>
      <PageHeader label="Holder · redemptions" title="Redeem for real GPU time">
        <DemoBadge>Demo mode · 1 delivery hour = 1.8 s</DemoBadge>
      </PageHeader>

      <div className="grid gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
        <div className="space-y-5">
          <section className="tk-panel panel p-6">
            <p className="label">Redeem</p>
            <div className="mt-5 space-y-3">
              <Select label="Series" value={sel} onChange={setSel} options={SERIES.map((s) => ({ value: s.id, label: s.code }))} />
              <Field
                label="GPU-hours to redeem"
                suffix="hours"
                type="number"
                step="1"
                min="1"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                error={err}
                hint={
                  <>
                    Balance <NumberRoll value={balance} format={(n) => `${int(n)} h`} snap={1} /> of {series.code}
                  </>
                }
              />
            </div>
            <div className="mt-3 rounded-lg border border-line bg-void/40 px-3 py-2">
              <Row k="Delivery window" v={`${utcDay(series.deliveryStart)} → ${utcDay(series.deliveryEnd)}`} />
              <Row k="Window" v={demo ? "open (demo mode)" : now === 0 ? "…" : inWindow ? "open" : `opens in ${countdown(series.deliveryStart.getTime() - now)}`} tone={inWindow ? "text-bid" : "text-warn"} />
              <Row k="Price fixed for slashes" v={`$${series.mark.toFixed(2)} / h`} />
              <Row k="Slash per missed hour" v={usd(slashPayout(1, series.mark))} tone="text-gold-hot" />
            </div>
            <label className="mt-4 flex cursor-pointer items-center gap-3 text-[12px] text-sand">
              <input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} className="accent-[#e2b36e]" />
              Demo mode: treat the delivery window as open
            </label>
            <button onClick={redeem} className="mt-4 w-full rounded-full bg-cream py-3 text-sm font-semibold text-void transition-shadow hover:shadow-[0_0_30px_rgba(255,205,140,0.35)]">
              {address ? "redeem() · burn & open ticket" : "Connect wallet to redeem"}
            </button>
            <Toast show={!!msg} tone={msg?.tone}>
              {msg?.text}
            </Toast>
          </section>

          <section className="tk-panel panel p-6">
            <p className="label">Delivery evidence (demo)</p>
            <p className="mt-3 text-[12px] leading-relaxed text-dust">Each hour, CRE compares 12 signed provider heartbeats with 12 independent probe checks. Change what the next hours look like:</p>
            <div className="mt-4 grid gap-2">
              {(
                [
                  ["healthy", "Both up", "confirmed", "text-bid border-bid/40 bg-bid/10"],
                  ["outage", "Provider outage", "missed → slashed", "text-ask border-ask/40 bg-ask/10"],
                  ["probe", "Sources disagree", "disputed, held", "text-warn border-warn/40 bg-warn/10"],
                ] as const
              ).map(([m, label, out, cls]) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-left text-[12px] transition-colors ${mode === m ? cls : "border-line text-dust hover:text-cream"}`}
                >
                  <span>{label}</span>
                  <span className="num text-[10px] opacity-80">{out}</span>
                </button>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-5">
          {all.map((t) => (
            <TicketCard key={t.id} t={t} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function TicketCard({ t, access }: { t: Ticket; access?: React.ReactNode }) {
  const slash = slashPayout(t.missed, t.priceAtOpen);
  const pill =
    t.status === "Settled"
      ? "border-line text-dust"
      : t.status === "AccessPosted"
        ? "border-bid/40 bg-bid/10 text-bid"
        : "border-warn/40 bg-warn/10 text-warn";
  return (
    <article className="tk-panel panel p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-xs tracking-[0.18em] text-cream">TICKET #{t.id}</p>
          <p className="num mt-1.5 text-[11px] text-dust">
            {t.seriesCode} · {t.provider} · {int(t.hours)} h @ ${t.priceAtOpen.toFixed(2)} · opened {t.openedAt}
          </p>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-wider ${pill}`}>{t.status === "AccessPosted" ? "Delivering" : t.status}</span>
      </div>

      <div className="mt-5">
        <TicketTimeline ticket={t} />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
        <Cell k="Confirmed" v={<NumberRoll value={t.confirmed} format={int} snap={1} />} tone="text-bid" />
        <Cell k="Missed" v={<NumberRoll value={t.missed} format={int} snap={1} />} tone="text-ask" />
        <Cell k="Disputed" v={<NumberRoll value={t.disputed} format={int} snap={1} />} tone="text-warn" />
        <Cell k="Slash paid to you" v={<NumberRoll value={slash} format={(n) => usd(n)} />} tone="text-gold-hot" />
      </div>

      {t.status !== "Open" && <div className="mt-5">{access ?? <AccessReveal ticketId={t.id} provider={t.provider} />}</div>}
    </article>
  );
}

function Cell({ k, v, tone }: { k: string; v: React.ReactNode; tone: string }) {
  return (
    <div className="bg-night px-4 py-3">
      <p className="label !text-[9px]">{k}</p>
      <p className={`num mt-1.5 text-lg ${tone}`}>{v}</p>
    </div>
  );
}
