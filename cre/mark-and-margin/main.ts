/**
 * Silica · Mark & Margin (Chainlink CRE workflow 2)
 *
 * Hourly: read each series' best bid and ask (from its Kuru Spot V2 book once Kuru has
 * verified it, otherwise from SilicaBook) and its current mark,
 * fetch every provider's delivery record from Envio's GraphQL API (identical consensus),
 * and write one report: new marks (book mid, tick-snapped), bond ratios (30%; 20% after
 * 1,000 confirmed hours at >= 99%; 40% below 95% reliability over 10+ hours) and a margin
 * check for every provider position whose requirement moved.
 * Under-bonded providers get a MarginCall onchain and cannot mint until they top up.
 */
import {
  CronCapability,
  HTTPClient,
  Runner,
  TxStatus,
  bytesToHex,
  consensusIdenticalAggregation,
  handler,
  hexToBase64,
  type CronPayload,
  type NodeRuntime,
  type Runtime,
} from "@chainlink/cre-sdk"
import type { Address } from "viem"
import { BondVault, KuruBook, KuruRouter, SeriesRegistry, SilicaBook } from "./contracts/abi"
import { evmFor, read, readMany } from "./contracts/evm"
import { markAndMargin, type ProviderRecord } from "../../packages/shared/src/verifier"
import { emptyReport, encodeReport } from "../../packages/shared/src/report"

type Config = {
  schedule: string
  chainName: string
  seriesRegistry: Address
  silicaBook: Address
  bondVault: Address
  oracle: Address
  envioUrl: string
  providers: Address[]
  gasLimit: string
  /** Kuru Spot V2 books for our series (predicted by computeAddress); used once verified */
  kuru?: { spotRouter: Address; pricePrecision: number; markets: Record<string, Address> }
}

type SeriesRow = { deliveryEnd: bigint; markPrice: bigint }
type Position = { bond: bigint; minted: bigint; marginCalled: boolean }

/** Envio GraphQL: confirmed and missed hours per provider (runs on every node) */
const fetchRecords = (nodeRuntime: NodeRuntime<Config>): string => {
  const http = new HTTPClient()
  const body = new TextEncoder().encode(JSON.stringify({ query: "{ Provider(order_by: {id: asc}) { id hoursConfirmed hoursMissed } }" }))
  const resp = http
    .sendRequest(nodeRuntime, { url: nodeRuntime.config.envioUrl, method: "POST" as const, headers: { "content-type": "application/json" }, body })
    .result()
  if (resp.statusCode !== 200) return "[]"
  const j = JSON.parse(new TextDecoder().decode(resp.body)) as { data?: { Provider?: { id: string; hoursConfirmed: string; hoursMissed: string }[] } }
  return JSON.stringify((j.data?.Provider ?? []).map((p) => ({ address: p.id, confirmed: Number(p.hoursConfirmed), missed: Number(p.hoursMissed) })))
}

