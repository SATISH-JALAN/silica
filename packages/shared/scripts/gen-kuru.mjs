// Writes kuru.<chainId>.json: Kuru Spot V2 contracts, the listing parameters, and for each
// series its token, its Kuru price feed (from DeployKuruFeeds.s.sol) and the book address
// Kuru's SpotRouter.computeAddress predicts for those parameters. A book counts as live only
// once SpotRouter.verifiedSpotMarket(book) is true (Kuru deploys it; creation is permissioned).
//   node scripts/gen-kuru.mjs [chainId]
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, http, parseAbi } from "viem";
import { monadTestnet } from "viem/chains";

const here = dirname(fileURLToPath(import.meta.url));
const chainId = process.argv[2] ?? "10143";
const d = JSON.parse(readFileSync(join(here, `../addresses.${chainId}.json`), "utf8"));
const feeds = JSON.parse(readFileSync(join(here, `../kuru-feeds.${chainId}.json`), "utf8"));

const kuru = {
  spotRouter: "0x008200AD02fCb7020B019D11Cbabd32FecE1De78",
  accountCore: "0xe08573a1Ecc4aa507c9626071fA0c4513caf7906",
  usdc: "0xb01DC575a7ef75e58A05D2bde73ab79f8e7dd0Be",
  usdcFeed: "0x29064f22175DBD7394aC7a61e3CC42Fb377175B7",
};
// Kuru's xStock books (18-decimal base vs USDC) with a $0.02 passive band for a ~$2 asset
const params = {
  sizePrecision: "10000000000",
  pricePrecision: 10000,
  tickSize: 100,
  passiveSpreadTicks: 2,
  minQuoteNotional: "10000000",
  maxQuoteNotional: "5000000000000",
  takerFeePps: "2000",
  makerFeePps: "0",
};

const routerAbi = parseAbi([
  "function computeAddress(address baseToken, address quoteToken, uint96 sizePrecision, uint32 pricePrecision, uint32 tickSize, uint32 passiveSpreadTicks, uint96 minQuoteNotional, uint96 maxQuoteNotional, uint256 takerFeePps, uint256 makerFeePps) view returns (address)",
]);
const pc = createPublicClient({ chain: monadTestnet, transport: http(process.env.RPC_URL ?? "https://testnet-rpc.monad.xyz") });

const series = {};
for (const s of Object.values(d.series)) {
  const market = await pc.readContract({
    address: kuru.spotRouter,
    abi: routerAbi,
    functionName: "computeAddress",
    args: [s.token, kuru.usdc, BigInt(params.sizePrecision), params.pricePrecision, params.tickSize, params.passiveSpreadTicks, BigInt(params.minQuoteNotional), BigInt(params.maxQuoteNotional), BigInt(params.takerFeePps), BigInt(params.makerFeePps)],
  });
  series[s.seriesId] = { week: s.week, token: s.token, feed: feeds[s.token], market };
}

const out = { chainId: Number(chainId), ...kuru, params, series };
writeFileSync(join(here, `../kuru.${chainId}.json`), JSON.stringify(out, null, 2) + "\n");
console.log(`wrote kuru.${chainId}.json for ${Object.keys(series).length} series`);
