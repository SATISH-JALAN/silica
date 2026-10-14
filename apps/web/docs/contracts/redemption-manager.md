# RedemptionManager

`contracts/src/RedemptionManager.sol` · turns tokens into delivery tickets, carries the sealed access, applies hour verdicts and pays slashes through the vault.

## Functions

| Function | Access | Description |
| --- | --- | --- |
| `redeem(seriesId, hrs, holderKey, probeKey)` | holder | burns tokens, assigns hours FIFO, opens one ticket per provider; returns the ticket ids |
| `postAccess(ticketId, ciphertext)` | the ticket's provider | posts the sealed credentials; delivery hour 0 starts now |
| `slashUnserved(ticketId)` | **anyone** | after `accessDeadline` with no access posted, slashes every remaining hour and settles the ticket |
| `applyHour(ticketId, hour, kind)` | `ORACLE_ROLE` | applies one verdict: `0` confirm, `1` miss (slash), `2` dispute |
| `resolveDispute(ticketId, toConfirmed, toMissed)` | `ARBITER_ROLE` | moves disputed hours to confirmed or missed |
| `setNodeKey(nodeKey)` | provider | registers the key that signs the provider's hour summaries |
| `setParams(accessWindow, hourSeconds)` | admin | the access deadline and the length of a delivery hour |

## Views

| View | Returns |
| --- | --- |
| `getTicket(ticketId)` | the full `Ticket` struct |
| `getOpenTickets(offset, limit)` | `(ids[], tickets[])` of tickets still open, paged (used by CRE) |
| `openCount()` | number of open tickets |
| `hoursElapsed(ticketId)` | delivery hours that have ended since access was posted |
| `verdictApplied(ticketId, hour)` | whether that hour has been judged |
| `ticketCount()` | total tickets ever opened |

## Events

| Event | Meaning |
| --- | --- |
| `Redeemed(ticketId, seriesId, holder, provider, hrs, priceAtOpen)` | a ticket opened |
| `TicketKeys(ticketId, holderKey, probeKey, nodeKey, accessDeadline)` | the keys for sealing and verification |
| `AccessPosted(ticketId, ciphertext)` | the provider delivered access |
| `HourVerdict(ticketId, hour, kind)` | one hour was judged |
| `HoursConfirmed(ticketId, hrs)` / `HoursSlashed(ticketId, hrs, payout)` / `HoursDisputed(ticketId, hrs)` | running totals |
| `DisputeResolved(ticketId, toConfirmed, toMissed)` | an arbiter resolved disputed hours |
| `TicketSettled(ticketId)` | every hour is accounted for |
| `NodeKeySet(provider, nodeKey)` · `ParamsSet(accessWindow, hourSeconds)` | configuration |

## Errors

`NotProvider` · `OutsideDeliveryWindow` · `ZeroAmount` · `AccessAlreadyPosted` · `AccessNotPosted` · `DeadlineNotPassed` · `HourOutOfRange(hour)` · `HourNotElapsed(hour)` · `VerdictAlreadyApplied(hour)` · `InvalidKind(kind)` · `UnknownTicket(ticketId)` · `TooManyResolved`

## Constants

| Constant | Value |
| --- | --- |
| `KIND_CONFIRM` / `KIND_MISS` / `KIND_DISPUTE` | `0` / `1` / `2` |
| `accessWindow` (testnet) | 30 minutes |
| `hourSeconds` (testnet) | 300 seconds |

## Slash arithmetic

```solidity
uint256 owed = (uint256(hrs) * t.priceAtOpen * s.slashMultBps) / BPS;   // 1.5× at slashMultBps = 15000
t.missed += hrs;
vault.settleHours(t.provider, t.seriesId, hrs);
uint256 paid = vault.slash(t.provider, t.seriesId, t.holder, owed);       // capped at the remaining bond
emit HoursSlashed(ticketId, hrs, paid);
```
