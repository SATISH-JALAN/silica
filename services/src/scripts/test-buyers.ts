/**
 * test-buyers — separate, clearly labelled test wallets that take the market maker's quotes,
 * so the book shows real fills without any wallet ever trading with itself.
 * Testnet-simulated liquidity; never presented as organic volume.
 */
import { erc20Abi, maxUint256, type Address } from "viem";
import { seriesList, seriesRegistryAbi, silicaBookAbi } from "@silica/shared";
import { loadDeployment } from "../lib/env";
import { clients, send, sleep } from "../lib/chain";
import { logger } from "../lib/log";

const log = logger("test-buyers");
const d = loadDeployment();
const { publicClient, wallet } = clients(d);
const book = d.SilicaBook as Address;
const buyers = [process.env.BUYER_A_KEY, process.env.BUYER_B_KEY].filter(Boolean).map((k) => wallet(k!));

async function approve(w: (typeof buyers)[number]) {
  for (const t of [d.MockUSDC as Address, ...seriesList(d).map((s) => s.token)]) {
    const a = await publicClient.readContract({ address: t, abi: erc20Abi, functionName: "allowance", args: [w.account.address, book] });
    if (a < 10n ** 30n) await send(publicClient, w, { address: t, abi: erc20Abi, functionName: "approve", args: [book, maxUint256] });
  }
}

const rand = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));

async function main() {
  for (const b of buyers) await approve(b);
  log.info("taking quotes", { buyers: buyers.map((b) => b.account.address) });
  for (;;) {
    const b = buyers[rand(0, buyers.length - 1)];
    const live = [];
    for (const s of seriesList(d)) {
      const info = await publicClient.readContract({ address: d.SeriesRegistry as Address, abi: seriesRegistryAbi, functionName: "getSeries", args: [BigInt(s.seriesId)] });
      if (Date.now() / 1000 < Number(info.deliveryEnd)) live.push(s);
    }
    const s = live[rand(0, live.length - 1)];
    const held = Number((await publicClient.readContract({ address: s.token, abi: erc20Abi, functionName: "balanceOf", args: [b.account.address] })) / 10n ** 18n);
    const sell = held >= 10 && Math.random() < 0.4;
    const hrs = rand(5, 14);
    try {
      const r = sell
        ? await send(publicClient, b, { address: book, abi: silicaBookAbi, functionName: "marketSell", args: [BigInt(s.seriesId), Math.min(hrs, held), 0n] })
        : await send(publicClient, b, { address: book, abi: silicaBookAbi, functionName: "marketBuy", args: [BigInt(s.seriesId), hrs, BigInt(hrs) * 3_000_000n] });
      log.info(sell ? "sold" : "bought", { buyer: b.account.address, series: s.seriesId, hrs, tx: r.hash });
    } catch (e) {
      log.warn("trade skipped", { series: s.seriesId, err: String(e).slice(0, 160) });
    }
    await sleep(rand(25, 70) * 1000);
  }
}
void main();
