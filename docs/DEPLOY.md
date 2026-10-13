# Deploying Silica (hosting runbook)

The contracts are already live on Monad Testnet (`packages/shared/addresses.10143.json`). Hosting means three things: the **indexer** (Envio Cloud), the **services** (any Node host, e.g. Railway), and the **web app** (Vercel). Do them in that order, because each one needs the previous one's URL.

Never put a private key in the repo or in any `NEXT_PUBLIC_*` variable. Service keys go only into the host's secret settings. All keys here are testnet-only.

## 1 · Indexer on Envio Cloud

1. Regenerate and commit the config: `node indexer/gen-config.mjs`. It uses HyperSync, which needs `ENVIO_API_TOKEN`. If you don't have a HyperSync token, use `RPC_ONLY=1 node indexer/gen-config.mjs` instead (public RPC, slower but fine at this size).
2. At envio.dev, connect the GitHub repo, set the indexer root directory to `indexer`, and deploy. Add `ENVIO_API_TOKEN` as a secret if you use HyperSync.
3. Copy the GraphQL endpoint. It is `ENVIO_URL` for the services and `NEXT_PUBLIC_ENVIO_URL` for the web app.

## 2 · Services on Railway (one service per process)

All four services share one image, `Dockerfile.services` at the repo root, which is tested locally. On Railway, create four services from the GitHub repo. For each one, set **Settings → Build → Dockerfile path** to `Dockerfile.services` and add a `SERVICE` variable that picks the process. The image contains no keys (`.dockerignore` excludes every `.env`), so put the keys in each service's Variables.

| Service | `SERVICE` | Variables |
| --- | --- | --- |
| provider-agent | `agent` | `PROVIDER_A_KEY`, `NODE_A_KEY`, `PROVIDER_B_KEY`, `NODE_B_KEY`, `AGENT_PORT` (= Railway `PORT`), `RPC_URL` |
| buyer-probe | `probe` | `PROBE_KEY`, `AGENT_URL` (agent's public URL), `PROBE_PORT` (= `PORT`), `RPC_URL` |
| mm-bot | `mm` | `MM_KEY`, `PROVIDER_A_KEY`, `LEVELS=2`, `SIZES=15,25`, `RPC_URL` |
| cre-relay | `relay` | `RELAYER_KEY`, `PROVIDER_A_ADDRESS`, `PROVIDER_B_ADDRESS`, `AGENT_URL`, `PROBE_URL`, `ENVIO_URL`, `RELAY_MODE=local`, `RPC_URL` |

- Give the agent and the probe public domains. The web app's demo controls call them.
- Hosted, the relay uses `RELAY_MODE=local`, the testnet `relayReport()` path, because `cre workflow simulate` needs the CRE CLI and a login. To run CRE itself while you record, use your own machine with `cre login` and `RELAY_MODE=cre pnpm relay`. `/status` labels each report with the path it took.
- Monad bills the full gas limit. Keep about 1 MON on the relayer, about 0.5 MON on each provider, and about 1 MON on the market maker, and top them up from the deployer.

## 3 · Web app on Vercel

1. Import the repo, set the root directory to `apps/web`, and use framework preset Next.js. Vercel detects pnpm from the lockfile.
2. Set these environment variables:

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_RPC_URL` | `https://testnet-rpc.monad.xyz` |
| `NEXT_PUBLIC_ENVIO_URL` | Envio Cloud GraphQL URL |
| `NEXT_PUBLIC_AGENT_URL` / `NEXT_PUBLIC_PROBE_URL` | the Railway agent and probe URLs |
| `NEXT_PUBLIC_PROVIDER_A` / `NEXT_PUBLIC_PROVIDER_B` / `NEXT_PUBLIC_PROBE_ADDRESS` | provider and probe addresses (public, not keys) |
| `NEXT_PUBLIC_HOUR_SECONDS` | `300` |
| `NEXT_PUBLIC_WALLETCONNECT_ID` | optional, from cloud.reown.com |
| `NEXT_PUBLIC_SITE_URL` | the Vercel URL |

**Never set `NEXT_PUBLIC_DEV_BURNER_KEY` on Vercel.** It is a localhost-only test wallet.

## 4 · Smoke test after hosting

1. Open `/status`: the contracts, CRE reports and sample transactions load, and the Kuru listing rows read "listing requested" (or "live on Kuru").
2. On `/markets/h100-apac-w42`, the book shows quotes. Press "Get test USDC", then buy 10 hours with a fresh test wallet.
3. On `/tickets`, redeem 5 hours. Access is posted within about a minute; decrypt it. Within 5 minutes the first hour is confirmed.
4. Press "Provider outage". The next hour is slashed and the payout shows on the ticket.
