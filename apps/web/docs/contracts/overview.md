# Contracts: overview and addresses

All contracts are written in Solidity 0.8.26 with Foundry (`network = "monad"`, `via_ir`), use OpenZeppelin Contracts v5, and are **verified on MonadVision through Sourcify (exact match)**.

## Monad Testnet (chain 10143)

| Contract | Address |
| --- | --- |
| SeriesRegistry | [`0x7889B29861aF261026a1aaa9983954DE0E76D8a6`](https://testnet.monadvision.com/address/0x7889B29861aF261026a1aaa9983954DE0E76D8a6) |
| BondVault | [`0xa730F61B3A0c0f3042EEd7b458EcF3aD392bFa00`](https://testnet.monadvision.com/address/0xa730F61B3A0c0f3042EEd7b458EcF3aD392bFa00) |
| RedemptionManager | [`0xf21bd145cd5C7d306033bfdF5FE9Cf87c3738dab`](https://testnet.monadvision.com/address/0xf21bd145cd5C7d306033bfdF5FE9Cf87c3738dab) |
| DeliveryOracle | [`0xF5d5419A6f1DaA315fa6b1312e24A639D33d2a52`](https://testnet.monadvision.com/address/0xF5d5419A6f1DaA315fa6b1312e24A639D33d2a52) |
| SilicaBook | [`0x783d37B75E294A92cF54c017dF9FA7e8A05c9Be3`](https://testnet.monadvision.com/address/0x783d37B75E294A92cF54c017dF9FA7e8A05c9Be3) |
| MockUSDC | [`0x077eF50fd19bc7A77f3Bd7Fd8A3Ad028E7014561`](https://testnet.monadvision.com/address/0x077eF50fd19bc7A77f3Bd7Fd8A3Ad028E7014561) |
| CRE forwarder (MockKeystoneForwarder) | [`0xB9F79d863261869B234c481D1f9A7af84AeAd192`](https://testnet.monadvision.com/address/0xB9F79d863261869B234c481D1f9A7af84AeAd192) |

### Series tokens and Kuru feeds

| Series | Token | Kuru USD feed |
| --- | --- | --- |
| W42 (demo week) | [`0x0a34…d6ed`](https://testnet.monadvision.com/address/0x0a34471DC8c2893a8c63e4Af603535e3F496d6ed) | [`0x8842…D672`](https://testnet.monadvision.com/address/0x88424A266946BE4912e23BcA1D135e1c8113D672) |
| W44 | [`0x8416…F093`](https://testnet.monadvision.com/address/0x841661c94Af0384680755bB65738027EA1FCF093) | [`0x835a…B6DC`](https://testnet.monadvision.com/address/0x835a250Faa251D9c74c87B548E5aF0D4204dB6DC) |
| W45 | [`0x7a2E…C8B3`](https://testnet.monadvision.com/address/0x7a2E94F1fA56D36E5144EC849311de164341C8B3) | [`0xf45E…39ac`](https://testnet.monadvision.com/address/0xf45E3200B54610685a535C3e9Db7bB055EA739ac) |
| W46 | [`0x5d76…814F`](https://testnet.monadvision.com/address/0x5d76f956712B9E9A357Be1F1E25b79A299B8814F) | [`0xb99C…7F8e`](https://testnet.monadvision.com/address/0xb99C9af3011E689B9F7155562529449f8C187F8e) |
| W47 | [`0x5561…E30a`](https://testnet.monadvision.com/address/0x5561b62F6B73097948c32f94c7ab0F97311AE30a) | [`0x1b6b…e8a3`](https://testnet.monadvision.com/address/0x1b6b317716c9D56A0F390DB3B849C89b383be8a3) |

Deployed at block **70687435**. Addresses are written by `script/Deploy.s.sol` to `packages/shared/addresses.10143.json`, and every config (CRE, Envio, Kuru, the app) is generated from that file. Nobody pastes an address by hand.

## How the contracts connect

<Fig name="contractsMap" />

## Tests

`forge test` runs **31 tests** across five suites:

| Suite | Covers |
| --- | --- |
| `Silica.t.sol` | the mint rule and margin block, reputation ratios, FIFO redemption, the delivery window, access posting and `slashUnserved`, the verdict rule (dead node still slashed, disagreement disputed, forged provider signature never confirms), early and duplicate verdicts, forwarder/chain/stale/relay checks, bond release, the faucet, fuzzed mint and slash caps, and the worked example ($30.75 / $569.25) |
| `SilicaBook.t.sol` | resting asks and market buys, resting bids and market sells, price-time priority and price improvement, best-first depth, and the revert cases |
| `Invariant.t.sol` | stateful fuzzing: solvency, supply, hour accounting |
| `SilicaMarkFeed.t.sol` | the Kuru feed: USD conversion, following CRE marks, unknown series |
| `Base.t.sol` | shared fixtures |
