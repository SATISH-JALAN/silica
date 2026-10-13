# Kuru Spot V2 listing spec (Monad Testnet)

Kuru market creation is permissioned (`deploySpotMarket` and the token whitelist are admin-only), so Silica requests the books below. Everything Kuru needs is already deployed and verified.

**Kuru contracts (current testnet):** SpotRouter `0x008200AD02fCb7020B019D11Cbabd32FecE1De78` · AccountCore `0xe08573a1Ecc4aa507c9626071fA0c4513caf7906` · quote USDC `0xb01DC575a7ef75e58A05D2bde73ab79f8e7dd0Be` (6 decimals, existing USDC/USD feed `0x29064f22175DBD7394aC7a61e3CC42Fb377175B7`).

## Base tokens and price feeds

Each series token is 18 decimals (1 token = 1 H100-80GB hour). Its feed is `SilicaMarkFeed` (`contracts/src/kuru/SilicaMarkFeed.sol`), which serves Kuru's feed read interface (`fetchPrice()` / `priceUsd18()` in USD with 18 decimals, `observedAt()`, `maxPriceAge() = 300`) from the series mark that Chainlink CRE writes to `SeriesRegistry`. The mark is onchain state, so the feed can't go stale; `markUpdatedAt()` shows when CRE last changed it.

| Series | Token | USD feed | Predicted Kuru book |
| --- | --- | --- | --- |
| SIL·H100·APAC·W42 (demo week) | `0x0a34471DC8c2893a8c63e4Af603535e3F496d6ed` | `0x88424A266946BE4912e23BcA1D135e1c8113D672` | `0xAc325AB01DfE0fbF5e3Ac422C87c62783Fb061fA` |
| SIL·H100·APAC·W44 | `0x841661c94Af0384680755bB65738027EA1FCF093` | `0x835a250Faa251D9c74c87B548E5aF0D4204dB6DC` | `0x39d3a741Caef7F15aF495748159BE451199F2104` |
| SIL·H100·APAC·W45 | `0x7a2E94F1fA56D36E5144EC849311de164341C8B3` | `0xf45E3200B54610685a535C3e9Db7bB055EA739ac` | `0xdbdDBCd51fB933c8249dc62AAE8F6bFd6133af96` |
| SIL·H100·APAC·W46 | `0x5d76f956712B9E9A357Be1F1E25b79A299B8814F` | `0xb99C9af3011E689B9F7155562529449f8C187F8e` | `0xa5434ea6CADf6bDA1833eAFC2AFf2bE035F3c344` |
| SIL·H100·APAC·W47 | `0x5561b62F6B73097948c32f94c7ab0F97311AE30a` | `0x1b6b317716c9D56A0F390DB3B849C89b383be8a3` | `0x461FFe3b6F562f228dBC421E7863b6FDbcfE68df` |

## Market parameters (same for every series)

Modelled on Kuru's xStock markets (18-decimal base, USDC quote) with a tighter passive band for a ~$2 asset:

| Parameter | Value | Meaning |
| --- | --- | --- |
| sizePrecision | `10000000000` | as Kuru's 18-decimal xStocks |
| pricePrecision | `10000` | |
| tickSize | `100` | $0.01 tick, same as SilicaBook |
| passiveSpreadTicks | `2` | $0.02 passive band |
| minQuoteNotional | `10000000` | 10 USDC, Kuru default |
| maxQuoteNotional | `5000000000000` | 5,000,000 USDC, Kuru default |
| takerFeePps | `2000` | 2 bps, Kuru default |
| makerFeePps | `0` | Kuru default |

The predicted book addresses come from `SpotRouter.computeAddress` with exactly these parameters and the USDC quote; the same call reproduces Kuru's MON/USDC book `0xD2F64EaF7E85688802d24C18ea268C365533b344`.
