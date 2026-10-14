// Concepts: the token family, bonds, the book, redemption, verification, slashing, marks and reputation.
import { svg, node, state, terminal, decision, edge, txt, sequence, bars, lineChart } from "./kit.mjs";
import { chain, timeline } from "./layouts.mjs";

export function tokenFamily() {
  const W = 820;
  const tw = 146, gap = 12, x0 = (W - (5 * tw + 4 * gap)) / 2;
  const series = [
    ["W42", "12 – 18 Oct", "demo week · 5-min hours", "accent"],
    ["W44", "26 Oct – 1 Nov", "forward", "monad"],
    ["W45", "2 – 8 Nov", "forward", "monad"],
    ["W46", "9 – 15 Nov", "forward", "monad"],
    ["W47", "16 – 22 Nov", "forward", "monad"],
  ];
  let b = node(W / 2 - 120, 16, 240, 56, "SeriesRegistry.createSeries", "deploys one token per series", "monad", { mono: true });
  b += edge([[W / 2, 72], [W / 2, 98]], { noHead: true });
  const cx = (i) => x0 + i * (tw + gap) + tw / 2;
  b += `<g class="dg-edge"><path d="M${cx(0)},98 H${cx(4)}"/></g>`;
  series.forEach(([wk, dates, sub, tone], i) => {
    b += edge([[cx(i), 98], [cx(i), 124]]);
    b += node(cx(i) - tw / 2, 124, tw, 72, `SIL·H100·APAC·${wk}`, [dates, sub], tone, { mono: true });
    b += edge([[cx(i), 196], [cx(i), 236]], { dashed: true });
    b += node(cx(i) - tw / 2 + 18, 236, tw - 36, 40, `${wk} book`, undefined, "muted");
  });
  b += txt(W / 2, 302, "one standard contract per GPU model × region × ISO week, each with its own order book", { anchor: "middle" });
  return svg({ title: "One SeriesRegistry deploys a token per series; each series trades on its own book", width: W, height: 318, body: b });
}

export function bondStates() {
  const W = 820, y = 60, h = 52;
  let b = "";
  b += terminal(30, y + h / 2);
  b += state(60, y, 130, h, "Bonded", "depositBond");
  b += state(300, y, 150, h, "Issued", undefined, "accent");
  b += state(600, y, 170, h, "Delivering", undefined, "monad");
  b += state(290, 230, 170, h, "Margin-called", undefined, "bad");
  b += state(600, 230, 170, h, "Settled", undefined, "good");
  b += terminal(685, 352, true);
  b += edge([[37, y + h / 2], [60, y + h / 2]]);
  b += edge([[190, y + h / 2], [300, y + h / 2]], { label: "mint", sub: "bond ≥ requirement", at: [245, y + h / 2 - 22] });
  b += edge([[450, y + h / 2], [600, y + h / 2]], { label: "redeem assigns hours", sub: "FIFO across providers", at: [525, y + h / 2 - 22] });
  b += edge([[350, y], [350, 34], [400, 34], [400, y]], { label: "more mints · trades", at: [375, 26] });
  b += edge([[340, y + h], [340, 230]], { label: "checkMargin", sub: "bond < requirement", at: [332, 168], anchor: "end", tone: "bad" });
  b += edge([[410, 230], [410, y + h]], { label: "depositBond", sub: "next check clears it", at: [418, 168], anchor: "start", tone: "good" });
  b += edge([[685, y + h], [685, 230]], { label: "every assigned hour", sub: "confirmed or slashed", at: [693, 168], anchor: "start" });
  b += edge([[685, 282], [685, 343]], { label: "releaseBond", sub: "after deliveryEnd", at: [693, 312], anchor: "start" });
  return svg({ title: "A provider's position in one series, from bond to release", width: W, height: 372, body: b });
}

export function orderFill() {
  return sequence({
    title: "A market buy that walks two ask levels",
    col: 190,
    actors: [
      { id: "T", label: "Taker", sub: "AI team", tone: "accent" },
      { id: "B", label: "SilicaBook", tone: "monad", mono: true },
      { id: "M1", label: "Maker", sub: "ask @ $2.04" },
      { id: "M2", label: "Maker", sub: "ask @ $2.05" },
    ],
    steps: [
      { from: "T", to: "B", label: "marketBuy(W42, 20 h, maxCost)" },
      { from: "B", to: "M1", label: "fill 15 h @ $2.04", detail: "USDC → maker · tokens → taker" },
      { from: "B", to: "M2", label: "fill 5 h @ $2.05", detail: "price-time priority within a level" },
      { from: "B", to: "T", label: "Trade events · 20 h for $40.85", dashed: true, tone: "good" },
    ],
  });
}

