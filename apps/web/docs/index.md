---
layout: home
title: Silica Docs
hero:
  name: SILICA
  text: Real compute. Real possibilities.
  tagline: Deliverable, bond-backed GPU-hour forwards on Monad. Buy compute forward, trade it on an onchain book, and get paid from the provider's bond if an hour isn't delivered.
  image:
    src: /emblem.webp
    alt: The Silica emblem
  actions:
    - theme: brand
      text: Read the guide
      link: /guide/introduction
    - theme: alt
      text: Open the live app
      link: https://silica-monard.vercel.app
    - theme: alt
      text: View the proof
      link: /reference/proof
features:
  - icon: ⏱️
    title: One token, one GPU-hour
    details: Each token is one H100-80GB hour in a set region and ISO week, redeemable for real GPU access, not a cash payout.
    link: /concepts/gpu-hour-token
  - icon: 🛡️
    title: Bond-backed by the provider
    details: Providers mint only against a USDC bond. A missed hour pays the holder 1.5× its price, automatically and onchain.
    link: /concepts/bonds-and-minting
  - icon: 🔗
    title: Settled by Chainlink CRE
    details: Two CRE workflows decide every confirmed hour, every slash and every margin call. The contract re-derives each verdict from signatures.
    link: /integrations/chainlink-cre
  - icon: 📈
    title: Indexed by Envio
    details: HyperIndex turns every event into provider reliability, candles, tickets and CRE reports, and that data sets each provider's collateral.
    link: /integrations/envio
  - icon: 📚
    title: An onchain order book per week
    details: SilicaBook is a price-time-priority book with $0.01 ticks. Kuru Spot V2 books are prepared and switch on the moment Kuru lists them.
    link: /concepts/order-book
  - icon: 🟣
    title: Built for Monad
    details: Sixty-four GPUs mean sixty-four verdicts an hour, and every GPU × region × week is its own market. Monad makes that affordable.
    link: /guide/why-silica
---

<div class="stats">
  <div class="stat"><b>11</b><span>contracts verified on MonadVision</span></div>
  <div class="stat"><b>31</b><span>Foundry tests (unit, fuzz, invariant)</span></div>
  <div class="stat"><b>2</b><span>Chainlink CRE workflows</span></div>
  <div class="stat"><b>13</b><span>Envio entities</span></div>
  <div class="stat"><b>$27.29</b><span>slashed to buyers on testnet</span></div>
</div>

::: warning Testnet only
Silica runs on Monad Testnet (chain 10143). Provider GPU nodes are simulated, liquidity is testnet-simulated, and Chainlink CRE runs through `cre workflow simulate`. Every simulated part is labelled. See [Limitations](/reference/limitations).
:::
