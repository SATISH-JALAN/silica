# FAQ

## Is this a derivative?

No. A Silica token is a prepaid, physically delivered service contract: the right to one GPU-hour. It settles by delivering compute, or by the provider's bond paying the holder for a missed hour. It isn't cash-settled on a price, and it isn't a claim on anyone's profits. We stay on testnet until counsel reviews the structure.

## What stops a provider from lying about delivery?

A confirmation needs **two** signatures: the provider's node and an independent buyer probe, both at 11 of 12 checks or better, on the same GPU. The contract recovers both signatures and decides itself. See [Delivery verification](/concepts/verification).

## What if the provider's node just goes offline?

Then it can't sign, and the probe's signed summary showing the outage is enough: the hour is **missed** and slashed to the holder. Going silent never helps a provider.

## What if Chainlink CRE sends a wrong report?

The contract doesn't take the report on trust. It re-derives every verdict from the two EIP-712 signatures, so a report can't confirm or slash an hour the signatures don't support. Reports also carry the chain selector and a strictly increasing timestamp, so they can't be replayed.

## Why 1.5×?

A missed hour costs the buyer more than its price: a training run stalls and capacity has to be found elsewhere at short notice. 1.5× compensates for that and makes failing expensive for the provider. It's a per-series parameter (`slashMultBps`).

## Why does the bond ratio change?

Reliable providers have earned lower collateral (20% after 1,000 confirmed hours at ≥ 99%); unreliable ones need more (40% below 95%). The record comes from Envio and the ratio is written by CRE. See [Reputation](/concepts/reputation).

## Can I sell hours I've bought?

Yes, any time before the delivery week ends, on the series' order book.

## What happens to hours nobody redeems?

They expire at the end of the delivery week. Once every hour assigned to tickets has settled, the provider can `releaseBond`.

## Why is there a W42 series?

W44–W47 start delivering on 26 October, so nothing in them could be redeemed during judging. W42 is the current week, so the whole redeem → deliver → verify → slash path can be tried live, with 5-minute delivery hours.

## Why not trade on Kuru today?

Kuru market creation is permissioned. Everything up to `deploySpotMarket` is built and requested, and the market maker, CRE and the app switch over automatically once Kuru verifies the books. See [Kuru](/integrations/kuru).

## Is my access really private?

Yes. It's sealed to an X25519 key derived from a signature your wallet makes, and decrypted only in your browser. Only you and the provider that issued the credentials ever see them in plaintext: the chain, the indexer and the app only ever hold the ciphertext.

## Why Monad?

Delivery creates one verdict per GPU per hour, and every GPU × region × week is its own book. That volume of small, money-moving transactions is only affordable at Monad's throughput and fees. See [Why Silica](/guide/why-silica#why-monad).
