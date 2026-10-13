// Display helpers. Contract units (6-dp USDC, 18-dp hours, bps) are converted
// at the data edge; components only ever see plain numbers.

export const usd = (n: number, dp = 2) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;

export const price = (n: number) => n.toFixed(2);

export const int = (n: number) => Math.round(n).toLocaleString("en-US");

export const compact = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M` : n >= 10_000 ? `${(n / 1000).toFixed(1)}k` : int(n);

export const pct = (n: number, dp = 1) => `${(n * 100).toFixed(dp)}%`;

export const signedPct = (n: number, dp = 2) => `${n >= 0 ? "+" : ""}${(n * 100).toFixed(dp)}%`;

export const bpsToRatio = (bps: number) => bps / 10_000;

export const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export const utcDay = (d: Date) =>
  d.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", timeZone: "UTC" });

export function countdown(ms: number) {
  if (ms <= 0) return "open";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m ${s % 60}s`;
}
