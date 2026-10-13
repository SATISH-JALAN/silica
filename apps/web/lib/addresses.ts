// Contract addresses. Silica's own contracts are written into
// packages/shared/addresses.10143.json by Deploy.s.sol; until then they are null
// and the UI shows "not deployed". Ecosystem addresses come from the
// technical architecture doc (Monad Testnet + Kuru testnet docs).

export const EXPLORER = "https://testnet.monadvision.com";

export const SILICA_CONTRACTS: { name: string; role: string; address: string | null }[] = [
  { name: "SeriesRegistry", role: "Creates series, stores marks", address: null },
  { name: "BondVault", role: "Holds bonds, enforces the mint rule, margin calls", address: null },
  { name: "RedemptionManager", role: "Burns tokens into tickets, applies verdicts, pays slashes", address: null },
  { name: "DeliveryOracle", role: "CRE ReceiverTemplate consumer; verifies EIP-712 evidence", address: null },
  { name: "SilicaBook", role: "Fallback price-time-priority order book", address: null },
  { name: "MockUSDC", role: "Quote and bond token, if Kuru USDC is unavailable", address: null },
];

export const ECOSYSTEM: { name: string; address: string }[] = [
  { name: "Wrapped MON", address: "0xFb8bf4c1CC7a94c73D209a149eA2AbEa852BC541" },
  { name: "Multicall3", address: "0xcA11bde05977b3631167028862bE2a173976CA11" },
  { name: "Permit2", address: "0x000000000022d473030f116ddee9f6b43ac78ba3" },
  { name: "Kuru test USDC", address: "0xA402B424f392EAA05DBc8779e4502A1F6A96fEF1" },
  { name: "Kuru AccountCore", address: "0xdbaaDe7B42c95399bb1E9614D51B5B9e2cf78038" },
];

export const NETWORK = [
  ["Chain ID", "10143"],
  ["Public RPC", "https://testnet-rpc.monad.xyz"],
  ["Backup RPCs", "rpc.ankr.com/monad_testnet · rpc-testnet.monadinfra.com"],
  ["WebSocket", "wss://testnet-rpc.monad.xyz"],
  ["Native token", "MON"],
  ["Order book", process.env.NEXT_PUBLIC_ORDERBOOK === "kuru" ? "Kuru Spot V2" : "SilicaBook (fallback) until Kuru lists"],
] as const;
