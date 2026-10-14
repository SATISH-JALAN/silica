# Buyer probe

`services/src/buyer-probe/index.ts` · the **independent witness**. It acts for the buyer, checks the delivered machine from the outside, and signs its own `HourSummary` with the ticket's **probe key**. Because a miss requires the probe's signature and a confirmation requires both, the provider can never grade itself.

## What it checks

Every `hourSeconds / 14` seconds, for every delivering ticket:

- **Reachability:** can it reach the host the provider delivered (`/host/:ticketId/nvidia-smi` on testnet)?
- **GPU identity:** does the GPU's identity hash match what the provider claims (`gpuIdHash`)? A mismatch makes the hour disputed, never confirmed.

## HTTP API

| Route | Description |
| --- | --- |
| `GET /health` | probe address, `hourSeconds`, tickets being watched, `brokenLink` state |
| `GET /summary/:ticketId/:hour` | the probe's signed `HourSummary` for an ended hour |
| `POST /demo/fail` | **demo control:** breaks the probe's own link, so the two sides disagree and the hour is **disputed** ("Sources disagree" in the app) |
| `POST /demo/recover` | restores it |

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `PROBE_KEY` | | signs the probe's summaries |
| `AGENT_URL` | `http://127.0.0.1:8081` | where the delivered host is reachable |
| `PROBE_PORT` | `8082` | HTTP port |

::: info One probe today
On testnet the probe is a single service we run. The production design is a network of probes operated independently, with the buyer choosing (or the protocol rotating) the probe per ticket. See the [roadmap](/reference/roadmap).
:::
