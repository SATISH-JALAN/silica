// Integrations, services, economics, operations, reference and the user guides.
import { svg, node, zone, edge, txt, card, cardHeight, decision, badge, sequence, bars, split } from "./kit.mjs";
import { chain } from "./layouts.mjs";

/* ---------------------------------------------------------------- integrations */

export function creWorkflows() {
  const W = 820, zw = 384, X = [16, 420], sw = 352, sh = 50, gap = 66, top = 46;
  const flows = [
    ["Delivery Verifier · cron", [
      ["EVM read", "open tickets · due hours · verdictApplied"],
      ["HTTP in node mode", "provider + probe summaries"],
      ["consensusIdenticalAggregation", "every node must see identical evidence"],
      ["buildVerdicts → encodeReport", "only hours with a verdict"],
      ["runtime.report → writeReport", "signed by the DON, delivered by the forwarder"],
    ]],
    ["Mark & Margin · cron", [
      ["EVM read", "marks · best bid / ask · Kuru first, else SilicaBook"],
      ["HTTP in node mode", "Envio GraphQL: delivery record per provider"],
      ["consensusIdenticalAggregation", "every node must see identical evidence"],
      ["marks · ratios · margin checks", "only what changed"],
      ["runtime.report → writeReport", "signed by the DON, delivered by the forwarder"],
    ]],
  ];
  let b = "";
  const zh = top + 5 * gap - (gap - sh) + 14;
  flows.forEach(([label, steps], k) => {
    b += zone(X[k], 16, zw, zh, label, "cre");
    steps.forEach(([t, s], i) => {
      const x = X[k] + 16, y = 16 + top + i * gap;
      b += node(x, y, sw, sh, t, s, i === 2 ? "cre" : "plain", { mono: i !== 1 && i !== 0 ? true : false });
      b += badge(x + 20, y + sh / 2, i + 1, "cre");
      if (i) b += edge([[x + sw / 2, y - (gap - sh)], [x + sw / 2, y]]);
    });
  });
  const oy = 16 + zh + 44;
  b += node(W / 2 - 150, oy, 300, 56, "DeliveryOracle on Monad", "onReport(metadata, report)", "monad");
  b += edge([[X[0] + zw / 2, 16 + zh], [X[0] + zw / 2, oy + 28], [W / 2 - 150, oy + 28]], { tone: "cre" });
  b += edge([[X[1] + zw / 2, 16 + zh], [X[1] + zw / 2, oy + 28], [W / 2 + 150, oy + 28]], { tone: "cre" });
  return svg({ title: "The two CRE workflows, step by step, both writing to DeliveryOracle", width: W, height: oy + 56 + 16, body: b });
}

export function envioEntities() {
  const W = 880, cw = 260, X = [16, 310, 604], top = 16;
  const cols = [
    ["Series", [["mark", "BigInt"], ["openInterestHours", "BigInt"], ["bondLocked", "BigInt"], ["volumeUsdc", "BigInt"]], [["Candle", "1-hour buckets"], ["Level", "book depth"], ["Trade", "every fill"], ["Order", "open and closed"], ["ForwardPoint", "one curve point"]]],
    ["Provider", [["hoursConfirmed", "BigInt"], ["hoursMissed", "BigInt"], ["reliabilityBps", "Int"], ["openMarginCalls", "Int"]], [["Position", "per series"], ["MarginCallEvent", "margin calls"]]],
    ["Ticket", [["confirmed", "Int"], ["missed", "Int"], ["slashPaid", "BigInt"], ["ciphertext", "String"]], [["HourVerdict", "one per hour"]]],
  ];
  let b = "";
  const tones = ["monad", "envio", "accent"];
  let maxY = 0;
  cols.forEach(([name, fields, kids], k) => {
    const x = X[k];
    b += card(x, top, cw, name, fields, tones[k]);
    const cb = top + cardHeight(fields.length);
    const sx = x + 20;
    kids.forEach(([kn, rel], i) => {
      const y = cb + 26 + i * 52;
      b += node(x + 44, y, cw - 44, 42, kn, undefined, "plain", { mono: true, align: "start" });
      b += txt(x + cw - 14, y + 26, rel, { anchor: "end", kind: "axis" });
      b += edge([[sx, y + 21], [x + 44, y + 21]]);
      maxY = Math.max(maxY, y + 42);
    });
    const lastY = cb + 26 + (kids.length - 1) * 52 + 21;
    b += `<g class="dg-edge"><path d="M${sx},${cb} V${lastY}"/></g>`;
  });
  return svg({ title: "The main Envio entities and what hangs off each", width: W, height: maxY + 16 + 10, body: b });
}

