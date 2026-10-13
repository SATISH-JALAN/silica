import testnet from "../addresses.10143.json" with { type: "json" };

export type SeriesEntry = { seriesId: number; token: `0x${string}`; week: number };

export type Deployment = {
  chainId: number;
  chainSelector: string;
  deployBlock: number;
  hourSeconds: number;
  admin?: `0x${string}`;
  relayer?: `0x${string}`;
  forwarder?: `0x${string}`;
  MockUSDC?: `0x${string}`;
  SeriesRegistry?: `0x${string}`;
  BondVault?: `0x${string}`;
  RedemptionManager?: `0x${string}`;
  DeliveryOracle?: `0x${string}`;
  SilicaBook?: `0x${string}`;
  series: Record<string, SeriesEntry>;
};

/** Written by contracts/script/Deploy.s.sol. Nobody pastes an address into app code. */
export const deployment = testnet as Deployment;

export const isDeployed = (d: Deployment = deployment) => Boolean(d.DeliveryOracle && d.SilicaBook);

export function requireAddr(name: keyof Deployment, d: Deployment = deployment): `0x${string}` {
  const a = d[name];
  if (typeof a !== "string" || !a.startsWith("0x")) throw new Error(`${String(name)} is not deployed on chain ${d.chainId}`);
  return a as `0x${string}`;
}

export const seriesList = (d: Deployment = deployment) =>
  Object.values(d.series).sort((a, b) => a.seriesId - b.seriesId);

/** Monad Testnet, from the architecture doc */
export const MONAD = {
  chainId: 10143,
  rpc: "https://testnet-rpc.monad.xyz",
  rpcFallback: "https://rpc.ankr.com/monad_testnet",
  ws: "wss://testnet-rpc.monad.xyz",
  explorer: "https://testnet.monadvision.com",
  hypersync: "https://monad-testnet.hypersync.xyz",
} as const;
