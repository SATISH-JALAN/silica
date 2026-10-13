// Testnet demo data, shaped like the Envio HyperIndex schema (Series, Provider,
// Ticket, Candle) so `lib/envio.ts` can replace it field-for-field once the
// indexer is live. Everything is seeded, so server and client render the same.

import { DEFAULT_BOND_RATIO_BPS, DEFAULT_SLASH_MULT_BPS } from "./units";

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Monday 00:00 UTC of ISO week `week` in `year` */
export function isoWeekStart(year: number, week: number) {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dow = jan4.getUTCDay() || 7;
  const week1 = Date.UTC(year, 0, 4 - (dow - 1));
  return new Date(week1 + (week - 1) * 7 * 86_400_000);
}

export type Series = {
  id: string; // route slug
  seriesId: number; // onchain id
  code: string; // H100·APAC·W44
  symbol: string; // SIL·H100·APAC·W44
  gpu: string;
  region: string;
  week: number;
  deliveryStart: Date;
  deliveryEnd: Date;
  mark: number; // USDC per GPU-hour
  change24h: number; // fraction
  openInterestHours: number;
  volumeHours: number;
  bondRatioBps: number;
  slashMultBps: number;
  bondLocked: number; // USDC across providers
  providers: number;
};

const WEEKS = [44, 45, 46, 47];
const MARKS = [2.05, 2.12, 2.09, 2.18];
const CHANGE = [0.0124, -0.0071, 0.0032, 0.0188];
const OI = [8_640, 6_120, 4_480, 2_960];
const VOL = [3_215, 1_904, 1_122, 640];
const BOND_FACTOR = [0.41, 0.36, 0.33, 0.31]; // bond as a share of open notional

export const SERIES: Series[] = WEEKS.map((week, i) => {
  const start = isoWeekStart(2026, week);
  const mark = MARKS[i];
  const oi = OI[i];
  return {
    id: `h100-apac-w${week}`,
    seriesId: i + 1,
    code: `H100·APAC·W${week}`,
    symbol: `SIL·H100·APAC·W${week}`,
    gpu: "H100-80GB",
    region: "APAC",
    week,
    deliveryStart: start,
    deliveryEnd: new Date(start.getTime() + 7 * 86_400_000 - 60_000),
    mark,
    change24h: CHANGE[i],
    openInterestHours: oi,
    volumeHours: VOL[i],
    bondRatioBps: DEFAULT_BOND_RATIO_BPS,
    slashMultBps: DEFAULT_SLASH_MULT_BPS,
    bondLocked: Math.round(oi * mark * BOND_FACTOR[i]),
    providers: 3 - (i > 1 ? 1 : 0),
  };
});

export const getSeries = (id: string) => SERIES.find((s) => s.id === id);

/** Proposed expansion series, shown greyed on the forward curve */
export const PLANNED = [
  { code: "H100·EU", note: "after first books trade daily" },
  { code: "H100·US", note: "after first books trade daily" },
  { code: "H200·APAC", note: "roadmap phase 4" },
  { code: "B200·APAC", note: "roadmap phase 4" },
];

export type Provider = {
  id: string;
  name: string;
  address: string;
  bondLocked: number;
  hoursMinted: number;
  hoursConfirmed: number;
  hoursMissed: number;
  hoursDisputed: number;
  reliabilityBps: number;
  marginCalls: number;
  bondRatioBps: number;
};

const P = (name: string, address: string, bond: number, minted: number, confirmed: number, missed: number, disputed: number, mc: number): Provider => {
  const rel = confirmed + missed === 0 ? 10_000 : Math.round((confirmed * 10_000) / (confirmed + missed));
  return {
    id: address, name, address, bondLocked: bond, hoursMinted: minted, hoursConfirmed: confirmed,
    hoursMissed: missed, hoursDisputed: disputed, reliabilityBps: rel, marginCalls: mc,
    bondRatioBps: confirmed >= 1000 && rel >= 9900 ? 2000 : 3000,
  };
};

// Illustrative demo providers. Testnet only, nodes simulated with FAKE_GPU=1.
export const PROVIDERS: Provider[] = [
  P("NeoGPU", "0x7a3F9c2E41b8D06a5E1c7B94fA02d83C6e19B4d1", 4_920, 9_400, 1_412, 6, 2, 0),
  P("Basalt Cloud", "0x2c91E4aB07F3d58C6b1A90e2D47f8135B6c0aE72", 3_310, 6_200, 868, 14, 3, 1),
  P("Kestrel Compute", "0xD45b0e1F9A27c3E86d4B51a0C2f7E93b18A6c05e", 1_870, 3_600, 214, 9, 0, 0),
];

