# Silica: submission pack

Everything the Metropolis submission form and the sponsor bounties ask for, in one place. Fill the bracketed items after the testnet deploy and demo runs.

## One-liner

Silica turns GPU time into a commodity you can buy forward, trade and rely on: bond-backed, deliverable GPU-hour tokens on Monad, with every delivered hour verified by Chainlink CRE and a missed hour slashed straight to the holder.

## Links

- Live app: [Vercel URL]
- Repo: https://github.com/SATISH-JALAN/silica (MIT; shared with metropolis@hackathon.monad.xyz)
- Proof page: [Vercel URL]/status (contracts, CRE reports, sample transactions)
- Envio GraphQL: [Envio Cloud URL]
- Videos: technical demo [link] · pitch [link] · CRE [link] · Envio [link]

## Judge access (testnet only)

- **Wallet:** the judge wallet `0x71A64D0CEB4898f5a03AD4dcA658141e16EE9670` is funded with testnet MON, 3,000 test USDC and 20 H100·APAC·W42 hours. Share its private key in the private access notes field only, never in the repo. It is labelled testnet-only.
- **Setup:** import the key into a fresh browser profile's MetaMask, add Monad Testnet (chain 10143, `https://testnet-rpc.monad.xyz`), and open the app.
- **Self-serve:** any wallet can press "Get test USDC" on a trading screen (1,000 USDC per hour from the `MockUSDC` faucet).
- **Suggested path:**
  1. On `/markets/h100-apac-w42`, buy some hours.
  2. On `/tickets`, redeem them, click "Decrypt with wallet" when access is posted, and watch the hours verify.
  3. Press "Provider outage" to see the next hours slashed to you.
  4. Open `/status` for the onchain trail.

## Track 1 answer: why this, why Monad

- **The gap.** Every compute product (CME, ICE·Ornn, Kalshi, Injective) is cash-settled on an index; Silica delivers the compute.
- **Why Monad.** One provider with 64 GPUs writes 64 delivery verdicts an hour, over 10,000 a week, and each GPU, region and week is its own order book. That is only affordable at Monad's throughput and costs, and 400 ms blocks with 800 ms finality make the book feel like an exchange.

## Kuru · Bring New Assets & Markets

1. **New asset class.** Deliverable compute. Each token is one H100-80GB hour in a set region and week, redeemable for real GPU time and backed by a provider bond that pays holders on missed delivery. Unlike cash-settled compute futures on CME, ICE and Kalshi, it delivers the compute itself.
2. **Legal, operational and liquidity plan.** These are prepaid, physically delivered service contracts, issued only by KYB'd providers under standard terms, and testnet-only until counsel review. Liquidity starts narrow: one GPU, one region, four weekly series, seeded by provider asks and Kuru passive bands, then a partner market maker.
3. **Roadmap.** Pilot with 2–3 real providers and 5 AI startups on testnet. Then an audit and legal sign-off. Then mainnet with four weekly series. Then more GPUs, regions and lending integrations that accept bonded compute tokens as collateral.

**Integration status.** Kuru Spot V2 market creation and the token whitelist are admin-only (`deploySpotMarket` / `whitelistSpotToken` revert for outside callers), so we did everything up to that call and requested the listing on 13 Oct 2026 in Kuru's Discord ([screenshot of the request]):

- **Price feeds:** a USD feed per series, deployed and verified, in the read interface of Kuru's own testnet feeds (`fetchPrice()` / `priceUsd18()` in USD with 18 decimals, `observedAt()`, `maxPriceAge() = 300`). It serves the mark that Chainlink CRE writes onchain (`contracts/src/kuru/SilicaMarkFeed.sol`).
- **Exact listing:** market parameters modelled on Kuru's xStock books, plus the book addresses Kuru's `SpotRouter.computeAddress` predicts for them. The same call reproduces Kuru's live MON/USDC book address, so the predictions are exact ([`docs/kuru-listing.md`](kuru-listing.md)).
- **Wired to switch on by itself:** each component watches `SpotRouter.verifiedSpotMarket(book)`. Once Kuru verifies a book, the market maker deposits into AccountCore and quotes a post-only ladder on it through Kuru's SDK, the CRE Mark & Margin workflow takes the mid from it, and the app shows the Kuru book next to SilicaBook. Until then `SilicaBook` is the live venue, and `/status` shows each book as "listing requested".

