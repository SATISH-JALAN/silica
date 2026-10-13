import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Deployment } from "@silica/shared";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
// root .env holds every testnet key (gitignored); hosts inject the same names as secrets
config({ path: join(root, ".env"), quiet: true });

/** ADDRESSES_FILE lets local runs point at an anvil deployment (addresses.31337.json). */
export function loadDeployment(): Deployment {
  const file = process.env.ADDRESSES_FILE ?? join(root, "packages/shared/addresses.10143.json");
  const d = JSON.parse(readFileSync(resolve(root, file), "utf8")) as Deployment;
  if (!d.DeliveryOracle) throw new Error(`no deployment in ${file}; run the deploy script first`);
  return d;
}

export const ROOT = root;