export function ticketStates() {
  const W = 860, y = 70, h = 52;
  let b = "";
  b += terminal(30, y + h / 2);
  b += state(60, y, 140, h, "Open", "redeemed");
  b += state(330, y, 180, h, "Access posted", "hours running", "accent");
  b += state(640, y, 160, h, "Settled", undefined, "good");
  b += terminal(836, y + h / 2, true);
  b += edge([[37, y + h / 2], [60, y + h / 2]]);
  b += edge([[200, y + h / 2], [330, y + h / 2]], { label: "postAccess", sub: "within 30 minutes", at: [265, y + h / 2 - 22] });
  b += edge([[510, y + h / 2], [640, y + h / 2]], { label: "all hours settled", sub: "confirmed + missed", at: [575, y + h / 2 - 22] });
  b += edge([[395, y], [395, 42], [445, 42], [445, y]], { label: "applyHour, per elapsed hour", at: [420, 34] });
  b += edge([[130, y + h], [130, 182], [720, 182], [720, y + h]], { label: "slashUnserved after the deadline: every hour slashed to the holder", at: [425, 174], tone: "bad" });
  b += edge([[800, y + h / 2], [827, y + h / 2]]);
  return svg({ title: "The states of a redemption ticket", width: W, height: 200, body: b });
}

export function accessKey() {
  return sequence({
    title: "Sealing access to the holder: a key derived from a signature, never stored",
    col: 230,
    actors: [
      { id: "H", label: "Holder", sub: "browser", tone: "accent" },
      { id: "R", label: "RedemptionManager", tone: "monad", mono: true },
      { id: "A", label: "Node agent", sub: "provider-agent", tone: "service" },
    ],
    steps: [
      { from: "H", to: "H", label: "sign “Silica access key v1…”", detail: "no gas, nothing sent" },
      { from: "H", to: "H", label: "X25519 key pair = derive(sha256(signature))" },
      { from: "H", to: "R", label: "redeem(…, holderKey = public key, …)" },
      { from: "R", to: "A", label: "TicketKeys(ticket, holderKey, probeKey, nodeKey)", dashed: true },
      { from: "A", to: "A", label: "seal credentials to holderKey", detail: "crypto_box_seal" },
      { from: "A", to: "R", label: "postAccess(ticket, ciphertext)" },
      { from: "H", to: "H", label: "sign again → same key → open it locally", tone: "good" },
      { note: "the chain, Envio and the app only ever hold the ciphertext", over: ["H", "A"], tone: "muted" },
    ],
  });
}

export function verifySeq() {
  return sequence({
    title: "One run of the Delivery Verifier",
    col: 152,
    actors: [
      { id: "A", label: "Node agent", tone: "service" },
      { id: "Q", label: "Buyer probe", tone: "service" },
      { id: "C", label: "Delivery Verifier", sub: "every CRE node", tone: "cre" },
      { id: "O", label: "DeliveryOracle", tone: "monad", mono: true },
      { id: "R", label: "Redemption", sub: "Manager", tone: "monad" },
    ],
    steps: [
      { from: "C", to: "R", label: "read open tickets + due hours", detail: "EVM read · Multicall3" },
      { from: "C", to: "A", label: "GET /summary/:ticket/:hour" },
      { from: "C", to: "Q", label: "GET /summary/:ticket/:hour" },
      { note: "consensusIdenticalAggregation: every node must see identical evidence", over: ["A", "R"], tone: "cre" },
      { from: "C", to: "O", label: "writeReport(verdicts[])", tone: "accent" },
      { from: "O", to: "O", label: "recover both EIP-712 signers", detail: "check okChecks + gpuIdHash" },
      { from: "O", to: "R", label: "applyHour(ticket, hour, kind)" },
    ],
  });
}

