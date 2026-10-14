# Formulas and worked examples

## Every formula in one place

| Quantity | Formula | Where |
| --- | --- | --- |
| Bond required | `(minted − settled) × mark × bondRatio` | `BondVault._required` |
| Mint allowed | `bond ≥ (minted − settled + newHours) × mark × bondRatio` | `BondVault.mint` |
| Slash for missed hours | `hours × priceAtOpen × slashMult` (1.5×), capped at the bond | `RedemptionManager._slash` |
| Margin shortfall | `required − bond` when positive | `BondVault.checkMargin` |
| Mark | `floor((bestBid + bestAsk) / 2 / $0.01) × $0.01` | CRE Mark & Margin |
| Reliability | `confirmed / (confirmed + missed)` | Envio handler |
| Bond ratio | 20% / 30% / 40% by record (see [Reputation](/concepts/reputation)) | `ratioFor` |
| Kuru feed price | `mark × 1e12` (USD, 18 decimals) | `SilicaMarkFeed` |

## Worked example 1: the reference case

This is reproduced exactly in `contracts/test/Silica.t.sol` (`test_WorkedExample_TenMissedHoursPay3075`).

| Step | Numbers |
| --- | --- |
| A provider bonds and mints | 1,000 W44 hours at a $2.00 mark, 30% ratio → **$600** bond |
| A buyer redeems | 100 hours at a **$2.05** mark (this becomes `priceAtOpen`) |
| Delivery | **10** of those hours are missed |
| Paid to the buyer | 10 × $2.05 × 1.5 = **$30.75** |
| Returned to the provider | $600 − $30.75 = **$569.25** |

<Fig name="bondSplit" />

## Worked example 2: how far a bond stretches

At the default 30% ratio and a 1.5× slash, a fully used bond covers:

```text
bond / (mark × 1.5)  =  (hours × mark × 0.30) / (mark × 1.5)  =  20% of the hours
```

So a provider bonded at 30% can miss **one hour in five** of its open hours before the bond runs out, and margin calls step in long before that: every slash lowers the bond, and every margin check compares it against what the remaining hours require.

## Worked example 3: the live outage on testnet

| | Ticket #2 | Ticket #7 |
| --- | --- | --- |
| Mark at redemption | $2.02 | $2.03 |
| Hours missed | 2 | 1 |
| Judged by | testnet relay | `cre workflow simulate delivery-verifier --broadcast` |
| Paid to the buyer | **$6.06** | **$3.05** (3.045) |

## Worked example 4: reputation in money

For 1,000 open hours at a $2.05 mark:

| Ratio | Bond | Difference vs default |
| --- | --- | --- |
| 20% (reputation) | $410 | **−$205** freed for the provider |
| 30% (default) | $615 | n/a |
| 40% (penalty) | $820 | **+$205** more collateral required |