export function envioSeq() {
  return sequence({
    title: "How a missed hour reaches a provider's bond through Envio and CRE",
    col: 190,
    actors: [
      { id: "R", label: "RedemptionManager", tone: "monad", mono: true },
      { id: "E", label: "Envio", sub: "HyperIndex", tone: "envio" },
      { id: "C", label: "Mark & Margin", sub: "CRE", tone: "cre" },
      { id: "V", label: "BondVault", tone: "monad", mono: true },
    ],
    steps: [
      { from: "R", to: "E", label: "HoursSlashed", detail: "the provider missed an hour", dashed: true, tone: "bad" },
      { from: "E", to: "E", label: "Provider.reliabilityBps recomputed" },
      { from: "C", to: "E", label: "GraphQL: confirmed + missed", detail: "under consensus" },
      { from: "C", to: "V", label: "setBondRatio(provider, series, 4000)", tone: "accent" },
      { from: "C", to: "V", label: "checkMargin(provider, series)" },
      { from: "V", to: "E", label: "MarginCall(provider, series, shortfall)", dashed: true, tone: "bad" },
    ],
  });
}

export function kuruListing() {
  const W = 880;
  let b = "";
  b += zone(16, 16, 340, 244, "Built by Silica · done", "good");
  b += zone(388, 16, 230, 244, "Kuru admin · requested", "kuru");
  b += zone(650, 16, 214, 244, "Silica · switches over", "good");
  b += node(32, 48, 308, 56, "SilicaMarkFeed × 5", "USD price feed per series", "monad", { mono: true });
  b += node(32, 122, 308, 56, "Listing parameters", "tick · size · fees, per series");
  b += node(32, 190, 308, 56, "Predicted book addresses", "SpotRouter.computeAddress", "plain");
  b += node(404, 48, 198, 56, "whitelistSpotToken", "per series token", "kuru", { mono: true });
  b += node(404, 136, 198, 104, "deploySpotMarket", ["one book per series", "at the predicted address"], "kuru", { mono: true });
  b += node(666, 136, 182, 104, "Auto-switch", ["mm-bot quotes on Kuru", "CRE reads Kuru first", "app shows Kuru books"], "accent");
  b += edge([[340, 76], [404, 76]], { label: "feed", at: [372, 68] });
  b += edge([[340, 150], [404, 150]], { label: "params", at: [372, 142] });
  b += edge([[340, 218], [404, 218]], { label: "addresses", at: [372, 210] });
  b += edge([[503, 104], [503, 136]]);
  b += edge([[602, 188], [666, 188]], { label: "verified", at: [634, 180], tone: "kuru" });
  return svg({ title: "Listing on Kuru: what Silica built, what Kuru's admin does, and the automatic switch-over", width: W, height: 276, body: b });
}

/* ---------------------------------------------------------------- services */

