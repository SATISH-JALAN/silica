/**
 * Kuru Spot V2 venue for the market maker. Inactive until Kuru deploys and verifies one of our
 * books (SpotRouter.verifiedSpotMarket): market creation is permissioned, see docs/kuru-listing.md.
 *
 * For each live book it deposits inventory into Kuru's AccountCore (series hours from the MM
 * wallet, plus any Kuru test USDC the wallet holds), then keeps a post-only GTC ladder around the
 * CRE mark, replaced in one batch whenever the mark moves. Post-only: it never takes liquidity.
 */
import { erc20Abi, type Address, type PublicClient } from "viem";
import { createKuruClient } from "@toxicflow-labs/ts-sdk";
import { kuru, kuruLiveMarkets, seriesRegistryAbi, type Deployment } from "@silica/shared";
import { logger } from "../lib/log";

const log = logger("mm-bot:kuru");
const ONE = 10n ** 18n;

type Wallet = { account: { address: Address } } & Record<string, unknown>;
type Ladder = { levels: number; spreadTicks: number; sizes: number[]; depositHours: number };

export function kuruVenue(o: { pc: PublicClient; w: Wallet; d: Deployment; ladder: Ladder }) {
  const me = o.w.account.address;
  const client = createKuruClient({ publicClient: o.pc as never, walletClient: o.w as never, account: (o.w as { account: never }).account, addresses: { accountCore: kuru.accountCore } });
  const pricePrecision = BigInt(kuru.params.pricePrecision);
  const tick = BigInt(kuru.params.tickSize);
  const sizePrecision = BigInt(kuru.params.sizePrecision);
  const lastMark: Record<string, bigint> = {};

  async function userId() {
    return client.account.getRootAccountId({ rootOwner: me });
  }

  /** Move wallet inventory into AccountCore (creates the Kuru account on first deposit) */
  async function deposit(token: Address, amount: bigint) {
    if (amount === 0n) return;
    const allowance = await o.pc.readContract({ address: token, abi: erc20Abi, functionName: "allowance", args: [me, kuru.accountCore] });
    if (allowance < amount) await o.pc.waitForTransactionReceipt({ hash: await client.account.approveErc20({ token, spender: kuru.accountCore, amount: 2n ** 255n }) });
    await o.pc.waitForTransactionReceipt({ hash: await client.account.depositToOwner({ rootOwner: me, token, amount }) });
    log.info("deposited to Kuru AccountCore", { token, amount: amount.toString() });
  }

  async function fund(token: Address) {
    const [hours, usdc] = await Promise.all([
      o.pc.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [me] }),
      o.pc.readContract({ address: kuru.usdc, abi: erc20Abi, functionName: "balanceOf", args: [me] }),
    ]);
    const id = await userId();
    const [inHours, inUsdc] = id === 0n ? [0n, 0n] : await Promise.all([client.account.getBalance({ accountId: id, token }), client.account.getBalance({ accountId: id, token: kuru.usdc })]);
    const wantHours = BigInt(o.ladder.depositHours) * ONE;
    if (inHours < wantHours) await deposit(token, (wantHours - inHours < hours ? wantHours - inHours : hours) / ONE * ONE);
    if (inUsdc === 0n && usdc > 0n) await deposit(kuru.usdc, usdc);
  }

  /** One pass over every live Kuru book */
  return async function cycle() {
    const live = await kuruLiveMarkets(o.pc);
    for (const [seriesId, market] of Object.entries(live)) {
      const s = kuru.series[seriesId];
      const info = await o.pc.readContract({ address: o.d.SeriesRegistry as Address, abi: seriesRegistryAbi, functionName: "getSeries", args: [BigInt(seriesId)] });
      if (Date.now() / 1000 > Number(info.deliveryEnd)) continue;
      // CRE mark (USDC, 6 dp) in Kuru price units, snapped to the book's tick
      const mark = ((info.markPrice * pricePrecision) / 1_000_000n / tick) * tick;
      if (lastMark[seriesId] === mark) continue;
      try {
        await fund(s.token);
        const id = await userId();
        if (id === 0n) continue;
        const [hours, usdc] = await Promise.all([client.account.getBalance({ accountId: id, token: s.token }), client.account.getBalance({ accountId: id, token: kuru.usdc })]);
        const orders = Array.from({ length: o.ladder.levels }, (_, i) => {
          const hrs = BigInt(o.ladder.sizes[i] ?? o.ladder.sizes.at(-1)!);
          const off = tick * BigInt(o.ladder.spreadTicks + i);
          return [
            { side: "buy" as const, price: mark - off, quantity: hrs * sizePrecision, need: usdc >= ((mark - off) * hrs * 1_000_000n) / pricePrecision },
            { side: "sell" as const, price: mark + off, quantity: hrs * sizePrecision, need: hours >= hrs * ONE },
          ];
        })
          .flat()
          .filter((q) => q.need) // out of inventory: skip, never borrow
          .map(({ side, price, quantity }) => ({ side, price, quantity, tif: "GTC" as const, executionInstruction: "POST_ONLY" as const }));
        await o.pc.waitForTransactionReceipt({ hash: await client.spot.cancelAllOrders({ market, userId: id }) }).catch(() => undefined);
        if (orders.length) await o.pc.waitForTransactionReceipt({ hash: await client.spot.batch({ market, userId: id, orders, cancelSlotIdxs: [] }) });
        lastMark[seriesId] = mark;
        log.info("Kuru ladder", { seriesId, market, mark: Number(mark) / Number(pricePrecision), orders: orders.length });
      } catch (e) {
        log.warn("Kuru quote failed", { seriesId, market, err: String(e).slice(0, 240) });
      }
    }
  };
}
