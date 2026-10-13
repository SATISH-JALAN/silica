# Glossary

| Term | Meaning |
| --- | --- |
| **AccountCore** | Kuru's account contract, where traders deposit balances for its order books |
| **Arbiter** | the holder of `ARBITER_ROLE`, who resolves disputed hours |
| **Bond** | USDC a provider locks per series; it pays holders for missed hours |
| **Bond ratio** | the share of notional the bond must cover: 20%, 30% or 40% |
| **Buyer probe** | the independent witness that checks the delivered host and signs its own hour summary |
| **CRE** | Chainlink Runtime Environment: decentralized workflows that fetch data under consensus and write signed reports |
| **Delivery hour** | one hour of GPU time on a ticket; 5 minutes on the testnet demo series |
| **Delivery week / window** | the ISO week (Monday 00:00 → Sunday 23:59:59 UTC) in which a series can be redeemed |
| **Delivery Verifier** | the CRE workflow that turns signed hour summaries into verdicts |
| **Disputed** | an hour where the witnesses disagree; held until resolved |
| **EIP-712** | the typed-data signing standard used for hour summaries |
| **Envio HyperIndex** | the indexer that turns Silica's events into GraphQL entities |
| **Forward curve** | the marks of successive weekly series, plotted by delivery week |
| **Forwarder** | the Chainlink contract that delivers CRE reports to a consumer (`MockKeystoneForwarder` in simulation) |
| **HourSummary** | `(ticketId, hour, okChecks, gpuIdHash)`, signed by each witness for each hour |
| **HyperSync** | Envio's fast data source for historical and live chain data |
| **Margin call** | a flag set when a provider's bond falls below its requirement; blocks minting |
| **Mark** | a series' reference price, written by CRE from the book mid |
| **Mark & Margin** | the CRE workflow that writes marks, bond ratios and margin checks |
| **Missed** | an hour the probe saw fail and the provider can't refute; slashed to the holder at 1.5× |
| **Node key** | the key a provider's node signs hour summaries with (`setNodeKey`) |
| **priceAtOpen** | the mark when a ticket opened; fixes the slash value |
| **Reliability** | `confirmed / (confirmed + missed)` for a provider, from Envio |
| **ReceiverTemplate** | the Chainlink base contract a CRE consumer inherits |
| **Sealed box** | public-key encryption to a single recipient (libsodium `crypto_box_seal`) |
| **Series** | one standardized contract: GPU model × region × ISO week |
| **SilicaBook** | Silica's onchain price-time-priority order book |
| **Slash** | a transfer from the provider's bond to the holder for missed hours |
| **slashUnserved** | the function anyone can call when access isn't posted within 30 minutes |
| **Ticket** | one provider's share of a redemption, with its own delivery timeline |
| **Verdict** | the outcome of one delivery hour: confirmed, missed or disputed |
