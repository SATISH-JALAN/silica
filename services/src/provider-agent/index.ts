/**
 * provider-agent — runs on the provider's GPU host.
 *
 * Watches its tickets, provisions access and posts it sealed to the holder's X25519 key,
 * records a heartbeat 12 times per delivery hour, and serves an EIP-712 signed HourSummary
 * per (ticket, hour) for the CRE Delivery Verifier.
 *
 * FAKE_GPU=1 (the hackathon default) simulates nvidia-smi and the delivered host, so the
 * agent runs on any VM. The README and /status say so.
 */
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { keccak256, toBytes, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { z } from "zod";
import { hourSummaryTypes, redemptionManagerAbi, sealTo, silicaDomain, type SignedSummary } from "@silica/shared";
import { parseEnv } from "@silica/shared/node";
import { loadDeployment } from "../lib/env";
import { clients, send, sleep } from "../lib/chain";
import { logger } from "../lib/log";
import { beatStore, checkInterval } from "../lib/heartbeats";

const env = parseEnv(
  z.object({
    PROVIDER_A_KEY: z.string(),
    NODE_A_KEY: z.string(),
    PROVIDER_B_KEY: z.string().optional(),
    NODE_B_KEY: z.string().optional(),
    AGENT_PORT: z.coerce.number().default(8081),
    FAKE_GPU: z.string().default("1"),
  }),
);
if (env.FAKE_GPU !== "1") throw new Error("only FAKE_GPU=1 is supported in the hackathon build");

const log = logger("provider-agent");
const d = loadDeployment();
const { publicClient, wallet } = clients(d);
const rm = d.RedemptionManager!;
const hourSeconds = Number(d.hourSeconds);

type Prov = { name: string; wallet: ReturnType<typeof wallet>; node: ReturnType<typeof privateKeyToAccount>; gpuUuid: string; down: boolean };
const providers = new Map<string, Prov>();
const add = (name: string, pk?: string, nk?: string) => {
  if (!pk || !nk) return;
  const w = wallet(pk);
  const addr = w.account.address.toLowerCase();
  // a stable simulated GPU per provider host
  const gpuUuid = `GPU-${keccak256(toBytes(addr)).slice(2, 10)}-h100-80gb`;
  providers.set(addr, { name, wallet: w, node: privateKeyToAccount(nk as Hex), gpuUuid, down: false });
};
add("NeoGPU", env.PROVIDER_A_KEY, env.NODE_A_KEY);
add("Basalt Cloud", env.PROVIDER_B_KEY, env.NODE_B_KEY);

type Tk = { id: string; provider: string; status: number; accessPostedAt: number; hrs: number; holderKey: Hex };
const tickets = new Map<string, Tk>();
const beats = beatStore("agent");
const posting = new Set<string>();

async function refreshTickets() {
  const [ids, ts] = await publicClient.readContract({ address: rm, abi: redemptionManagerAbi, functionName: "getOpenTickets", args: [0n, 500n] });
  ids.forEach((id, i) => {
    const t = ts[i];
    const prov = t.provider.toLowerCase();
    if (!providers.has(prov)) return;
    tickets.set(id.toString(), { id: id.toString(), provider: prov, status: t.status, accessPostedAt: Number(t.accessPostedAt), hrs: t.hrs, holderKey: t.holderKey });
  });
  // tickets that left the open list are settled; stop beating for them
  const open = new Set(ids.map((x) => x.toString()));
  for (const k of tickets.keys()) if (!open.has(k)) tickets.delete(k);
}

/** Provision simulated credentials and post them sealed to the holder. */
async function deliverAccess(t: Tk) {
  if (posting.has(t.id)) return;
  posting.add(t.id);
  const p = providers.get(t.provider)!;
  try {
    const creds = JSON.stringify({
      kind: "ssh",
      host: `${p.name.toLowerCase().replace(/\s+/g, "-")}-node-${t.id}.sim.silica.dev`,
      port: 2200 + (Number(t.id) % 100),
      user: `t${t.id}`,
      token: keccak256(toBytes(`${t.id}:${p.node.address}:${Date.now()}`)).slice(2, 34),
      gpu: p.gpuUuid,
      note: "Simulated host (FAKE_GPU=1). Testnet demo only.",
    });
    const ciphertext = sealTo(t.holderKey, creds);
    const r = await send(publicClient, p.wallet, { address: rm, abi: redemptionManagerAbi, functionName: "postAccess", args: [BigInt(t.id), ciphertext] });
    log.info("access posted", { ticketId: t.id, provider: p.name, tx: r.hash, status: r.status });
  } catch (e) {
    log.error("postAccess failed", { ticketId: t.id, err: String(e).slice(0, 300) });
  } finally {
    posting.delete(t.id);
  }
}

/** Simulated `nvidia-smi --query-gpu=uuid,name,utilization.gpu,memory.used --format=csv` */
function nvidiaSmi(p: Prov) {
  if (p.down) return null;
  const util = 70 + Math.floor(Math.random() * 29);
  return `uuid, name, utilization.gpu [%], memory.used [MiB]\n${p.gpuUuid}, NVIDIA H100 80GB HBM3, ${util} %, ${40000 + Math.floor(Math.random() * 30000)} MiB`;
}

function heartbeat() {
  const now = Math.floor(Date.now() / 1000);
  for (const t of tickets.values()) {
    if (t.status !== 1 || !t.accessPostedAt) continue;
    if (now >= t.accessPostedAt + t.hrs * hourSeconds) continue;
    const p = providers.get(t.provider)!;
    const out = nvidiaSmi(p);
    beats.add(t.id, { t: now, ok: out !== null && out.includes(p.gpuUuid), gpu: p.gpuUuid });
  }
}

async function signSummary(t: Tk, hour: number): Promise<SignedSummary | null> {
  const p = providers.get(t.provider)!;
  const from = t.accessPostedAt + hour * hourSeconds;
  const window = beats.window(t.id, from, from + hourSeconds);
  if (window.length === 0) return null; // the node wasn't running: no evidence to sign
  const okChecks = Math.min(12, window.filter((b) => b.ok).length);
  const gpuIdHash = keccak256(toBytes(p.gpuUuid));
  const signature = await p.node.signTypedData({
    domain: silicaDomain(d.chainId, d.DeliveryOracle as Address),
    types: hourSummaryTypes,
    primaryType: "HourSummary",
    message: { ticketId: BigInt(t.id), hour, okChecks, gpuIdHash },
  });
  return { ticketId: t.id, hour, okChecks, gpuIdHash, signer: p.node.address, signature };
}

// ───────────────────────── HTTP ─────────────────────────

const app = new Hono();
// the web app's demo controls call /demo/* from the browser
app.use("*", cors());
app.get("/health", (c) =>
  c.json({
    ok: true,
    fakeGpu: true,
    hourSeconds,
    providers: [...providers.entries()].map(([a, p]) => ({ address: a, name: p.name, node: p.node.address, down: p.down })),
    tickets: [...tickets.values()],
  }),
);

app.get("/summary/:ticketId/:hour", async (c) => {
  const id = c.req.param("ticketId");
  const hour = Number(c.req.param("hour"));
  let t = tickets.get(id);
  if (!t) {
    // settled tickets are no longer cached; read once from chain
    const raw = await publicClient.readContract({ address: rm, abi: redemptionManagerAbi, functionName: "getTicket", args: [BigInt(id)] }).catch(() => null);
    if (!raw || !providers.has(raw.provider.toLowerCase())) return c.json({ error: "unknown ticket" }, 404);
    t = { id, provider: raw.provider.toLowerCase(), status: raw.status, accessPostedAt: Number(raw.accessPostedAt), hrs: raw.hrs, holderKey: raw.holderKey };
  }
  if (Date.now() / 1000 < t.accessPostedAt + (hour + 1) * hourSeconds) return c.json({ error: "hour not elapsed" }, 425);
  const s = await signSummary(t, hour);
  return s ? c.json(s) : c.json({ error: "no heartbeats recorded for this hour" }, 404);
});

/** The simulated delivered machine the buyer probe connects to */
app.get("/host/:ticketId/nvidia-smi", (c) => {
  const t = tickets.get(c.req.param("ticketId"));
  if (!t) return c.text("connection refused", 503);
  const out = nvidiaSmi(providers.get(t.provider)!);
  return out ? c.text(out) : c.text("connection timed out", 503);
});

const pick = (q?: string) =>
  [...providers.values()].filter((p) => !q || p.name.toLowerCase().startsWith(q.toLowerCase()) || q.toLowerCase() === "all");

/** Demo only: take a provider's host down so the next hours are missed and slashed */
app.post("/demo/fail", (c) => {
  const hit = pick(c.req.query("provider") ?? "NeoGPU");
  hit.forEach((p) => (p.down = true));
  log.warn("demo outage started", { providers: hit.map((p) => p.name) });
  return c.json({ down: hit.map((p) => p.name) });
});
app.post("/demo/recover", (c) => {
  const hit = pick(c.req.query("provider") ?? "all");
  hit.forEach((p) => (p.down = false));
  log.info("demo outage ended", { providers: hit.map((p) => p.name) });
  return c.json({ up: hit.map((p) => p.name) });
});

// ───────────────────────── loops ─────────────────────────

async function main() {
  serve({ fetch: app.fetch, port: env.AGENT_PORT });
  log.info("listening", { port: env.AGENT_PORT, providers: [...providers.values()].map((p) => p.name), hourSeconds });
  setInterval(heartbeat, checkInterval(hourSeconds) * 1000);
  for (;;) {
    try {
      await refreshTickets();
      for (const t of tickets.values()) if (t.status === 0) void deliverAccess(t);
    } catch (e) {
      log.warn("refresh failed", { err: String(e).slice(0, 200) });
    }
    await sleep(4_000);
  }
}
void main();
