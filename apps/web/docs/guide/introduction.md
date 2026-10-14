# Introduction

**Silica is an onchain market for deliverable, bond-backed GPU-hour forwards on Monad.**

A GPU provider sells standardized contracts, such as *one H100-80GB hour in the APAC region, delivered in ISO week 44*. Each contract is an ERC-20 token, and one token is exactly one GPU-hour. Before a provider can mint a single token it must lock a USDC bond in `BondVault`. Tokens trade on an onchain order book. In the delivery week a holder burns tokens to open a ticket, receives SSH or Jupyter access sealed to a key only their wallet can derive, and uses the GPU.

Every delivery hour is checked twice: once by the provider's own node, and once by an independent probe on the buyer's side. Each signs an EIP-712 summary of 12 health checks. A Chainlink CRE workflow fetches both under consensus and writes one report to Monad, and the `DeliveryOracle` contract recovers both signatures and decides the verdict itself:

- both sides healthy on the same GPU → the hour is **confirmed** and settles to the provider;
- the buyer's probe saw an outage the provider can't refute → the hour is **missed**, and the provider's bond pays the holder **1.5×** the hour's price;
- anything else → the hour is **disputed** and held, neither paid nor slashed.

A second CRE workflow posts a new mark price for each series every hour, reads each provider's delivery record from **Envio**, and adjusts the provider's bond ratio. A provider whose bond no longer covers its open hours is **margin-called** and cannot mint until it tops up.

<Fig name="introFlow" />

## Who it's for

| | Buyers | Providers |
| --- | --- | --- |
| Who | AI startups, ML teams and research labs that rent GPUs | Small GPU clouds, resellers and data centres with idle capacity |
| Pain today | can't lock next month's price or capacity | can't pre-sell capacity, because buyers don't trust an unknown provider |
| What Silica gives them | a fixed price and guaranteed allocation, with the provider's money on the line | payment up front, and a lower bond as their delivery record improves |

## What makes it different

Every compute product listed on an exchange today (CME, ICE·Ornn, Kalshi, Injective) is **cash-settled on a price index**. It gives price exposure, never a GPU. Silica is the first **physically delivered, collateralised** forward on compute. The refund for a failed hour isn't a support ticket or a lawsuit: it is an onchain transfer from the provider's bond.

## Where to go next

- [Why Silica](/guide/why-silica): the problem in more depth, and why it runs on Monad.
- [Quickstart](/guide/quickstart): try the live app on testnet in 10 minutes.
- [Core concepts](/concepts/gpu-hour-token): how tokens, bonds, tickets and verdicts work.
- [Architecture](/architecture/overview): every component and how they connect.
