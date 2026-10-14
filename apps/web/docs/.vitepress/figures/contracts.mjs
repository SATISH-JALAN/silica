// Smart contracts: the contract map, the book's price levels, the vault's flow and the oracle's pipeline.
import { svg, node, zone, edge, txt, card, cardHeight, decision, badge } from "./kit.mjs";

export function contractsMap() {
  const W = 944, cw = 280, X = [16, 332, 648];
  const r1 = 16, r2 = 176, r3 = 356;
  let b = "";
  b += card(X[0], r1, cw, "SilicaMarkFeed × 5", [["fetchPrice · priceUsd18", "view"], ["observedAt · maxPriceAge", "view"]], "monad");
  b += card(X[1], r1, cw, "DeliveryOracle", [["onReport", "forwarder"], ["relayReport", "RELAYER · simulation"], ["deriveKind · hourDigest", "view"]], "monad");
  b += card(X[2], r1, cw, "SilicaBook", [["placeLimit · marketBuy", "anyone"], ["marketSell · cancel", "anyone"], ["bestBidAsk · depth", "view"]], "monad");
  b += card(X[0], r2, cw, "SeriesRegistry", [["createSeries", "ADMIN"], ["setMark", "ORACLE"], ["getSeries", "view"]], "monad");
  b += card(X[1], r2, cw, "RedemptionManager", [["redeem · postAccess", "anyone"], ["slashUnserved · setNodeKey", "anyone"], ["applyHour", "ORACLE"], ["resolveDispute", "ARBITER"]], "monad");
  b += card(X[2], r2, cw, "BondVault", [["depositBond · mint", "PROVIDER"], ["withdrawExcess · releaseBond", "PROVIDER"], ["checkMargin · setBondRatio", "ORACLE"], ["assign · settle · slash", "REDEMPTION"]], "monad");
  b += card(X[1], r3, cw, "SilicaToken × 5", [["mint", "MINTER · BondVault"], ["burn", "BURNER · Redemption"]], "accent");
  const oB = r1 + cardHeight(3), fB = r1 + cardHeight(2);
  const rB = r2 + cardHeight(3), mB = r2 + cardHeight(4);
  const tY = r3 + cardHeight(2) / 2;
  b += edge([[472, oB], [472, r2]], { label: "applyHour", at: [480, 168], anchor: "start" });
  b += edge([[412, oB], [412, 146], [210, 146], [210, r2]], { label: "setMark", at: [311, 140] });
  b += edge([[532, oB], [532, 146], [740, 146], [740, r2]], { label: "setBondRatio · checkMargin", at: [636, 140] });
  b += edge([[100, fB], [100, r2]], { label: "reads the mark", at: [108, 130], anchor: "start", dashed: true });
  b += edge([[161, rB], [161, tY], [X[1], tY]], { label: "deploys", at: [240, tY - 8] });
  b += edge([[472, mB], [472, r3]], { label: "burns", at: [480, 336], anchor: "start" });
  b += edge([[788, mB], [788, tY], [X[1] + cw, tY]], { label: "mints", at: [700, tY - 8] });
  b += edge([[X[1] + cw, r2 + 70], [X[2], r2 + 70]], { tone: "bad" });
  return svg({ title: "The seven contracts, what each exposes, who may call it, and how they call each other", width: W, height: r3 + cardHeight(2) + 16, body: b, minWidth: 760 });
}

export function bookLevels() {
  const W = 780, px = 230, pw = 110, cx0 = 372, chipW = 74, chipG = 26, rh = 34;
  const asks = [["$2.08", ["#40"]], ["$2.05", ["#13"]], ["$2.04", ["#12", "#31"]]];
  const bids = [["$2.02", ["#11"]], ["$2.00", ["#9", "#22"]], ["$1.99", ["#10"]]];
  let b = "";
  b += txt(16, 28, "ASKS", { kind: "label" });
  b += txt(cx0, 28, "orders at each price, first in → first filled", { kind: "axis" });
  const row = (y, [price, ids], tone) => {
    let s = node(px, y, pw, rh, price, undefined, tone, { mono: true, r: 8 });
    ids.forEach((id, i) => {
      const x = cx0 + i * (chipW + chipG);
      if (i === 0) s += edge([[px + pw, y + rh / 2], [x, y + rh / 2]], { noHead: true, dashed: true });
      else s += edge([[x - chipG, y + rh / 2], [x, y + rh / 2]]);
      s += node(x, y, chipW, rh, id, undefined, "muted", { mono: true, r: 8 });
    });
    return s;
  };
  asks.forEach((a, i) => (b += row(44 + i * 44, a, "bad")));
  const sp = 44 + 3 * 44 + 4;
  b += `<line x1="${px - 70}" y1="${sp + 14}" x2="${W - 30}" y2="${sp + 14}" class="dg-marker"/>`;
  b += txt(px + pw / 2, sp + 18, "spread $0.02 · mid $2.03", { anchor: "middle", kind: "elabel" });
  bids.forEach((a, i) => (b += row(sp + 36 + i * 44, a, "good")));
  b += txt(16, sp + 36 + 3 * 44 + 18, "BIDS", { kind: "label" });
  b += node(16, 132, 150, 40, "marketBuy", "takes the best ask first", "accent", { mono: true });
  b += edge([[166, 150], [px, 150]]);
  b += node(16, sp + 36, 150, 40, "marketSell", "hits the best bid first", "accent", { mono: true });
  b += edge([[166, sp + 54], [px, sp + 54]]);
  return svg({ title: "SilicaBook price levels: each price holds a FIFO queue; takers fill outward from the spread", width: W, height: sp + 36 + 3 * 44 + 30, body: b });
}

