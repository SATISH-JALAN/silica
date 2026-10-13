/**
 * Silica · Delivery Verifier (Chainlink CRE workflow 1)
 *
 * Every delivery hour: read the open tickets from RedemptionManager, fetch the provider
 * node's and the buyer probe's EIP-712 signed hour summaries over HTTP on every DON node,
 * reach identical consensus on them, and write one report to DeliveryOracle. The contract
 * re-derives each verdict from the signatures (both >= 11/12 confirm, probe-only outage
 * miss, disagreement dispute), so a node can't push a fake outcome even with consensus.
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
import { RedemptionManager } from "./contracts/abi"
import { evmFor, read, readMany } from "./contracts/evm"
import { buildVerdicts, dueHours, type HourEvidence } from "../../packages/shared/src/verifier"
import { emptyReport, encodeReport } from "../../packages/shared/src/report"
import type { SignedSummary } from "../../packages/shared/src/eip712"

type Config = {
  schedule: string
  chainName: string
  redemptionManager: Address
  oracle: Address
  agentUrl: string
  probeUrl: string
  gasLimit: string
  maxVerdicts: number
}

type Due = { ticketId: string; hour: number }
type TicketRow = { status: number; accessPostedAt: bigint; hrs: number }

/** Runs on every node; returns JSON so identical aggregation compares byte for byte. */
const fetchEvidence = (nodeRuntime: NodeRuntime<Config>, due: Due[]): string => {
  const http = new HTTPClient()
  const get = (base: string, d: Due): SignedSummary | null => {
    const resp = http.sendRequest(nodeRuntime, { url: `${base}/summary/${d.ticketId}/${d.hour}`, method: "GET" as const }).result()
    if (resp.statusCode !== 200) return null
    try {
      const s = JSON.parse(new TextDecoder().decode(resp.body)) as SignedSummary
      return typeof s.signature === "string" && typeof s.okChecks === "number" ? s : null
    } catch {
      return null
    }
  }
  return JSON.stringify(due.map((d) => ({ ...d, provider: get(nodeRuntime.config.agentUrl, d), probe: get(nodeRuntime.config.probeUrl, d) })))
}

const onCron = (runtime: Runtime<Config>, payload: CronPayload): string => {
  const cfg = runtime.config
  const scheduledAt = BigInt(payload.scheduledExecutionTime?.seconds ?? BigInt(Math.floor(Date.now() / 1000)))
  const { client, selector } = evmFor(cfg.chainName)

  // CRE allows 15 chain reads per run and 5 KB per response: page tickets, batch the checks
  const [ids, tickets] = read<[bigint[], TicketRow[]]>(runtime, client, cfg.redemptionManager, RedemptionManager, "getOpenTickets", [0n, 8n])
  const hourSeconds = read<bigint>(runtime, client, cfg.redemptionManager, RedemptionManager, "hourSeconds")

  const candidates: Due[] = []
  ids.forEach((id, i) => {
    const t = tickets[i]
    if (t.status !== 1) return
    for (const hour of dueHours({ accessPostedAt: t.accessPostedAt, hrs: Number(t.hrs), now: scheduledAt, hourSeconds, applied: () => false }))
      if (candidates.length < 24) candidates.push({ ticketId: id.toString(), hour })
  })
  const applied = readMany(
    runtime,
    client,
    candidates.map((c) => ({ to: cfg.redemptionManager, abi: RedemptionManager, functionName: "verdictApplied", args: [BigInt(c.ticketId), c.hour] })),
  )
  const due = candidates.filter((_, i) => !applied[i]).slice(0, cfg.maxVerdicts)
  if (due.length === 0) {
    runtime.log("no delivery hours due")
    return "idle"
  }

  const raw = runtime.runInNodeMode(fetchEvidence, consensusIdenticalAggregation<string>())(due).result()
  const evidence = (JSON.parse(raw) as (Due & { provider: SignedSummary | null; probe: SignedSummary | null })[]).map(
    (e): HourEvidence => ({ ticketId: BigInt(e.ticketId), hour: e.hour, provider: e.provider, probe: e.probe }),
  )
  for (const e of evidence) {
    runtime.log(`ticket ${e.ticketId} hour ${e.hour}: provider ${e.provider?.okChecks ?? "absent"}/12, probe ${e.probe?.okChecks ?? "absent"}/12`)
  }

  const report = { ...emptyReport(selector, scheduledAt), verdicts: buildVerdicts(evidence) }
  if (report.verdicts.length === 0) return "no evidence"
  const hex = encodeReport(report)
  runtime.log(`SILICA_REPORT=${hex}`)

  const signed = runtime.report({ encodedPayload: hexToBase64(hex), encoderName: "evm", signingAlgo: "ecdsa", hashingAlgo: "keccak256" }).result()
  const w = client.writeReport(runtime, { receiver: cfg.oracle, report: signed, gasConfig: { gasLimit: cfg.gasLimit } }).result()
  const tx = bytesToHex(w.txHash || new Uint8Array(32))
  runtime.log(`DeliveryOracle report: ${report.verdicts.length} verdicts, ${w.txStatus === TxStatus.SUCCESS ? "success" : `status ${w.txStatus}`}, tx ${tx}`)
  return tx
}

const initWorkflow = (config: Config) => [handler(new CronCapability().trigger({ schedule: config.schedule }), onCron)]

export async function main() {
  const runner = await Runner.newRunner<Config>()
  await runner.run(initWorkflow)
}
