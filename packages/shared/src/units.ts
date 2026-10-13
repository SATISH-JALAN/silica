// Unit conventions shared with the contracts (see the architecture doc):
// series token 18 decimals (1e18 = one GPU-hour), USDC 6 decimals, prices USDC/hour 6 dp,
// ratios in basis points.

export const HOUR_UNIT = 10n ** 18n;
export const USDC_UNIT = 1_000_000n;
export const TICK = 10_000n; // $0.01
export const BPS = 10_000n;

export const DEFAULT_BOND_RATIO_BPS = 3000;
export const REPUTATION_BOND_RATIO_BPS = 2000;
export const PENALTY_BOND_RATIO_BPS = 4000;
/** a record this short can't earn or lose a tier yet */
export const PENALTY_MIN_HOURS = 10;
export const PENALTY_BELOW_RELIABILITY = 0.95;
export const DEFAULT_SLASH_MULT_BPS = 15000;
export const MIN_NOTIONAL_USDC = 10;
export const CHECKS_PER_HOUR = 12;
export const OK_THRESHOLD = 11;

export const toUsdc = (n: number) => BigInt(Math.round(n * 1e6));
export const fromUsdc = (v: bigint | number | string) => Number(BigInt(v)) / 1e6;
export const hoursToUnits = (h: number | bigint) => BigInt(h) * HOUR_UNIT;
export const unitsToHours = (v: bigint) => Number(v / HOUR_UNIT);

/** Snap a dollar price to the $0.01 tick as 6-decimal USDC */
export const priceToTick = (price: number) => (BigInt(Math.round(price * 100)) * TICK);

/** bond ≥ (minted − settled + new) × mark × ratio */
export function requiredBond(openHours: number, mark: number, ratioBps = DEFAULT_BOND_RATIO_BPS) {
  return (openHours * mark * ratioBps) / 10_000;
}

/** missed hours × priceAtOpen × slash multiple */
export function slashPayout(missedHours: number, priceAtOpen: number, slashMultBps = DEFAULT_SLASH_MULT_BPS) {
  return (missedHours * priceAtOpen * slashMultBps) / 10_000;
}

export function minOrderHours(price: number) {
  return Math.ceil(MIN_NOTIONAL_USDC / price);
}

export type Verdict = "confirmed" | "missed" | "disputed";

/** The 11-of-12 rule; mirrors DeliveryOracle._derive */
export function verdict(providerOk: number | null, probeOk: number | null): Verdict | null {
  const provUp = providerOk !== null && providerOk >= OK_THRESHOLD;
  const probeUp = probeOk !== null && probeOk >= OK_THRESHOLD;
  if (providerOk === null && probeOk === null) return null;
  if (provUp && probeUp) return "confirmed";
  if (probeOk !== null && !probeUp && !provUp) return "missed";
  return "disputed";
}

/**
 * Bond ratio from the delivery record (read from Envio by CRE Mark & Margin):
 * 20% after 1,000 confirmed hours at ≥ 99%; 40% once at least 10 delivered-or-missed hours
 * show reliability below 95%; otherwise 30%. A raised ratio can margin-call a provider.
 */
export function ratioFor(confirmed: number, missed: number) {
  const total = confirmed + missed;
  const reliability = total === 0 ? 1 : confirmed / total;
  if (confirmed >= 1000 && reliability >= 0.99) return REPUTATION_BOND_RATIO_BPS;
  if (total >= PENALTY_MIN_HOURS && reliability < PENALTY_BELOW_RELIABILITY) return PENALTY_BOND_RATIO_BPS;
  return DEFAULT_BOND_RATIO_BPS;
}
