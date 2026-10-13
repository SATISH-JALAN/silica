# Trust and security model

The design question behind every component is: **who could lie, and what happens if they do?**

## Assumptions

| Party | Trusted to | Not trusted to |
| --- | --- | --- |
| Provider | deliver, or lose its bond | grade its own delivery |
| Provider node | sign what it saw | decide a verdict alone |
| Buyer probe | sign what it saw | decide a verdict alone |
| Chainlink CRE | fetch the evidence under consensus and deliver it intact | turn evidence into money (the contract re-checks it) |
| Envio | index events faithfully | move funds directly (it only informs ratios via CRE) |
| Admin (testnet) | parameters and roles, disclosed | (mainnet: multisig + timelock) |

## Threats and mitigations

| Threat | Mitigation |
| --- | --- |
| Provider claims an hour it didn't deliver | a confirmation needs **both** signatures ≥ 11/12 on the same GPU; the probe is independent |
| Provider's node goes dark to avoid a miss | a missing provider summary plus a probe that saw the outage counts as **missed**: a dead node can't sign, so silence doesn't help |
| Provider never posts access | anyone can call `slashUnserved` after 30 minutes; every remaining hour is slashed |
| A CRE report carries a fabricated verdict | `DeliveryOracle` recovers both EIP-712 signers against the ticket's `nodeKey` and `probeKey` and **re-derives** the verdict. A report every node agreed on still can't pay or slash without valid signatures |
| A report is replayed | reports carry `chainSelector` (cross-chain) and a strictly increasing `scheduledAt` (same chain) |
| One bad verdict blocks a whole report | each verdict is applied in `try/catch`; failures emit `VerdictSkipped` |
| The same hour is judged twice | `verdictApplied[ticket][hour]` makes `applyHour` idempotent |
| A slash is gamed by moving the mark | the slash uses `priceAtOpen`, fixed at redemption |
| A provider oversells against a thin bond | the mint rule and margin calls: no minting while margin-called |
| Self-dealing on the book | `SilicaBook` rejects self-trades; the market maker only quotes |
| The testnet relay is abused | `relayReport` needs `RELAYER_ROLE` **and** `simulationMode`; with simulation off, only the CRE forwarder can deliver reports |
| Reentrancy through token transfers | `ReentrancyGuard` and `SafeERC20` on every function that moves money |

## The simulation caveat

During `cre workflow simulate`, reports arrive through Chainlink's **MockKeystoneForwarder**, which provides no workflow metadata. Two consequences:

- **Delivery verdicts are unaffected.** They're re-derived from signatures, so a fake report can't confirm or slash anything.
- **Marks and ratios are only as trusted as that forwarder.** In production, `setForwarderAddress` points at the real `KeystoneForwarder` and the workflow ID is pinned, so only the registered workflow can write.

## Keys

| Key | Holds funds? | Notes |
| --- | --- | --- |
| Provider wallet | yes (bond, proceeds) | `PROVIDER_ROLE`, KYB in production |
| Provider **node key** | no | signs hour summaries only; registered with `setNodeKey`, snapshotted per ticket |
| **Probe key** | no | signs hour summaries only; chosen per ticket |
| Holder access key | no | X25519, derived from a wallet signature, never stored |
| Relayer key | gas only | testnet relay and CRE simulation broadcasts |
| Admin key | no | testnet only, disclosed |

## Invariants under test

`contracts/test/Invariant.t.sol` runs a stateful fuzzer over random sequences of protocol actions, and checks after every step:

1. **Solvency:** the vault's USDC balance covers every provider's recorded bond.
2. **Supply:** token supply equals minted minus redeemed hours, exactly.
3. **Hour accounting:** assigned hours never exceed minted, settled never exceeds assigned, and assigned equals redeemed.