const onCron = (runtime: Runtime<Config>, payload: CronPayload): string => {
  const cfg = runtime.config
  const scheduledAt = BigInt(payload.scheduledExecutionTime?.seconds ?? BigInt(Math.floor(Date.now() / 1000)))
  const { client, selector } = evmFor(cfg.chainName)

  // CRE allows 15 chain reads per run and 5 KB per response: batch through Multicall3 (4 reads)
  const count = read<bigint>(runtime, client, cfg.seriesRegistry, SeriesRegistry, "seriesCount")
  const ids = Array.from({ length: Number(count) }, (_, i) => BigInt(i + 1))
  const book = readMany(runtime, client, ids.flatMap((id) => [
    { to: cfg.seriesRegistry, abi: SeriesRegistry, functionName: "getSeries", args: [id] },
    { to: cfg.silicaBook, abi: SilicaBook, functionName: "bestBidAsk", args: [id] },
  ]))
  // Kuru first: a verified, two-sided Kuru book sets the mid; otherwise SilicaBook does
  const k = cfg.kuru
  const kq = k
    ? readMany(runtime, client, ids.flatMap((id) => {
        const market = k.markets[id.toString()]
        return market
          ? [
              { to: k.spotRouter, abi: KuruRouter, functionName: "verifiedSpotMarket", args: [market], allowFailure: true },
              { to: market, abi: KuruBook, functionName: "bestBidAsk", allowFailure: true },
            ]
          : []
      }))
    : []
  let kAt = 0
  const EMPTY = [0, 2 ** 32 - 1]
  const quotes = ids.map((id, i) => {
    const s = book[i * 2] as SeriesRow
    let [bid, ask] = book[i * 2 + 1] as [bigint, bigint]
    let source = "SilicaBook"
    if (k?.markets[id.toString()]) {
      const verified = kq[kAt] === true
      const bba = kq[kAt + 1] as [number, number] | null
      kAt += 2
      if (verified && bba && !EMPTY.includes(bba[0]) && !EMPTY.includes(bba[1])) {
        bid = (BigInt(bba[0]) * 1_000_000n) / BigInt(k.pricePrecision)
        ask = (BigInt(bba[1]) * 1_000_000n) / BigInt(k.pricePrecision)
        source = "Kuru"
      }
    }
    runtime.log(`series ${id}: bid $${Number(bid) / 1e6} ask $${Number(ask) / 1e6} (${source})`)
    return { seriesId: id, mark: s.markPrice, bid, ask }
  })

  const fromEnvio = JSON.parse(runtime.runInNodeMode(fetchRecords, consensusIdenticalAggregation<string>())().result()) as ProviderRecord[]
  const records = cfg.providers.map((p) => ({
    ...(fromEnvio.find((r) => r.address.toLowerCase() === p.toLowerCase()) ?? { confirmed: 0, missed: 0 }),
    address: p,
  }))
  for (const r of records) runtime.log(`provider ${r.address}: ${r.confirmed} confirmed, ${r.missed} missed (Envio)`)

  const pairs = cfg.providers.flatMap((provider) => ids.map((seriesId) => ({ provider, seriesId })))
  const held = readMany(runtime, client, pairs.map((p) => ({ to: cfg.bondVault, abi: BondVault, functionName: "positionOf", args: [p.provider, p.seriesId] }))) as Position[]
  const vault = readMany(runtime, client, pairs.flatMap((p) => [
    { to: cfg.bondVault, abi: BondVault, functionName: "bondRatioOf", args: [p.provider, p.seriesId] },
    { to: cfg.bondVault, abi: BondVault, functionName: "requiredBond", args: [p.provider, p.seriesId] },
  ]))
  const at = (provider: Address, seriesId: bigint) => pairs.findIndex((p) => p.provider === provider && p.seriesId === seriesId)
  const positions = pairs.filter((_, i) => held[i].minted > 0n)

  const parts = markAndMargin({ series: quotes, providers: records, positions })
  // only write bond ratios that change, and only check positions whose mark or ratio moves now
  // or whose margin-call flag disagrees with its bond (Monad bills the full gas limit)
  parts.ratios = parts.ratios.filter((r) => Number(vault[at(r.provider, r.seriesId) * 2]) !== r.bondRatioBps)
  const moved = new Set([...parts.marks.map((m) => `*:${m.seriesId}`), ...parts.ratios.map((r) => `${r.provider}:${r.seriesId}`)])
  parts.checks = parts.checks.filter((c) => {
    if (moved.has(`*:${c.seriesId}`) || moved.has(`${c.provider}:${c.seriesId}`)) return true
    const i = at(c.provider, c.seriesId)
    return held[i].bond < (vault[i * 2 + 1] as bigint) !== held[i].marginCalled
  })
  for (const m of parts.marks) runtime.log(`series ${m.seriesId}: new mark $${Number(m.price) / 1e6}`)
  if (!parts.marks.length && !parts.ratios.length && !parts.checks.length) {
    runtime.log("marks, ratios and margin flags already current")
    return "idle"
  }

  const report = { ...emptyReport(selector, scheduledAt), ...parts }
  const hex = encodeReport(report)
  runtime.log(`SILICA_REPORT=${hex}`)

  const signed = runtime.report({ encodedPayload: hexToBase64(hex), encoderName: "evm", signingAlgo: "ecdsa", hashingAlgo: "keccak256" }).result()
  const w = client.writeReport(runtime, { receiver: cfg.oracle, report: signed, gasConfig: { gasLimit: cfg.gasLimit } }).result()
  const tx = bytesToHex(w.txHash || new Uint8Array(32))
  runtime.log(
    `DeliveryOracle report: ${parts.marks.length} marks, ${parts.ratios.length} ratios, ${parts.checks.length} margin checks, ${w.txStatus === TxStatus.SUCCESS ? "success" : `status ${w.txStatus}`}, tx ${tx}`,
  )
  return tx
}

const initWorkflow = (config: Config) => [handler(new CronCapability().trigger({ schedule: config.schedule }), onCron)]

export async function main() {
  const runner = await Runner.newRunner<Config>()
  await runner.run(initWorkflow)
}