export function relayFlow() {
  const W = 870;
  let b = "";
  b += node(16, 136, 110, 56, "tick", "the relay loop", "service");
  b += decision(262, 90, 190, 80, "RELAY_MODE");
  b += decision(262, 270, 230, 84, "MARGIN_EVERY", "elapsed?");
  b += node(400, 24, 220, 56, "cre workflow simulate", "delivery-verifier --broadcast", "cre", { mono: true });
  b += node(648, 24, 206, 56, "MockKeystoneForwarder", "→ onReport", "cre", { mono: true });
  b += node(400, 108, 220, 56, "build verdicts in-process", "same rules, same codec");
  b += node(648, 108, 206, 56, "relayReport", "RELAYER_ROLE · simulationMode", "service", { mono: true });
  b += node(424, 242, 430, 56, "Mark & Margin", "the same two modes", "cre");
  b += edge([[126, 150], [146, 150], [146, 90], [167, 90]]);
  b += edge([[126, 178], [146, 178], [146, 270], [147, 270]]);
  b += edge([[357, 90], [376, 90], [376, 52], [400, 52]], { label: "cre", at: [386, 44] });
  b += edge([[376, 90], [376, 136], [400, 136]], { label: "local", at: [386, 154] });
  b += edge([[620, 52], [648, 52]]);
  b += edge([[620, 136], [648, 136]]);
  b += edge([[377, 270], [424, 270]], { label: "yes", at: [400, 262] });
  return svg({ title: "The CRE relay loop: delivery every tick, Mark & Margin when its interval is up", width: W, height: 316, body: b });
}

export function mmLadder() {
  return bars({
    title: "The market maker's W42 ladder around a $2.02 mark · hours per level",
    max: 70,
    ticks: 7,
    valueFmt: (v) => `${Math.round(v)} h`,
    items: [
      { label: "$1.99", value: 25, tone: "good", note: "bid" },
      { label: "$2.00", value: 15, tone: "good", note: "bid" },
      { label: "$2.02", value: 0, tone: "accent", text: "mark", note: "no quote at the mark" },
      { label: "$2.04", value: 15, tone: "bad", note: "ask" },
      { label: "$2.05", value: 25, tone: "bad", note: "ask" },
      { label: "$2.08", value: 40, tone: "bad", note: "ask" },
      { label: "$2.10", value: 60, tone: "bad", note: "ask" },
    ],
    height: 320,
  });
}

export function agentSeq() {
  return sequence({
    title: "What the provider agent does for one ticket",
    col: 220,
    actors: [
      { id: "R", label: "RedemptionManager", tone: "monad", mono: true },
      { id: "A", label: "Node agent", sub: "provider-agent", tone: "service" },
      { id: "C", label: "CRE · probe", sub: "the verifiers", tone: "cre" },
    ],
    steps: [
      { section: "Watch · every few seconds", tone: "monad" },
      { from: "A", to: "R", label: "getOpenTickets()" },
      { from: "R", to: "A", label: "a new ticket for NeoGPU", dashed: true },
      { section: "Serve" },
      { from: "A", to: "A", label: "seal credentials to holderKey" },
      { from: "A", to: "R", label: "postAccess(ticket, ciphertext)" },
      { section: "Run · heartbeat every hourSeconds / 14", tone: "good" },
      { from: "A", to: "A", label: "heartbeat", detail: "nvidia-smi, simulated" },
      { section: "Answer, per hour", tone: "cre" },
      { from: "C", to: "A", label: "GET /summary/:ticket/:hour" },
      { from: "A", to: "C", label: "{ okChecks, gpuIdHash, signer, signature }", dashed: true },
    ],
  });
}

/* ---------------------------------------------------------------- economics */

export function bondSplit() {
  return split({
    title: "Where a $600 bond goes when 10 hours are missed",
    parts: [
      { label: "Paid to the buyer for 10 missed hours (10 × $2.05 × 1.5)", value: 30.75, tone: "bad", text: "$30.75" },
      { label: "Returned to the provider at release", value: 569.25, tone: "good", text: "$569.25" },
    ],
  });
}

