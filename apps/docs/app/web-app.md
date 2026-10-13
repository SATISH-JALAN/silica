# The web app

`apps/web` · Next.js 16, wagmi + RainbowKit, TanStack Query, Envio GraphQL, TradingView lightweight-charts, GSAP. Live at **[silica-monard.vercel.app](https://silica-monard.vercel.app)**.

## Pages

| Route | What's there |
| --- | --- |
| `/` | the story of the product, with scroll animations and a live ticker of marks |
| `/markets` | the **forward curve** from live marks, and a card per series (mark, open interest, bond) |
| `/markets/[series]` | the trading screen: price chart and trade tape (Envio), **order book** (chain, with a Kuru venue once listed), **order form** (limit or market), **Bond & risk** panel with each provider's reliability |
| `/tickets` | **redeem**, your tickets with a per-hour timeline, **Decrypt with wallet**, and the **demo controls** (both up, provider outage, sources disagree) |
| `/provider` | bond, minted, mint headroom, bond ratio, reputation progress and margin status. Deposit, mint and node-key registration for a connected provider; a read-only view of NeoGPU for everyone else |
| `/status` | network details, every oracle report and its path, all contract addresses, Kuru listing status, sample transactions and the disclosures |

## Wallets

- **RainbowKit** connectors: MetaMask, Rabby, any injected wallet, and WalletConnect when a project id is configured.
- The app prompts to **switch to Monad Testnet** (chain 10143) when needed.
- Every write **estimates gas and pads it by 20%**, because Monad bills the full gas limit.
- On `localhost` only, a development burner wallet can be enabled with a test key, for scripted testing. It is never present in production builds.

## Live data

| Data | Source | Refresh |
| --- | --- | --- |
| Book depth, best bid/ask, balances, allowances, positions, oracle state | chain (wagmi multicall) | about 1.5 s |
| Trades, candles, tickets, verdicts, reliability, CRE reports | Envio GraphQL | about 2 s |
| New fills before Envio indexes them | `Trade` logs over the last ~90 blocks | 2 s |

Polling keeps running in background tabs, so a screen left open on a second monitor never freezes.

## The price chart

The live chart resamples the trade tape into even time buckets (1 min to 1 day, chosen by the span), carries the last price forward between fills, and draws a stepped price line with volume bars and the CRE mark as a dashed reference. The price axis never zooms below ±4%, so a one-tick move isn't a cliff.
