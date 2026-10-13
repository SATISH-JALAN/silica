"use client";

import { useRef, useState } from "react";
import type { Address } from "viem";
import { maxUint256 } from "viem";
import { gsap, useGSAP, MOTION_OK } from "@/animations/gsap";
import { BondGauge, DemoBadge, Field, PageHeader, Row, Select, Toast } from "@/components/ui/kit";
import { NumberRoll } from "@/components/ui/motion";
import { bondVaultAbi, mockUSDCAbi, redemptionManagerAbi } from "@silica/shared/abis";
import { SERIES_LIST } from "@/lib/series";
import { A, useBalances, useNodeKey, usePositions, useSeriesLive } from "@/lib/onchain";
import { useProviders } from "@/lib/envio";
import { DEFAULT_BOND_RATIO_BPS, PENALTY_BOND_RATIO_BPS, REPUTATION_BOND_RATIO_BPS } from "@/lib/units";
import { int, pct, shortAddr, usd } from "@/lib/format";
import { useWallet } from "@/lib/wallet";
import { explain, txUrl, useSend } from "@/lib/tx";
import { Stat } from "./ProviderConsole";

// The seeded, simulated testnet provider shown when the connected wallet isn't one
const DEMO_PROVIDER = process.env.NEXT_PUBLIC_PROVIDER_A as Address | undefined;

type Msg = { where: string; tone: "ok" | "err"; msg: React.ReactNode } | null;

