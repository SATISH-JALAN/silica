# Silica — Project Documentation

Oct 12, 2026 · @Satish

## Overview

Silica is an onchain market for **deliverable GPU compute** on Monad. A GPU provider sells standardized contracts, such as "one H100-hour in the APAC region, delivered in week 44", and must lock a cash bond to do it. Buyers trade these contracts on a live order book, redeem them for real GPU time, and are paid from the provider's bond if delivery fails.

In one line: **Silica turns GPU time into a commodity you can buy forward, trade, and rely on.**

This document explains the problem, how the product works, its contracts and parameters, who uses it, its risks, and the plan to build and submit it for Monad's Metropolis hackathon (Track 1, Onchain Finance & Trading).

## The problem

GPU compute is one of the world's most important inputs, yet it has no open market where you can buy it ahead of time with a guarantee.

- **Prices are opaque.** Most GPU capacity is sold through private, bilateral deals. There is no public spot price and no forward price to plan around.
- **Nobody can hedge.** An AI startup cannot lock today's price for next month's training run. A provider cannot pre-sell idle capacity with confidence.
- **Lenders charge more.** The Metropolis track brief notes that companies using compute as loan collateral pay a premium above 5%, because lenders cannot value or hedge the risk.
- **Delivery is trust-based.** When you prepay for GPU time, you trust the provider to deliver. If it doesn't, your only recourse is a dispute or a lawsuit.

### What exists today, and the gap

Traditional exchanges are moving in. [CME](https://investor.cmegroup.com/node/55686) planned H100 and B200 rental-index futures for October 5, 2026, pending regulatory review. [ICE and Ornn](https://finance.yahoo.com/markets/options/articles/ice-ornn-launch-gpu-compute-142609556.html) announced GPU compute futures, and [Kalshi](https://www.marketsmedia.com/?p=156559) launched compute forward curves in July 2026. Onchain, [Injective](https://injective.com/blog/injective-releases-the-first-ever-onchain-nvidia-gpu-market) lists a market on the hourly H100 rental price.

All of these are **cash-settled on a price index**. They let you bet on or hedge the *price* of compute, but nobody delivers you any compute. Silica fills that gap: a contract you can redeem for actual GPU time, backed by the provider's money.

## The solution and core concepts

Silica combines three things that today live in separate places: a standardized compute contract, a performance bond that backs it, and an order book where it trades.

- **Standardized:** every contract in a series is identical, so they are interchangeable and can be priced on one order book.
- **Bonded:** a provider can only sell as much as its locked bond supports. Failure to deliver costs the provider real money.
- **Deliverable:** holding the token gives you the right to claim real GPU time during its delivery week.
- **Verified:** delivery is checked hour by hour by an independent workflow, and the result is written onchain.

### Glossary

| Term | Meaning |
| --- | --- |
| Series | One standardized product, defined by GPU model, region and delivery week. Example: `H100·APAC·W44`. |
| Contract token | An ERC-20 token for a series. One token = one GPU-hour. |
| Provider | A company with GPUs (a data center or small cloud) that mints and sells contracts. |
| Holder | Whoever owns contract tokens: a buyer, a trader or a market maker. |
| Performance bond | Stablecoin collateral the provider locks before minting. It pays holders if delivery fails. |
| Delivery window | The week in which tokens of a series can be redeemed for GPU time. |
| Redemption ticket | An onchain record created when a holder burns tokens to request GPU time. |
| Heartbeat | A signed, periodic status report from the provider's machine proving the GPU is running for the holder. |
| Slash | Taking money from the provider's bond and paying it to the holder after a missed delivery. |
| Forward curve | The prices of the same GPU across several future delivery weeks, read off the order books. |

## Contract lifecycle

A contract moves from bond to mint to trade to redemption; every redeemed hour then ends either confirmed or slashed.

&#91;embedded content: contract lifecycle · 8 steps, 1 decision\]

The heartbeat check repeats for every redeemed hour. The provider's remaining bond is released only after the delivery week closes and every ticket is settled.

## System architecture

All money and rules live in contracts on Monad; offchain parts only report delivery and index data.

&#91;embedded content: system architecture · onchain contracts and offchain services\]

The web app sends trades and redemptions to Monad. The provider's node sends heartbeats to the Chainlink CRE workflow, which writes delivery verdicts through `DeliveryOracle`. Envio indexes contract events to feed the app's charts and each provider's reputation.

## Smart contracts

Five Solidity contracts on Monad testnet hold all the rules; the order book is Kuru's (or a minimal Silica order book if a Kuru listing isn't available in time).

