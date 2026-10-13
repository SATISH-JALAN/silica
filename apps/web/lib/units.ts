// Protocol rules mirrored from the contracts so the UI can preview outcomes
// before a transaction is sent. The contracts remain the source of truth.

export const DEFAULT_BOND_RATIO_BPS = 3000; // 30% of notional
export const REPUTATION_BOND_RATIO_BPS = 2000; // after 1,000 confirmed hours at 99%+
export const DEFAULT_SLASH_MULT_BPS = 15000; // 1.5x reference price per missed hour
export const MIN_NOTIONAL_USDC = 10; // Kuru minimum order notional
export const ACCESS_DEADLINE_MIN = 30;
export const HEARTBEATS_PER_HOUR = 12;
export const CONFIRM_THRESHOLD = 11; // of 12

/** bond ≥ (minted − settled + newHours) × mark × ratio */
export const requiredBond = (openHours: number, mark: number, ratioBps = DEFAULT_BOND_RATIO_BPS) =>
  openHours * mark * (ratioBps / 10_000);

/** missedHours × priceAtOpen × slashMult, capped at remaining bond */
export const slashPayout = (missed: number, priceAtOpen: number, remainingBond = Infinity, multBps = DEFAULT_SLASH_MULT_BPS) =>
  Math.min(missed * priceAtOpen * (multBps / 10_000), remainingBond);

/** Smallest whole-hour order that clears the 10 USDC minimum */
export const minOrderHours = (p: number) => Math.max(1, Math.ceil(MIN_NOTIONAL_USDC / Math.max(p, 0.01)));

export type Verdict = "confirmed" | "missed" | "disputed";

/** Delivery Verifier rule: both ≥ 11/12 confirm, both below miss, otherwise dispute */
export function verdict(providerOk: number, probeOk: number): Verdict {
  const p = providerOk >= CONFIRM_THRESHOLD;
  const b = probeOk >= CONFIRM_THRESHOLD;
  if (p && b) return "confirmed";
  if (!p && !b) return "missed";
  return "disputed";
}
