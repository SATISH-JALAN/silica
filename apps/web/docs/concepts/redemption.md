# Redemption and tickets

Redemption turns tokens into GPU time. During the delivery week a holder burns whole hours and receives one **ticket** per provider that takes them.

## Redeeming

```solidity
redeem(uint256 seriesId, uint32 hrs, bytes32 holderKey, address probeKey) returns (uint256[] ticketIds)
```

| Argument | Meaning |
| --- | --- |
| `seriesId` | the series being redeemed (must be inside its delivery window) |
| `hrs` | whole hours to redeem |
| `holderKey` | the holder's X25519 public key, derived from a wallet signature |
| `probeKey` | the address whose signature counts as the buyer-side probe |

What happens in that one transaction:

1. The tokens are burned (`SilicaToken.burn`).
2. `BondVault.assign` splits the hours across providers in FIFO order.
3. One `Ticket` opens per provider, with `priceAtOpen` fixed at the current mark. That price sets the value of any later slash.
4. `accessDeadline` is set to `openedAt + accessWindow` (30 minutes).
5. `Redeemed` and `TicketKeys` events tell the provider's agent what to deliver and to whom.

## The ticket

| Field | Meaning |
| --- | --- |
| `seriesId`, `holder`, `provider` | who owes whom, in which series |
| `hrs` | hours on this ticket |
| `confirmed`, `missed`, `disputed` | running verdict counts |
| `priceAtOpen` | the mark at redemption, which prices a slash |
| `openedAt`, `accessDeadline`, `accessPostedAt` | timing; delivery hour 0 starts at `accessPostedAt` |
| `holderKey`, `probeKey`, `nodeKey` | the keys used to seal access and to check signatures |
| `status` | `Open` → `AccessPosted` → `Settled` |

<Fig name="ticketStates" />

## Sealed access

The provider must post the credentials (SSH host, port, user, token, GPU id) **encrypted to the holder**. Nothing secret is ever stored in plaintext, onchain or off.

<Fig name="accessKey" />

- The key is **derived, not stored**: signing the same fixed message with the same wallet always gives the same key, so the browser can recreate it whenever needed.
- The ciphertext is a standard sealed box (`tweetnacl` + a BLAKE2b nonce, compatible with libsodium's `crypto_box_seal`).

## If the provider never shows up

If access isn't posted by `accessDeadline`, **anyone** can call `slashUnserved(ticketId)`. Every remaining hour on the ticket is slashed to the holder at 1.5× and the ticket settles. The holder doesn't need to wait for anyone's permission.
