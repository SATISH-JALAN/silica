"use client";

import { BondGauge, Row } from "@/components/ui/kit";
import { PROVIDERS, type Series } from "@/lib/mock";
import { requiredBond, slashPayout } from "@/lib/units";
import { int, pct, shortAddr, usd } from "@/lib/format";
import { useProviders } from "@/lib/envio";
import { LIVE } from "@/lib/series";

// testnet providers are simulated (FAKE_GPU nodes); names for the two seeded wallets
const NAMES: Record<string, string> = {
  [(process.env.NEXT_PUBLIC_PROVIDER_A ?? "").toLowerCase()]: "NeoGPU",
  [(process.env.NEXT_PUBLIC_PROVIDER_B ?? "").toLowerCase()]: "Basalt Cloud",
};

type Row = { id: string; name: string; reliabilityBps: number; ratioBps: number; marginCall: boolean; coverage: number };

/** Every risk number a holder needs, on the trading screen */
export function BondRiskPanel({ series, mark }: { series: Series; mark: number }) {
  const required = requiredBond(series.openInterestHours, mark, series.bondRatioBps);
  const fullSlash = slashPayout(series.openInterestHours, mark);
  const coverage = series.bondLocked / fullSlash;
  const hoursCovered = Math.floor(series.bondLocked / slashPayout(1, mark));

  // live: providers holding a position in this series, from Envio
  const envio = useProviders().data?.Provider;
  const rows: Row[] =
    LIVE && envio
      ? envio.flatMap((p) => {
          const pos = p.positions.find((x) => Number(x.series_id) === series.seriesId && Number(x.minted) > 0);
          if (!pos) return [];
          const open = Number(pos.minted) - Number(pos.settled);
          const ratio = pos.bondRatioBps || series.bondRatioBps;
          const need = requiredBond(open, mark, ratio);
          return [{ id: p.id, name: NAMES[p.id] ?? shortAddr(p.id), reliabilityBps: p.reliabilityBps, ratioBps: ratio, marginCall: pos.marginCalled, coverage: need > 0 ? Number(pos.bond) / 1e6 / need : 1 }];
        })
      : PROVIDERS.slice(0, series.providers).map((p, i) => ({
          id: p.id,
          name: p.name,
          reliabilityBps: p.reliabilityBps,
          ratioBps: p.bondRatioBps,
          marginCall: series.week === 44 && p.marginCalls > 0,
          coverage: [1, 0.94, 0.97][i] ?? 1,
        }));

  return (
    <div className="p-5">
      <p className="label">Bond &amp; risk</p>
      <div className="mt-4">
        <BondGauge coverage={coverage} label="Bond vs. every open hour missed (1.5×)" />
      </div>
      <div className="mt-4">
        <Row k="Bond locked" v={usd(series.bondLocked)} tone="text-cream" />
        <Row k="Required now (30% of notional)" v={usd(required)} />
        <Row k="Fully missed hours covered" v={`${int(hoursCovered)} of ${int(series.openInterestHours)}`} />
        <Row k="Slash per missed hour" v={usd(slashPayout(1, mark))} tone="text-gold-hot" />
      </div>

      <p className="label mt-6 !text-[9px]">Providers in this series</p>
      <div className="mt-3 space-y-3">
        {rows.length === 0 && <p className="text-[12px] text-dust">{LIVE ? "Waiting for the indexer…" : "No providers yet."}</p>}
        {rows.map((p) => (
          <div key={p.id} className="rounded-lg border border-line bg-void/40 px-3 py-2.5">
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-cream">{p.name}</span>
              {p.marginCall ? (
                <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-warn">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inset-0 animate-ping rounded-full bg-warn" />
                    <span className="relative h-1.5 w-1.5 rounded-full bg-warn" />
                  </span>
                  margin call
                </span>
              ) : (
                <span className="num text-[11px] text-dust">ratio {p.ratioBps / 100}%</span>
              )}
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px]">
              <span className="text-dust">Reliability</span>
              <span className={`num ${p.reliabilityBps >= 9900 ? "text-bid" : "text-sand"}`}>{pct(p.reliabilityBps / 10_000, 2)}</span>
            </div>
            <div className="mt-2">
              <BondGauge coverage={Math.min(1, p.coverage)} marginCall={p.marginCall} />
            </div>
          </div>
        ))}
      </div>

      <ul className="mt-6 space-y-2 text-[11px] leading-relaxed text-dust">
        <li>· Slashes are capped at the provider&apos;s remaining bond and priced at your redemption mark.</li>
        <li>· Hours where provider and probe disagree are held as disputed, neither paid nor slashed.</li>
        <li>· Tokens not redeemed by Sun 23:59 UTC of W{series.week} expire.</li>
        <li>· Margin-called providers cannot mint until they top up.</li>
      </ul>
    </div>
  );
}