| Contract | Responsibility | Key functions | Key events |
| --- | --- | --- | --- |
| `SeriesRegistry` | Creates and stores each series: GPU model, region, delivery week, bond ratio, slash multiple | `createSeries(spec)`, `getSeries(id)` | `SeriesCreated` |
| `SilicaToken` | One ERC-20 per series; only the protocol can mint or burn | `mint(to, amt)`, `burn(from, amt)` | `Transfer` |
| `BondVault` | Holds each provider's stablecoin bond and enforces how many hours it may mint | `depositBond(series, amt)`, `mintAgainstBond(series, hours)`, `releaseBond(series)`, setMark(series, price) | `BondDeposited`, `Minted`, `BondReleased`, MarginCall |
| `RedemptionManager` | Burns tokens into redemption tickets and tracks each ticket from request to delivered or slashed | `redeem(series, hours, pubKey)`, `postAccess(ticket, encryptedCreds)`, `confirmHour(ticket)`, `slash(ticket, hours)` | `Redeemed`, `AccessPosted`, `HourConfirmed`, `Slashed` |
| `DeliveryOracle` | Accepts delivery and mark-price reports only from the authorized Chainlink CRE forwarder and routes marks to BondVault and verdicts to `RedemptionManager` | `onReport(report)` | `ReportReceived` |

**Order book.** Each series is a market quoted in a testnet stablecoin (USDC or AUSD). Kuru's Spot V2 order book on Monad gives limit orders, price-time priority and passive liquidity. The fallback is a small onchain limit-order book with the same matching rules. Kuru market creation is permissioned, so each Silica market must be deployed by the Kuru team on request.

## How delivery and bonds are verified

Silica never trusts a single source: two Chainlink CRE workflows check delivery and bond coverage under CRE's node consensus, then write the results onchain. CRE supports Monad Testnet from CLI v1.30.0 and TS SDK v1.19.0 ([CRE supported networks](https://docs.chain.link/cre/supported-networks-ts)).

