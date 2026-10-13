/**
 * buyer-probe — an independent check of the delivered machine, run on the holder's behalf.
 *
 * 12 times per delivery hour it connects to the ticket's host and runs the same nvidia-smi
 * query. A check counts only if the machine answers with a GPU UUID. It signs its own
 * HourSummary with the probe key the holder registered at redemption. If it disagrees with
 * the provider's heartbeat, the hour is held as disputed, never paid.
 */
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { keccak256, toBytes, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { z } from "zod";
import { hourSummaryTypes, redemptionManagerAbi, silicaDomain, type SignedSummary } from "@silica/shared";
import { parseEnv } from "@silica/shared/node";
import { loadDeployment } from "../lib/env";
import { clients, sleep } from "../lib/chain";
import { logger } from "../lib/log";
import { beatStore, checkInterval } from "../lib/heartbeats";

const env = parseEnv(
  z.object({
    PROBE_KEY: z.string(),
    AGENT_URL: z.string().default("http://127.0.0.1:8081"),
    PROBE_PORT: z.coerce.number().default(8082),
  }),
);

const log = logger("buyer-probe");
const d = loadDeployment();
const { publicClient } = clients(d);
const probe = privateKeyToAccount(env.PROBE_KEY as Hex);
const hourSeconds = Number(d.hourSeconds);
const beats = beatStore("probe");
let brokenLink = false; // demo: the buyer's own connection fails -> disputed hours

type Tk = { id: string; accessPostedAt: number; hrs: number };
const tickets = new Map<string, Tk>();

async function refresh() {
  const [ids, ts] = await publicClient.readContract({ address: d.RedemptionManager!, abi: redemptionManagerAbi, functionName: "getOpenTickets", args: [0n, 500n] });
  const mine = new Set<string>();
  ids.forEach((id, i) => {
    const t = ts[i];
    if (t.probeKey.toLowerCase() !== probe.address.toLowerCase() || t.status !== 1) return;
    mine.add(id.toString());
    tickets.set(id.toString(), { id: id.toString(), accessPostedAt: Number(t.accessPostedAt), hrs: t.hrs });
  });
  for (const k of tickets.keys()) if (!mine.has(k)) tickets.delete(k);
}

async function check() {
  const now = Math.floor(Date.now() / 1000);
  await Promise.all(
    [...tickets.values()].map(async (t) => {
      if (now >= t.accessPostedAt + t.hrs * hourSeconds) return;
      let ok = false;
      let gpu: string | undefined;
      if (!brokenLink) {
        try {
          const r = await fetch(`${env.AGENT_URL}/host/${t.id}/nvidia-smi`, { signal: AbortSignal.timeout(4_000) });
          const body = await r.text();
          gpu = body.match(/GPU-[\w-]+/)?.[0];
          ok = r.ok && Boolean(gpu);
        } catch {
          ok = false;
        }
      }
      beats.add(t.id, { t: now, ok, gpu });
    }),
  );
}

async function sign(id: string, hour: number, accessPostedAt: number): Promise<SignedSummary> {
  const from = accessPostedAt + hour * hourSeconds;
  const window = beats.window(id, from, from + hourSeconds);
  const okChecks = Math.min(12, window.filter((b) => b.ok).length);
  const gpu = window.find((b) => b.ok && b.gpu)?.gpu;
  const gpuIdHash = gpu ? keccak256(toBytes(gpu)) : (`0x${"0".repeat(64)}` as Hex);
  const signature = await probe.signTypedData({
    domain: silicaDomain(d.chainId, d.DeliveryOracle as Address),
    types: hourSummaryTypes,
    primaryType: "HourSummary",
    message: { ticketId: BigInt(id), hour, okChecks, gpuIdHash },
  });
  return { ticketId: id, hour, okChecks, gpuIdHash, signer: probe.address, signature };
}

const app = new Hono();
// the web app's demo controls call /demo/* from the browser
app.use("*", cors());
app.get("/health", (c) => c.json({ ok: true, probe: probe.address, brokenLink, hourSeconds, tickets: [...tickets.values()] }));
app.get("/summary/:ticketId/:hour", async (c) => {
  const id = c.req.param("ticketId");
  const hour = Number(c.req.param("hour"));
  let t = tickets.get(id);
  if (!t) {
    const raw = await publicClient.readContract({ address: d.RedemptionManager!, abi: redemptionManagerAbi, functionName: "getTicket", args: [BigInt(id)] }).catch(() => null);
    if (!raw || raw.probeKey.toLowerCase() !== probe.address.toLowerCase()) return c.json({ error: "not probing this ticket" }, 404);
    t = { id, accessPostedAt: Number(raw.accessPostedAt), hrs: raw.hrs };
  }
  if (!t.accessPostedAt || Date.now() / 1000 < t.accessPostedAt + (hour + 1) * hourSeconds) return c.json({ error: "hour not elapsed" }, 425);
  // the probe always signs what it saw, including zero checks: that is the buyer's evidence of an outage
  return c.json(await sign(id, hour, t.accessPostedAt));
});
app.post("/demo/fail", (c) => {
  brokenLink = true;
  log.warn("demo: probe link broken (expect disputed hours)");
  return c.json({ brokenLink });
});
app.post("/demo/recover", (c) => {
  brokenLink = false;
  return c.json({ brokenLink });
});

async function main() {
  serve({ fetch: app.fetch, port: env.PROBE_PORT });
  log.info("listening", { port: env.PROBE_PORT, probe: probe.address, hourSeconds });
  setInterval(() => void check(), checkInterval(hourSeconds) * 1000);
  for (;;) {
    try {
      await refresh();
    } catch (e) {
      log.warn("refresh failed", { err: String(e).slice(0, 200) });
    }
    await sleep(4_000);
  }
}
void main();
