"use client";

import { useMemo, useRef, useState } from "react";
import { gsap, useGSAP, MOTION_OK } from "@/animations/gsap";
import { BondGauge, DemoBadge, Field, PageHeader, Row, Select, Toast } from "@/components/ui/kit";
import { NumberRoll } from "@/components/ui/motion";
import { PROVIDERS, SERIES } from "@/lib/mock";
import { requiredBond, REPUTATION_BOND_RATIO_BPS, DEFAULT_BOND_RATIO_BPS } from "@/lib/units";
import { int, pct, shortAddr, usd } from "@/lib/format";
import { useWallet } from "@/lib/wallet";

type Position = { seriesId: string; bond: number; minted: number; assigned: number; settled: number; marginCalled: boolean };

const me = PROVIDERS[0];

const INITIAL: Position[] = [
  { seriesId: SERIES[0].id, bond: 1_850, minted: 2_400, assigned: 148, settled: 100, marginCalled: false },
  { seriesId: SERIES[1].id, bond: 1_420, minted: 2_000, assigned: 0, settled: 0, marginCalled: false },
  { seriesId: SERIES[2].id, bond: 980, minted: 1_400, assigned: 0, settled: 0, marginCalled: false },
  { seriesId: SERIES[3].id, bond: 420, minted: 1_100, assigned: 0, settled: 0, marginCalled: true },
];