export function ProviderConsoleLive() {
  const root = useRef<HTMLDivElement>(null);
  const { address, connect } = useWallet();
  const mine = usePositions(address);
  const isProvider = !!address && mine.isProvider;
  const who = (isProvider ? address : DEMO_PROVIDER) ?? null;
  const view = usePositions(who);
  const marks = useSeriesLive().map;
  const bal = useBalances(address, undefined, A.vault);
  const nodeKeyRead = useNodeKey(who);
  const rec = useProviders().data?.Provider.find((p) => p.id === who?.toLowerCase());
  const { send, pending } = useSend();

  const [sel, setSel] = useState(SERIES_LIST[0].seriesId);
  const [deposit, setDeposit] = useState("200");
  const [mintHours, setMintHours] = useState("50");
  const [withdraw, setWithdraw] = useState("50");
  const [nodeKey, setNodeKey] = useState("");
  const [msg, setMsg] = useState<Msg>(null);

  const series = SERIES_LIST.find((s) => s.seriesId === sel)!;
  const mark = marks.get(sel)?.mark ?? series.mark;
  const pos = view.positions.find((p) => p.seriesId === sel);
  const n = Number(mintHours);
  const ratio = pos?.ratioBps ?? DEFAULT_BOND_RATIO_BPS;
  const requiredAfter = pos ? ((pos.minted - pos.settled + (Number.isFinite(n) ? n : 0)) * mark * ratio) / 10_000 : 0;
  const mintErr = !isProvider
    ? null
    : pos?.marginCalled
      ? "MarginCalled: top up this series before minting"
      : !Number.isInteger(n) || n <= 0
        ? "Whole hours only"
        : pos && n > pos.mintable
          ? `BondTooLow: headroom is ${int(pos.mintable)} h`
          : null;

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

  const run = async (where: string, label: string, fn: () => Promise<{ hash: string; ok: boolean }>, done: string) => {
    if (!address) return connect();
    setMsg(null);
    try {
      const r = await fn();
      void view.refetch();
      void mine.refetch();
      void bal.refetch();
      setMsg({
        where,
        tone: r.ok ? "ok" : "err",
        msg: (
          <>
            {r.ok ? done : `${label} reverted`} ·{" "}
            <a className="underline" href={txUrl(r.hash)} target="_blank" rel="noreferrer">
              tx ↗
            </a>
          </>
        ),
      });
    } catch (e) {
      setMsg({ where, tone: "err", msg: explain(e) });
    }
  };

  const doDeposit = () =>
    run(
      "bond",
      "depositBond",
      async () => {
        const amount = BigInt(Math.round(Number(deposit) * 1e6));
        if (!(amount > 0n)) throw new Error("Enter a USDC amount");
        if (bal.usdcAllowance < amount) await send("Approving USDC", { address: A.usdc, abi: mockUSDCAbi, functionName: "approve", args: [A.vault, maxUint256] });
        return send("Depositing bond", { address: A.vault, abi: bondVaultAbi, functionName: "depositBond", args: [BigInt(sel), amount] });
      },
      `BondDeposited · ${usd(Number(deposit))} into ${series.code}`,
    );

  const doMint = () =>
    run("mint", "mint", () => send("Minting", { address: A.vault, abi: bondVaultAbi, functionName: "mint", args: [BigInt(sel), BigInt(n)] }), `Minted ${int(n)} ${series.code} tokens to your wallet`);

  const doWithdraw = () =>
    run(
      "bond",
      "withdrawExcess",
      () => send("Withdrawing", { address: A.vault, abi: bondVaultAbi, functionName: "withdrawExcess", args: [BigInt(sel), BigInt(Math.round(Number(withdraw) * 1e6))] }),
      `Withdrew ${usd(Number(withdraw))} of excess bond`,
    );

  const doKey = () =>
    /^0x[0-9a-fA-F]{40}$/.test(nodeKey)
      ? run("key", "setNodeKey", () => send("Registering key", { address: A.rm, abi: redemptionManagerAbi, functionName: "setNodeKey", args: [nodeKey as Address] }), `setNodeKey(${shortAddr(nodeKey)})`)
      : setMsg({ where: "key", tone: "err", msg: "Enter the node's signer address (0x…40 hex)" });

  const totals = {
    bond: view.positions.reduce((a, p) => a + p.bond, 0),
    minted: view.positions.reduce((a, p) => a + p.minted, 0),
  };
  const confirmed = Number(rec?.hoursConfirmed ?? 0);
  const missed = Number(rec?.hoursMissed ?? 0);
  const reliabilityBps = rec?.reliabilityBps ?? 10_000;
  const repProgress = Math.min(1, confirmed / 1000);
  const name = who && who.toLowerCase() === DEMO_PROVIDER?.toLowerCase() ? "NeoGPU" : who ? shortAddr(who) : "Provider";
  const disabled = !isProvider || !!pending;

  return (
    <div ref={root}>
      <PageHeader label="Provider console" title={name}>
        <div className="flex flex-col items-start gap-2 md:items-end">
          <DemoBadge>Monad Testnet · simulated FAKE_GPU node</DemoBadge>
          <span className="num text-[11px] text-dust">
            {isProvider ? `connected provider ${shortAddr(address!)}` : address ? `${shortAddr(address)} is not a registered provider · viewing NeoGPU` : `viewing ${who ? shortAddr(who) : "—"}`}
          </span>
        </div>
      </PageHeader>

      {!isProvider && (
        <div className="mb-6 rounded-xl border border-gold/25 bg-gold/[0.06] px-5 py-3 text-[12px] text-sand">
          Read-only. Providers are allowlisted (PROVIDER_ROLE; KYB in production). On testnet the two seeded provider wallets run simulated nodes. Connect one of them to deposit, mint and register a node key.
        </div>
      )}

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-5">
        <Stat k="Bond locked" v={<NumberRoll value={totals.bond} format={(x) => usd(x)} />} />
        <Stat k="Hours minted" v={<NumberRoll value={totals.minted} format={int} snap={1} />} />
        <Stat k="Hours confirmed" v={int(confirmed)} tone="text-bid" />
        <Stat k="Hours missed" v={int(missed)} tone="text-ask" />
        <Stat k="Reliability" v={pct(reliabilityBps / 10_000, 2)} />
      </div>

      <div className="pc-panel panel mt-6 p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="label">Bond ratio from reputation</p>
            <p className="mt-3 text-sm text-sand">
              Ratio drops from <span className="num text-cream">{DEFAULT_BOND_RATIO_BPS / 100}%</span> to <span className="num text-cream">{REPUTATION_BOND_RATIO_BPS / 100}%</span> after 1,000 confirmed hours at 99% or better, and rises to{" "}
              <span className="num text-cream">{PENALTY_BOND_RATIO_BPS / 100}%</span> if reliability falls below 95% over 10+ hours. Read from Envio, applied by CRE Mark &amp; Margin.
            </p>
          </div>
          <p className="num text-3xl text-gold-hot">{ratio / 100}%</p>
        </div>
        <div className="relative mt-5 h-2 overflow-hidden rounded-full bg-white/[0.06]">
          <div className="pc-rep absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-gold-deep to-gold-hot" style={{ width: `${repProgress * 100}%` }} />
        </div>
        <div className="num mt-2 flex justify-between text-[11px] text-dust">
          <span>{int(confirmed)} / 1,000 confirmed h</span>
          <span className={reliabilityBps >= 9900 ? "text-bid" : ""}>{pct(reliabilityBps / 10_000, 2)} ≥ 99%</span>
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <section className="pc-panel panel p-6">
          <p className="label">1 · Deposit bond</p>
          <div className="mt-5 space-y-3">
            <Select label="Series" value={String(sel)} onChange={(v) => setSel(Number(v))} options={SERIES_LIST.map((s) => ({ value: String(s.seriesId), label: s.code }))} />
            <Field label="Amount" suffix="USDC" type="number" min="1" value={deposit} onChange={(e) => setDeposit(e.target.value)} hint={address ? `Wallet ${usd(bal.usdc)}` : undefined} />
          </div>
          <button onClick={doDeposit} disabled={disabled} className="mt-4 w-full rounded-full border border-gold/40 bg-gold/10 py-2.5 text-sm text-cream transition-colors hover:border-gold hover:bg-gold/20 disabled:opacity-40">
            {pending === "Depositing bond" || pending === "Approving USDC" ? `${pending}…` : "depositBond()"}
          </button>
          <div className="mt-3 flex gap-2">
            <input
              value={withdraw}
              onChange={(e) => setWithdraw(e.target.value)}
              className="num w-24 rounded-md border border-line bg-void/50 px-2 py-1.5 text-[12px] text-cream outline-none focus:border-gold/50"
              aria-label="Withdraw amount"
            />
            <button onClick={doWithdraw} disabled={disabled} className="flex-1 rounded-full border border-line py-1.5 text-[12px] text-sand transition-colors hover:text-cream disabled:opacity-40">
              withdrawExcess()
            </button>
          </div>
          <Toast show={msg?.where === "bond"} tone={msg?.tone}>
            {msg?.msg}
          </Toast>
        </section>

        <section className="pc-panel panel p-6">
          <p className="label">2 · Mint GPU-hours</p>
          <div className="mt-5 space-y-3">
            <Field label={`Hours of ${series.code}`} suffix="hours" type="number" step="1" min="1" value={mintHours} onChange={(e) => setMintHours(e.target.value)} error={mintErr} />
          </div>
          <div className="mt-3 rounded-lg border border-line bg-void/40 px-3 py-2">
            <Row k="Mark (CRE)" v={`$${mark.toFixed(2)} / h`} />
            <Row k="Required after mint" v={usd(requiredAfter)} tone={mintErr ? "text-ask" : "text-cream"} />
            <Row k="Bond in series" v={usd(pos?.bond ?? 0)} />
            <Row k="Headroom" v={`${int(pos?.mintable ?? 0)} h`} tone="text-gold-hot" />
          </div>
          <p className="num mt-2 text-[10px] text-ash">bond ≥ (minted − settled + new) × mark × {ratio / 100}%</p>
          <button onClick={doMint} disabled={disabled || !!mintErr} className="mt-4 w-full rounded-full bg-cream py-2.5 text-sm font-semibold text-void transition-opacity disabled:opacity-40">
            {pending === "Minting" ? "Minting…" : "mint()"}
          </button>
          <Toast show={msg?.where === "mint"} tone={msg?.tone}>
            {msg?.msg}
          </Toast>
        </section>

        <section className="pc-panel panel p-6">
          <p className="label">3 · Register node key</p>
          <p className="mt-4 text-[12px] leading-relaxed text-dust">
            Your provider-agent signs an EIP-712 HourSummary every hour with this key. DeliveryOracle recovers it onchain, so heartbeats from any other key are worthless.
          </p>
          <p className="num mt-3 text-[11px] text-sand">current: {nodeKeyRead.data && nodeKeyRead.data !== "0x0000000000000000000000000000000000000000" ? shortAddr(nodeKeyRead.data) : "not set"}</p>
          <div className="mt-3">
            <Field label="Node signer address" placeholder="0x…" value={nodeKey} onChange={(e) => setNodeKey(e.target.value.trim())} />
          </div>
          <button onClick={doKey} disabled={disabled} className="mt-4 w-full rounded-full border border-line-strong py-2.5 text-sm text-cream transition-colors hover:border-gold/60 disabled:opacity-40">
            {pending === "Registering key" ? "Registering…" : "setNodeKey()"}
          </button>
          <Toast show={msg?.where === "key"} tone={msg?.tone}>
            {msg?.msg}
          </Toast>
        </section>
      </div>

      <section className="pc-panel panel mt-6 overflow-hidden">
        <div className="flex items-center justify-between px-6 pt-6">
          <p className="label">Positions</p>
          <p className="num text-[11px] text-dust">read from BondVault · CRE Mark &amp; Margin checks each run</p>
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
              {view.positions.map((p) => {
                const s = SERIES_LIST.find((x) => x.seriesId === p.seriesId)!;
                const cov = p.required > 0 ? p.bond / p.required : 1;
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
                    <td className="num px-6 py-4 text-sand">{usd(p.required)}</td>
                    <td className="w-40 px-6 py-4">
                      <BondGauge coverage={Math.min(1, cov)} marginCall={p.marginCalled} />
                    </td>
                    <td className="px-6 py-4">
                      {p.minted === 0 ? (
                        <span className="text-[10px] uppercase tracking-wider text-ash">No position</span>
                      ) : p.marginCalled ? (
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
