"use client";

import { useRef } from "react";
import { gsap, useGSAP, MOTION_OK } from "@/animations/gsap";
import { DemoBadge, PageHeader } from "@/components/ui/kit";
import { ECOSYSTEM, EXPLORER, KURU_LISTINGS, NETWORK, SERIES_TOKENS, SILICA_CONTRACTS } from "@/lib/addresses";
import { useKuruBook } from "@/lib/onchain";
import { shortAddr } from "@/lib/format";
import { useNow } from "@/lib/live";
import { LIVE } from "@/lib/series";
import { useOracleState } from "@/lib/onchain";
import { HAS_ENVIO, useCreReports, useStats } from "@/lib/envio";
import demoTxs from "@silica/shared/demo-txs.json";

type DemoRun = { ticketId: string; at: string; hours: number; slashPaidUsdc: string; txs: Record<string, string> };
const RUNS = demoTxs as Record<string, DemoRun | undefined>;

const REPORTS = [
  { wf: "Mark & Margin", at: ":05", detail: "4 marks · 1 ratio → 20% · 1 margin call", tone: "text-warn" },
  { wf: "Delivery Verifier", at: ":02", detail: "64 verdicts · 63 confirmed · 1 disputed", tone: "text-bid" },
  { wf: "Mark & Margin", at: ":05", detail: "4 marks · 0 margin calls", tone: "text-sand" },
  { wf: "Delivery Verifier", at: ":02", detail: "64 verdicts · 54 confirmed · 10 missed → slashed $30.75", tone: "text-ask" },
];

const PROOF = ["Mint", "Trade", "Redeem", "Confirm", "Slash", "Margin call"];

const DISCLOSURES = [
  "Testnet only. No real money, no mainnet tokens, no offering.",
  "Provider nodes are simulated with a heartbeat agent (FAKE_GPU=1).",
  "Order-book liquidity is testnet-simulated: the market-maker bot only quotes; separate, labelled test wallets take trades. It never trades with itself.",
  "If CRE deploy access is pending, workflows run via `cre workflow simulate`, and a testnet-only relayReport() (RELAYER_ROLE, simulationMode) delivers the same signed report bytes.",
  "Single admin key on testnet, disclosed. Mainnet plan: multisig + timelock.",
];

