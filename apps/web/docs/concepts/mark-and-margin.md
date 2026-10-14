# Mark and margin

The **mark** is each series' reference price. It sizes every bond requirement, it prices every redemption (and so every slash), and it drives the [Kuru price feeds](/contracts/mark-feed). It is written onchain by the Chainlink CRE **Mark & Margin** workflow.

## How the mark is set

1. CRE reads each series' best bid and best ask: from its **Kuru Spot V2 book** once Kuru has verified it, otherwise from **SilicaBook**.
2. If both sides exist, the new mark is the mid, snapped down to the $0.01 tick: `mid = ((bid + ask) / 2 / TICK) × TICK`.
3. Only marks that **changed** are written. `SeriesRegistry.setMark(seriesId, price, scheduledAt)` rejects a report whose `scheduledAt` is not newer than the last one (`StaleReport`).

## Margin checks

```text
required = (minted − settled) × markPrice × bondRatio
```

`BondVault.checkMargin(provider, seriesId)`:

| Situation | Result |
| --- | --- |
| `bond < required` | `marginCalled = true`, emit `MarginCall(provider, seriesId, shortfall)` |
| `bond ≥ required` and the position was margin-called | `marginCalled = false`, emit `MarginCleared(provider, seriesId)` |
| otherwise | nothing |

A margin-called provider **cannot mint** (`MarginCalled()`) until it deposits enough bond and the next check clears it.

<Fig name="markMargin" />

## What a report contains

Monad bills the **full gas limit** of a transaction, so a report carries only what actually changed:

- a **mark** only where the mid moved;
- a **ratio** only where the provider's tier changed;
- a **margin check** only where the mark or ratio moved, or where the position's margin flag disagrees with its bond (for example after a slash).

If nothing changed, the workflow writes nothing at all.

## The live margin call

On testnet, the NeoGPU provider missed hours across several demo outages. When Mark & Margin ran, Envio showed **13 confirmed and 8 missed hours (61.9%)**, far below the 95% threshold. The workflow raised its ratio to **40%** and margin-called it on the four series its bond no longer covered (its record has since settled at 15 confirmed and 9 missed, or 6250 bps):

| Series | Bond | Required at 40% | Shortfall |
| --- | --- | --- | --- |
| W44 | $750.00 | $820.00 | $70.00 |
| W45 | $600.00 | $678.40 | $78.40 |
| W46 | $350.00 | $418.00 | $68.00 |
| W47 | $300.00 | $348.80 | $48.80 |

Transaction: [`0x8dc3…19b0`](https://testnet.monadvision.com/tx/0x8dc3ab5edb43d9b5952eb7aa158c214cfd487960ed1dc2076c9e5efb2dfa19b0).
