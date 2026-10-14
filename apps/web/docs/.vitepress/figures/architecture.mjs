// Architecture: the system map, roles, the lifecycle of an hour, ticket 7, and the data flows.
import { svg, node, zone, edge, txt, tag, sequence } from "./kit.mjs";
import { callTable, timeline } from "./layouts.mjs";

export function system() {
  const W = 1000;
  let b = "";
  // row 1: people · app · indexer
  b += zone(16, 16, 300, 120, "People");
  b += node(30, 46, 88, 72, "Buyer", "holder");
  b += node(124, 46, 88, 72, "Provider", ["bonds", "mints"]);
  b += node(218, 46, 88, 72, "Anyone", "slashUnserved");
  b += zone(336, 16, 320, 120, "Next.js app · Vercel", "accent");
  b += node(352, 46, 288, 72, "Web app", ["Markets · Trade · Tickets", "Provider console · Status · Docs"], "accent");
  b += zone(676, 16, 308, 120, "Envio Cloud", "envio");
  b += node(692, 46, 276, 72, "Envio HyperIndex", ["every Silica event → GraphQL", "reliability · candles · tickets"], "envio");
  b += edge([[316, 82], [352, 82]]);
  b += edge([[692, 82], [640, 82]], { label: "GraphQL", at: [666, 74] });

  // row 2: Monad
  b += zone(16, 168, 968, 200, "Monad Testnet · chain 10143", "monad");
  const c = [36, 272, 508, 744];
  const A = 204, B = 288, cw = 216, ch = 60;
  b += node(c[0], A, cw, ch, "SeriesRegistry", "series · marks", "monad", { mono: true });
  b += node(c[1], A, cw, ch, "BondVault", "bonds · mint · margin · slash", "monad", { mono: true });
  b += node(c[2], A, cw, ch, "SilicaToken × 5", "one ERC-20 per series", "monad", { mono: true });
  b += node(c[3], A, cw, ch, "MockUSDC", "quote + bond token · faucet", "monad", { mono: true });
  b += node(c[0], B, cw, ch, "SilicaBook", "price-time order book", "monad", { mono: true });
  b += node(c[1], B, cw, ch, "RedemptionManager", "tickets · access · verdicts", "monad", { mono: true });
  b += node(c[2], B, cw, ch, "DeliveryOracle", "CRE consumer · re-derives verdicts", "monad", { mono: true });
  b += node(c[3], B, cw, ch, "SilicaMarkFeed × 5", "USD mark for Kuru", "monad", { mono: true });
  b += edge([[380, 288], [380, 264]], { label: "assign · slash", at: [388, 280], anchor: "start" });
  b += edge([[508, 318], [488, 318]]);
  b += edge([[496, 116], [496, 168]], { label: "reads + writes · wagmi", at: [504, 148], anchor: "start" });
  b += edge([[930, 168], [930, 116]], { label: "events · HyperSync", at: [922, 148], anchor: "end", tone: "envio" });

  // row 3: services · CRE · Kuru
  b += zone(16, 416, 454, 120, "Services · Render", "service", { bottom: true, right: true });
  const s = [30, 134, 238, 342];
  b += node(s[0], 444, 100, 60, "Market maker", "mm-bot", "service");
  b += node(s[1], 444, 100, 60, "Node agent", "provider-agent", "service");
  b += node(s[2], 444, 100, 60, "Buyer probe", "second signer", "service");
  b += node(s[3], 444, 100, 60, "CRE relay", "testnet fallback", "service");
  b += zone(520, 416, 292, 120, "Chainlink CRE", "cre", { bottom: true });
  b += node(534, 444, 124, 60, "Delivery Verifier", "cron · per hour", "cre");
  b += node(672, 444, 124, 60, "Mark & Margin", "cron · marks · bonds", "cre");
  b += zone(828, 416, 156, 120, "Kuru Spot V2", "kuru", { bottom: true, right: true });
  b += node(842, 444, 128, 60, "Kuru books", "5 requested", "kuru");

  b += edge([[80, 444], [80, 348]], { label: "quotes", at: [88, 404], anchor: "start" });
  b += edge([[184, 444], [184, 392], [300, 392], [300, 348]], { label: "postAccess", at: [242, 386] });
  b += edge([[392, 444], [392, 392], [540, 392], [540, 348]], { label: "relayReport", at: [466, 386], dashed: true });
  b += edge([[470, 474], [534, 474]], { label: "/summary", at: [502, 466] });
  b += edge([[596, 444], [596, 348]], { label: "verdicts", at: [590, 410], anchor: "end", tone: "cre" });
  b += edge([[700, 444], [700, 348]], { label: "marks · ratios", at: [694, 410], anchor: "end", tone: "cre" });
  b += edge([[734, 116], [734, 444]], { label: "reliability", at: [740, 410], anchor: "start", tone: "envio" });
  b += edge([[900, 348], [900, 444]], { label: "USD mark", at: [906, 410], anchor: "start", dashed: true, tone: "kuru" });
  b += edge([[842, 474], [796, 474]], { label: "bid / ask", at: [819, 466], dashed: true, tone: "kuru" });
  b += edge([[80, 504], [80, 552], [860, 552], [860, 504]], { label: "post-only ladder, once Kuru lists the books", at: [470, 546], dashed: true, tone: "kuru" });
  return svg({ title: "System overview: people, the app, Envio, the Monad contracts, the Render services, Chainlink CRE and Kuru", width: W, height: 566, body: b, minWidth: 760 });
}