export function StatusView() {
  const root = useRef<HTMLDivElement>(null);
  const now = useNow(60_000);
  const oracle = useOracleState().data;
  const simulationMode = oracle?.[0]?.result as boolean | undefined;
  const forwarder = oracle?.[2]?.result as string | undefined;
  const hourSeconds = oracle?.[3]?.result as bigint | undefined;
  const live = useCreReports().data?.CreReport;
  const stats = useStats().data?.Stats?.[0];
  const reports = live?.length
    ? live.map((r) => ({
        wf: r.verdicts > 0 ? "Delivery Verifier" : "Mark & Margin",
        when: new Date(Number(r.at) * 1000).toISOString().slice(11, 19),
        detail: r.verdicts > 0 ? `${r.verdicts} verdicts · ${r.applied} applied` : `${r.marks} marks · ${r.ratios} ratios · ${r.checks} margin checks`,
        tone: r.verdicts > 0 ? "text-bid" : "text-sand",
        via: r.relayed ? "relayReport (simulation)" : "CRE forwarder",
        tx: r.txHash,
      }))
    : null;

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.from(".st-panel", { y: 30, opacity: 0, stagger: 0.08, duration: 0.7, delay: 0.2 });
        gsap.from(".st-row", { x: -12, opacity: 0, stagger: 0.04, duration: 0.5, delay: 0.5 });
        gsap.from(".st-spine", { scaleY: 0, transformOrigin: "top center", duration: 1.2, delay: 0.6, ease: "expo.inOut" });
        gsap.from(".st-report", { x: 20, opacity: 0, stagger: 0.12, duration: 0.6, delay: 0.8 });
      });
    },
    { scope: root },
  );

  const hourLabel = (back: number) => {
    if (!now) return "—";
    const d = new Date(now - back * 3_600_000);
    return `${d.toISOString().slice(11, 13)}`;
  };

  return (
    <div ref={root}>
      <PageHeader label="Proof · for judges" title="Status & contracts">
        <DemoBadge>Monad Testnet · chain 10143</DemoBadge>
      </PageHeader>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="st-panel panel p-6">
          <p className="label">Network</p>
          <dl className="mt-4">
            {NETWORK.map(([k, v]) => (
              <div key={k} className="st-row flex items-baseline justify-between gap-6 border-b border-line py-3 text-[12px] last:border-0">
                <dt className="text-dust">{k}</dt>
                <dd className="num break-all text-right text-sand">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 flex flex-wrap gap-2 text-[12px]">
            {[
              ["MonadVision", "https://testnet.monadvision.com"],
              ["MonadScan", "https://testnet.monadscan.com"],
              ["Faucet", "https://faucet.monad.xyz"],
            ].map(([k, href]) => (
              <a key={k} href={href} target="_blank" rel="noreferrer" className="rounded-full border border-line px-3 py-1.5 text-sand transition-colors hover:border-gold/50 hover:text-cream">
                {k} ↗
              </a>
            ))}
          </div>
        </section>

        <section className="st-panel panel p-6">
          <div className="flex items-center justify-between">
            <p className="label">Latest CRE reports</p>
            <span className="num text-[10px] text-ash">{reports ? "live from Envio" : LIVE && !HAS_ENVIO ? "needs the indexer" : "simulated until deploy"}</span>
          </div>
          <div className="relative mt-5 pl-6">
            <span className="st-spine absolute bottom-2 left-[5px] top-2 w-px bg-gradient-to-b from-gold to-transparent" />
            {reports?.map((r, i) => (
              <div key={i} className="st-report relative pb-5 last:pb-0">
                <span className="absolute -left-[23px] top-1 h-2.5 w-2.5 rounded-full border border-gold bg-void" />
                <div className="flex items-baseline justify-between gap-4">
                  <p className="text-[13px] text-cream">{r.wf}</p>
                  <a href={`${EXPLORER}/tx/${r.tx}`} target="_blank" rel="noreferrer" className="num text-[11px] text-gold hover:text-gold-hot">
                    {r.when} UTC ↗
                  </a>
                </div>
                <p className={`num mt-1 text-[11px] ${r.tone}`}>{r.detail}</p>
                <p className="num text-[10px] text-ash">via {r.via}</p>
              </div>
            ))}
            {!reports && LIVE && <p className="text-[12px] leading-relaxed text-dust">Reports appear here as the CRE workflows write them (indexed by Envio).</p>}
            {!reports && !LIVE && REPORTS.map((r, i) => (
              <div key={i} className="st-report relative pb-5 last:pb-0">
                <span className="absolute -left-[23px] top-1 h-2.5 w-2.5 rounded-full border border-gold bg-void" />
                <div className="flex items-baseline justify-between gap-4">
                  <p className="text-[13px] text-cream">{r.wf}</p>
                  <p className="num text-[11px] text-dust" suppressHydrationWarning>
                    {hourLabel(Math.floor(i / 2))}
                    {r.at} UTC
                  </p>
                </div>
                <p className={`num mt-1 text-[11px] ${r.tone}`}>{r.detail}</p>
              </div>
            ))}
          </div>
          {LIVE && (
            <div className="mt-5 grid grid-cols-2 gap-2 text-[11px]">
              <p className="text-dust">
                simulationMode <span className={`num ${simulationMode ? "text-warn" : "text-bid"}`}>{simulationMode === undefined ? "…" : String(simulationMode)}</span>
              </p>
              <p className="text-dust">
                delivery hour <span className="num text-sand">{hourSeconds ? `${Number(hourSeconds) / 60} min` : "…"}</span>
              </p>
              <p className="col-span-2 text-dust">
                forwarder <span className="num text-sand">{forwarder ? shortAddr(forwarder) : "…"}</span>
              </p>
              {stats && (
                <p className="col-span-2 text-dust">
                  totals <span className="num text-sand">{stats.reports} reports · {stats.tickets} tickets · {Number(stats.hoursConfirmed)} h confirmed · {Number(stats.hoursMissed)} h slashed</span>
                </p>
              )}
            </div>
          )}
          <p className="mt-5 text-[11px] leading-relaxed text-ash">
            Reports carry chainSelector and a strictly increasing scheduledAt. DeliveryOracle rejects wrong-chain and stale reports, and checks both EIP-712 signatures on every verdict.
          </p>
        </section>
      </div>

      <section className="st-panel panel mt-5 overflow-hidden">
        <p className="label px-6 pt-6">Silica contracts</p>
        <div className="mt-3">
          {[...SILICA_CONTRACTS, ...SERIES_TOKENS.map((t) => ({ name: t.name, role: "Series token (1 token = 1 H100-80GB hour)", address: t.address }))].map((c) => (
            <div key={c.name} className="st-row grid gap-1 border-t border-line px-6 py-3.5 text-[12px] sm:grid-cols-[200px_1fr_auto] sm:items-center sm:gap-6">
              <span className="font-medium text-cream">{c.name}</span>
              <span className="text-dust">{c.role}</span>
              {c.address ? (
                <a href={`${EXPLORER}/address/${c.address}`} target="_blank" rel="noreferrer" className="num text-gold hover:text-gold-hot">
                  {shortAddr(c.address)} ↗
                </a>
              ) : (
                <span className="num text-[11px] text-ash">not deployed yet</span>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="st-panel panel mt-5 overflow-hidden">
        <p className="label px-6 pt-6">Kuru Spot V2 listing</p>
        <p className="mt-2 px-6 text-[11px] leading-relaxed text-ash">
          Kuru market creation is permissioned. Each series has a USD price feed in Kuru&apos;s feed interface (serving the CRE mark) and a book address predicted by
          SpotRouter.computeAddress for our listing parameters. A book goes live here, in the trading screen and in the CRE mark the moment Kuru verifies it.
        </p>
        <div className="mt-3">
          {KURU_LISTINGS.map((k, i) => (
            <KuruRow key={k.name} seriesId={i + 1} {...k} />
          ))}
        </div>
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="st-panel panel overflow-hidden">
          <p className="label px-6 pt-6">Ecosystem addresses</p>
          <div className="mt-3">
            {ECOSYSTEM.map((c) => (
              <div key={c.name} className="st-row flex items-center justify-between gap-4 border-t border-line px-6 py-3 text-[12px]">
                <span className="text-sand">{c.name}</span>
                <a href={`${EXPLORER}/address/${c.address}`} target="_blank" rel="noreferrer" className="num text-gold transition-colors hover:text-gold-hot">
                  {shortAddr(c.address)} ↗
                </a>
              </div>
            ))}
          </div>
        </section>

        <section className="st-panel panel p-6">
          <p className="label">Sample transactions</p>
          {(["happy", "slash"] as const).map((k) => {
            const run = RUNS[k];
            if (!run) return null;
            return (
              <div key={k} className="mt-4">
                <p className="text-[12px] text-cream">
                  {k === "happy" ? "Happy path" : "Outage → slash"} · ticket #{run.ticketId}
                  {k === "slash" && <span className="num text-gold-hot"> · ${run.slashPaidUsdc} paid to the buyer</span>}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {Object.entries(run.txs).map(([label, hash]) => (
                    <a key={label} href={`${EXPLORER}/tx/${hash}`} target="_blank" rel="noreferrer" className="st-row num rounded-md border border-line px-2 py-1 text-[10px] text-sand transition-colors hover:border-gold/50 hover:text-cream">
                      {label} ↗
                    </a>
                  ))}
                </div>
              </div>
            );
          })}
          <div className={`mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 ${RUNS.happy || RUNS.slash ? "hidden" : ""}`}>
            {PROOF.map((p) => (
              <div key={p} className="st-row rounded-lg border border-dashed border-line px-3 py-3">
                <p className="text-[12px] text-sand">{p}</p>
                <p className="num mt-1 text-[10px] text-ash">after demo run</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[11px] leading-relaxed text-ash">Hashes from `pnpm demo:happy` and `pnpm demo:slash` land here and in the README.</p>
        </section>
      </div>

      <section className="st-panel panel mt-5 p-6">
        <p className="label">Disclosures</p>
        <ul className="mt-4 space-y-2.5">
          {DISCLOSURES.map((d) => (
            <li key={d} className="st-row flex gap-3 text-[13px] leading-relaxed text-sand">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-gold" />
              {d}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function KuruRow({ seriesId, name, feed, market }: { seriesId: number; name: string; feed: string; market: string }) {
  const book = useKuruBook(seriesId, 1);
  return (
    <div className="st-row grid gap-1 border-t border-line px-6 py-3.5 text-[12px] sm:grid-cols-[200px_1fr_1fr_auto] sm:items-center sm:gap-6">
      <span className="font-medium text-cream">{name}</span>
      <a href={`${EXPLORER}/address/${feed}`} target="_blank" rel="noreferrer" className="num text-gold hover:text-gold-hot">
        feed {shortAddr(feed)} ↗
      </a>
      <a href={`${EXPLORER}/address/${market}`} target="_blank" rel="noreferrer" className="num text-gold hover:text-gold-hot">
        book {shortAddr(market)} ↗
      </a>
      <span className={`num text-[11px] ${book.live ? "text-bid" : "text-ash"}`}>{book.live ? "live on Kuru" : "listing requested"}</span>
    </div>
  );
}
