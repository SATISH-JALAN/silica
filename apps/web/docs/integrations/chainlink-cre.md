# Chainlink CRE

**Chainlink CRE is Silica's settlement layer.** Every economic outcome after a trade (an hour confirmed, a bond slashed to a buyer, a mark moved, a ratio changed, a provider margin-called) is decided by one of two CRE workflows written with the CRE TypeScript SDK (`@chainlink/cre-sdk` 1.23). Without CRE, the market cannot settle.

## Two workflows

<Fig name="creWorkflows" />

### Delivery Verifier: `cre/delivery-verifier/main.ts`

1. **EVM read** `RedemptionManager.getOpenTickets(0, 8)` and `hourSeconds`, then which due hours are still unjudged (`verdictApplied`, batched in one Multicall3 call).
2. **HTTP under consensus:** every node fetches the provider node's and the buyer probe's signed `HourSummary` for each due hour. `runInNodeMode` with `consensusIdenticalAggregation` means the nodes must agree byte for byte on the evidence.
3. **Build** one verdict per hour (with both summaries and signatures attached), ABI-encode the `Report`, sign it with `runtime.report({ encoderName: "evm", signingAlgo: "ecdsa", hashingAlgo: "keccak256" })`, and **write** it with `EVMClient.writeReport` to `DeliveryOracle`.

```ts
const raw = runtime.runInNodeMode(fetchEvidence, consensusIdenticalAggregation<string>())(due).result()
// …
const report = { ...emptyReport(selector, scheduledAt), verdicts: buildVerdicts(evidence) }
const hex = encodeReport(report)
const signed = runtime.report({ encodedPayload: hexToBase64(hex), encoderName: "evm",
                                signingAlgo: "ecdsa", hashingAlgo: "keccak256" }).result()
const w = client.writeReport(runtime, { receiver: cfg.oracle, report: signed,
                                        gasConfig: { gasLimit: cfg.gasLimit } }).result()
```

### Mark & Margin: `cre/mark-and-margin/main.ts`

1. **EVM read** every series and its best bid/ask: from its **Kuru Spot V2** book when `SpotRouter.verifiedSpotMarket(book)` is true and both sides are quoted, otherwise from **SilicaBook**. Then every provider position, bond ratio and required bond.
2. **HTTP under consensus:** each provider's confirmed and missed hours from **Envio's GraphQL API**.
3. **Compute** the new marks (book mid, tick-snapped), the ratios (`ratioFor`, see [Reputation](/concepts/reputation)) and the margin checks, keeping **only what changed**. If nothing changed, it writes nothing.

## Built for production limits

The simulator enforces the same limits as a production DON, and both workflows are built to fit them:

| Limit | Value | How Silica fits |
| --- | --- | --- |
| Chain reads per run | 15 | reads batched through **Multicall3** (`readMany`): Mark & Margin uses 5, the verifier 3 |
| Response size per read | 5 KB | batches split by type; tickets paged 8 at a time |
| HTTP calls per run | 15 | at most 4 verdicts per report (2 calls each) |
| Gas per write | up to 10M | sized to the report: **900k** (verifier) and **1.5M** (margin), because Monad bills the full gas limit |

## Running it

```bash
cre login
node cre/gen-config.mjs                       # writes config.staging.json for both workflows
cd cre
cre workflow simulate delivery-verifier --target staging-settings --broadcast
cre workflow simulate mark-and-margin    --target staging-settings --broadcast
```

`--broadcast` sends real transactions through Chainlink's **MockKeystoneForwarder** (`0xB9F7…d192`) into `DeliveryOracle.onReport`. The `cre-relay` service can run both simulations on a schedule (`RELAY_MODE=cre`).

## Proof on Monad Testnet

| Workflow | CLI output | Onchain | Tx |
| --- | --- | --- | --- |
| Delivery Verifier | `ticket 7 hour 0: provider 0/12, probe 0/12` → `DeliveryOracle report: 1 verdicts, success` | hour missed, $3.05 paid to the buyer | [`0xf39c…53b8`](https://testnet.monadvision.com/tx/0xf39c4691e4c0e35b5a0ce69833f7cee6a0fa7e7e53cbbc61f3e256aa874453b8) |
| Delivery Verifier | ticket 4, both hours `12/12, 12/12` | two hours confirmed | [`0x9890…9089`](https://testnet.monadvision.com/tx/0x98907a4d485a6b0dfbb2d074388959783a152fbb92d12d33fb0166abd2209089), [`0xf9c1…d168`](https://testnet.monadvision.com/tx/0xf9c10beb5c460b3c9b35e45a9073f94bc24115c2225bb72cb61e4f1fb503d168) |
| Mark & Margin | Envio reliability read → `1 marks, 5 ratios, 6 margin checks, success` | NeoGPU to 40%, margin-called on 4 series | [`0x8dc3…19b0`](https://testnet.monadvision.com/tx/0x8dc3ab5edb43d9b5952eb7aa158c214cfd487960ed1dc2076c9e5efb2dfa19b0) |

Each of these is labelled `relayed: false` in Envio's `CreReport` entity and on the app's `/status` page.

## Simulation, relay and production

| Path | Delivers via | Used when |
| --- | --- | --- |
| `cre workflow simulate --broadcast` | MockKeystoneForwarder → `onReport` | recording, demos, judged runs |
| `relayReport` (testnet only) | `RELAYER_ROLE` while `simulationMode` is on | the hosted relay, which can't run the CLI login |
| Production DON | `KeystoneForwarder` → `onReport` | after `setForwarderAddress` + pinning the workflow ID |

The relay sends the **same report bytes** the workflow would, and every report records which path delivered it.