export function roles() {
  return callTable({
    title: "Who may call what: every privileged function and the role that guards it",
    width: 820,
    leftW: 180,
    rightW: 330,
    rows: [
      { from: "Admin key", fromSub: "testnet, one key", label: "DEFAULT_ADMIN_ROLE", labelTone: "bad", to: "every contract", toSub: "grant roles · parameters" },
      { from: "DeliveryOracle", fromSub: "after re-deriving", fromTone: "monad", label: "ORACLE_ROLE", to: "SeriesRegistry.setMark" },
      { from: "DeliveryOracle", label: "ORACLE_ROLE", to: "BondVault.setBondRatio · checkMargin" },
      { from: "DeliveryOracle", label: "ORACLE_ROLE", to: "RedemptionManager.applyHour" },
      { from: "RedemptionManager", fromTone: "monad", label: "REDEMPTION_ROLE", to: "BondVault.assign · settleHours · slash" },
      { from: "RedemptionManager", label: "BURNER_ROLE", to: "SilicaToken.burn" },
      { from: "BondVault", fromTone: "monad", label: "MINTER_ROLE", to: "SilicaToken.mint" },
      { from: "Providers", fromSub: "KYB'd", fromTone: "accent", label: "PROVIDER_ROLE", to: "BondVault.depositBond · mint", toSub: "withdrawExcess · releaseBond" },
      { from: "Relayer key", fromSub: "simulationMode only", fromTone: "service", label: "RELAYER_ROLE", labelTone: "muted", to: "DeliveryOracle.relayReport", dashed: true },
      { from: "Arbiter", label: "ARBITER_ROLE", to: "RedemptionManager.resolveDispute" },
      { from: "CRE forwarder", fromSub: "the only caller", fromTone: "cre", label: "forwarder address", labelTone: "cre", to: "DeliveryOracle.onReport" },
    ],
  });
}