export function verdictRules() {
  const W = 800, cx = 230;
  const ox = 470, ow = 314;
  let b = "";
  b += node(cx - 130, 16, 260, 48, "Two signed summaries", "for one ticket-hour", "muted");
  b += decision(cx, 140, 290, 84, "Either signature valid?");
  b += decision(cx, 270, 320, 92, "Provider ≥ 11 and probe ≥ 11", "on the same GPU?");
  b += decision(cx, 404, 320, 92, "Probe valid and probe < 11", "provider not ≥ 11?");
  b += node(cx - 130, 488, 260, 56, "Disputed · kind 2", "held until resolveDispute", "muted");
  b += node(ox, 112, ow, 56, "No verdict", "skipped, retried on the next run");
  b += node(ox, 242, ow, 56, "Confirmed · kind 0", "the provider earned the hour", "good");
  b += node(ox, 376, ow, 56, "Missed · kind 1", "1.5 × priceAtOpen slashed to the holder", "bad");
  b += edge([[cx, 64], [cx, 98]]);
  b += edge([[cx + 145, 140], [ox, 140]], { label: "no", at: [(cx + 145 + ox) / 2, 132] });
  b += edge([[cx, 182], [cx, 224]], { label: "yes", at: [cx + 8, 208], anchor: "start" });
  b += edge([[cx + 160, 270], [ox, 270]], { label: "yes", at: [(cx + 160 + ox) / 2, 262], tone: "good" });
  b += edge([[cx, 316], [cx, 358]], { label: "no", at: [cx + 8, 342], anchor: "start" });
  b += edge([[cx + 160, 404], [ox, 404]], { label: "yes", at: [(cx + 160 + ox) / 2, 396], tone: "bad" });
  b += edge([[cx, 450], [cx, 488]], { label: "no", at: [cx + 8, 474], anchor: "start" });
  return svg({ title: "How DeliveryOracle derives a verdict from the two signed summaries", width: W, height: 560, body: b });
}

export function slashSeq() {
  return sequence({
    title: "What a missed hour does onchain",
    col: 190,
    actors: [
      { id: "O", label: "DeliveryOracle", tone: "monad", mono: true },
      { id: "R", label: "RedemptionManager", tone: "monad", mono: true },
      { id: "V", label: "BondVault", tone: "monad", mono: true },
      { id: "H", label: "Holder", tone: "accent" },
    ],
    steps: [
      { from: "O", to: "R", label: "applyHour(ticket, hour, MISSED)" },
      { from: "R", to: "R", label: "owed = 1 × priceAtOpen × 1.5" },
      { from: "R", to: "V", label: "settleHours(provider, series, 1)" },
      { from: "R", to: "V", label: "slash(provider, series, holder, owed)" },
      { from: "V", to: "H", label: "USDC: min(owed, bond)", tone: "bad" },
      { note: "emit HoursSlashed(ticket, 1, paid) · HourVerdict(ticket, hour, 1)", over: ["O", "V"], tone: "muted" },
    ],
  });
}

export function markMargin() {
  const W = 840;
  let b = "";
  const L = 30, lw = 180, C = 330, cw = 180, R = 640, rw = 184;
  b += node(L, 24, lw, 56, "Order books", "Kuru first, else SilicaBook", "monad");
  b += node(L, 104, lw, 56, "Envio", "delivery record", "envio");
  b += node(L, 184, lw, 56, "BondVault positions", "bond · minted · settled", "monad");
  b += node(C, 24, cw, 216, "Mark & Margin", ["CRE workflow", "", "marks", "ratios", "margin checks"], "cre");
  b += node(R, 24, rw, 56, "SeriesRegistry", "the series mark", "monad", { mono: true });
  b += node(R, 104, rw, 136, "BondVault", ["bond ratio per provider", "margin call flag"], "monad", { mono: true });
  b += edge([[L + lw, 52], [C, 52]], { label: "best bid / ask", at: [(L + lw + C) / 2, 44] });
  b += edge([[L + lw, 132], [C, 132]], { label: "confirmed · missed", at: [(L + lw + C) / 2, 124], tone: "envio" });
  b += edge([[L + lw, 212], [C, 212]], { label: "positions", at: [(L + lw + C) / 2, 204] });
  b += edge([[C + cw, 52], [R, 52]], { label: "setMark", at: [(C + cw + R) / 2, 44], tone: "cre" });
  b += edge([[C + cw, 132], [R, 132]], { label: "setBondRatio", at: [(C + cw + R) / 2, 124], tone: "cre" });
  b += edge([[C + cw, 212], [R, 212]], { label: "checkMargin", at: [(C + cw + R) / 2, 204], tone: "cre" });
  b += edge([[R + rw / 2, 240], [R + rw / 2, 284], [14, 284], [14, 132], [L, 132]], { label: "MarginCall / MarginCleared events", at: [420, 278], dashed: true, tone: "envio" });
  return svg({ title: "Mark & Margin: three inputs, three writes, and the margin events Envio picks up again", width: W, height: 300, body: b });
}

