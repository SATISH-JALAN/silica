/**
 * mm-bot — testnet-simulated liquidity.
 *
 * Quotes LEVELS price levels per side around each series' CRE mark on SilicaBook (the
 * market-maker wallet) plus a provider ask ladder (NeoGPU offering its minted hours).
 * It only ever quotes: it never takes liquidity, and SilicaBook rejects self-trades.
 * Fills come from separate, labelled test-buyer wallets (scripts/test-buyers.ts).
 * VENUES=silica,kuru also quotes the same ladder on any Kuru Spot V2 book Kuru has verified
 * for our series (./kuru.ts); until then the Kuru venue is a no-op.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { erc20Abi, maxUint256, type Address } from "viem";
import { z } from "zod";
import { mockUSDCAbi, seriesList, seriesRegistryAbi, silicaBookAbi, TICK } from "@silica/shared";
import { parseEnv } from "@silica/shared/node";
import { ROOT, loadDeployment } from "../lib/env";
import { clients, send, sleep } from "../lib/chain";
import { logger } from "../lib/log";
import { kuruVenue } from "./kuru";

const env = parseEnv(
  z.object({
    MM_KEY: z.string(),
    PROVIDER_A_KEY: z.string().optional(),
    SPREAD_TICKS: z.coerce.number().default(2), // half-spread in $0.01 ticks
    LEVELS: z.coerce.number().default(3),
    REFRESH_MS: z.coerce.number().default(15_000),
    SIZES: z.string().default("12,18,26"),
    VENUES: z.string().default("silica,kuru"),
    KURU_DEPOSIT_HOURS: z.coerce.number().default(60),
  }),
);

const log = logger("mm-bot");
const d = loadDeployment();
const { publicClient, wallet } = clients(d);
const book = d.SilicaBook as Address;
const sizes = env.SIZES.split(",").map(Number);

type Quote = { isBid: boolean; price: bigint; hrs: number };
type Maker = { name: string; w: ReturnType<typeof wallet>; plan: (mark: bigint) => Quote[] };

const makers: Maker[] = [
  {
    name: "market-maker",
    w: wallet(env.MM_KEY),
    plan: (mark) =>
      Array.from({ length: env.LEVELS }, (_, i) => [
        { isBid: true, price: mark - TICK * BigInt(env.SPREAD_TICKS + i), hrs: sizes[i] ?? sizes.at(-1)! },
        { isBid: false, price: mark + TICK * BigInt(env.SPREAD_TICKS + i), hrs: sizes[i] ?? sizes.at(-1)! },
      ]).flat(),
  },
];
if (env.PROVIDER_A_KEY)
  makers.push({
    name: "provider-NeoGPU",
    w: wallet(env.PROVIDER_A_KEY),
    // the provider offers deeper size a little further out
    plan: (mark) => [4, 6].map((k, i) => ({ isBid: false, price: mark + TICK * BigInt(env.SPREAD_TICKS + k), hrs: [40, 60][i] })),
  });

// open orders per maker, persisted so a restart can cancel what it left behind
const stateFile = join(ROOT, "services/data/mm.json");
mkdirSync(dirname(stateFile), { recursive: true });
type Open = { id: string; seriesId: number; isBid: boolean; price: string; hrs: number };
const state: Record<string, Open[]> = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, "utf8")) : {};
const save = () => writeFileSync(stateFile, JSON.stringify(state, null, 1));

async function approvals(m: Maker) {
  const me = m.w.account.address;
  const tokens = [d.MockUSDC as Address, ...seriesList(d).map((s) => s.token)];
  for (const t of tokens) {
    const a = await publicClient.readContract({ address: t, abi: erc20Abi, functionName: "allowance", args: [me, book] });
    if (a > 10n ** 30n) continue;
    await send(publicClient, m.w, { address: t, abi: erc20Abi, functionName: "approve", args: [book, maxUint256] });
    log.info("approved", { maker: m.name, token: t });
  }
}

async function remaining(id: string) {
  const o = await publicClient.readContract({ address: book, abi: silicaBookAbi, functionName: "orders", args: [BigInt(id)] });
  return Number(o[4]);
}

async function place(m: Maker, seriesId: number, q: Quote) {
  const r = await send(publicClient, m.w, { address: book, abi: silicaBookAbi, functionName: "placeLimit", args: [BigInt(seriesId), q.isBid, q.price, q.hrs] });
  const receipt = await publicClient.getTransactionReceipt({ hash: r.hash });
  // OrderPlaced topic[1] = orderId; absent if the order fully crossed
  const placed = receipt.logs.find((l) => l.address.toLowerCase() === book.toLowerCase() && l.topics.length === 4);
  if (placed?.topics[1]) {
    (state[m.name] ??= []).push({ id: BigInt(placed.topics[1]).toString(), seriesId, isBid: q.isBid, price: q.price.toString(), hrs: q.hrs });
    save();
  }
}

async function cancel(m: Maker, o: Open) {
  try {
    if ((await remaining(o.id)) > 0) await send(publicClient, m.w, { address: book, abi: silicaBookAbi, functionName: "cancel", args: [BigInt(o.id)] });
  } catch (e) {
    log.warn("cancel failed", { maker: m.name, id: o.id, err: String(e).slice(0, 160) });
  }
  state[m.name] = (state[m.name] ?? []).filter((x) => x.id !== o.id);
  save();
}

async function balances(m: Maker, token: Address) {
  const me = m.w.account.address;
  const [usdc, tok] = await Promise.all([
    publicClient.readContract({ address: d.MockUSDC as Address, abi: mockUSDCAbi, functionName: "balanceOf", args: [me] }),
    publicClient.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [me] }),
  ]);
  return { usdc, hours: Number(tok / 10n ** 18n) };
}

async function cycle(m: Maker) {
  for (const s of seriesList(d)) {
    const info = await publicClient.readContract({ address: d.SeriesRegistry as Address, abi: seriesRegistryAbi, functionName: "getSeries", args: [BigInt(s.seriesId)] });
    if (Date.now() / 1000 > Number(info.deliveryEnd)) continue;
    const want = m.plan(info.markPrice);
    const mine = (state[m.name] ?? []).filter((o) => o.seriesId === s.seriesId);

    // drop orders that are filled, partly eaten, or no longer at a wanted price
    for (const o of mine) {
      const rem = await remaining(o.id);
      const keep = rem >= o.hrs / 2 && want.some((q) => q.isBid === o.isBid && q.price.toString() === o.price);
      if (!keep) await cancel(m, o);
    }
    const live = (state[m.name] ?? []).filter((o) => o.seriesId === s.seriesId);
    let { usdc, hours } = await balances(m, s.token);
    for (const q of want) {
      if (live.some((o) => o.isBid === q.isBid && o.price === q.price.toString())) continue;
      if (q.isBid ? usdc < q.price * BigInt(q.hrs) : hours < q.hrs) continue; // out of inventory: skip, never borrow
      try {
        await place(m, s.seriesId, q);
        if (q.isBid) usdc -= q.price * BigInt(q.hrs);
        else hours -= q.hrs;
      } catch (e) {
        log.warn("place failed", { maker: m.name, series: s.seriesId, price: q.price, err: String(e).slice(0, 200) });
      }
    }
  }
}

const venues = env.VENUES.split(",").map((v) => v.trim());
const kuruCycle = venues.includes("kuru")
  ? kuruVenue({ pc: publicClient as never, w: makers[0].w as never, d, ladder: { levels: env.LEVELS, spreadTicks: env.SPREAD_TICKS, sizes, depositHours: env.KURU_DEPOSIT_HOURS } })
  : null;

async function main() {
  log.info("quoting", { makers: makers.map((m) => m.name), venues, levels: env.LEVELS, spreadTicks: env.SPREAD_TICKS });
  for (const m of makers) await approvals(m);
  for (;;) {
    if (kuruCycle) await kuruCycle().catch((e) => log.warn("kuru cycle failed", { err: String(e).slice(0, 200) }));
    for (const m of venues.includes("silica") ? makers : []) {
      try {
        await cycle(m);
      } catch (e) {
        log.warn("cycle failed", { maker: m.name, err: String(e).slice(0, 200) });
      }
    }
    await sleep(env.REFRESH_MS);
  }
}
void main();
