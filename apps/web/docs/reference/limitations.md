# Limitations

The honest list. Nothing here is hidden elsewhere.

| Area | Today | Production plan |
| --- | --- | --- |
| **Provider nodes** | simulated (`FAKE_GPU=1`): the agent simulates `nvidia-smi` and the host. NeoGPU and Basalt Cloud are seeded test wallets, not companies | the real agent on real hardware (`nvidia-smi` / DCGM checks) |
| **Liquidity** | a quote-only market-maker bot plus separate, labelled test-buyer wallets; never presented as organic volume | provider asks, a partner market maker, Kuru passive bands |
| **CRE** | `cre workflow simulate --broadcast` through the MockKeystoneForwarder; the hosted relay sends the same report bytes through `relayReport` (testnet-only, `simulationMode`) | a CRE DON: `setForwarderAddress` to the `KeystoneForwarder`, pin the workflow ID, turn `simulationMode` off |
| **Mock forwarder trust** | the mock forwarder provides no workflow metadata, so marks and ratios are only as trusted as it; verdicts are unaffected (re-derived from signatures) | the production forwarder plus a pinned workflow ID |
| **Kuru** | market creation is permissioned; feeds, parameters and predicted books are ready, listing requested; SilicaBook is the live venue | Kuru books live, with the market maker and CRE switching automatically |
| **Probe** | a single buyer probe we run | an independent probe network |
| **Disputes** | resolved by `ARBITER_ROLE` (the admin on testnet); no dispute UI | a review process with evidence from both witnesses |
| **Demo timing** | W44–W47 deliver from 26 Oct, so a W42 demo series is live now; a delivery hour lasts 5 minutes | real ISO weeks, one-hour delivery hours |
| **Admin** | a single admin key, disclosed | a multisig plus a timelock on parameter changes |
| **Audit** | none | an external audit before mainnet |
| **Quote token** | `MockUSDC` with a public faucet | real USDC |
| **Hosting** | free tiers; a Render cold start can add about 30 s to the first request | paid instances |

## Things that are easy to misread

- **"Missed" doesn't need the provider's signature.** A dead node can't sign, so a valid probe summary showing the outage is enough. That's deliberate.
- **The slash is capped at the bond.** If a provider's bond were somehow exhausted, later slashes would pay less. Margin calls exist to stop that from happening.
- **`observedAt()` on the Kuru feed is the current block.** The mark is onchain state, read fresh on every call; `markUpdatedAt()` gives the time CRE last changed it.
