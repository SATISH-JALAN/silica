// Static series metadata. With a deployment in packages/shared/addresses.10143.json the
// list comes from the deploy script (series ids, tokens, weeks); live numbers (marks, open
// interest, bonds) are layered on by lib/onchain.ts and lib/envio.ts. Without a deployment
// the seeded demo data in lib/mock.ts is used and the UI says so.

import { deployment, isDeployed, seriesList } from "@silica/shared/addresses";
import { SERIES as MOCK, isoWeekStart, type Series } from "./mock";

export const LIVE = isDeployed(deployment);
export const DEPLOYMENT = deployment;

const mockByWeek = new Map(MOCK.map((s) => [s.week, s]));

export const SERIES_LIST: Series[] = LIVE
  ? seriesList(deployment).map((e) => {
      const start = isoWeekStart(2026, e.week);
      const seed = mockByWeek.get(e.week);
      return {
        id: `h100-apac-w${e.week}`,
        seriesId: e.seriesId,
        code: `H100·APAC·W${e.week}`,
        symbol: `SIL·H100·APAC·W${e.week}`,
        gpu: "H100-80GB",
        region: "APAC",
        week: e.week,
        deliveryStart: start,
        deliveryEnd: new Date(start.getTime() + 7 * 86_400_000 - 1000),
        // first-paint placeholders until the chain reads land
        mark: seed?.mark ?? 2,
        change24h: 0,
        openInterestHours: 0,
        volumeHours: 0,
        bondRatioBps: 3000,
        slashMultBps: 15000,
        bondLocked: 0,
        providers: 2,
        token: e.token,
      } as Series & { token: `0x${string}` };
    })
  : MOCK;

export const getSeriesBySlug = (slug: string) => SERIES_LIST.find((s) => s.id === slug);
export const tokenOf = (s: Series) => (s as Series & { token?: `0x${string}` }).token;

/** The week whose delivery window is open now (redeemable), if any */
export function liveWeek(now = Date.now()) {
  return SERIES_LIST.find((s) => now >= s.deliveryStart.getTime() && now <= s.deliveryEnd.getTime());
}
