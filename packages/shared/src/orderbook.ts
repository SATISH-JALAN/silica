import type { Address, Hash, PublicClient, WalletClient } from "viem";
import { silicaBookAbi } from "./abis";
import { TICK, priceToTick } from "./units";

export type Level = { price: number; hours: number };
export type BookTrade = { seriesId: bigint; maker: Address; taker: Address; takerBuys: boolean; hours: number; price: number; txHash: Hash };

/** Order-book adapter (SilicaBook). Kuru Spot V2 books are read through ./kuru.ts once Kuru lists them. */
export interface OrderBookAdapter {
  placeLimit(p: { seriesId: bigint; side: "buy" | "sell"; hours: number; price: number }): Promise<Hash>;
  cancel(orderRef: string): Promise<Hash>;
  getBook(seriesId: bigint, depth: number): Promise<{ bids: Level[]; asks: Level[] }>;
  bestBidAsk(seriesId: bigint): Promise<{ bid: number | null; ask: number | null }>;
  onTrades(seriesId: bigint, cb: (t: BookTrade) => void): () => void;
}

const px = (v: bigint) => Number(v) / 1e6;

export function silicaBookAdapter(opts: {
  book: Address;
  publicClient: PublicClient;
  walletClient?: WalletClient;
  /** Monad charges the gas limit, so every write carries a tight explicit limit */
  gas?: { place?: bigint; cancel?: bigint };
}): OrderBookAdapter {
  const { book, publicClient, walletClient } = opts;
  const need = () => {
    if (!walletClient?.account) throw new Error("walletClient with an account is required for writes");
    return walletClient;
  };
  return {
    async placeLimit({ seriesId, side, hours, price }) {
      const w = need();
      return w.writeContract({
        address: book,
        abi: silicaBookAbi,
        functionName: "placeLimit",
        args: [seriesId, side === "buy", priceToTick(price), hours],
        account: w.account!,
        chain: w.chain,
        gas: opts.gas?.place ?? 900_000n,
      });
    },
    async cancel(orderRef) {
      const w = need();
      return w.writeContract({
        address: book,
        abi: silicaBookAbi,
        functionName: "cancel",
        args: [BigInt(orderRef)],
        account: w.account!,
        chain: w.chain,
        gas: opts.gas?.cancel ?? 250_000n,
      });
    },
    async getBook(seriesId, depth) {
      const [bp, bh, ap, ah] = await publicClient.readContract({ address: book, abi: silicaBookAbi, functionName: "depth", args: [seriesId, BigInt(depth)] });
      return {
        bids: bp.map((p, i) => ({ price: px(p), hours: Number(bh[i]) })),
        asks: ap.map((p, i) => ({ price: px(p), hours: Number(ah[i]) })),
      };
    },
    async bestBidAsk(seriesId) {
      const [bid, ask] = await publicClient.readContract({ address: book, abi: silicaBookAbi, functionName: "bestBidAsk", args: [seriesId] });
      return { bid: bid === 0n ? null : px(bid), ask: ask === 0n ? null : px(ask) };
    },
    onTrades(seriesId, cb) {
      return publicClient.watchContractEvent({
        address: book,
        abi: silicaBookAbi,
        eventName: "Trade",
        args: { seriesId },
        onLogs: (logs) =>
          logs.forEach((l) => {
            const a = l.args as { seriesId: bigint; maker: Address; taker: Address; takerBuys: boolean; hrs: number; price: bigint };
            cb({ seriesId: a.seriesId, maker: a.maker, taker: a.taker, takerBuys: a.takerBuys, hours: Number(a.hrs), price: px(a.price), txHash: l.transactionHash! });
          }),
      });
    },
  };
}

export { TICK };