export function bondVaultFlow() {
  const W = 840;
  let b = "";
  b += node(16, 44, 130, 52, "depositBond", "USDC per series", "monad", { mono: true });
  b += decision(300, 70, 230, 92, "Bond covers it?", "and no margin call");
  b += node(450, 44, 150, 52, "SIL to the provider", "mint(series, hours)", "accent");
  b += node(650, 44, 174, 52, "assigned on redeem", "FIFO across providers");
  b += node(185, 150, 230, 52, "revert", "BondTooLow · MarginCalled", "bad");
  b += edge([[146, 70], [185, 70]]);
  b += edge([[415, 70], [450, 70]], { label: "yes", at: [432, 62] });
  b += edge([[600, 70], [650, 70]]);
  b += edge([[300, 116], [300, 150]], { label: "no", at: [308, 138], anchor: "start" });
  b += decision(737, 320, 170, 84, "Verdict", "each delivery hour");
  b += edge([[737, 96], [737, 278]], { label: "hours run", at: [745, 190], anchor: "start" });
  b += node(380, 244, 220, 52, "settleHours", "the provider earned the hour", "good", { mono: true });
  b += node(380, 344, 220, 52, "settleHours + slash", "1.5 × priceAtOpen → holder", "bad", { mono: true });
  b += node(40, 292, 190, 56, "releaseBond", "after deliveryEnd, all settled", "monad", { mono: true });
  b += edge([[652, 320], [626, 320], [626, 270], [600, 270]], { label: "confirmed", at: [626, 262], tone: "good" });
  b += edge([[626, 320], [626, 370], [600, 370]], { label: "missed", at: [626, 392], tone: "bad" });
  b += edge([[380, 270], [300, 270], [300, 310], [230, 310]]);
  b += edge([[380, 370], [300, 370], [300, 330], [230, 330]]);
  return svg({ title: "BondVault: from a deposit to a release, with the mint check and the per-hour settlement", width: W, height: 412, body: b });
}

export function oracleFlow() {
  const W = 900, w = 196, xs = [16, 240, 464, 688], h = 56;
  const z = [16, 160, 318];
  let b = "";
  b += zone(8, z[0], W - 16, 112, "1 · Authenticate the report", "monad");
  b += zone(8, z[1], W - 16, 132, "2 · Verdicts, one at a time", "cre");
  b += zone(8, z[2], W - 16, 112, "3 · Marks, ratios, margin checks", "accent");
  const y1 = z[0] + 36, y2 = z[1] + 36, y3 = z[2] + 36;
  const r1 = [["onReport", "metadata, report · forwarder only", "monad", true], ["abi.decode → Report", "verdicts · marks · ratios · checks"], ["chainSelector matches?", "else revert WrongChain"], ["scheduledAt > last?", "else revert StaleReport"]];
  const r2 = [["for each verdict", "ticket · hour · two summaries"], ["deriveKind", "recover both EIP-712 signers", "cre", true], ["applyHour", "ticket, hour, kind · try / catch", "monad", true], ["RedemptionManager", "settle or slash that hour", "monad", true]];
  const r3 = [["setMark", "marks → SeriesRegistry", "plain", true], ["setBondRatio", "ratios → BondVault", "plain", true], ["checkMargin", "checks → BondVault", "plain", true], ["ReportReceived", "emitted once, at the end", "good", true]];
  r1.forEach(([t, s, tone, mono], i) => (b += node(xs[i], y1, w, h, t, s, tone, { mono })));
  [3, 2, 1, 0].forEach((slot, i) => {
    const [t, s, tone, mono] = r2[i];
    b += node(xs[slot], y2, w, h, t, s, tone, { mono });
  });
  r3.forEach(([t, s, tone, mono], i) => (b += node(xs[i], y3, w, h, t, s, tone, { mono })));
  for (let i = 0; i < 3; i++) {
    b += edge([[xs[i] + w, y1 + h / 2], [xs[i + 1], y1 + h / 2]]);
    b += edge([[xs[3 - i], y2 + h / 2], [xs[2 - i] + w, y2 + h / 2]], {});
    b += edge([[xs[i] + w, y3 + h / 2], [xs[i + 1], y3 + h / 2]]);
  }
  b += edge([[xs[3] + w / 2, y1 + h], [xs[3] + w / 2, y2]]);
  b += edge([[xs[0] + w / 2, y2 + h], [xs[0] + w / 2, y3]]);
  b += txt(W / 2, y2 + h + 26, "no verdict, or applyHour reverted → emit VerdictSkipped; the hour waits for the next run", { anchor: "middle", kind: "axis" });
  return svg({ title: "DeliveryOracle.onReport: authenticate, then apply each verdict, then marks, ratios and margin checks", width: W, height: z[2] + 112 + 10, body: b, minWidth: 760 });
}

export { badge };
