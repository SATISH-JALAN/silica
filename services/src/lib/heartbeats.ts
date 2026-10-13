import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./env";

/** Tiny persisted heartbeat log: ticketId -> [{t, ok, gpu}] so a restart keeps history. */
export type Beat = { t: number; ok: boolean; gpu?: string };

export function beatStore(name: string) {
  const dir = join(ROOT, "services/data");
  const file = join(dir, `${name}.json`);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const data: Record<string, Beat[]> = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
  let dirty = false;
  setInterval(() => {
    if (!dirty) return;
    dirty = false;
    writeFileSync(file, JSON.stringify(data));
  }, 2_000).unref();
  return {
    add(ticketId: string, b: Beat) {
      (data[ticketId] ??= []).push(b);
      dirty = true;
    },
    /** beats inside [from, to) in unix seconds */
    window(ticketId: string, from: number, to: number) {
      return (data[ticketId] ?? []).filter((b) => b.t >= from && b.t < to);
    },
    all: () => data,
  };
}

/**
 * The rule counts 12 checks per delivery hour. We sample 14 times and cap the count at
 * 12, so timer jitter or a late first sample never costs a healthy host a check.
 */
export const checkInterval = (hourSeconds: number) => Math.max(1, Math.floor(hourSeconds / 14));