export function bondRatios() {
  return bars({
    title: "Bond required for 1,000 open hours at a $2.05 mark",
    max: 900,
    ticks: 3,
    valueFmt: (v) => `$${Math.round(v)}`,
    items: [
      { label: "Reputation · 20 %", value: 410, tone: "good", note: "≥ 1,000 h confirmed at ≥ 99 %" },
      { label: "Default · 30 %", value: 615, tone: "accent", note: "everyone starts here" },
      { label: "Penalty · 40 %", value: 820, tone: "bad", note: "< 95 % after ≥ 10 h" },
    ],
    height: 320,
  });
}

export function reputation() {
  return chain({
    title: "From a delivery event to a provider's bond ratio",
    perRow: 4,
    w: 168,
    h: 66,
    gx: 36,
    items: [
      { title: "HoursConfirmed", sub: "HoursSlashed events", tone: "monad", mono: true },
      { title: "Envio handler", sub: "recomputes reliabilityBps", tone: "envio" },
      { title: "GraphQL", sub: "Provider entity", tone: "envio" },
      { title: "Mark & Margin", sub: "HTTP under consensus", tone: "cre" },
      { title: "ratioFor()", sub: "20 · 30 · 40 %", tone: "accent", mono: true },
      { title: "setBondRatio", sub: "BondVault", tone: "monad", mono: true },
      { title: "checkMargin", sub: "margin call if short", tone: "bad", mono: true },
    ],
  }).svg();
}

export function seriesLifecycle() {
  // days: October d → d, November d → 31 + d
  return timeline({
    title: "The life of a weekly series, W44 as the example",
    heading: "Series lifecycle · H100·APAC·W44",
    start: 11,
    end: 37,
    ticks: [12, 19, 26, 33],
    fmtTick: (d) => (d > 31 ? `${d - 31} Nov` : `${d} Oct`),
    labelW: 150,
    trackH: 66,
    tracks: [
      { label: "Before delivery", segments: [{ from: 12, to: 26, tone: "accent", label: "mint · trade · quote", sub: "forward hours change hands" }] },
      { label: "Delivery week", segments: [{ from: 26, to: 33, tone: "good", label: "redeem · deliver", sub: "Mon 00:00 → Sun 23:59 UTC" }] },
      { label: "After", segments: [{ from: 33, to: 36, tone: "muted", label: "releaseBond", sub: "once settled" }] },
    ],
  });
}

export function forwardCurve() {
  return lineChart({
    title: "Forward curve at launch · USDC per H100-hour",
    min: 1.95,
    max: 2.25,
    ticks: 6,
    prefix: "$",
    highlight: 0,
    points: [
      { label: "W42", value: 2.02, note: "demo · this week" },
      { label: "W44", value: 2.05, note: "from 26 Oct" },
      { label: "W45", value: 2.12, note: "from 2 Nov" },
      { label: "W46", value: 2.09, note: "from 9 Nov" },
      { label: "W47", value: 2.18, note: "from 16 Nov" },
    ],
  });
}

export function verdictsPerWeek() {
  return bars({
    title: "Delivery verdicts per week, by provider size (one per GPU per hour)",
    max: 24000,
    ticks: 4,
    valueFmt: (v) => v.toLocaleString("en-US"),
    yLabel: "verdicts / week",
    items: [
      { label: "8 GPUs", value: 1344, tone: "muted" },
      { label: "16 GPUs", value: 2688, tone: "muted" },
      { label: "32 GPUs", value: 5376, tone: "accent" },
      { label: "64 GPUs", value: 10752, tone: "accent" },
      { label: "128 GPUs", value: 21504, tone: "accent" },
    ],
  });
}

export { txt };
