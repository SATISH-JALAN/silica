# Liquidity and market formation

A forward market is only useful if it has a book. Silica starts narrow on purpose, so every book it does open has depth.

## Start narrow

| Dimension | At launch |
| --- | --- |
| GPU | H100-80GB |
| Region | APAC |
| Series | four rolling weekly series (W44–W47), plus a live demo week on testnet |
| Venues | SilicaBook now; Kuru Spot V2 books once listed |

## Who supplies liquidity

<Fig name="liquidity" />

1. **Providers' asks.** A provider sells the capacity it has bonded. Its asks sit a little away from the mid (on testnet NeoGPU quotes at mark + 6 and + 8 ticks).
2. **A market maker.** It quotes both sides around the CRE mark and refreshes when the mark moves. On testnet this is the quote-only `mm-bot`; at launch, a partner market maker.
3. **Kuru.** Once the books are listed, the same ladder runs on Kuru through its SDK, and Kuru's passive liquidity bands and existing Monad traders join the same markets.

## Why the bond helps market making

A market maker quoting a forward on an unknown provider normally prices in the risk that the provider fails. In Silica that risk is **capped and collateralized**: a missed hour pays 1.5× from a bond sized to the open hours, and margin calls stop an under-bonded provider from issuing more. The credit risk on any hour is bounded, so quotes can stay tight.

## Initial market formation

| Phase | Supply | Demand |
| --- | --- | --- |
| Pilot | 2–3 KYB'd providers issue one weekly series | 5 design-partner AI teams commit to buying forward hours |
| Kuru launch | provider asks + our market maker on day one | Kuru's existing traders |
| Scale | partner market maker, Kuru passive bands | more GPUs and regions, monthly series |
