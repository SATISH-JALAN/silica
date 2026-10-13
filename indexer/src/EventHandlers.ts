/**
 * Silica indexer handlers. Every Silica contract event becomes a derived entity: provider
 * reliability (read by the CRE Mark & Margin workflow to set bond ratios), per-series
 * candles and forward-curve points, book levels, tickets with per-hour verdicts, margin
 * calls and CRE reports for /status.
 */
import { indexer, type EvmOnEventContext } from "envio";

const HOUR = 3600n;
const lc = (a: string) => a.toLowerCase();
const tx = (e: { transaction: { hash?: string } }) => e.transaction.hash ?? "";

/** bytes32 "H100-80GB\0\0…" -> "H100-80GB" */
function bytes32ToString(hex: string) {
  const clean = hex.replace(/^0x/, "").replace(/(00)+$/, "");
  let s = "";
  for (let i = 0; i < clean.length; i += 2) s += String.fromCharCode(parseInt(clean.slice(i, i + 2), 16));
  return s;
}

/** ISO week number of a Monday 00:00 UTC timestamp */
function isoWeek(ts: bigint) {
  const d = new Date(Number(ts) * 1000);
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

// ───────────────────────── helpers ─────────────────────────

type Ctx = EvmOnEventContext;

async function provider(context: Ctx, id: string) {
  return (
    (await context.Provider.get(id)) ?? {
      id,
      nodeKey: "",
      bondLocked: 0n,
      bondSlashed: 0n,
      hoursMinted: 0n,
      hoursConfirmed: 0n,
      hoursMissed: 0n,
      hoursDisputed: 0n,
      reliabilityBps: 10_000,
      marginCalls: 0,
      openMarginCalls: 0,
    }
  );
}

async function position(context: Ctx, prov: string, seriesId: string) {
  const id = `${prov}-${seriesId}`;
  return (
    (await context.Position.get(id)) ?? {
      id,
      provider_id: prov,
      series_id: seriesId,
      bond: 0n,
      minted: 0n,
      settled: 0n,
      bondRatioBps: 0,
      marginCalled: false,
    }
  );
}

async function stats(context: Ctx) {
  return (
    (await context.Stats.get("global")) ?? {
      id: "global",
      tickets: 0,
      hoursRedeemed: 0n,
      hoursConfirmed: 0n,
      hoursMissed: 0n,
      slashedUsdc: 0n,
      trades: 0,
      volumeUsdc: 0n,
      reports: 0,
    }
  );
}

const reliability = (confirmed: bigint, missed: bigint) => {
  const total = confirmed + missed;
  return total === 0n ? 10_000 : Number((confirmed * 10_000n) / total);
};

async function levelDelta(context: Ctx, seriesId: string, isBid: boolean, price: bigint, delta: bigint) {
  const id = `${seriesId}-${isBid ? "bid" : "ask"}-${price}`;
  const lvl = (await context.Level.get(id)) ?? { id, series_id: seriesId, isBid, price, hours: 0n };
  const hours = lvl.hours + delta;
  if (hours <= 0n) context.Level.deleteUnsafe(id);
  else context.Level.set({ ...lvl, hours });
}

// ───────────────────────── SeriesRegistry ─────────────────────────

indexer.onEvent({ contract: "SeriesRegistry", event: "SeriesCreated" }, async ({ event, context }) => {
  const id = event.params.seriesId.toString();
  const week = isoWeek(event.params.deliveryStart);
  context.Series.set({
    id,
    token: lc(event.params.token),
    gpu: bytes32ToString(event.params.gpu),
    region: bytes32ToString(event.params.region),
    week,
    deliveryStart: event.params.deliveryStart,
    deliveryEnd: event.params.deliveryEnd,
    mark: 0n,
    markUpdatedAt: 0n,
    mintedHours: 0n,
    redeemedHours: 0n,
    openInterestHours: 0n,
    volumeHours: 0n,
    volumeUsdc: 0n,
    tradeCount: 0,
    lastPrice: 0n,
    bondLocked: 0n,
  });
});

indexer.onEvent({ contract: "SeriesRegistry", event: "MarkUpdated" }, async ({ event, context }) => {
  const id = event.params.seriesId.toString();
  const s = await context.Series.getOrThrow(id);
  context.Series.set({ ...s, mark: event.params.price, markUpdatedAt: BigInt(event.block.timestamp) });
  context.ForwardPoint.set({ id, series_id: id, week: s.week, deliveryStart: s.deliveryStart, mark: event.params.price, updatedAt: BigInt(event.block.timestamp) });
});

// ───────────────────────── BondVault ─────────────────────────

indexer.onEvent({ contract: "BondVault", event: "BondDeposited" }, async ({ event, context }) => {
  const prov = lc(event.params.provider);
  const sid = event.params.seriesId.toString();
  const p = await provider(context, prov);
  const pos = await position(context, prov, sid);
  const s = await context.Series.getOrThrow(sid);
  context.Provider.set({ ...p, bondLocked: p.bondLocked + event.params.amount });
  context.Position.set({ ...pos, bond: pos.bond + event.params.amount });
  context.Series.set({ ...s, bondLocked: s.bondLocked + event.params.amount });
});

indexer.onEvent({ contract: "BondVault", event: "Minted" }, async ({ event, context }) => {
  const prov = lc(event.params.provider);
  const sid = event.params.seriesId.toString();
  const hrs = BigInt(event.params.hrs);
  const p = await provider(context, prov);
  const pos = await position(context, prov, sid);
  const s = await context.Series.getOrThrow(sid);
  context.Provider.set({ ...p, hoursMinted: p.hoursMinted + hrs });
  context.Position.set({ ...pos, minted: pos.minted + hrs });
  context.Series.set({ ...s, mintedHours: s.mintedHours + hrs, openInterestHours: s.openInterestHours + hrs });
});

indexer.onEvent({ contract: "BondVault", event: "MarginCall" }, async ({ event, context }) => {
  const prov = lc(event.params.provider);
  const sid = event.params.seriesId.toString();
  const p = await provider(context, prov);
  const pos = await position(context, prov, sid);
  const wasCalled = pos.marginCalled;
  context.Position.set({ ...pos, marginCalled: true });
  context.Provider.set({ ...p, marginCalls: p.marginCalls + (wasCalled ? 0 : 1), openMarginCalls: p.openMarginCalls + (wasCalled ? 0 : 1) });
  if (!wasCalled)
    context.MarginCallEvent.set({
      id: `${prov}-${sid}-${event.block.number}-${event.logIndex}`,
      provider_id: prov,
      series_id: sid,
      shortfall: event.params.shortfall,
      at: BigInt(event.block.timestamp),
      resolved: false,
      resolvedAt: 0n,
      txHash: tx(event),
    });
});

indexer.onEvent({ contract: "BondVault", event: "MarginCleared" }, async ({ event, context }) => {
  const prov = lc(event.params.provider);
  const sid = event.params.seriesId.toString();
  const p = await provider(context, prov);
  const pos = await position(context, prov, sid);
  context.Position.set({ ...pos, marginCalled: false });
  context.Provider.set({ ...p, openMarginCalls: Math.max(0, p.openMarginCalls - 1) });
  const open = await context.MarginCallEvent.getWhere({ provider_id: { _eq: prov } });
  for (const m of open) if (!m.resolved && m.series_id === sid) context.MarginCallEvent.set({ ...m, resolved: true, resolvedAt: BigInt(event.block.timestamp) });
});

indexer.onEvent({ contract: "BondVault", event: "BondReleased" }, async ({ event, context }) => {
  const prov = lc(event.params.provider);
  const sid = event.params.seriesId.toString();
  const p = await provider(context, prov);
  const pos = await position(context, prov, sid);
  const s = await context.Series.getOrThrow(sid);
  context.Provider.set({ ...p, bondLocked: p.bondLocked - event.params.amount });
  context.Position.set({ ...pos, bond: pos.bond - event.params.amount });
  context.Series.set({ ...s, bondLocked: s.bondLocked - event.params.amount });
});

indexer.onEvent({ contract: "BondVault", event: "BondSlashed" }, async ({ event, context }) => {
  const prov = lc(event.params.provider);
  const sid = event.params.seriesId.toString();
  const p = await provider(context, prov);
  const pos = await position(context, prov, sid);
  const s = await context.Series.getOrThrow(sid);
  const g = await stats(context);
  context.Provider.set({ ...p, bondLocked: p.bondLocked - event.params.amount, bondSlashed: p.bondSlashed + event.params.amount });
  context.Position.set({ ...pos, bond: pos.bond - event.params.amount });
  context.Series.set({ ...s, bondLocked: s.bondLocked - event.params.amount });
  context.Stats.set({ ...g, slashedUsdc: g.slashedUsdc + event.params.amount });
});

indexer.onEvent({ contract: "BondVault", event: "BondRatioSet" }, async ({ event, context }) => {
  const pos = await position(context, lc(event.params.provider), event.params.seriesId.toString());
  context.Position.set({ ...pos, bondRatioBps: Number(event.params.bondRatioBps) });
});

indexer.onEvent({ contract: "BondVault", event: "HoursSettled" }, async ({ event, context }) => {
  const pos = await position(context, lc(event.params.provider), event.params.seriesId.toString());
  context.Position.set({ ...pos, settled: pos.settled + BigInt(event.params.hrs) });
});

// ───────────────────────── RedemptionManager ─────────────────────────

indexer.onEvent({ contract: "RedemptionManager", event: "NodeKeySet" }, async ({ event, context }) => {
  const p = await provider(context, lc(event.params.provider));
  context.Provider.set({ ...p, nodeKey: lc(event.params.nodeKey) });
});

indexer.onEvent({ contract: "RedemptionManager", event: "Redeemed" }, async ({ event, context }) => {
  const id = event.params.ticketId.toString();
  const sid = event.params.seriesId.toString();
  const prov = lc(event.params.provider);
  const hrs = BigInt(event.params.hrs);
  const s = await context.Series.getOrThrow(sid);
  const p = await provider(context, prov);
  const g = await stats(context);
  context.Provider.set(p);
  context.Series.set({ ...s, redeemedHours: s.redeemedHours + hrs, openInterestHours: s.openInterestHours - hrs });
  context.Stats.set({ ...g, tickets: g.tickets + 1, hoursRedeemed: g.hoursRedeemed + hrs });
  context.Ticket.set({
    id,
    series_id: sid,
    provider_id: prov,
    holder: lc(event.params.holder),
    hours: Number(event.params.hrs),
    confirmed: 0,
    missed: 0,
    disputed: 0,
    priceAtOpen: event.params.priceAtOpen,
    slashPaid: 0n,
    status: "Open",
    openedAt: BigInt(event.block.timestamp),
    accessDeadline: 0n,
    accessPostedAt: 0n,
    holderKey: "",
    probeKey: "",
    nodeKey: "",
    ciphertext: "",
    redeemTx: tx(event),
    accessTx: "",
  });
});

indexer.onEvent({ contract: "RedemptionManager", event: "TicketKeys" }, async ({ event, context }) => {
  const t = await context.Ticket.getOrThrow(event.params.ticketId.toString());
  context.Ticket.set({ ...t, holderKey: event.params.holderKey, probeKey: lc(event.params.probeKey), nodeKey: lc(event.params.nodeKey), accessDeadline: event.params.accessDeadline });
});

indexer.onEvent({ contract: "RedemptionManager", event: "AccessPosted" }, async ({ event, context }) => {
  const t = await context.Ticket.getOrThrow(event.params.ticketId.toString());
  context.Ticket.set({ ...t, status: "AccessPosted", ciphertext: event.params.ciphertext, accessPostedAt: BigInt(event.block.timestamp), accessTx: tx(event) });
});

indexer.onEvent({ contract: "RedemptionManager", event: "HoursConfirmed" }, async ({ event, context }) => {
  const t = await context.Ticket.getOrThrow(event.params.ticketId.toString());
  const p = await provider(context, t.provider_id);
  const g = await stats(context);
  const hrs = BigInt(event.params.hrs);
  const confirmed = p.hoursConfirmed + hrs;
  context.Ticket.set({ ...t, confirmed: t.confirmed + Number(event.params.hrs) });
  context.Provider.set({ ...p, hoursConfirmed: confirmed, reliabilityBps: reliability(confirmed, p.hoursMissed) });
  context.Stats.set({ ...g, hoursConfirmed: g.hoursConfirmed + hrs });
});

indexer.onEvent({ contract: "RedemptionManager", event: "HoursSlashed" }, async ({ event, context }) => {
  const t = await context.Ticket.getOrThrow(event.params.ticketId.toString());
  const p = await provider(context, t.provider_id);
  const g = await stats(context);
  const hrs = BigInt(event.params.hrs);
  const missed = p.hoursMissed + hrs;
  context.Ticket.set({ ...t, missed: t.missed + Number(event.params.hrs), slashPaid: t.slashPaid + event.params.payout });
  context.Provider.set({ ...p, hoursMissed: missed, reliabilityBps: reliability(p.hoursConfirmed, missed) });
  context.Stats.set({ ...g, hoursMissed: g.hoursMissed + hrs });
});

indexer.onEvent({ contract: "RedemptionManager", event: "HoursDisputed" }, async ({ event, context }) => {
  const t = await context.Ticket.getOrThrow(event.params.ticketId.toString());
  const p = await provider(context, t.provider_id);
  context.Ticket.set({ ...t, disputed: t.disputed + Number(event.params.hrs) });
  context.Provider.set({ ...p, hoursDisputed: p.hoursDisputed + BigInt(event.params.hrs) });
});

indexer.onEvent({ contract: "RedemptionManager", event: "HourVerdict" }, async ({ event, context }) => {
  const id = event.params.ticketId.toString();
  context.HourVerdict.set({
    id: `${id}-${event.params.hour}`,
    ticket_id: id,
    hour: Number(event.params.hour),
    kind: ["confirmed", "missed", "disputed"][Number(event.params.kind)] ?? "unknown",
    at: BigInt(event.block.timestamp),
    txHash: tx(event),
  });
});

indexer.onEvent({ contract: "RedemptionManager", event: "TicketSettled" }, async ({ event, context }) => {
  const t = await context.Ticket.getOrThrow(event.params.ticketId.toString());
  context.Ticket.set({ ...t, status: "Settled" });
});

// ───────────────────────── DeliveryOracle ─────────────────────────

indexer.onEvent({ contract: "DeliveryOracle", event: "ReportReceived" }, async ({ event, context }) => {
  const g = await stats(context);
  context.Stats.set({ ...g, reports: g.reports + 1 });
  context.CreReport.set({
    id: `${event.block.number}-${event.logIndex}`,
    scheduledAt: event.params.scheduledAt,
    verdicts: Number(event.params.verdicts),
    applied: Number(event.params.applied),
    marks: Number(event.params.marks),
    ratios: Number(event.params.ratios),
    checks: Number(event.params.checks),
    relayed: event.params.relayed,
    at: BigInt(event.block.timestamp),
    txHash: tx(event),
  });
});

// ───────────────────────── SilicaBook ─────────────────────────

indexer.onEvent({ contract: "SilicaBook", event: "OrderPlaced" }, async ({ event, context }) => {
  const sid = event.params.seriesId.toString();
  context.Order.set({
    id: event.params.orderId.toString(),
    series_id: sid,
    owner: lc(event.params.owner),
    isBid: event.params.isBid,
    price: event.params.price,
    hours: Number(event.params.hrs),
    remaining: Number(event.params.hrs),
    status: "open",
    createdAt: BigInt(event.block.timestamp),
  });
  await levelDelta(context, sid, event.params.isBid, event.params.price, BigInt(event.params.hrs));
});

indexer.onEvent({ contract: "SilicaBook", event: "OrderCancelled" }, async ({ event, context }) => {
  const o = await context.Order.get(event.params.orderId.toString());
  if (!o) return;
  context.Order.set({ ...o, remaining: 0, status: "cancelled" });
  await levelDelta(context, o.series_id, o.isBid, o.price, -BigInt(event.params.remaining));
});

indexer.onEvent({ contract: "SilicaBook", event: "Trade" }, async ({ event, context }) => {
  const sid = event.params.seriesId.toString();
  const hrs = BigInt(event.params.hrs);
  const px = event.params.price;
  const at = BigInt(event.block.timestamp);
  const s = await context.Series.getOrThrow(sid);
  const g = await stats(context);

  context.Trade.set({
    id: `${event.block.number}-${event.logIndex}`,
    series_id: sid,
    makerOrderId: event.params.makerOrderId,
    maker: lc(event.params.maker),
    taker: lc(event.params.taker),
    takerBuys: event.params.takerBuys,
    hours: Number(event.params.hrs),
    price: px,
    at,
    txHash: tx(event),
  });
  context.Series.set({ ...s, volumeHours: s.volumeHours + hrs, volumeUsdc: s.volumeUsdc + hrs * px, tradeCount: s.tradeCount + 1, lastPrice: px });
  context.Stats.set({ ...g, trades: g.trades + 1, volumeUsdc: g.volumeUsdc + hrs * px });

  // maker order and its price level shrink by the fill
  const o = await context.Order.get(event.params.makerOrderId.toString());
  if (o) {
    const remaining = o.remaining - Number(event.params.hrs);
    context.Order.set({ ...o, remaining, status: remaining <= 0 ? "filled" : "open" });
    await levelDelta(context, sid, o.isBid, o.price, -hrs);
  }

  // 1-hour candles
  const bucket = (at / HOUR) * HOUR;
  const cid = `${sid}-${bucket}`;
  const c = await context.Candle.get(cid);
  context.Candle.set(
    c
      ? { ...c, high: px > c.high ? px : c.high, low: px < c.low ? px : c.low, close: px, volumeHours: c.volumeHours + hrs }
      : { id: cid, series_id: sid, bucketStart: bucket, open: px, high: px, low: px, close: px, volumeHours: hrs },
  );
});