export function liquidity() {
  const W = 820, L = 16, lw = 190, R = 610, rw = 194;
  let b = "";
  b += node(L, 24, lw, 52, "Providers", "pre-sell capacity", "accent");
  b += node(L, 112, lw, 52, "AI teams", "buy forward hours", "accent");
  b += node(L, 200, lw, 52, "Market maker", "mm-bot", "service");
  b += node(L, 300, lw, 52, "Kuru passive bands", "Kuru's own liquidity", "kuru");
  b += node(R, 24, rw, 228, "Series book", ["SilicaBook, live today", "one per series"], "monad");
  b += node(R, 286, rw, 80, "Kuru book", ["once Kuru lists it"], "kuru");
  b += edge([[L + lw, 50], [R, 50]], { label: "asks: capacity they want to pre-sell", at: [(L + lw + R) / 2, 42] });
  b += edge([[L + lw, 138], [R, 138]], { label: "market and limit buys", at: [(L + lw + R) / 2, 130] });
  b += edge([[L + lw, 218], [R, 218]], { label: "two-sided ladder around the CRE mark", at: [(L + lw + R) / 2, 210] });
  b += edge([[L + lw, 236], [420, 236], [420, 306], [R, 306]], { label: "post-only ladder, once listed", at: [515, 300], dashed: true, tone: "kuru" });
  b += edge([[L + lw, 336], [R, 336]], { label: "passive bands, once listed", at: [(L + lw + R) / 2, 352], dashed: true, tone: "kuru" });
  return svg({ title: "Where liquidity comes from, today on SilicaBook and later on Kuru", width: W, height: 382, body: b });
}

/* ---------------------------------------------------------------- guides */

export function introFlow() {
  const W = 860, w = 152, g = 24, x0 = (W - (5 * w + 4 * g)) / 2, y = 16, h = 66;
  const steps = [
    ["Provider bonds", "and mints hours", "accent"],
    ["Tokens trade", "on the series book", "monad"],
    ["Holder redeems", "in the delivery week", "accent"],
    ["Access sealed", "to the holder's key", "plain"],
    ["Every hour", "two signed reports · CRE", "cre"],
  ];
  let b = "";
  steps.forEach(([t, s, tone], i) => {
    const x = x0 + i * (w + g);
    b += node(x, y, w, h, t, s, tone);
    b += badge(x + 2, y + 2, i + 1, tone === "cre" ? "cre" : "accent");
    if (i) b += edge([[x - g, y + h / 2], [x, y + h / 2]]);
  });
  const ox = [2, 3, 4].map((k) => x0 + k * (w + g) + w / 2 - 80);
  const outs = [["Confirmed", "the provider is paid", "good", "both healthy"], ["Missed", "the bond pays 1.5×", "bad", "probe saw an outage"], ["Disputed", "held for the arbiter", "muted", "they disagree"]];
  const cx = x0 + 4 * (w + g) + w / 2, bus = y + h + 30, oy = bus + 46;
  b += `<g class="dg-edge"><path d="M${cx},${y + h} V${bus} M${ox[0] + 80},${bus} H${ox[2] + 80}"/></g>`;
  outs.forEach(([t, s, tone, why], i) => {
    b += edge([[ox[i] + 80, bus], [ox[i] + 80, oy]], { tone: tone === "muted" ? undefined : tone });
    b += txt(ox[i] + 80, bus + 26, why, { anchor: "middle", kind: "elabel" });
    b += node(ox[i], oy, 160, 56, t, s, tone);
  });
  return svg({ title: "Silica in one line: bond, trade, redeem, deliver, and every hour is verified", width: W, height: oy + 56 + 16, body: b });
}

export function quickstart() {
  const items = [
    ["Connect a wallet", "switch to Monad Testnet", "Set up"],
    ["Get test USDC", "from the faucet button", "Set up"],
    ["Read the curve", "marks for W42 – W47", "Trade"],
    ["Market-buy W42", "the live demo week", "Trade"],
    ["Redeem", "and decrypt access", "Deliver"],
    ["Hour confirmed", "via CRE, every 5 min", "Deliver"],
    ["Outage → slash", "1.5× paid to you", "Protection"],
  ];
  const c = chain({
    title: "A buyer's first ten minutes",
    perRow: 4,
    w: 170,
    h: 64,
    gx: 34,
    gy: 66,
    pad: 34,
    items: items.map(([t, s, sec], i) => ({ title: t, sub: s, tone: sec === "Protection" ? "bad" : sec === "Deliver" ? "good" : sec === "Trade" ? "monad" : "accent" })),
  });
  let b = c.body;
  items.forEach(([, , sec], i) => {
    const p = c.pos[i];
    b += badge(p.x + 2, p.y + 2, i + 1, sec === "Protection" ? "bad" : sec === "Deliver" ? "good" : "accent");
    b += txt(p.x + 18, p.y - 12, sec.toUpperCase(), { kind: "label" });
  });
  return svg({ title: "A buyer's first ten minutes, in seven steps", width: c.width, height: c.height, body: b });
}

