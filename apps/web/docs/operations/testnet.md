# Deploy to Monad Testnet

<Fig name="testnetPipeline" />

## 1 · Contracts

```bash
cd contracts && set -a && . ../.env && set +a
forge script script/Deploy.s.sol          --rpc-url https://testnet-rpc.monad.xyz --broadcast --slow --gas-estimate-multiplier 120
forge script script/Seed.s.sol            --rpc-url https://testnet-rpc.monad.xyz --broadcast --slow --gas-estimate-multiplier 120
forge script script/DeployKuruFeeds.s.sol --rpc-url https://testnet-rpc.monad.xyz --broadcast
```

- `Deploy.s.sol` deploys every contract, wires every role, creates the W42 demo series and W44–W47, sets `simulationMode = true`, points the oracle at the CRE forwarder, and writes `packages/shared/addresses.10143.json`.
- `Seed.s.sol` funds the service wallets with gas and test USDC, registers node keys, posts bonds, mints hours, and gives the market maker and the judge wallet their inventory.
- `DeployKuruFeeds.s.sol` deploys one `SilicaMarkFeed` per series.

::: warning Monad bills the full gas limit
A transaction pays for its whole gas limit, not just the gas it used. Keep `--gas-estimate-multiplier` modest, and keep service wallets topped up: each provider transaction costs about 0.02–0.04 MON at ~100 gwei.
:::

## 2 · Generate every config from the addresses

```bash
node packages/shared/scripts/gen-kuru.mjs   # Kuru params + predicted books → kuru.10143.json
node cre/gen-config.mjs                     # both CRE workflow configs
node indexer/gen-config.mjs                 # the Envio indexer config
```

## 3 · Verify the sources

```bash
forge verify-contract <address> src/BondVault.sol:BondVault --chain 10143 \
  --verifier sourcify --verifier-url https://sourcify-api-monad.blockvision.org
```

All 11 contracts and the 5 Kuru feeds are verified (exact match).

## 4 · Run CRE

```bash
cre login
cd cre && cre workflow simulate delivery-verifier --target staging-settings --broadcast
cd ../services && RELAY_MODE=cre pnpm relay     # both workflows on a schedule
```

## Gas budget (as deployed)

| Step | Approximate cost |
| --- | --- |
| Deploy | ~2.1 MON |
| Seed (gas) | ~0.75 MON, plus 0.3 MON sent to each service wallet |
| Kuru feeds | ~0.4 MON |
| A CRE delivery write (900k limit) | ~0.09 MON |
| A CRE margin write (1.5M limit) | ~0.15 MON |
