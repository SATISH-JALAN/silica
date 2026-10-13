import type { Address, PublicClient } from "viem";
import { parseAbi } from "viem";
import testnet from "../kuru.10143.json" with { type: "json" };
import type { Level } from "./orderbook";

/**
 * Kuru Spot V2 on Monad Testnet. Market creation is permissioned, so kuru.<chainId>.json
 * (scripts/gen-kuru.mjs) holds the books Kuru's SpotRouter.computeAddress predicts for our
 * listing parameters; a book is used only once SpotRouter.verifiedSpotMarket(book) is true.
 */
export type KuruConfig = {
  chainId: number;
  spotRouter: Address;
  accountCore: Address;
  usdc: Address;
  usdcFeed: Address;
  params: { sizePrecision: string; pricePrecision: number; tickSize: number; passiveSpreadTicks: number };
  series: Record<string, { week: number; token: Address; feed: Address; market: Address }>;
};

export const kuru = testnet as KuruConfig;

export const kuruRouterAbi = parseAbi([
  "function verifiedSpotMarket(address market) view returns (bool)",
  "function whitelistedSpotTokens(address token) view returns (bool)",
]);

export const kuruOrderBookAbi = parseAbi([
  "function bestBidAsk() view returns (uint32 bid, uint32 ask)",
  "function getL2Book(uint256 levels) view returns (uint32[] bidPrices, uint96[] bidSizes, uint32[] askPrices, uint96[] askSizes)",
  "function getMarketParams() view returns (uint32 pricePrecision, uint96 sizePrecision, uint32 tickSize, uint96 minQuoteNotional, uint96 maxQuoteNotional, uint256 takerFeePps, uint256 makerFeePps)",
]);

export const kuruMarketOf = (seriesId: number | bigint, k: KuruConfig = kuru) => k.series[String(seriesId)]?.market ?? null;

/** Kuru prices are USD * pricePrecision (uint32; 0 and 2^32-1 mark an empty side) */
const EMPTY = new Set([0, 2 ** 32 - 1]);
export const kuruPrice = (native: number, pricePrecision: number) => (EMPTY.has(native) ? null : native / pricePrecision);
/** Kuru sizes are base units * sizePrecision; one Silica token is one hour */
export const kuruHours = (native: bigint, sizePrecision: bigint) => Number(native) / Number(sizePrecision);
/** USDC, 6 decimals, from a Kuru price: what SeriesRegistry marks and SilicaBook ticks use */
export const kuruPriceToUsdc6 = (native: number, pricePrecision: number) => (EMPTY.has(native) ? 0n : (BigInt(native) * 1_000_000n) / BigInt(pricePrecision));

/** Which of our series have a live (verified) Kuru book */
export async function kuruLiveMarkets(pc: PublicClient, k: KuruConfig = kuru): Promise<Record<string, Address>> {
  const ids = Object.keys(k.series);
  const ok = await pc.multicall({
    contracts: ids.map((id) => ({ address: k.spotRouter, abi: kuruRouterAbi, functionName: "verifiedSpotMarket", args: [k.series[id].market] }) as const),
    allowFailure: true,
  });
  return Object.fromEntries(ids.filter((_, i) => ok[i].status === "success" && ok[i].result === true).map((id) => [id, k.series[id].market]));
}

/** Read-only Kuru book in the same shape as the SilicaBook adapter (prices in USD, sizes in hours) */
export function kuruBookReader(pc: PublicClient, k: KuruConfig = kuru) {
  const pricePrecision = k.params.pricePrecision;
  const sizePrecision = BigInt(k.params.sizePrecision);
  return {
    async bestBidAsk(market: Address) {
      const [bid, ask] = await pc.readContract({ address: market, abi: kuruOrderBookAbi, functionName: "bestBidAsk" });
      return { bid: kuruPrice(bid, pricePrecision), ask: kuruPrice(ask, pricePrecision) };
    },
    async getBook(market: Address, depth: number): Promise<{ bids: Level[]; asks: Level[] }> {
      const [bp, bs, ap, as] = await pc.readContract({ address: market, abi: kuruOrderBookAbi, functionName: "getL2Book", args: [BigInt(depth)] });
      const side = (p: readonly number[], s: readonly bigint[]) =>
        p.flatMap((px, i) => {
          const price = kuruPrice(px, pricePrecision);
          return price === null || s[i] === 0n ? [] : [{ price, hours: kuruHours(s[i], sizePrecision) }];
        });
      return { bids: side(bp, bs), asks: side(ap, as) };
    },
  };
}