export function lifecycle() {
  return sequence({
    title: "The life of one GPU-hour: issue, trade, redeem and deliver, then verify every hour",
    col: 106,
    numbered: true,
    actors: [
      { id: "P", label: "Provider", tone: "accent" },
      { id: "H", label: "Holder", tone: "accent" },
      { id: "V", label: "BondVault", tone: "monad" },
      { id: "B", label: "SilicaBook", tone: "monad" },
      { id: "R", label: "Redemption", sub: "Manager", tone: "monad" },
      { id: "A", label: "Node agent", tone: "service" },
      { id: "Q", label: "Buyer probe", tone: "service" },
      { id: "C", label: "CRE", sub: "Verifier", tone: "cre" },
      { id: "O", label: "Oracle", sub: "Delivery", tone: "monad" },
    ],
    steps: [
      { section: "Issue" },
      { from: "P", to: "V", label: "depositBond(series, usdc)" },
      { from: "P", to: "V", label: "mint(series, hours)", detail: "bond ≥ open × mark × ratio" },
      { from: "V", to: "P", label: "SIL tokens", dashed: true },
      { section: "Trade", tone: "good" },
      { from: "P", to: "B", label: "placeLimit(ask)" },
      { from: "H", to: "B", label: "marketBuy(hours, maxCost)" },
      { from: "B", to: "H", label: "tokens to the holder · USDC to the maker", dashed: true },
      { section: "Redeem and deliver" },
      { from: "H", to: "R", label: "redeem(series, hours, holderKey, probeKey)", detail: "burns the tokens · assigns FIFO" },
      { from: "R", to: "A", label: "Redeemed + TicketKeys", dashed: true },
      { from: "A", to: "R", label: "postAccess(ticket, sealed credentials)", detail: "within 30 minutes" },
      { section: "Verify, every hour", tone: "cre" },
      { from: "A", to: "C", label: "signed HourSummary", detail: "node key", dashed: true },
      { from: "Q", to: "C", label: "signed HourSummary", detail: "probe key", dashed: true },
      { from: "C", to: "O", label: "onReport(verdicts)", tone: "accent" },
      { from: "O", to: "R", label: "applyHour(ticket, hour, kind)", detail: "kind re-derived from both signatures" },
      { note: "confirmed → settleHours: the provider earned the hour", over: ["V", "O"], tone: "good" },
      { note: "missed → settleHours + slash 1.5 × priceAtOpen from the bond to the holder", over: ["H", "O"], tone: "bad" },
      { note: "disputed → held until resolveDispute", over: ["V", "O"], tone: "muted" },
    ],
  });
}

export function ticket7() {
  // minutes after 20:00 UTC
  return timeline({
    title: "Ticket 7 on testnet: hour 0 an outage, missed and slashed via CRE; hours 1 and 2 confirmed",
    heading: "Ticket 7 on Monad Testnet · 5-minute delivery hours · UTC, approximate",
    start: 20,
    end: 42,
    ticks: [20, 25, 30, 35, 40],
    fmtTick: (t) => `20:${String(t).padStart(2, "0")}`,
    tracks: [
      {
        label: "Access",
        points: [{ at: 23, tone: "accent", label: "postAccess", sub: "sealed to the holder" }],
      },
      {
        label: "Hours",
        segments: [
          { from: 23, to: 28, tone: "bad", label: "Hour 0", sub: "outage (demo)" },
          { from: 28, to: 33, tone: "good", label: "Hour 1" },
          { from: 33, to: 38, tone: "good", label: "Hour 2" },
        ],
      },
      {
        label: "Verdicts",
        points: [
          { at: 29, tone: "bad", label: "missed", sub: "via CRE · $3.05 slashed" },
          { at: 34, tone: "good", label: "confirmed" },
          { at: 39, tone: "good", label: "confirmed" },
        ],
      },
    ],
  });
}

export function writes() {
  return callTable({
    title: "Who writes to which contract",
    width: 820,
    leftW: 170,
    rightW: 260,
    rowH: 42,
    rows: [
      { from: "Wallet", fromSub: "in the web app", fromTone: "accent", label: "placeLimit · marketBuy · marketSell · cancel", to: "SilicaBook", toTone: "monad" },
      { from: "Wallet", label: "redeem", to: "RedemptionManager", toTone: "monad" },
      { from: "Wallet", label: "depositBond · mint · withdrawExcess · releaseBond", to: "BondVault", toTone: "monad" },
      { from: "Wallet", label: "faucet", to: "MockUSDC", toTone: "monad" },
      { from: "Node agent", fromSub: "provider-agent", fromTone: "service", label: "postAccess", to: "RedemptionManager", toTone: "monad" },
      { from: "Market maker", fromSub: "mm-bot", fromTone: "service", label: "placeLimit · cancel", to: "SilicaBook", toTone: "monad" },
      { from: "Delivery Verifier", fromSub: "CRE", fromTone: "cre", label: "onReport: verdicts", labelTone: "cre", to: "DeliveryOracle", toTone: "monad" },
      { from: "Mark & Margin", fromSub: "CRE", fromTone: "cre", label: "onReport: marks · ratios · checks", labelTone: "cre", to: "DeliveryOracle", toTone: "monad" },
      { from: "DeliveryOracle", fromSub: "fans the report out", fromTone: "monad", label: "applyHour", to: "RedemptionManager", toTone: "monad" },
      { from: "DeliveryOracle", label: "setMark", to: "SeriesRegistry", toTone: "monad" },
      { from: "DeliveryOracle", label: "setBondRatio · checkMargin", to: "BondVault", toTone: "monad" },
    ],
  });
}

