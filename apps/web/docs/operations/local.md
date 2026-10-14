# Run it locally

Run the whole system against a local chain: contracts, services, the indexer and the app.

## Prerequisites

| Tool | Version |
| --- | --- |
| Node.js | 22+ |
| pnpm | 10 |
| Foundry | ≥ 1.8 |
| Bun | for the CRE workflows |
| CRE CLI | for `cre workflow simulate` |
| Docker | for the local Envio indexer (on Windows, with WSL) |

## 1 · Install and test

```bash
pnpm install
cp .env.example .env               # fresh testnet-only keys: cast wallet new
cd contracts && forge test         # 31 tests
```

## 2 · Start a chain and deploy

```bash
anvil --chain-id 10143
# Multicall3 at its canonical address (wagmi and CRE batch reads through it)
cast rpc anvil_setCode 0xcA11bde05977b3631167028862bE2a173976CA11 \
  $(cast code 0xcA11bde05977b3631167028862bE2a173976CA11 --rpc-url https://testnet-rpc.monad.xyz)

cd contracts && set -a && . ../.env && set +a
export RPC_URL=http://127.0.0.1:8545 DEMO_HOUR_SECONDS=60
forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast   # writes packages/shared/addresses.10143.json
forge script script/Seed.s.sol   --rpc-url $RPC_URL --broadcast   # providers, bonds, mints, market-maker inventory
```

## 3 · Start the services (one terminal each)

```bash
cd services
pnpm agent                   # provider agent      :8081
pnpm probe                   # buyer probe         :8082
pnpm mm                      # market maker
RELAY_MODE=local pnpm relay  # verdicts + marks via relayReport
```

## 4 · Run a scenario

```bash
pnpm demo:happy              # buy → redeem → decrypt → hours confirmed
pnpm demo:slash              # the same, plus an outage → hours slashed to the buyer
```

Both write their transaction hashes to `packages/shared/demo-txs.json`, which `/status` displays.

## 5 · The app

```bash
cd apps/web && pnpm dev      # http://localhost:3000 (see apps/web/.env.example)
```

## 6 · The docs

```bash
pnpm --filter web docs:dev         # http://localhost:5173/docs/
```
