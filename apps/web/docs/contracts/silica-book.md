# SilicaBook

`contracts/src/SilicaBook.sol` · one contract holds a price-time-priority limit order book for every series. Orders escrow their funds in the book: bids lock USDC, asks lock series tokens.

## Functions

| Function | Description | Reverts with |
| --- | --- | --- |
| `placeLimit(seriesId, isBid, price, hrs)` | crosses against the opposite side first (up to `MAX_FILLS`), then rests the remainder; returns `(orderId, filled)` | `NotTickAligned`, `ZeroAmount`, `BelowMinNotional`, `SelfTrade` |
| `marketBuy(seriesId, hrs, maxCost)` | takes the best asks; returns `(filled, cost)` | `Slippage(got, limit)`, `SelfTrade` |
| `marketSell(seriesId, hrs, minProceeds)` | hits the best bids; returns `(filled, proceeds)` | `Slippage(got, limit)`, `SelfTrade` |
| `cancel(orderId)` | owner cancels and is refunded the escrow | `NotOwner`, `OrderClosed` |

## Views

| View | Returns |
| --- | --- |
| `bestBidAsk(seriesId)` | `(bid, ask)`; `0` on an empty side |
| `depth(seriesId, n)` | `(bidPx[], bidHrs[], askPx[], askHrs[])`, best `n` levels per side |
| `levelOrders(seriesId, isBid, price, max)` | order ids resting at one price, in time priority |
| `orders(orderId)` | `(seriesId, owner, isBid, price, remaining, prev, next)` |

## Events

- `OrderPlaced(orderId indexed, seriesId indexed, owner indexed, isBid, price, hrs)`
- `OrderCancelled(orderId indexed, seriesId indexed, remaining)`
- `Trade(seriesId indexed, makerOrderId indexed, maker, taker, takerBuys, hrs, price)`

## Constants

| Constant | Value | Why |
| --- | --- | --- |
| `TICK` | `10_000` ($0.01) | the same tick as the Kuru listing |
| `MIN_NOTIONAL` | `10e6` (10 USDC) | the same floor as Kuru |
| `MAX_FILLS` | `20` | bounds the gas of one transaction (Monad bills the full gas limit) |
| `HOUR_UNIT` | `1e18` | one hour of token |

## Data structure

Each price level is a doubly linked FIFO queue of orders, and each side keeps a sorted array of active prices, so the best price is always at the end of the array:

<Fig name="bookLevels" />
