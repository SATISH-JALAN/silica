# SeriesRegistry

`contracts/src/SeriesRegistry.sol` · creates series, deploys their tokens and stores their marks.

## Functions

| Function | Access | Description |
| --- | --- | --- |
| `createSeries(gpu, region, weekStart, bondRatioBps, slashMultBps, initialMark, name, symbol)` | `SERIES_ADMIN_ROLE` | deploys a `SilicaToken`, grants it `MINTER_ROLE` (vault) and `BURNER_ROLE` (redemption), stores the series, emits `SeriesCreated` |
| `setMark(seriesId, price, scheduledAt)` | `ORACLE_ROLE` | writes a new mark; rejects `scheduledAt ≤ markUpdatedAt` and a zero price |
| `setCore(vault, redemption)` | admin | wires the vault and redemption manager (once, at deploy) |
| `getSeries(seriesId)` | view | the full `Series` struct |
| `seriesCount()` | view | number of series |

## Events

| Event | Emitted when |
| --- | --- |
| `SeriesCreated(seriesId, token, gpu, region, deliveryStart, deliveryEnd)` | a series is created |
| `MarkUpdated(seriesId, price, scheduledAt)` | CRE writes a new mark |
| `CoreSet(vault, redemption)` | the core contracts are wired |

## Errors

| Error | Meaning |
| --- | --- |
| `UnknownSeries(seriesId)` | no such series |
| `StaleReport(scheduledAt, last)` | the mark is older than the current one |
| `InvalidParams()` | a zero price or invalid series parameters |
| `CoreNotSet()` | the vault and redemption manager aren't wired yet |

## Constants

| Constant | Value |
| --- | --- |
| `WEEK` | `7 days`. A series delivers from `weekStart` to `weekStart + WEEK − 1` |