export function buyerFlow() {
  return chain({
    title: "The buyer's path, from USDC to a delivered (or compensated) GPU-hour",
    perRow: 4,
    w: 168,
    gx: 34,
    items: [
      { title: "Get USDC", sub: "faucet · 1,000 an hour", tone: "accent" },
      { title: "Buy hours", sub: "on the series book", tone: "monad" },
      { title: "Hold or sell back", sub: "until the delivery week" },
      { title: "Redeem", sub: "whole hours, in the week", tone: "accent" },
      { title: "Sign once", sub: "your access key · no gas" },
      { title: "Access posted", sub: "sealed, within 30 min" },
      { title: "Use the GPU", sub: "decrypted in your browser", tone: "good" },
      { title: "Every hour verified", sub: "or 1.5× paid to you", tone: "cre" },
    ],
  }).svg();
}

export function providerFlow() {
  return chain({
    title: "The provider's path, from onboarding to releasing the bond",
    perRow: 3,
    w: 212,
    gx: 40,
    items: [
      { title: "KYB + service terms", sub: "offchain onboarding" },
      { title: "PROVIDER_ROLE granted", sub: "by the admin", mono: true, tone: "monad" },
      { title: "Install the node agent", sub: "register a node key: setNodeKey" },
      { title: "depositBond", sub: "per series", mono: true, tone: "monad" },
      { title: "mint hours", sub: "bond ≥ hours × mark × ratio", mono: true, tone: "accent" },
      { title: "Quote asks", sub: "or let a market maker sell them" },
      { title: "Serve redemptions", sub: "sealed access ≤ 30 min", tone: "service" },
      { title: "Verified every hour", sub: "via Chainlink CRE", tone: "cre" },
      { title: "releaseBond", sub: "after the delivery week", mono: true, tone: "good" },
    ],
  }).svg();
}

/* ---------------------------------------------------------------- operations */

export function hosting() {
  const W = 860;
  let b = "";
  b += node(W / 2 - 140, 16, 280, 56, "GitHub · SATISH-JALAN/silica", "push main · push main:envio", "plain");
  const X = [16, 316, 616], w = 228, y = 136, h = 92;
  b += node(X[0], y, w, h, "Envio Cloud", ["HyperIndex indexer", "GraphQL endpoint", "deploys from the envio branch"], "envio");
  b += node(X[1], y, w, h, "Render", ["silica-agent · silica-probe", "agent, probe, mm-bot, relay", "Blueprint: render.yaml"], "service");
  b += node(X[2], y, w, h, "Vercel", ["the web app + /docs", "root apps/web", "auto-deploys on push"], "accent");
  b += `<g class="dg-edge"><path d="M${W / 2},72 V96 M${X[0] + w / 2},96 H${X[2] + w / 2}"/></g>`;
  [0, 1, 2].forEach((i) => (b += edge([[X[i] + w / 2, 96], [X[i] + w / 2, y]])));
  b += txt(X[0] + w / 2 + 8, 122, "main:envio", { kind: "elabel" });
  b += txt(X[1] + w / 2 + 8, 122, "Blueprint sync", { kind: "elabel" });
  b += txt(X[2] + w / 2 + 8, 122, "every push", { kind: "elabel" });
  b += edge([[X[0] + w, y + 30], [X[1], y + 30]], { label: "GraphQL", at: [(X[0] + w + X[1]) / 2, y + 22], tone: "envio" });
  b += edge([[X[1] + w, y + 30], [X[2], y + 30]], { label: "service URLs", at: [(X[1] + w + X[2]) / 2, y + 22] });
  b += edge([[X[0] + w / 2, y + h], [X[0] + w / 2, y + h + 30], [X[2] + w / 2, y + h + 30], [X[2] + w / 2, y + h]], { label: "GraphQL URL for the app", at: [W / 2, y + h + 24], tone: "envio" });
  b += node(W / 2 - 200, y + h + 64, 400, 52, "Monad Testnet · chain 10143", "every service reads and writes over RPC", "monad");
  return svg({ title: "Where each part is hosted and what each needs from the others", width: W, height: y + h + 64 + 52 + 16, body: b });
}