## Chainlink CRE · Best workflow

Silica uses two CRE workflows as its settlement layer:

- **Delivery Verifier** reads open tickets from `RedemptionManager`, fetches the provider node's and an independent buyer probe's EIP-712 signed hour summaries over HTTP under identical consensus, and writes one report to `DeliveryOracle` on Monad. The contract recovers both signatures and re-derives each verdict: both ≥ 11/12 confirm, a probe-seen outage slashes the bond to the holder, and disagreement is held as disputed.
- **Mark & Margin** reads every series' best bid and ask from the order book and each provider's delivery record from Envio's GraphQL API, then writes mark prices, reputation-based bond ratios and margin checks. Under-bonded providers are margin-called and cannot mint.

Without CRE the market cannot settle. The workflows run with `cre workflow simulate --broadcast` against Monad Testnet. The simulator writes through Chainlink's `MockKeystoneForwarder` into our `ReceiverTemplate` consumer, and the resulting transactions are listed on `/status`, each marked as CRE or relay. Both workflows stay within CRE's production limits: 15 chain reads per run, batched through Multicall3. Deploy access is [requested / granted].

**Video shot list (2 min):**
1. Show `cre/delivery-verifier/main.ts` and the 11-of-12 rule in `DeliveryOracle._derive`.
2. Run the simulation on a delivering ticket: the logs print provider and probe check counts, and a confirmed hour lands onchain.
3. Press "Provider outage" in the app, run the simulation again: missed hours, and the slash lands in the buyer's balance.
4. Run Mark & Margin: Envio reliability is read, then a ratio or margin call follows.

## Envio · Best use

Envio HyperIndex indexes every Silica contract on Monad Testnet into derived entities:

- provider reliability, bond and margin calls;
- per-series 1-hour candles and forward-curve points;
- book levels and trades;
- tickets with per-hour verdicts;
- CRE reports.

That data drives core features. The CRE Mark & Margin workflow reads provider reliability from Envio to set each provider's bond ratio, and the app's charts, forward curve, provider risk panel, ticket timelines and `/status` read from the same endpoint.

**Video shot list (optional, 2 min):**
1. A slash happens.
2. In the GraphQL playground, `Provider.reliabilityBps` drops.
3. The next Mark & Margin run keeps or raises that provider's ratio.

## Technical demo shot list (3 min, live product, no slides)

1. `/markets`: the forward curve from live marks, and series cards (0:00–0:20).
2. `/markets/h100-apac-w42`: the book (market-maker quotes and provider asks), a market buy, and a fill confirmed in about 1 s (0:20–0:50).
3. `/provider` with a provider wallet: bond, mint headroom and the mint rule; a margin-call row (0:50–1:20).
4. `/tickets`: redeem, the access sealed to your key arrives, decrypt in the browser (1:20–1:50).
5. The hours confirm on the timeline. Press "Provider outage": the next hours turn red and the slash is paid (1:50–2:30).
6. `/status`: contract addresses, CRE reports and explorer links for the mint, trade, redeem, confirm and slash transactions (2:30–3:00).

## Pitch (2 min): you, the problem, why you

AI teams can't lock next month's GPU price, and providers can't pre-sell idle capacity with confidence, because there's no deliverable, guaranteed forward market. Exchanges are listing compute futures, but all of them settle in cash. Silica delivers the compute and backs it with the provider's money, settled on Monad and verified by Chainlink CRE.

## Checklist

- [ ] Public GitHub repo, MIT, shared with metropolis@hackathon.monad.xyz
- [ ] README: description, architecture, setup, attributions, AI disclosure, addresses and transaction hashes
- [ ] Live link, access notes and a funded judge wallet
- [ ] 3-minute technical demo, 2-minute pitch
- [ ] Logo PNG under 3 MB (`art-style/Silica Futuristic Planet Emblem.png`)
- [ ] Kuru answers plus the listing request
- [ ] CRE answer plus the simulation video
- [ ] Envio answer (plus optional video)
- [ ] Community team selected, if eligible
