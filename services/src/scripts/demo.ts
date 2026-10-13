/**
 * Scripted end-to-end scenarios on the live deployment (services must be running):
 *
 *   pnpm demo:happy   buy W42 hours → redeem → access sealed to the buyer → every hour confirmed
 *   pnpm demo:slash   same, but the provider's host goes down mid-delivery → hours slashed to the buyer
 *
 * Transaction hashes are written to packages/shared/demo-txs.json for the README and /status.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { erc20Abi, formatUnits, maxUint256, parseAbiItem, type Address, type Hash } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  ACCESS_KEY_MESSAGE,
  keyPairFromSignature,
  openSealed,
  redemptionManagerAbi,
  silicaBookAbi,
} from "@silica/shared";
import { ROOT, loadDeployment } from "../lib/env";
import { clients, send, sleep } from "../lib/chain";
import { logger } from "../lib/log";

const scenario = (process.argv[2] ?? "happy") as "happy" | "slash";
const HOURS = Number(process.env.DEMO_HOURS ?? (scenario === "slash" ? 4 : 3));
const AGENT = process.env.AGENT_URL ?? "http://127.0.0.1:8081";

const log = logger(`demo:${scenario}`);
const d = loadDeployment();
const { publicClient, wallet } = clients(d);
const buyer = wallet(process.env.BUYER_A_KEY!);
const probe = privateKeyToAccount(process.env.PROBE_KEY as `0x${string}`).address;
const rm = d.RedemptionManager as Address;
const W42 = 1;
const txs: Record<string, Hash | string> = {};


async function logsFor(eventSig: string, ticketId: bigint, fromBlock: bigint) {
  const event = parseAbiItem(eventSig);
  const latest = await publicClient.getBlockNumber();
  const out = [];
  for (let from = fromBlock; from <= latest; from += 100n) {
    const to = from + 99n > latest ? latest : from + 99n;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    out.push(...(await publicClient.getLogs({ address: rm, event: event as any, args: { ticketId } as any, fromBlock: from, toBlock: to })));
  }
  return out;
}

async function main() {
  const book = d.SilicaBook as Address;
  const series = d.series[String(W42)];

  // 1 · buy W42 hours from the book (the market maker's resting asks)
  for (const t of [d.MockUSDC as Address, series.token]) {
    const a = await publicClient.readContract({ address: t, abi: erc20Abi, functionName: "allowance", args: [buyer.account.address, book] });
    if (a < 10n ** 30n) await send(publicClient, buyer, { address: t, abi: erc20Abi, functionName: "approve", args: [book, maxUint256] });
  }
  const buy = await send(publicClient, buyer, { address: book, abi: silicaBookAbi, functionName: "marketBuy", args: [BigInt(W42), HOURS, BigInt(HOURS) * 3_000_000n] });
  txs.trade = buy.hash;
  log.info("bought W42 hours", { hours: HOURS, tx: buy.hash });

  // 2 · derive the holder's X25519 key from a wallet signature and redeem
  const sig = await buyer.signMessage({ message: ACCESS_KEY_MESSAGE });
  const kp = keyPairFromSignature(sig);
  const redeem = await send(publicClient, buyer, { address: rm, abi: redemptionManagerAbi, functionName: "redeem", args: [BigInt(W42), HOURS, kp.publicKey, probe] });
  txs.redeem = redeem.hash;
  const receipt = await publicClient.getTransactionReceipt({ hash: redeem.hash });
  const count = await publicClient.readContract({ address: rm, abi: redemptionManagerAbi, functionName: "ticketCount" });
  const ticketId = count; // single-provider fill in the demo (FIFO hands it to one provider)
  log.info("redeemed", { ticketId, tx: redeem.hash });

  // 3 · wait for the provider agent to post access, then decrypt it locally
  for (;;) {
    const t = await publicClient.readContract({ address: rm, abi: redemptionManagerAbi, functionName: "getTicket", args: [ticketId] });
    if (t.status >= 1) break;
    await sleep(3_000);
  }
  const [posted] = await logsFor("event AccessPosted(uint256 indexed ticketId, bytes ciphertext)", ticketId, receipt.blockNumber);
  txs.access = posted.transactionHash!;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const creds = openSealed((posted as any).args.ciphertext, kp.secretKey);
  log.info("access decrypted in the holder's hands only", { creds: creds ? JSON.parse(creds) : null, tx: posted.transactionHash });

  // 4 · the slash scenario takes the host down for the middle hours
  const hourMs = Number(d.hourSeconds) * 1000;
  if (scenario === "slash") {
    await sleep(hourMs * 0.9);
    await fetch(`${AGENT}/demo/fail?provider=all`, { method: "POST" });
    log.warn("provider host down (demo outage)");
    await sleep(hourMs * 2);
    await fetch(`${AGENT}/demo/recover?provider=all`, { method: "POST" });
    log.info("provider host back up");
  }

  // 5 · wait for the CRE verdicts (cre-relay) to settle the ticket
  for (;;) {
    const t = await publicClient.readContract({ address: rm, abi: redemptionManagerAbi, functionName: "getTicket", args: [ticketId] });
    log.info("ticket", { confirmed: t.confirmed, missed: t.missed, disputed: t.disputed, of: t.hrs, status: ["open", "delivering", "settled"][t.status] });
    if (t.status === 2 || (t.confirmed + t.missed + t.disputed === t.hrs && t.disputed > 0)) break;
    await sleep(20_000);
  }

  const verdicts = await logsFor("event HourVerdict(uint256 indexed ticketId, uint32 hour, uint8 kind)", ticketId, receipt.blockNumber);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const v of verdicts as any[]) txs[`hour${v.args.hour}_${["confirm", "slash", "dispute"][v.args.kind]}`] = v.transactionHash;
  // the payout of THIS ticket, from its own HoursSlashed events (balances can move for other reasons)
  const slashes = await logsFor("event HoursSlashed(uint256 indexed ticketId, uint32 hrs, uint256 payout)", ticketId, receipt.blockNumber);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const paid = (slashes as any[]).reduce((sum, l) => sum + (l.args.payout as bigint), 0n);
  log.info("done", { scenario, ticketId, slashPaidUsdc: formatUnits(paid, 6) });

  const file = join(ROOT, "packages/shared/demo-txs.json");
  const all = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
  all[scenario] = { ticketId: ticketId.toString(), at: new Date().toISOString(), hours: HOURS, slashPaidUsdc: formatUnits(paid, 6), txs };
  writeFileSync(file, JSON.stringify(all, null, 2));
  log.info("wrote demo-txs.json");
}
void main().catch((e) => {
  log.error("demo failed", { err: String(e) });
  process.exit(1);
});
