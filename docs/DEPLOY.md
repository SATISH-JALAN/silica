# Deploying Silica (hosting runbook)

The contracts are already live on Monad Testnet (`packages/shared/addresses.10143.json`). Hosting means three things: the **indexer** (Envio Cloud), the **services** (Render, via `render.yaml`), and the **web app** (Vercel). Do them in that order, because each one needs the previous one's URL.

Never put a private key in the repo or in any `NEXT_PUBLIC_*` variable. Service keys go only into the host's secret settings. All keys here are testnet-only.

## 1 · Indexer on Envio Cloud

1. Regenerate and commit the config: `node indexer/gen-config.mjs`. It uses HyperSync, which needs `ENVIO_API_TOKEN`. If you don't have a HyperSync token, use `RPC_ONLY=1 node indexer/gen-config.mjs` instead (public RPC, slower but fine at this size).
2. At envio.dev, connect the GitHub repo, set the indexer root directory to `indexer`, and deploy. Add `ENVIO_API_TOKEN` as a secret if you use HyperSync.
3. Copy the GraphQL endpoint. It is `ENVIO_URL` for the services and `NEXT_PUBLIC_ENVIO_URL` for the web app.

## 2 · Services on Render (Blueprint)

`render.yaml` defines two free web services built from `Dockerfile.services`. Each runs two processes through `services/run.sh`:

| Render service | Processes | Public URL used by |
| --- | --- | --- |
| `silica-agent` | provider agent + market maker | probe, relay, web app demo controls |
| `silica-probe` | buyer probe + CRE relay | web app demo controls |

1. In the Render dashboard, click **New → Blueprint**, connect GitHub, and pick this repo (branch `main`).
2. Render lists the `sync: false` variables. Paste the keys (testnet-only), plus:
   - `ENVIO_URL`: the Envio Cloud GraphQL URL;
   - `AGENT_URL`: `https://silica-agent.onrender.com`. If Render gives the agent a different URL, edit this on `silica-probe` afterwards.
3. Click **Apply**. Both services build the same image, and their logs show `listening` (and `relay up` on the probe).
4. Free services sleep after 15 minutes without traffic, so each one pings its own `/health` every 4 minutes (`RENDER_EXTERNAL_URL`).
5. The hosted relay uses `RELAY_MODE=local`, the testnet `relayReport()` path, because `cre workflow simulate` needs the CRE CLI and a login. Run CRE itself from your own machine (`cre login`, then `RELAY_MODE=cre pnpm relay`). `/status` labels each report with the path it took. Mark & Margin starts paused (`MARGIN_EVERY=86400`); set it to `3600` once you've recorded the live margin call.
6. Monad bills the full gas limit. Keep about 1 MON on the relayer, about 0.5 MON on each provider, and about 1 MON on the market maker, and top them up from the deployer.

**Alternative: Railway.** Create one service per process from `Dockerfile.services`, each with `SERVICE` set to `agent`, `probe`, `mm` or `relay` and the same variables. Give the agent and the probe public domains.

## 3 · Web app on Vercel

1. Import the repo, set the root directory to `apps/web`, and use framework preset Next.js. Vercel detects pnpm from the lockfile.
2. Set these environment variables:

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_RPC_URL` | `https://testnet-rpc.monad.xyz` |
| `NEXT_PUBLIC_ENVIO_URL` | Envio Cloud GraphQL URL |
| `NEXT_PUBLIC_AGENT_URL` / `NEXT_PUBLIC_PROBE_URL` | the Render URLs of `silica-agent` and `silica-probe` |
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
