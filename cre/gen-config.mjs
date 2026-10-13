// Writes each workflow's config.staging.json from packages/shared/addresses.10143.json,
// so no address is pasted by hand. Usage: node cre/gen-config.mjs [addresses file]
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const d = JSON.parse(readFileSync(resolve(process.argv[2] ?? join(here, "../packages/shared/addresses.10143.json")), "utf8"));
const env = Object.fromEntries(
  readFileSync(join(here, "../.env"), "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
// Kuru Spot V2 books for our series (packages/shared/scripts/gen-kuru.mjs), used once verified
const kuruFile = join(here, `../packages/shared/kuru.${d.chainId}.json`);
const k = existsSync(kuruFile) ? JSON.parse(readFileSync(kuruFile, "utf8")) : null;
const kuru = k && {
  spotRouter: k.spotRouter,
  pricePrecision: k.params.pricePrecision,
  markets: Object.fromEntries(Object.entries(k.series).map(([id, s]) => [id, s.market])),
};

// Monad bills the full gas limit, so size it to the report: ~200k per verdict write, plus headroom
const common = { chainName: "monad-testnet", oracle: d.DeliveryOracle };

writeFileSync(join(here, "delivery-verifier/config.staging.json"), JSON.stringify({
  ...common,
  gasLimit: "900000",
  schedule: process.env.VERIFY_SCHEDULE ?? "0 */1 * * * *",
  redemptionManager: d.RedemptionManager,
  agentUrl: process.env.AGENT_URL ?? "http://127.0.0.1:8081",
  probeUrl: process.env.PROBE_URL ?? "http://127.0.0.1:8082",
  maxVerdicts: 4,
}, null, 2) + "\n");

writeFileSync(join(here, "mark-and-margin/config.staging.json"), JSON.stringify({
  ...common,
  gasLimit: "1500000",
  schedule: process.env.MARGIN_SCHEDULE ?? "0 */5 * * * *",
  seriesRegistry: d.SeriesRegistry,
  silicaBook: d.SilicaBook,
  bondVault: d.BondVault,
  envioUrl: process.env.ENVIO_URL ?? "http://127.0.0.1:8080/v1/graphql",
  providers: [env.PROVIDER_A_ADDRESS, env.PROVIDER_B_ADDRESS].filter(Boolean),
  ...(kuru ? { kuru } : {}),
}, null, 2) + "\n");
console.log("wrote CRE configs for", d.DeliveryOracle);
