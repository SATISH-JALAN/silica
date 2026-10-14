# CRE relay

`services/src/cre-relay/index.ts` (+ `workflows.ts`) · runs the two CRE workflows on a schedule. It has two modes.

| Mode | What it does | When to use |
| --- | --- | --- |
| `RELAY_MODE=cre` | spawns `cre workflow simulate <workflow> --broadcast` on each tick. Chainlink's forwarder writes the report; the relay sends nothing itself | on a machine with the CRE CLI and `cre login` |
| `RELAY_MODE=local` | computes the same report in-process (the same shared verifier and ratio code) and sends it through `DeliveryOracle.relayReport` | hosted environments that can't run the CLI login; **testnet only**, refuses to start if `simulationMode` is off |

<Fig name="relayFlow" />

Every report records its path (`relayed = true` for the relay), and `/status` shows it.

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `RELAYER_KEY` | | `RELAYER_ROLE` key (local mode) and gas |
| `RELAY_MODE` | `local` | `local` or `cre` |
| `VERIFY_EVERY` | `60` | seconds between Delivery Verifier runs |
| `MARGIN_EVERY` | `300` | seconds between Mark & Margin runs (hosted: `3600`) |
| `MARGIN_AT_START` | `1` | `0` waits one interval before the first Mark & Margin run |
| `AGENT_URL`, `PROBE_URL` | localhost | where to fetch hour summaries |
| `ENVIO_URL` | | Envio GraphQL endpoint for reliability |
| `PROVIDER_A_ADDRESS`, `PROVIDER_B_ADDRESS` | | providers to score |
| `CRE_TARGET` | `staging-settings` | CRE target in `cre/project.yaml` |