export function testnetPipeline() {
  return chain({
    title: "Deploying to Monad Testnet, script by script",
    perRow: 4,
    w: 182,
    gx: 30,
    items: [
      { title: "Deploy.s.sol", sub: "contracts + roles", mono: true, tone: "monad" },
      { title: "Seed.s.sol", sub: "providers · bonds · marks", mono: true, tone: "monad" },
      { title: "DeployKuruFeeds.s.sol", sub: "5 USD mark feeds", mono: true, tone: "kuru" },
      { title: "gen-kuru.mjs", sub: "Kuru addresses JSON", mono: true },
      { title: "cre/gen-config.mjs", sub: "workflow configs", mono: true, tone: "cre" },
      { title: "indexer/gen-config.mjs", sub: "Envio config.yaml", mono: true, tone: "envio" },
      { title: "Verify on Sourcify", sub: "every contract", tone: "good" },
      { title: "Run CRE + services", sub: "relay · agent · probe · mm", tone: "service" },
    ],
  }).svg();
}

/* ---------------------------------------------------------------- reference */

export function proofOutcomes() {
  return split({
    title: "Delivery outcomes on Monad Testnet · 24 redeemed hours",
    parts: [
      { label: "Confirmed: both signers saw a healthy GPU", value: 15, tone: "good", text: "15 h" },
      { label: "Missed: slashed to buyers ($27.29 in total)", value: 9, tone: "bad", text: "9 h" },
    ],
  });
}

export function roadmap() {
  const cw = 214, g = 22, W = 16 * 2 + 4 * cw + 3 * g;
  const phases = [
    ["Now", "good", ["Contracts live on Monad Testnet", "Both CRE workflows proven", "Envio indexer on Envio Cloud", "App and docs on Vercel", "Kuru books requested"]],
    ["Phase 1 · months 1–2", "kuru", ["Kuru Spot V2 books live", "Pilot: 2–3 providers, 5 AI teams", "Real node agent (DCGM)", "CRE on a DON", "Kuru post-fill hooks"]],
    ["Phase 2 · months 2–4", "monad", ["Audit + legal sign-off", "Multisig + timelock", "Mainnet with real USDC bonds", "Four rolling weekly series", "Reputation pricing, 20–40 %"]],
    ["Phase 3 · months 4–9", "accent", ["A100 · H200 · B200", "US and EU regions", "Monthly series", "Independent probe network", "Bonded compute as collateral"]],
  ];
  let b = "";
  const lineY = 26;
  b += `<line x1="${16 + 12}" y1="${lineY}" x2="${W - 28}" y2="${lineY}" class="dg-axis-line"/>`;
  phases.forEach(([t, tone, rows], i) => {
    const x = 16 + i * (cw + g);
    b += `<circle cx="${x + 12}" cy="${lineY}" r="7" class="dg-dot-${tone === "kuru" || tone === "monad" ? "cre" : tone}"/>`;
    b += card(x, 48, cw, t, rows, tone, { mono: false, rowH: 22 });
  });
  return svg({ title: "Roadmap beyond Metropolis", width: W, height: 48 + cardHeight(5, 22) + 16, body: b });
}
