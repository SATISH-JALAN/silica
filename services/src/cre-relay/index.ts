/**
 * cre-relay — testnet-only bridge from Chainlink CRE simulation to Monad.
 *
 * `cre workflow simulate` proves each workflow end to end but its mock forwarder does not
 * call our consumer. Until CRE deploy access is granted, this loop runs the workflows and
 * submits the same report bytes to DeliveryOracle.relayReport() with RELAYER_ROLE, which
 * only works while the oracle's simulationMode is on. Every report lands as a
 * ReportReceived event with relayed = true, shown on /status.
 *
 * RELAY_MODE=cre    run `cre workflow simulate --broadcast`: the CRE simulator writes through
 *                   Chainlink's MockKeystoneForwarder into DeliveryOracle.onReport itself,
 *                   so this loop only schedules runs (relayed = false onchain)
 * RELAY_MODE=local  build the identical report in-process from the shared workflow code and
 *                   submit it with relayReport() (anvil, or when the CRE CLI is unavailable)
 */
import { spawn } from "node:child_process";
import { join } from "node:path";
import { type Address, type Hex } from "viem";
import { z } from "zod";
import { decodeReport, deliveryOracleAbi, encodeReport, type Report } from "@silica/shared";
import { parseEnv } from "@silica/shared/node";
import { ROOT, loadDeployment } from "../lib/env";
import { clients, send, sleep } from "../lib/chain";
import { logger } from "../lib/log";
import { deliveryVerifier, markAndMarginWorkflow } from "./workflows";

const env = parseEnv(
  z.object({
    RELAYER_KEY: z.string(),
    RELAY_MODE: z.enum(["local", "cre"]).default("local"),
    AGENT_URL: z.string().default("http://127.0.0.1:8081"),
    PROBE_URL: z.string().default("http://127.0.0.1:8082"),
    ENVIO_URL: z.string().optional(),
    VERIFY_EVERY: z.coerce.number().default(60),
    MARGIN_EVERY: z.coerce.number().default(300),
    // 0: wait MARGIN_EVERY before the first Mark & Margin run instead of running it at start
    MARGIN_AT_START: z.enum(["0", "1"]).default("1"),
    CRE_TARGET: z.string().default("staging-settings"),
    PROVIDER_A_ADDRESS: z.string(),
    PROVIDER_B_ADDRESS: z.string().optional(),
  }),
);

const log = logger("cre-relay");
const d = loadDeployment();
const { publicClient, wallet } = clients(d);
const relayer = wallet(env.RELAYER_KEY);
const providers = [env.PROVIDER_A_ADDRESS, env.PROVIDER_B_ADDRESS].filter(Boolean) as Address[];

let lastAt = 0n;
const nextScheduledAt = () => {
  // reports must carry a strictly increasing scheduledAt across both workflows
  const now = BigInt(Math.floor(Date.now() / 1000));
  lastAt = now > lastAt ? now : lastAt + 1n;
  return lastAt;
};

/** Run one CRE workflow simulation; with --broadcast the simulator delivers the report onchain itself. */
function simulate(workflow: string): Promise<Hex | null> {
  return new Promise((resolve) => {
    // --broadcast: the simulator sends the write through Chainlink's MockKeystoneForwarder
    const p = spawn("cre", ["workflow", "simulate", workflow, "--target", env.CRE_TARGET, "--non-interactive", "--trigger-index", "0", "--broadcast"], {
      cwd: join(ROOT, "cre"),
      shell: process.platform === "win32",
    });
    let out = "";
    p.stdout.on("data", (b) => (out += b));
    p.stderr.on("data", (b) => (out += b));
    p.on("close", (code) => {
      const tx = out.match(/DeliveryOracle report: ([^\n]+)/);
      if (tx) log.info("CRE simulation wrote report", { workflow, result: tx[1].trim() });
      else log.warn("CRE simulation finished without a write", { workflow, code, tail: out.slice(-600) });
      resolve(null); // already onchain via the forwarder
    });
  });
}

async function relay(kind: string, report: Report | null, hex?: Hex | null) {
  const bytes = hex ?? (report ? encodeReport(report) : null);
  if (!bytes) return;
  const decoded = decodeReport(bytes);
  const counts = { verdicts: decoded.verdicts.length, marks: decoded.marks.length, ratios: decoded.ratios.length, checks: decoded.checks.length };
  if (!counts.verdicts && !counts.marks && !counts.ratios && !counts.checks) return;
  try {
    const r = await send(publicClient, relayer, { address: d.DeliveryOracle as Address, abi: deliveryOracleAbi, functionName: "relayReport", args: [bytes] });
    log.info("report relayed", { kind, ...counts, scheduledAt: decoded.scheduledAt, tx: r.hash, status: r.status });
  } catch (e) {
    log.error("relay failed", { kind, ...counts, err: String(e).slice(0, 400) });
  }
}

async function verifyOnce() {
  if (env.RELAY_MODE === "cre") return void (await simulate("delivery-verifier"));
  const { report, evidence } = await deliveryVerifier({ pc: publicClient, d, agentUrl: env.AGENT_URL, probeUrl: env.PROBE_URL, scheduledAt: nextScheduledAt() });
  if (evidence.length)
    log.info("delivery evidence", {
      hours: evidence.map((e) => `${e.ticketId}:${e.hour} prov=${e.provider?.okChecks ?? "-"} probe=${e.probe?.okChecks ?? "-"}`),
    });
  await relay("delivery-verifier", report);
}

async function marginOnce() {
  if (env.RELAY_MODE === "cre") return void (await simulate("mark-and-margin"));
  const { report, reliabilitySource } = await markAndMarginWorkflow({ pc: publicClient, d, providers, envioUrl: env.ENVIO_URL, scheduledAt: nextScheduledAt() });
  log.info("mark & margin computed", { marks: report.marks.length, ratios: report.ratios.length, checks: report.checks.length, reliabilitySource });
  await relay("mark-and-margin", report);
}

async function main() {
  const sim = await publicClient.readContract({ address: d.DeliveryOracle as Address, abi: deliveryOracleAbi, functionName: "simulationMode" });
  if (!sim && env.RELAY_MODE === "local") {
    log.error("DeliveryOracle.simulationMode is off: the relay is disabled by design (reports must come from the CRE forwarder)");
    process.exit(1);
  }
  log.info("relay up", { mode: env.RELAY_MODE, verifyEvery: env.VERIFY_EVERY, marginEvery: env.MARGIN_EVERY, providers });
  const once = process.argv.includes("--once");
  let lastMargin = env.MARGIN_AT_START === "1" ? 0 : Date.now();
  for (;;) {
    try {
      await verifyOnce();
      if (once || Date.now() - lastMargin > env.MARGIN_EVERY * 1000) {
        await marginOnce();
        lastMargin = Date.now();
      }
    } catch (e) {
      log.error("cycle failed", { err: String(e).slice(0, 300) });
    }
    if (once) return;
    await sleep(env.VERIFY_EVERY * 1000);
  }
}
void main();