| Workflow | Trigger | Reads offchain | Reads onchain | Writes onchain |
| --- | --- | --- | --- | --- |
| Delivery Verifier | Cron, every 5 minutes | Provider's signed heartbeat API (GPU ID, model, utilization) and a probe of the buyer's machine | Open tickets in `RedemptionManager` | Hourly verdict per ticket via `DeliveryOracle` → `confirmHour` or `slash` |
| Mark & Margin | Cron, hourly | Kuru market data API (best bid and offer per series) and Envio GraphQL (each provider's delivered and missed hours) | Bonds and unredeemed supply in `BondVault` | Mark price and bond ratio via `setMark`; under-bonded providers get a `MarginCall` and cannot mint |

**Delivery rules**

- **Both sources up** for at least 11 of 12 checks → hour confirmed.
- **Both sources down** → hour missed and slashed.
- **Sources disagree** → hour marked disputed: neither paid nor slashed until reviewed. This stops a provider faking uptime and stops a buyer faking an outage to claim the bond.

**Bond rules (proposed)**

- Required bond = unredeemed hours × mark price × bond ratio.
- Bond ratio starts at 30% and drops to 20% after 1,000 confirmed hours at 99% or better delivery, read from Envio.
- If the mark rises and the bond falls short, the provider gets a margin call and cannot mint until it tops up.

## Contract terms and parameters

Every series is defined by the same fields; the values below are proposed defaults for the hackathon build and can be tuned per series.

| Field | Proposed default | Why it matters |
| --- | --- | --- |
| Unit | 1 GPU-hour | One token = one hour of one GPU |
| GPU spec | NVIDIA H100 80GB | Standard spec makes tokens interchangeable |
| Region | APAC (also EU, US) | Latency and data rules differ by region |
| Delivery window | ISO week N, Monday 00:00 to Sunday 23:59 UTC | Fixes when tokens can be redeemed |
| Quote currency | Testnet USDC or AUSD | Stable unit for prices and bonds |
| Price tick | 0.01 per GPU-hour | Smallest price step on the order book |
| Bond ratio | 30% of notional | Each minted hour needs 30% of its price locked |
| Bond reference price | Hourly mark: Kuru order-book mid-price, posted onchain by Chainlink CRE | A rising price triggers a margin call and blocks new minting until topped up |
| Access deadline | 30 minutes after redemption | Provider must post access credentials in time |
| Heartbeat interval | Every 5 minutes | How often the provider node reports |
| Hour counted as delivered | At least 11 of 12 heartbeats in that hour | Tolerates one missed report |
| Slash payout | 1.5 × reference price per missed hour | Holder is compensated, not just refunded |
| Bond release | After the window closes and all tickets settle | Provider gets back what wasn't slashed |

## Worked example

A provider sells 1,000 H100-hours forward, a buyer redeems 100, the provider misses 10, and the buyer receives $30.75 from the bond. Names are illustrative.

1. **Mint.** A small GPU cloud, "NeoGPU", wants to pre-sell idle capacity for week 44. The reference price is $2.00 per hour, so 1,000 hours is $2,000 of notional. At a 30% bond ratio it locks **$600** in `BondVault` and mints 1,000 `H100·APAC·W44` tokens.
2. **Trade.** NeoGPU posts the tokens as sell orders. An AI startup buys **100 tokens at $2.05**, paying $205. A market maker buys and sells the rest, keeping the book tight.
3. **Redeem.** In week 44 the startup burns its 100 tokens. `RedemptionManager` opens a ticket and records the startup's public key.
4. **Deliver.** NeoGPU posts SSH access encrypted to that key within 30 minutes. Its node sends a signed heartbeat every 5 minutes, and the Chainlink CRE workflow confirms each hour onchain.
5. **Miss.** The node goes down for 10 of the 100 hours. Those hours fail the 11-of-12 heartbeat rule.
6. **Slash.** The slash is 10 hours × 1.5 × $2.05 = **$30.75**, paid from NeoGPU's bond straight to the startup.
7. **Release.** After week 44 closes, NeoGPU gets back $600 − $30.75 = **$569.25**.

The startup received 90 hours of compute plus $30.75 for the missed 10. It never had to chase a refund or trust a promise.

## Who uses it

Two sides need each other: providers with idle GPUs and buyers who need guaranteed compute at a known price. Market makers connect them; lenders come later.

| User | Who exactly | What they want | What Silica gives them |
| --- | --- | --- | --- |
| Provider (first user) | Small neoclouds and GPU resellers with spare capacity | Sell future capacity now, smooth revenue | Pre-sell any week, get paid upfront, prove reliability onchain |
| Buyer (first user) | Seed-stage AI startups renting 8 to 64 H100s for training and inference | Lock compute cost and availability ahead of a run | A fixed price today for a guaranteed week, with automatic compensation |
| Market maker | Trading firms quoting both sides | A new market with spread to earn | A standardized asset on a fast order book |
| Lender (later) | Onchain credit protocols | Collateral they can value and liquidate | Bonded, priced, liquid compute tokens |

**Why this market doesn't exist yet:** compute isn't standardized, delivery can't be verified without trust, and bilateral settlement is too slow and costly for hourly units. Silica fixes all three with series specs, heartbeat verification and sub-second onchain settlement.

## Why Monad

Silica writes a delivery record for every GPU-hour and runs a live order book per series; only a fast, cheap chain makes both affordable.

- **Hourly attestations at scale.** One provider with 64 GPUs produces 64 delivery confirmations every hour, over 10,000 a week. That volume is impractical where each transaction is slow or expensive.
- **Order books that feel like an exchange.** The Metropolis brief cites 400ms blocks and 800ms finality. Fills land almost instantly, so traders see a real order book, not "pending" states.
- **Many series in parallel.** Each GPU model, region and week is its own market. Monad's throughput lets dozens of books run side by side.
- **Ecosystem fit.** Kuru provides an onchain order book on Monad, Envio indexes Monad data, and Chainlink CRE can write reports to it, so Silica assembles from existing parts instead of rebuilding them.

## Legal, liquidity and market formation

The hackathon build runs on testnet only; this is the plan for bringing the asset onchain properly afterwards. It is a working plan, not legal advice, and needs review by counsel.

### Legal and operational

- **What the token is.** A prepaid, physically-delivered service contract: the right to one hour of GPU time. It is not a share, a profit claim or a cash-settled derivative on an index.
- **Who may issue.** Only providers that pass KYB (business verification) and sign standard service terms with Silica.
- **Who may hold.** Open to start; add allowlists per jurisdiction if counsel advises that forwards need eligible-participant rules.
- **Disputes.** Heartbeat data decides by default. Edge cases go to a short, documented dispute process before any slash is final.
- **Testnet now.** No real money, no mainnet tokens and no offering during the hackathon.

### Liquidity and first markets

1. **Start narrow.** List H100 in one region for the next four delivery weeks, so liquidity is concentrated, not spread thin.
2. **Seed with providers.** Two or three providers post sell orders across those weeks. Their offers are the first real supply.
3. **Market maker support.** Use Kuru's passive liquidity bands plus a partner market maker to keep spreads tight.
4. **Bring buyers.** Reach AI startups through accelerator and builder communities with a simple pitch: lock next month's GPU price today.
5. **Expand.** Add H200 and B200, more regions and longer weeks once the first books trade daily.

## Risks and limitations

The biggest open risk is trusting the provider's own heartbeat; the table lists each risk with how Silica handles it now and later.

| Risk | What could go wrong | Mitigation |
| --- | --- | --- |
| Fake heartbeats | A provider's node reports "running" when the buyer gets nothing | Two independent sources must agree, checked under CRE node consensus: the provider's signed heartbeat and a probe of the buyer's machine. Buyers can also flag a ticket; hardware attestation later |
| Bond too small | A provider misses more hours than its bond covers (a 30% bond covers about 200 fully missed hours of 1,000) | Higher bond ratio for new providers; hourly mark-to-market margin calls; reputation lowers the ratio only after a delivery record |
| Thin liquidity | Few traders, wide spreads, hard to exit | Start with one GPU and region; seeded supply; market-maker support |
| Oracle downtime | CRE workflow fails to report | Hours aren't slashed while the oracle itself is down; a grace period, then manual review |
| Regulation | Forwards on a service could be treated as regulated derivatives in some places | Physically-delivered design, KYB'd issuers, counsel review before mainnet |
| Spec mismatch | Delivered GPU isn't the promised model or performance | Spec checks in the heartbeat (GPU model, memory); slash on mismatch |
| Hackathon simulation | Judges may assume real GPUs and real volume | README states clearly: provider node simulated, liquidity simulated on testnet |

## Roadmap after the hackathon

Four phases take Silica from a testnet demo to a live market; each phase starts only when the previous one meets its gate.

1. **Pilot (testnet).** Onboard 2 or 3 real providers and 5 AI startups to trade and redeem test contracts. *Gate:* real GPU hours delivered and verified end to end.
2. **Hardening.** Security audit, buyer-side delivery checks, dispute process, counsel review of the legal structure. *Gate:* audit passed and legal sign-off.
3. **Mainnet launch.** One GPU model, one region, four weekly series, seeded by providers and a market maker. *Gate:* steady daily volume and no unresolved disputes.
4. **Expansion.** More GPU models and regions, longer-dated series, and lending integrations that accept bonded compute tokens as collateral.

## 37-hour build plan

The build runs from Monday evening to a final submission around 07:30 IST Wednesday, two hours before the 09:29 deadline. Times are IST.

| When | Work | Done when |
| --- | --- | --- |
| Mon 20:30 to 02:00 | Write and deploy `SeriesRegistry`, `SilicaToken`, `BondVault`, `RedemptionManager`; message Kuru about a testnet listing | Contracts live on testnet, addresses in README |
| Tue 08:00 to 14:00 | Kuru market per series, or the fallback order book; provider node agent sending signed heartbeats | A trade fills on testnet; heartbeats reach an endpoint |
| Tue 14:00 to 22:00 | Chainlink CRE workflow (CLI simulation) and `DeliveryOracle`; trading UI with order book, forward curve, bond and risk panel | Redeem, confirm and slash work end to end |
| Tue 22:00 to Wed 04:00 | Envio indexer; market-maker bot quoting while separate test wallets take trades; full README; draft submission | Draft submitted with all required links |
| Wed 04:00 to 07:30 | 3-minute demo (mint, trade, redeem, missed heartbeat, slash payout) and 2-minute pitch; logo; final submit | Final version submitted |

**If Kuru doesn't list in time** (no reply by Tuesday noon), ship the fallback order book; only the Kuru bounty is lost.

## Hackathon track choice

Enter **Track 1 (Onchain Finance & Trading)** with **idea 08 (Compute Spot Exchange) merged with idea 11 (SLA Insurance & Performance Bonds)**, built as **Silica**: deliverable GPU-hour forwards on Monad.

Each token is one standardized contract, such as `H100·APAC·W44` (one H100-hour delivered in week 44). Providers mint only against a locked performance bond. Contracts trade on a live onchain order book. Holders redeem for real GPU time, and a missed delivery slashes the bond to the holder.

## How crowded the listed ideas will be

Compute is the thinnest lane that still matches what the organizers asked for. Crowd levels below are a judgment, not measured data.

| Crowd level | Listed ideas | Why |
| --- | --- | --- |
| Packed | T2 #01 social payments; T2 #02/#03 commitment and accountability pools; T3 #03 attention futures; T3 #06 TCG order book; T4 #01 passkey proof of personhood; T4 #04 AI memory; T1 #04/#05 trading interfaces | Easy to build in a weekend, demo well, suit vibe-coding |
| Medium | T1 #01 launchpads; T1 #02 exotic options; T2 #06 salary streaming; T4 #03/#06 data lockers and credentials | Already built elsewhere many times |
| Thin | **T1 #08 to #11 compute**; T1 #03 yield stripping; T1 #12 tokenized equities | Hard to build; needs domain understanding |

Why compute over the other thin ideas:

- **Yield stripping** risks the "faster clone of an existing DeFi product" penalty, because Pendle exists.
- **Tokenized equities (#12)** must be "not already common onchain" and carry heavy legal baggage.
- **Compute** gets a full paragraph in the track brief. The judge panel includes Auros (a market maker), Paradigm, Galaxy, Pantera and Electric Capital, who will read a new commodity market instantly.

## Making it ours: five upgrades

The track lists compute trading and SLA bonds as separate one-liners; these five changes turn them into one product.

1. **Physical delivery plus a bond in one contract.** Every token is backed by money the provider loses if it fails to deliver.
2. **Hourly proof of delivery onchain.** Each GPU-hour delivered is a small onchain attestation, affordable only on Monad. This answers the "why Monad" judging question directly.
3. **Bonds that shrink with reputation.** Envio indexes each provider's delivered-hours history, and reliable providers post smaller bonds. This mirrors the Metropolis site's own "onchain credit history" example.
4. **A live forward curve.** Order books for W44 through W48 together form a public compute price curve, answering the track's "no real spot markets" problem.
5. **A roadmap hook.** Bonded, deliverable compute tokens become collateral lenders can underwrite, addressing the track's ">5% premium" pain point.

## Bounty strategy

Silica targets three bounties, and each one does real work in the product, so none is bolted on. Sponsor bounties are scored on adherence to their own requirements (40%), technical implementation (30%), Monad integration (20%) and innovation (10%), so every requirement below maps to something we build, show and submit.

| Bounty | Prize (USD) | Role in Silica | Biggest risk and fix |
| --- | --- | --- | --- |
| Kuru: Bring New Assets & Markets | 5,000 | The order book every Silica series trades on | Market creation is permissioned: request listings tonight |
| Chainlink CRE | 3,000 | The engine that confirms delivery, slashes, marks prices and issues margin calls | Monad Testnet needs CLI v1.30.0+: check `cre workflow supported-chains` first |
| Envio | 1,000 | Provider reputation that sets bond ratios, plus the forward curve | Low: keep the schema deep, not a single-event indexer |
| Best Community Team | 5,000 | No extra build; eligibility only | Check your campus group is in the profile's community dropdown |

### Kuru: Bring New Assets and Markets

Kuru wants a new asset class with real issuance, redemption, legal and liquidity plans, not just a trading screen. Silica answers each criterion directly.

| Kuru criterion | What Silica delivers | Where judges see it |
| --- | --- | --- |
| Clear asset class and customer | Deliverable GPU-hour forwards; sellers are small neoclouds, buyers are seed-stage AI startups | Pitch video, README |
| Evidence of demand | CME, ICE, Kalshi and Injective compute products, plus 5 to 10 replies from GPU renters and providers we contact, as screenshots | README "Demand" section |
| Credible issuance and redemption | Bond-gated minting, burn-to-redeem tickets, CRE-verified delivery and slashing | Demo: mint, redeem, slash |
| Legal and operational viability | Physically-delivered service contract, KYB'd issuers, testnet only, counsel review before mainnet | README "Legal" section |
| Liquidity and market formation | Four weekly series of one GPU in one region; provider-seeded asks; Kuru passive liquidity bands for opening depth | Demo: book with depth |
| More than a trading interface | Issuance, redemption, verification and margin all run onchain; the UI is the last layer | Architecture diagram |

**Stretch, Kuru-native depth:** Kuru's post-fill hooks let a maker contract refresh its quotes right after a fill. Silica can use one so a provider's ask refills only while its bond still covers more hours, which we'd call bond-aware quoting. It needs hook access from Kuru, so ask for it in the listing request.

**Listing request to send tonight (Kuru Discord):**

> Hi Kuru team, we're building Silica for Metropolis (Bring New Assets bounty): deliverable GPU-hour forwards on Monad, with bond-backed issuance and CRE-verified delivery. Since market creation is permissioned, could you deploy testnet spot markets for our series tokens against your testnet USDC? Series: SIL·H100·APAC·W44 to W47. Contracts are deployed and we can share addresses now. Could we also get post-fill hook access for bond-aware quoting?

**Answers to have ready at submission:**

1. *New asset class:* deliverable compute. Each token is one H100-hour in a set region and week, redeemable for real GPU time and backed by a provider bond that pays holders on missed delivery. Unlike cash-settled compute futures on CME, ICE and Kalshi, it delivers the compute itself.
2. *Legal, operational and liquidity plan:* prepaid physically-delivered service contracts issued only by KYB'd providers under standard terms; testnet only until counsel review. Liquidity starts narrow: one GPU, one region, four weekly series, seeded by providers and Kuru passive bands, then a partner market maker.
3. *Roadmap:* pilot with 2 or 3 real providers and 5 AI startups on testnet; audit and legal sign-off; mainnet with four weekly series; then more GPUs, regions and lending integrations.

### Chainlink CRE: Best workflow

CRE is Silica's settlement engine: remove it and no hour can be confirmed, no bond slashed and no margin call issued. That is exactly the "orchestration layer" the bounty asks for.

| CRE requirement | What Silica delivers |
| --- | --- |
| Connect a blockchain with external APIs or data | Four offchain sources (provider heartbeat API, buyer-side probe, Kuru market data API, Envio GraphQL) feeding Monad Testnet |
| Successful CLI simulation or live deployment | `cre workflow simulate` for both workflows, shown alongside the Monad Testnet transactions they produce |
| Meaningful use as orchestration | Delivery Verifier decides every confirm or slash; Mark & Margin sets every bond requirement |

**Why it scores well:** it uses CRE for what CRE is built for. Several independent nodes fetch untrusted offchain data, reach consensus, and trigger onchain consequences with money attached. Most entries will use CRE for a single price fetch.

**2-minute demo video:** the provider's heartbeat stops; the Delivery Verifier simulation runs and outputs a slash verdict; the slash appears on Monad Testnet and the buyer's balance rises. Then one Mark & Margin run issuing a margin call.

**Answer to have ready:** *Silica uses two CRE workflows as its settlement layer. The Delivery Verifier reads the provider's signed heartbeat and an independent probe of the buyer's machine every 5 minutes, reaches consensus, and writes an hourly confirm, slash or dispute verdict to our DeliveryOracle on Monad. Mark & Margin reads Kuru's order book and Envio's provider history hourly, then writes mark prices and bond ratios that trigger margin calls. Without CRE, the market cannot settle.*

### Envio: Best use

Envio's data drives a protocol rule, not just a chart: each provider's delivery record, indexed by Envio, sets how much bond it must post.

| Envio criterion | What Silica delivers |
| --- | --- |
| Depth of use | HyperIndex over all five Silica contracts (plus Kuru trade events if indexable), with derived entities instead of raw event logs |
| Data driving a core feature | Provider reliability score sets the bond ratio via CRE; also feeds the forward curve and provider leaderboard |
| Working product | Live GraphQL endpoint on Envio Cloud, consumed by the web app and the CRE workflow |
| Craft | Public `config.yaml`, `schema.graphql` and handlers in the repo |

**Schema (derived entities):**

- `Provider`: bond locked, hours minted, hours delivered, hours missed, reliability score, current bond ratio
- `Series`: GPU, region, week, open interest, last mark
- `Ticket`: hours redeemed, confirmed, slashed, disputed, status
- `Candle`: hourly open, high, low, close and volume per series
- `ForwardPoint`: latest price per series, which the app joins into the forward curve
- `MarginCall`: provider, series, shortfall, resolved or not

**2-minute demo video:** a trade, redemption and slash happen onchain; the provider's reliability score drops in the Envio GraphQL playground; the next Mark & Margin run raises that provider's bond ratio.

**Answer to have ready:** *Envio HyperIndex indexes every Silica contract on Monad Testnet into derived entities: provider reliability, per-series candles, forward-curve points and margin calls. That data drives core features: the CRE Mark & Margin workflow reads provider reliability from Envio to set each provider's bond ratio, and the app's forward curve and provider leaderboard read from the same endpoint.*

### Per-bounty submission checklist

- [ ] Kuru: three written answers above; markets live on Kuru testnet (or the request message and Kuru's reply, if not)
- [ ] Chainlink CRE: written answer; 2-minute video of a CLI simulation writing to Monad Testnet
- [ ] Envio: written answer; repo shows `config.yaml`, `schema.graphql`, handlers; optional 2-minute video (record it)
- [ ] Community Team: campus group selected on your profile, if eligible

## Disqualification risks

Four rules in the Terms could sink this project; each has a simple fix.

| Rule | Risk | Fix |
| --- | --- | --- |
| No wash trading (§8.2, §10.4) | Market-maker bots look like fake volume | Bots only quote; separate test wallets take trades. Label it "testnet simulated liquidity" in the README, never organic volume. |
| No misleading info (§10.1) | Judges assume a real GPU provider | State plainly that the provider node is simulated with a heartbeat agent. |
| No secrets in submission (§5.3) | Private keys or CRE secrets leak into the repo | Keep them in `.env` and gitignore it. |
| Token legal treatment (§9.3) | Compute tokens read as unvetted financial products | README section: physically-delivered service forwards, testnet only, KYB'd-provider issuance plan. This also covers Kuru's "legal plan" requirement. |

## Submission checklist

Deadline is Oct 14, 2026 09:29 IST (Oct 13, 11:59 PM ET). Submit a draft Tuesday night; edits stay allowed until the deadline.

- [ ] One project, one track (Track 1)
- [ ] Public GitHub repo, MIT license, shared with metropolis@hackathon.monad.xyz
- [ ] Commit history inside the build window: fresh repo tonight, commit often
- [ ] README: description, architecture, tech stack, setup steps a third party can run
- [ ] README: attribution for external code (Kuru SDK, OpenZeppelin, CRE templates) and AI tool disclosure
- [ ] README: contract addresses and transaction hashes
- [ ] Deployed on Monad testnet with live link, access instructions and a funded test wallet for judges
- [ ] Technical demo, 3 minutes max, live product and Monad transactions, no slides
- [ ] Pitch video, 2 minutes max: you, the problem, why you
- [ ] Logo as PNG under 3MB
- [ ] Bounty answers: Kuru (asset class, legal plan, roadmap) and CRE simulation video

## Sources

- [CME Group and Silicon Data to launch compute futures](https://investor.cmegroup.com/node/55686)
- [ICE and Ornn to launch GPU compute futures](https://finance.yahoo.com/markets/options/articles/ice-ornn-launch-gpu-compute-142609556.html)
- [Kalshi offers compute forward curves](https://www.marketsmedia.com/?p=156559)
- [Injective's onchain NVIDIA H100 GPU market](https://injective.com/blog/injective-releases-the-first-ever-onchain-nvidia-gpu-market)
- [Kuru testnet documentation](https://kuru-testnet-docs.mintlify.site/)
- [Kuru SpotRouter: market creation is permissioned](https://kuru-testnet-docs.mintlify.site/contracts/spot-router.md)
- [Kuru post-fill hooks](https://kuru-testnet-docs.mintlify.site/matching-engine/post-fill-hooks.md)
- [Chainlink CRE supported networks (Monad Testnet)](https://docs.chain.link/cre/supported-networks-ts)
- Metropolis track brief, bounty pages, prize page and Terms & Conditions (as provided)