export function ProviderConsole() {
  const root = useRef<HTMLDivElement>(null);
  const { address } = useWallet();
  const [positions, setPositions] = useState(INITIAL);
  const [sel, setSel] = useState(SERIES[0].id);
  const [deposit, setDeposit] = useState("500");
  const [mintHours, setMintHours] = useState("200");
  const [nodeKey, setNodeKey] = useState("");
  const [toast, setToast] = useState<{ where: string; tone: "ok" | "err"; msg: string } | null>(null);

  const ratioBps = me.bondRatioBps;
  const series = SERIES.find((s) => s.id === sel)!;
  const pos = positions.find((p) => p.seriesId === sel)!;
  const open = pos.minted - pos.settled;
  const req = (h: number) => requiredBond(open + h, series.mark, ratioBps);
  const headroom = Math.max(0, Math.floor((pos.bond / (series.mark * (ratioBps / 10_000))) - open));
  const n = Number(mintHours);
  const mintErr = pos.marginCalled
    ? "MarginCalled: top up this series before minting"
    : !Number.isInteger(n) || n <= 0
      ? "Whole hours only"
      : req(n) > pos.bond
        ? `BondTooLow: need ${usd(req(n))}, have ${usd(pos.bond)}`
        : null;

  const totals = useMemo(
    () => ({
      bond: positions.reduce((a, p) => a + p.bond, 0),
      minted: positions.reduce((a, p) => a + p.minted, 0),
    }),
    [positions],
  );

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.from(".pc-stat", { y: 20, opacity: 0, stagger: 0.06, duration: 0.6, delay: 0.2 });
        gsap.from(".pc-panel", { y: 30, opacity: 0, stagger: 0.08, duration: 0.7, delay: 0.3 });
        gsap.from(".pc-rep", { scaleX: 0, transformOrigin: "left center", duration: 1.4, delay: 0.6, ease: "expo.inOut" });
      });
    },
    { scope: root },
  );

  const update = (fn: (p: Position) => Position) => setPositions((ps) => ps.map((p) => (p.seriesId === sel ? fn(p) : p)));

  const doDeposit = () => {
    const a = Number(deposit);
    if (!(a > 0)) return setToast({ where: "bond", tone: "err", msg: "Enter a USDC amount" });
    update((p) => {
      const bond = p.bond + a;
      const stillShort = requiredBond(p.minted - p.settled, series.mark, ratioBps) > bond;
      return { ...p, bond, marginCalled: p.marginCalled && stillShort };
    });
    setToast({ where: "bond", tone: "ok", msg: `BondDeposited · ${usd(a)} into ${series.code} (simulated)` });
  };

  const doMint = () => {
    if (mintErr) return setToast({ where: "mint", tone: "err", msg: mintErr });
    update((p) => ({ ...p, minted: p.minted + n }));
    setToast({ where: "mint", tone: "ok", msg: `Minted · ${int(n)} ${series.code} tokens to your wallet (simulated)` });
  };

  const doKey = () => {
    if (!/^0x[0-9a-fA-F]{40}$/.test(nodeKey)) return setToast({ where: "key", tone: "err", msg: "Enter the node's signer address (0x…40 hex)" });
    setToast({ where: "key", tone: "ok", msg: `setNodeKey(${shortAddr(nodeKey)}) · heartbeats will be verified against this key (simulated)` });
  };

  const repProgress = Math.min(1, me.hoursConfirmed / 1000);

  return (
    <div ref={root}>
      <PageHeader label="Provider console" title={`${me.name}`}>
        <div className="flex flex-col items-start gap-2 md:items-end">
          <DemoBadge>Demo provider · FAKE_GPU node</DemoBadge>
          <span className="num text-[11px] text-dust">{address ? `connected ${shortAddr(address)}` : `viewing ${shortAddr(me.address)}`}</span>
        </div>
      </PageHeader>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-5">
        <Stat k="Bond locked" v={<NumberRoll value={totals.bond} format={(x) => usd(x)} />} />
        <Stat k="Hours minted" v={<NumberRoll value={totals.minted} format={int} snap={1} />} />
        <Stat k="Hours confirmed" v={int(me.hoursConfirmed)} tone="text-bid" />
        <Stat k="Hours missed" v={int(me.hoursMissed)} tone="text-ask" />
        <Stat k="Reliability" v={pct(me.reliabilityBps / 10_000, 2)} />
      </div>

      {/* reputation → bond ratio */}
      <div className="pc-panel panel mt-6 p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="label">Bond ratio from reputation</p>
            <p className="mt-3 text-sm text-sand">
              Ratio drops from <span className="num text-cream">{DEFAULT_BOND_RATIO_BPS / 100}%</span> to{" "}
              <span className="num text-cream">{REPUTATION_BOND_RATIO_BPS / 100}%</span> after 1,000 confirmed hours at 99% or better. Read from Envio, applied by CRE Mark &amp; Margin.
            </p>
          </div>
          <p className="num text-3xl text-gold-hot">{ratioBps / 100}%</p>
        </div>
        <div className="relative mt-5 h-2 overflow-hidden rounded-full bg-white/[0.06]">
          <div className="pc-rep absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-gold-deep to-gold-hot" style={{ width: `${repProgress * 100}%` }} />
        </div>
        <div className="num mt-2 flex justify-between text-[11px] text-dust">
          <span>{int(me.hoursConfirmed)} / 1,000 confirmed h</span>
          <span className={me.reliabilityBps >= 9900 ? "text-bid" : ""}>{pct(me.reliabilityBps / 10_000, 2)} ≥ 99%</span>
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        {/* Deposit */}
        <section className="pc-panel panel p-6">
          <p className="label">1 · Deposit bond</p>
          <div className="mt-5 space-y-3">
            <Select label="Series" value={sel} onChange={setSel} options={SERIES.map((s) => ({ value: s.id, label: s.code }))} />
            <Field label="Amount" suffix="USDC" type="number" min="1" value={deposit} onChange={(e) => setDeposit(e.target.value)} />
          </div>
          <button onClick={doDeposit} className="mt-4 w-full rounded-full border border-gold/40 bg-gold/10 py-2.5 text-sm text-cream transition-colors hover:border-gold hover:bg-gold/20">
            depositBond()
          </button>
          <Toast show={toast?.where === "bond"} tone={toast?.tone}>
            {toast?.msg}
          </Toast>
        </section>

        {/* Mint */}
        <section className="pc-panel panel p-6">
          <p className="label">2 · Mint GPU-hours</p>
          <div className="mt-5 space-y-3">
            <Field label={`Hours of ${series.code}`} suffix="hours" type="number" step="1" min="1" value={mintHours} onChange={(e) => setMintHours(e.target.value)} error={mintErr} />
          </div>
          <div className="mt-3 rounded-lg border border-line bg-void/40 px-3 py-2">
            <Row k="Mark" v={`$${series.mark.toFixed(2)} / h`} />
            <Row k="Required after mint" v={Number.isFinite(req(n)) ? usd(req(n)) : "—"} tone={mintErr ? "text-ask" : "text-cream"} />
            <Row k="Bond in series" v={usd(pos.bond)} />
            <Row k="Headroom" v={`${int(headroom)} h`} tone="text-gold-hot" />
          </div>
          <p className="num mt-2 text-[10px] text-ash">bond ≥ (minted − settled + new) × mark × {ratioBps / 100}%</p>
          <button onClick={doMint} className="mt-4 w-full rounded-full bg-cream py-2.5 text-sm font-semibold text-void transition-opacity disabled:opacity-40" disabled={!!mintErr}>
            mint()
          </button>
          <Toast show={toast?.where === "mint"} tone={toast?.tone}>
            {toast?.msg}
          </Toast>
        </section>

        {/* Node key */}
        <section className="pc-panel panel p-6">
          <p className="label">3 · Register node key</p>
          <p className="mt-4 text-[12px] leading-relaxed text-dust">
            Your provider-agent signs an EIP-712 HourSummary every hour with this key. DeliveryOracle recovers it onchain, so heartbeats from any other key are worthless.
          </p>
          <div className="mt-4">
            <Field label="Node signer address" placeholder="0x…" value={nodeKey} onChange={(e) => setNodeKey(e.target.value.trim())} />
          </div>
          <button onClick={doKey} className="mt-4 w-full rounded-full border border-line-strong py-2.5 text-sm text-cream transition-colors hover:border-gold/60">
            setNodeKey()
          </button>
          <Toast show={toast?.where === "key"} tone={toast?.tone}>
            {toast?.msg}
          </Toast>
        </section>
      </div>

      {/* Positions */}
      <section className="pc-panel panel mt-6 overflow-hidden">
        <div className="flex items-center justify-between px-6 pt-6">
          <p className="label">Positions</p>
          <p className="num text-[11px] text-dust">CRE Mark &amp; Margin checks hourly</p>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-[12px]">
            <thead>
              <tr className="label !text-[9px]">
                {["Series", "Bond", "Minted", "Assigned", "Settled", "Required", "Coverage", "Status"].map((h) => (
                  <th key={h} className="px-6 pb-3 font-normal">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {positions.map((p) => {
                const s = SERIES.find((x) => x.id === p.seriesId)!;
                const r = requiredBond(p.minted - p.settled, s.mark, ratioBps);
                const cov = p.bond / r;
                return (
                  <tr key={p.seriesId} onClick={() => setSel(p.seriesId)} className={`cursor-pointer border-t border-line transition-colors hover:bg-white/[0.02] ${sel === p.seriesId ? "bg-gold/[0.04]" : ""}`}>
                    <td className="px-6 py-4 font-display text-[10px] tracking-[0.16em] text-cream">{s.code}</td>
                    <td className="num px-6 py-4 text-sand">
                      <NumberRoll value={p.bond} format={(x) => usd(x)} />
                    </td>
                    <td className="num px-6 py-4 text-sand">
                      <NumberRoll value={p.minted} format={int} snap={1} />
                    </td>
                    <td className="num px-6 py-4 text-sand">{int(p.assigned)}</td>
                    <td className="num px-6 py-4 text-sand">{int(p.settled)}</td>
                    <td className="num px-6 py-4 text-sand">{usd(r)}</td>
                    <td className="w-40 px-6 py-4">
                      <BondGauge coverage={Math.min(1, cov)} marginCall={p.marginCalled} />
                    </td>
                    <td className="px-6 py-4">
                      {p.marginCalled ? (
                        <span className="rounded-full border border-warn/40 bg-warn/10 px-2.5 py-1 text-[10px] uppercase tracking-wider text-warn">Margin call</span>
                      ) : (
                        <span className="rounded-full border border-bid/30 bg-bid/10 px-2.5 py-1 text-[10px] uppercase tracking-wider text-bid">Healthy</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({ k, v, tone = "text-cream" }: { k: string; v: React.ReactNode; tone?: string }) {
  return (
    <div className="pc-stat bg-night px-5 py-4">
      <p className="label !text-[9px]">{k}</p>
      <p className={`num mt-2 text-xl ${tone}`}>{v}</p>
    </div>
  );
}