export function reads() {
  const W = 820;
  let b = "";
  b += node(16, 128, 170, 150, "Monad state", ["contracts · events", "chain 10143"], "monad");
  b += node(312, 28, 190, 64, "Envio HyperIndex", "Envio Cloud", "envio");
  b += node(634, 28, 170, 64, "Web app", "wagmi + GraphQL", "accent");
  b += node(634, 160, 170, 64, "Mark & Margin", "CRE workflow", "cre");
  b += node(634, 300, 170, 100, "Delivery Verifier", "CRE workflow", "cre");
  b += node(16, 318, 170, 40, "Node agent", undefined, "service");
  b += node(16, 366, 170, 40, "Buyer probe", undefined, "service");
  b += edge([[120, 128], [120, 72], [312, 72]], { label: "events · HyperSync", at: [216, 64], tone: "envio" });
  b += edge([[502, 52], [634, 52]], { label: "GraphQL · 2 s poll", at: [568, 44], tone: "envio" });
  b += edge([[470, 92], [470, 184], [634, 184]], { label: "GraphQL under consensus", at: [552, 176], tone: "envio" });
  b += edge([[34, 128], [34, -6], [719, -6], [719, 28]], { label: "wagmi multicall · 1.5 s", at: [410, -12] });
  b += edge([[186, 206], [634, 206]], { label: "EVM reads · Multicall3", at: [380, 198] });
  b += edge([[186, 258], [580, 258], [580, 320], [634, 320]], { label: "EVM reads · Multicall3", at: [380, 250] });
  b += edge([[186, 338], [634, 338]], { label: "HTTP /summary · signed", at: [410, 330] });
  b += edge([[186, 386], [634, 386]], { label: "HTTP /summary · signed", at: [410, 378] });
  return svg({ title: "Who reads what: the app, both CRE workflows, Envio and the two signers", width: W, height: 444, body: `<g transform="translate(0 24)">${b}</g>` });
}

export function feedback() {
  const W = 820;
  const w = 176, h = 66;
  const xs = [16, 222, 428, 628];
  const T = 16, Bt = 150;
  let b = "";
  b += node(xs[0], T, w, h, "Signed hour summaries", ["node key + probe key", "every delivery hour"]);
  b += node(xs[1], T, w, h, "Delivery Verifier", "CRE · consensus", "cre");
  b += node(xs[2], T, w, h, "Confirmed / Slashed", ["HoursConfirmed", "HoursSlashed events"], "monad");
  b += node(xs[3], T, w, h, "Envio", "Provider.reliabilityBps", "envio");
  b += node(xs[3], Bt, w, h, "Mark & Margin", "CRE · reads Envio", "cre");
  b += node(xs[2], Bt, w, h, "BondVault", ["setBondRatio 20 · 30 · 40 %", "checkMargin"], "monad");
  b += node(xs[1], Bt, w, h, "Can it mint more?", ["bond required per hour", "margin call blocks minting"], "accent");
  for (let i = 0; i < 3; i++) b += edge([[xs[i] + w, T + h / 2], [xs[i + 1], T + h / 2]]);
  b += edge([[xs[3] + w / 2, T + h], [xs[3] + w / 2, Bt]], { tone: "envio" });
  b += edge([[xs[3], Bt + h / 2], [xs[2] + w, Bt + h / 2]], { tone: "cre" });
  b += edge([[xs[2], Bt + h / 2], [xs[1] + w, Bt + h / 2]]);
  b += edge([[xs[1], Bt + h / 2], [xs[0] + w / 2, Bt + h / 2], [xs[0] + w / 2, T + h]], { label: "next hour", at: [xs[0] + w / 2 + 8, 128], anchor: "start" });
  return svg({ title: "The feedback loop: delivery becomes reputation, reputation sets the bond", width: W, height: Bt + h + 16, body: b });
}

export { txt, tag };