export type Candle = { time: number; open: number; high: number; low: number; close: number; volume: number };

/** Hourly candles ending at the series mark */
export function candlesFor(series: Series, count = 168, endSec = 1_792_000_000): Candle[] {
  const r = rng(series.seriesId * 977);
  const out: Candle[] = [];
  let p = series.mark * (1 - series.change24h * 3.2);
  const drift = (series.mark - p) / count;
  for (let i = 0; i < count; i++) {
    const open = p;
    const shock = (r() - 0.5) * 0.018;
    const close = Math.max(1.5, open + drift + shock);
    const high = Math.max(open, close) + r() * 0.008;
    const low = Math.min(open, close) - r() * 0.008;
    out.push({
      time: endSec - (count - i) * 3600,
      open: +open.toFixed(4), high: +high.toFixed(4), low: +low.toFixed(4), close: +close.toFixed(4),
      volume: Math.round(10 + r() * 90 + (i > count - 24 ? 40 : 0)),
    });
    p = close;
  }
  // shift the whole walk so it lands exactly on the mark
  const shift = series.mark - out[out.length - 1].close;
  return out.map((c) => ({
    ...c,
    open: +(c.open + shift).toFixed(4),
    high: +(c.high + shift).toFixed(4),
    low: +(c.low + shift).toFixed(4),
    close: +(c.close + shift).toFixed(4),
  }));
}

export type Level = { price: number; hours: number };

export function bookFor(mark: number, seed: number, depth = 12) {
  const r = rng(seed);
  const asks: Level[] = [];
  const bids: Level[] = [];
  for (let i = 0; i < depth; i++) {
    asks.push({ price: +(mark + 0.01 * (i + 1)).toFixed(2), hours: Math.round(5 + r() * 140 + i * 6) });
    bids.push({ price: +(mark - 0.01 * i).toFixed(2), hours: Math.round(5 + r() * 140 + i * 6) });
  }
  return { asks, bids };
}

export type Trade = { id: string; price: number; hours: number; takerBuys: boolean; at: number };

export function tradesFor(mark: number, seed: number, n = 18, now = 1_792_000_000_000): Trade[] {
  const r = rng(seed + 31);
  return Array.from({ length: n }, (_, i) => ({
    id: `t${seed}-${i}`,
    price: +(mark + (r() - 0.5) * 0.04).toFixed(2),
    hours: Math.round(5 + r() * 60),
    takerBuys: r() > 0.45,
    at: now - i * (18_000 + Math.round(r() * 40_000)),
  }));
}

export type TicketStatus = "Open" | "AccessPosted" | "Settled";

export type Ticket = {
  id: number;
  seriesCode: string;
  provider: string;
  hours: number;
  confirmed: number;
  missed: number;
  disputed: number;
  priceAtOpen: number;
  status: TicketStatus;
  openedAt: string;
  /** per-hour outcome, length = hours; null = not yet verified */
  timeline: ("confirmed" | "missed" | "disputed" | null)[];
};

function timeline(hours: number, done: number, missedAt: number[], disputedAt: number[] = []) {
  return Array.from({ length: hours }, (_, i) =>
    i >= done ? null : missedAt.includes(i) ? "missed" : disputedAt.includes(i) ? "disputed" : "confirmed",
  ) as Ticket["timeline"];
}

// The worked example from the product doc: 100 hours, 10 missed, $30.75 slashed.
const missedRun = [41, 42, 43, 44, 45, 46, 47, 48, 49, 50];

export const TICKETS: Ticket[] = [
  {
    id: 1042, seriesCode: "H100·APAC·W44", provider: "NeoGPU", hours: 100, confirmed: 90, missed: 10, disputed: 0,
    priceAtOpen: 2.05, status: "Settled", openedAt: "Mon 26 Oct, 00:14 UTC", timeline: timeline(100, 100, missedRun),
  },
  {
    id: 1057, seriesCode: "H100·APAC·W44", provider: "Basalt Cloud", hours: 48, confirmed: 29, missed: 0, disputed: 1,
    priceAtOpen: 2.07, status: "AccessPosted", openedAt: "Tue 27 Oct, 09:02 UTC", timeline: timeline(48, 30, [], [17]),
  },
];
