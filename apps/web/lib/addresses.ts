import { deployment } from "@silica/shared/addresses";
import { kuru } from "@silica/shared/kuru";

// Contract addresses. Silica's own contracts are written into
// packages/shared/addresses.10143.json by Deploy.s.sol; until then they are null
// and the UI shows "not deployed". Ecosystem addresses come from the
// Monad and Kuru testnet docs; Kuru's come from packages/shared/kuru.10143.json.

export const EXPLORER = "https://testnet.monadvision.com";

const d = deployment as unknown as Record<string, string | undefined>;

export const SILICA_CONTRACTS: { name: string; role: string; address: string | null }[] = [
  { name: "SeriesRegistry", role: "Creates series, stores marks", address: d.SeriesRegistry ?? null },
  { name: "BondVault", role: "Holds bonds, enforces the mint rule, margin calls", address: d.BondVault ?? null },
  { name: "RedemptionManager", role: "Burns tokens into tickets, applies verdicts, pays slashes", address: d.RedemptionManager ?? null },
  { name: "DeliveryOracle", role: "CRE ReceiverTemplate consumer; verifies EIP-712 evidence", address: d.DeliveryOracle ?? null },
  { name: "SilicaBook", role: "Price-time-priority order book (live until Kuru lists)", address: d.SilicaBook ?? null },
  { name: "MockUSDC", role: "Testnet quote and bond token, public faucet", address: d.MockUSDC ?? null },
];

export const SERIES_TOKENS = Object.values(deployment.series).map((s) => ({ name: `SIL·H100·APAC·W${s.week}`, address: s.token }));

export const ECOSYSTEM: { name: string; address: string }[] = [
  { name: "Wrapped MON", address: "0xFb8bf4c1CC7a94c73D209a149eA2AbEa852BC541" },
  { name: "Multicall3", address: "0xcA11bde05977b3631167028862bE2a173976CA11" },
  { name: "Permit2", address: "0x000000000022d473030f116ddee9f6b43ac78ba3" },
  { name: "Kuru SpotRouter", address: kuru.spotRouter },
  { name: "Kuru AccountCore", address: kuru.accountCore },
  { name: "Kuru test USDC", address: kuru.usdc },
];

/** Per series: the Kuru price feed we deployed (serves the CRE mark) and the predicted Kuru book */
export const KURU_LISTINGS = Object.values(kuru.series).map((s) => ({ name: `SIL·H100·APAC·W${s.week}`, feed: s.feed, market: s.market }));

export const NETWORK = [
  ["Chain ID", "10143"],
  ["Public RPC", "https://testnet-rpc.monad.xyz"],
  ["Backup RPCs", "rpc.ankr.com/monad_testnet · rpc-testnet.monadinfra.com"],
  ["WebSocket", "wss://testnet-rpc.monad.xyz"],
  ["Native token", "MON"],
  ["Order book", "SilicaBook live · Kuru Spot V2 books shown once Kuru lists them"],
] as const;
