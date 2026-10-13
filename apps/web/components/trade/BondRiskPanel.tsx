"use client";

import { BondGauge, Row } from "@/components/ui/kit";
import { PROVIDERS, type Series } from "@/lib/mock";
import { requiredBond, slashPayout } from "@/lib/units";
import { int, pct, usd } from "@/lib/format";

/** Every risk number a holder needs, on the trading screen */
export function BondRiskPanel({ series, mark }: { series: Series; mark: number }) {
  const required = requiredBond(series.openInterestHours, mark, series.bondRatioBps);
  const fullSlash = slashPayout(series.openInterestHours, mark);
  const coverage = series.bondLocked / fullSlash;
  const hoursCovered = Math.floor(series.bondLocked / slashPayout(1, mark));

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
        {PROVIDERS.slice(0, series.providers).map((p, i) => {
          const marginCall = series.week === 44 && p.marginCalls > 0;
          return (
            <div key={p.id} className="rounded-lg border border-line bg-void/40 px-3 py-2.5">
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-cream">{p.name}</span>
                {marginCall ? (
                  <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-warn">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inset-0 animate-ping rounded-full bg-warn" />
                      <span className="relative h-1.5 w-1.5 rounded-full bg-warn" />
                    </span>
                    margin call
                  </span>
                ) : (
                  <span className="num text-[11px] text-dust">ratio {p.bondRatioBps / 100}%</span>
                )}
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px]">
                <span className="text-dust">Reliability</span>
                <span className={`num ${p.reliabilityBps >= 9900 ? "text-bid" : "text-sand"}`}>{pct(p.reliabilityBps / 10_000, 2)}</span>
              </div>
              <div className="mt-2">
                <BondGauge coverage={marginCall ? 0.86 : [1, 0.94, 0.97][i] ?? 1} marginCall={marginCall} />
              </div>
            </div>
          );
        })}
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
