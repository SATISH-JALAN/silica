# Provider agent

`services/src/provider-agent/index.ts` · the provider's node. On testnet it runs with `FAKE_GPU=1` and simulates the GPU host; in production the same agent runs next to real hardware.

## What it does

1. **Watches for tickets:** polls `RedemptionManager.getOpenTickets` for tickets assigned to its providers.
2. **Delivers access:** for each new ticket, generates credentials (host, port, user, token, GPU id), seals them to the ticket's `holderKey` with a libsodium-compatible sealed box, and calls `postAccess`. This happens within seconds of the redemption.
3. **Heartbeats:** samples its host checks every `hourSeconds / 14` seconds and stores them per ticket.
4. **Signs hour summaries:** for each ended hour, counts successful checks (capped at 12) and signs an EIP-712 `HourSummary` with the provider's **node key**.

<Fig name="agentSeq" />

## HTTP API

| Route | Description |
| --- | --- |
| `GET /health` | providers served, `fakeGpu`, `hourSeconds`, whether each host is up |
| `GET /summary/:ticketId/:hour` | the signed `HourSummary` for an ended hour; **404** if the node recorded no heartbeats (a dead node can't sign) |
| `GET /host/:ticketId/nvidia-smi` | the simulated host the buyer probe checks |
| `POST /demo/fail?provider=…` | **demo control:** takes a provider's host down (`all` for every provider) |
| `POST /demo/recover?provider=…` | brings it back |

The demo controls are what the app's **Provider outage** and **Both up** buttons call.

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `PROVIDER_A_KEY`, `PROVIDER_B_KEY` | | provider wallets (post access, pay gas) |
| `NODE_A_KEY`, `NODE_B_KEY` | | node keys (sign hour summaries only) |
| `AGENT_PORT` | `8081` | HTTP port |
| `FAKE_GPU` | `1` | simulate the GPU host |
| `RPC_URL` | Monad testnet RPC | |

The two simulated providers are **NeoGPU** (well bonded) and **Basalt Cloud** (thinly bonded). Both are seeded test wallets, not companies.
