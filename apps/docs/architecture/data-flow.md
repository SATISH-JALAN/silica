# Data flow

Silica has two read paths (the chain and Envio) and two write paths (users and CRE). This page shows which data travels where.

## Writes

```mermaid
flowchart LR
  subgraph Users
    W[Wallet in the app]
  end
  subgraph Workflows
    DV{{CRE Delivery Verifier}}
    MAM{{CRE Mark & Margin}}
  end
  subgraph Services
    AG[provider-agent]
    MM[mm-bot]
  end
  W -->|placeLimit · marketBuy · marketSell · cancel| BOOK[SilicaBook]
  W -->|redeem| RM[RedemptionManager]
  W -->|depositBond · mint · withdrawExcess · releaseBond| VAULT[BondVault]
  W -->|faucet| USDC[MockUSDC]
  AG -->|postAccess| RM
  MM -->|placeLimit · cancel| BOOK
  DV -->|onReport: verdicts| ORA[DeliveryOracle]
  MAM -->|onReport: marks · ratios · checks| ORA
  ORA -->|applyHour| RM
  ORA -->|setMark| REG[SeriesRegistry]
  ORA -->|setBondRatio · checkMargin| VAULT
```

## Reads

```mermaid
flowchart LR
  CHAIN[(Monad state)] -->|wagmi multicall, 1.5 s| APP[Web app]
  CHAIN -->|events via HyperSync| ENV[(Envio HyperIndex)]
  ENV -->|GraphQL, 2 s polling| APP
  ENV -->|GraphQL under consensus| MAM{{CRE Mark & Margin}}
  CHAIN -->|EVM reads, Multicall3| MAM
  CHAIN -->|EVM reads, Multicall3| DV{{CRE Delivery Verifier}}
  AG[provider-agent] -->|HTTP /summary| DV
  PR[buyer-probe] -->|HTTP /summary| DV
```

## What the app reads from where

| Screen | From the chain | From Envio |
| --- | --- | --- |
| Markets | marks, best bid/ask, supply | forward points, series stats |
| Trading | book depth, balances, allowances, Kuru book (once verified) | trade tape, price chart, open interest, bond locked, provider reliability |
| Tickets | live ticket state | ticket history, per-hour verdicts, sealed ciphertext |
| Provider | the connected provider's positions | delivery record, margin-call history |
| Status | oracle state (`simulationMode`, forwarder), contract addresses | CRE report log, protocol totals |

Live chain reads keep anything money-critical current to the block. Envio supplies everything historical or derived, which a single RPC call couldn't answer.

## The feedback loop

The most important flow is a loop: delivery evidence becomes a verdict, the verdict becomes reliability, reliability becomes collateral, and collateral constrains what a provider can sell next.

```mermaid
flowchart LR
  A[Signed hour summaries] --> B{{CRE Delivery Verifier}}
  B --> C[HoursConfirmed / HoursSlashed]
  C --> D[(Envio: Provider.reliabilityBps)]
  D --> E{{CRE Mark & Margin}}
  E --> F[BondVault: ratio + margin call]
  F --> G[Mint allowed? Bond required?]
  G --> A
```
