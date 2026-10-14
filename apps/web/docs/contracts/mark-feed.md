# SilicaMarkFeed (Kuru)

`contracts/src/kuru/SilicaMarkFeed.sol` · a USD price feed for one series, in the **read interface of Kuru's own testnet price feeds**, so Kuru's `WithdrawalLimiter` can value Silica tokens like any other listed asset.

## Interface

| Function | Returns |
| --- | --- |
| `fetchPrice()` / `priceUsd18()` | the series mark in USD with 18 decimals (`markPrice × 1e12`); reverts `NoMark()` if unset |
| `observedAt()` | the current block timestamp |
| `maxPriceAge()` | `300` seconds, the same as Kuru's feeds |
| `markUpdatedAt()` | when CRE last changed the mark |
| `token()` | the series token |
| `registry()`, `seriesId()` | where the mark comes from |

## Why `observedAt` is the current block

Kuru's own feeds are push oracles: an updater writes a price from Kraken, and the feed reports when it last did. A Silica mark is different: it **is** onchain state, written by Chainlink CRE into `SeriesRegistry`, and the feed reads it fresh on every call. There's no offchain observation that could go stale, so `observedAt()` returns the current block. Anyone who wants the time CRE last changed the mark can read `markUpdatedAt()`.

## How Kuru's interface was matched

Kuru's feed contracts aren't verified on the explorer, so their interface was read from the bytecode:

```text
0x055105f6  priceUsd18()      view
0x0fdb11cf  fetchPrice()      view
0x1584410a  maxPriceAge()     view
0x9be7dadb  observedAt()      view
0x15b5b207  accountCore()     view
0x1a153391  setUpdater(address,bool)
```

Reading the live NVDAx feed returned `225676075000000000000` from both `priceUsd18()` and `fetchPrice()` ($225.68 with 18 decimals) and `maxPriceAge() = 300`, which fixed the units and the age window.

## Deployed feeds

| Series | Feed | Price at deploy |
| --- | --- | --- |
| W42 | [`0x8842…D672`](https://testnet.monadvision.com/address/0x88424A266946BE4912e23BcA1D135e1c8113D672) | $2.02 |
| W44 | [`0x835a…B6DC`](https://testnet.monadvision.com/address/0x835a250Faa251D9c74c87B548E5aF0D4204dB6DC) | $2.05 |
| W45 | [`0xf45E…39ac`](https://testnet.monadvision.com/address/0xf45E3200B54610685a535C3e9Db7bB055EA739ac) | $2.12 |
| W46 | [`0xb99C…7F8e`](https://testnet.monadvision.com/address/0xb99C9af3011E689B9F7155562529449f8C187F8e) | $2.09 |
| W47 | [`0x1b6b…e8a3`](https://testnet.monadvision.com/address/0x1b6b317716c9D56A0F390DB3B849C89b383be8a3) | $2.18 |

Deployed by `script/DeployKuruFeeds.s.sol`; tested in `test/SilicaMarkFeed.t.sol`.
