# Silica — Technical Architecture

Oct 12, 2026 · @Satish

## Overview and scope

Silica is an onchain market for deliverable GPU compute on Monad: providers mint bond-backed GPU-hour tokens, traders buy and sell them on an order book, and holders redeem them for real GPU time, with delivery checked by Chainlink CRE. This document is the engineering blueprint for the hackathon build: every contract, service, indexer and screen, and how they are wired together.

**In scope:** five Solidity contracts on Monad Testnet, Kuru order-book integration with a fallback book, two Chainlink CRE workflows, a provider node agent and buyer probe, a market-maker bot, an Envio HyperIndex indexer, and a Next.js frontend animated with GSAP.

**Out of scope for the hackathon:** mainnet deployment, real KYB, hardware attestation, and a formal audit. Product context, market rationale and bounty strategy live in the companion doc, *Silica — Project Documentation*.

## System context

Every dollar and every rule lives in contracts on Monad; the offchain services only supply evidence, prices and liquidity.

&#91;embedded content: system context · contracts, services and data flow\]

The web app sends transactions to Monad and reads its data from Envio, which indexes contract events through HyperSync. The provider agent and buyer probe send signed hourly summaries to Chainlink CRE, which writes signed reports to `DeliveryOracle`; the provider agent also posts encrypted access to `RedemptionManager`. The market-maker bot quotes the order book.

## Tech stack

Everything is TypeScript except the contracts, so the two of you share one language, one package manager and one set of types across the whole repo. Versions marked "minimum" are hard requirements from the vendor docs; pin exact versions when you scaffold.

| Layer | Choice | Version | Why |
| --- | --- | --- | --- |
| Chain | Monad Testnet | chain ID `10143` | Required by Metropolis |
| Contracts | Solidity + OpenZeppelin Contracts v5 | `^0.8.26` | Audited ERC-20, AccessControl, SafeERC20, ReentrancyGuard |
| Contract tooling | Foundry with `network = "monad"` | minimum v1.8.0 | Native Monad gas model and limits in tests |
| Order book | Kuru Spot V2, SDK `@toxicflow-labs/ts-sdk` | reviewed release from Kuru docs | Kuru bounty; onchain CLOB on Monad |
| Oracle | Chainlink CRE, `@chainlink/cre-sdk` (TypeScript) | minimum CLI v1.30.0, TS SDK v1.19.0 for Monad Testnet | CRE bounty; consensus over offchain data |
| CRE consumer | Chainlink `ReceiverTemplate` pattern | from Chainlink docs | Forwarder check, ERC-165, workflow identity checks |
| Indexer | Envio HyperIndex v3 (`indexer.onEvent` API), hosted on Envio Cloud | v3 | Envio bounty; HyperSync supports Monad Testnet natively |
| Backend services | Node.js + TypeScript, `viem`, `hono` for HTTP, `zod` for validation | current LTS | Small, typed, fast to write |
| Frontend | Next.js (App Router) + TypeScript + Tailwind CSS | current stable | Server components for reads, client components for wallets |
| Wallet and chain | `wagmi` + `viem` (`monadTestnet` chain built in) + RainbowKit | current stable | Standard EVM wallet stack |
| Data fetching | TanStack Query (bundled with wagmi) + `graphql-request` for Envio | current stable | Caching, polling, optimistic updates |
| Charts | TradingView `lightweight-charts` for candles; custom SVG for the forward curve | current stable | Fast, small, animatable with GSAP |
| Animation | GSAP + `@gsap/react` (`useGSAP` hook) | 3.13 or later (all plugins free) | Timelines, ScrollTrigger, SplitText, Flip |
| Monorepo | pnpm workspaces + Turborepo | current stable | Shared types and ABIs across packages |
| Hosting | Vercel (web), Envio Cloud (indexer), Railway (services) | n/a | Free tiers cover the hackathon |

## Monad specifics

Silica runs on Monad Testnet, which is EVM-compatible but differs from Ethereum in ways that affect gas, storage and RPC reads.

### Network

| Item | Value |
| --- | --- |
| Chain ID | `10143` |
| Public RPC | `https://testnet-rpc.monad.xyz` (QuickNode, 50 rps; 25 rps for `eth_call` and `eth_estimateGas`) |
| Backup RPCs | `https://rpc.ankr.com/monad_testnet`, `https://rpc-testnet.monadinfra.com` |
| WebSocket | `wss://testnet-rpc.monad.xyz` |
| Explorers | [testnet.monadvision.com](https://testnet.monadvision.com), [testnet.monadscan.com](https://testnet.monadscan.com) |
| Faucet | [faucet.monad.xyz](https://faucet.monad.xyz) |
| Native token | MON |
| Wrapped MON | `0xFb8bf4c1CC7a94c73D209a149eA2AbEa852BC541` |
| Multicall3 | `0xcA11bde05977b3631167028862bE2a173976CA11` |
| Permit2 | `0x000000000022d473030f116ddee9f6b43ac78ba3` |

### Differences that change our design

| Monad behavior | Impact on Silica | What we do |
| --- | --- | --- |
| Gas is charged on the gas **limit**, not gas used | Over-estimated limits burn testnet MON fast, especially for bots and the agent | Set explicit, tight `gas` on every scripted transaction; never use a blanket high limit |
| 400ms blocks, 800ms finality (per the Metropolis brief) | Order fills and slashes appear near-instantly | UI uses optimistic states for under 1 second, then confirms from the receipt; no long "pending" screens |
| Reserve balance rules | A transaction can be included but revert if it spends too much MON | Keep each bot and agent wallet funded well above its spend |
| No global mempool | Transactions go straight to upcoming leaders | Don't build anything that watches pending transactions |
| Limited historical state on full nodes | Old `eth_call` reads may fail | Read history from Envio, never from archive RPC calls |
| Storage priced per 128-slot page | Neighbouring slots are cheap once one is touched | Keep each ticket's and series' fields packed together in one struct |
| 128 KB contract size limit | Size is not a constraint | Keep contracts separate for clarity, not to save size |
| P256 precompile at `0x0100` (EIP-7951) | Available, but not needed in this build | Noted for future passkey signing by provider nodes |

**Tooling requirement:** use Foundry v1.8.0 or later with `network = "monad"` in `foundry.toml`, so local tests use Monad's gas model, opcode pricing and size limits.

## Repository layout

One pnpm + Turborepo monorepo holds every part, and a shared package carries ABIs, addresses and types so nothing is copied by hand.

```
silica/
├─ apps/
│  └─ web/                    # Next.js frontend (App Router, GSAP)
│     ├─ app/                  # routes: /, /markets, /markets/[series], /provider, /tickets, /docs
│     ├─ components/           # UI: OrderBook, ForwardCurve, BondPanel, TicketTimeline
│     ├─ animations/           # GSAP timelines and hooks (one file per motion)
│     └─ lib/                  # wagmi config, Envio client, Kuru client, formatters
├─ contracts/                  # Foundry project
│  ├─ src/                     # SeriesRegistry, SilicaToken, BondVault, RedemptionManager,
│  │                           # DeliveryOracle, SilicaBook (fallback), MockUSDC
│  ├─ test/                    # unit, fuzz and invariant tests
│  ├─ script/                  # Deploy.s.sol, CreateSeries.s.sol, Seed.s.sol
│  └─ foundry.toml             # network = "monad"
├─ cre/                        # Chainlink CRE project
│  ├─ delivery-verifier/       # workflow 1: cron every 5 min
│  ├─ mark-and-margin/         # workflow 2: cron hourly
│  └─ project.yaml             # targets, RPCs
├─ indexer/                    # Envio HyperIndex v3
│  ├─ config.yaml
│  ├─ schema.graphql
│  └─ src/handlers/
├─ services/
│  ├─ provider-agent/          # signed GPU heartbeats + access posting
│  ├─ buyer-probe/             # independent liveness probe of the buyer's machine
│  └─ mm-bot/                  # market-maker quoting (never self-trades)
├─ packages/
│  └─ shared/                  # ABIs, deployed addresses, series IDs, zod schemas, types
├─ .env.example
├─ turbo.json
└─ README.md                   # setup, architecture, attributions, AI disclosure
```

**The one rule:** contract addresses and ABIs are written to `packages/shared` by the deploy script and imported everywhere else. Nobody pastes an address into app code.

## Smart contracts

Six production contracts plus one test token hold every rule and every dollar; offchain code can only call them, never override them.

### Units and conventions

- **Series token:** 18 decimals; `1e18` = one GPU-hour. Redemptions must be whole hours (`amount % 1e18 == 0`).
- **Quote and bond token:** USDC with 6 decimals. Kuru's admin-minted test USDC if Kuru lists us; our own `MockUSDC` otherwise.
- **Prices:** USDC per GPU-hour, 6 decimals (`2_050000` = $2.05).
- **Ratios:** basis points (`3000` = 30%, `15000` = 1.5×).
- **Time:** unix seconds; a delivery window is one ISO week, Monday 00:00 to Sunday 23:59 UTC.

### Roles

| Role | Held by | Can do |
| --- | --- | --- |
| `DEFAULT_ADMIN_ROLE` | Team multisig (a single deployer key on testnet) | Grant roles, pause, set parameters |
| `SERIES_ADMIN_ROLE` | Team | Create series |
| `PROVIDER_ROLE` | KYB'd providers (any test wallet on testnet) | Deposit bond, mint, post access |
| `MINTER_ROLE` (on each token) | `BondVault` | Mint series tokens |
| `BURNER_ROLE` (on each token) | `RedemptionManager` | Burn on redemption |
| `ORACLE_ROLE` | `DeliveryOracle` | Apply verdicts, set marks |
| `ARBITER_ROLE` | Team (pilot only) | Resolve disputed hours |

### Core types

```solidity
struct Series {
    bytes32 gpu;            // "H100-80GB"
    bytes32 region;         // "APAC"
    uint64  deliveryStart;  // Monday 00:00 UTC
    uint64  deliveryEnd;    // Sunday 23:59 UTC
    uint16  bondRatioBps;   // default 3000
    uint16  slashMultBps;   // default 15000
    address token;          // SilicaToken for this series
    uint128 markPrice;      // USDC/hour, 6 decimals
    uint64  markUpdatedAt;
}

struct Position {           // one per (provider, series)
    uint128 bond;           // USDC locked
    uint64  minted;         // hours minted
    uint64  assigned;       // hours assigned to open tickets
    uint64  settled;        // hours confirmed or slashed
    bool    marginCalled;
}

enum TicketStatus { Open, AccessPosted, Settled }

struct Ticket {
    uint256 seriesId;
    address holder;
    address provider;
    uint32  hours;
    uint32  confirmed;
    uint32  missed;
    uint32  disputed;
    uint128 priceAtOpen;    // mark when redeemed; fixes the slash value
    uint64  accessDeadline; // openedAt + 30 minutes
    bytes32 holderKey;      // holder's X25519 public key for encrypted access
    address probeKey;       // key that signs the buyer probe's summaries
    address nodeKey;        // provider node key at redemption time
    TicketStatus status;
}
```

### Key rules

- **Mint check:** `bond ≥ (minted − settled + newHours) × markPrice × bondRatioBps / 10_000`.
- **Provider assignment:** series tokens are fungible across providers, so a redemption is split into one ticket per provider. Hours go to providers in FIFO order of unassigned minted capacity.
- **Slash payout:** `missedHours × priceAtOpen × slashMultBps / 10_000`, paid in USDC to the holder, capped at the provider's remaining bond. Using `priceAtOpen` stops anyone moving the mark to inflate a slash.
- **Missed access:** if no access is posted by `accessDeadline`, anyone can call `slashUnserved(ticketId)` to slash the whole ticket.
- **Expiry:** tokens not redeemed by `deliveryEnd` expire. After all tickets settle, the provider can release its remaining bond.

### Contract reference

| Contract | Function | Caller | What it does |
| --- | --- | --- | --- |
| `SeriesRegistry` | `createSeries(gpu, region, weekStart, bondRatioBps, slashMultBps)` | Series admin | Deploys a `SilicaToken`, stores the series, emits `SeriesCreated` |
| `SeriesRegistry` | `setMark(seriesId, price, scheduledAt)` | Oracle | Updates `markPrice`; rejects stale `scheduledAt` |
| `SilicaToken` | `mint`, `burn` | Vault, RedemptionManager | ERC-20 with role-gated supply; plain transfers so it trades anywhere |
| `BondVault` | `depositBond(seriesId, amount)` | Provider | Pulls USDC, emits `BondDeposited` |
| `BondVault` | `mint(seriesId, hours)` | Provider | Checks the mint rule, mints tokens to provider, emits `Minted` |
| `BondVault` | `checkMargin(provider, seriesId)` | Oracle | Sets `marginCalled` if under-bonded, emits `MarginCall` |
| `BondVault` | `withdrawExcess(seriesId, amount)` / `releaseBond(seriesId)` | Provider | Withdraws bond above requirement / all remaining bond after settlement |
| `RedemptionManager` | `redeem(seriesId, hours, holderKey, probeKey)` | Holder | In the delivery window: burns tokens, opens tickets, emits `Redeemed` per ticket |
| `RedemptionManager` | `postAccess(ticketId, ciphertext)` | Ticket's provider | Emits `AccessPosted` with the encrypted credentials (event only, not stored) |
| `RedemptionManager` | `applyVerdict(ticketId, confirmed, missed, disputed, scheduledAt)` | Oracle | Adds hours, pays slashes from the vault, settles the ticket when complete |
| `RedemptionManager` | `slashUnserved(ticketId)` | Anyone | Slashes the full ticket if access is past its deadline |
| `RedemptionManager` | `resolveDispute(ticketId, toConfirmed, toMissed)` | Arbiter | Converts disputed hours |
| `DeliveryOracle` | `onReport(metadata, report)` | CRE forwarder | Decodes a batch of verdicts and marks, checks chain selector and timestamp, routes them |
| `SilicaBook` (fallback) | `placeLimit`, `cancel`, `marketBuy`, `marketSell` | Anyone | Minimal price-time-priority order book, used only if Kuru can't list us. Also on RedemptionManager: setNodeKey(key), called by a provider to register the key its node signs heartbeats with. Also on DeliveryOracle: relayReport(report), testnet-only, RELAYER\_ROLE while simulationMode is on |

**Custom errors (selection):** `NotProvider`, `BondTooLow(required, have)`, `OutsideDeliveryWindow`, `NotWholeHours`, `AccessAlreadyPosted`, `DeadlineNotPassed`, `StaleReport(scheduledAt, last)`, `WrongChain(selector)`, `TicketSettled`, `MarginCalled`.

**Every state change emits an event**, because Envio builds the whole read model from events: `SeriesCreated`, `MarkUpdated`, `BondDeposited`, `Minted`, `MarginCall`, `BondReleased`, `Redeemed`, `AccessPosted`, `HoursConfirmed`, `HoursSlashed`, `HoursDisputed`, `TicketSettled`.

## End-to-end flow

One GPU-hour goes from a provider's bond to a final verdict in nine steps, and only steps 7 and 8 happen offchain.

&#91;embedded content: end-to-end sequence · 6 participants, 9 steps\]

Steps 7 and 8 repeat every delivery hour until the ticket settles. Step 9 happens only when both the provider's heartbeat and the buyer's probe show the hour was missed; if they disagree, the hour is held as disputed instead.

## Order book integration

Silica trades on Kuru's onchain order book when Kuru lists our series, and on its own minimal book otherwise. One adapter interface hides which one is live, so the frontend and bots never change.

### Kuru Spot V2 facts that shape the design

| Fact (from Kuru testnet docs) | Consequence for Silica |
| --- | --- |
| Market creation is permissioned; tokens must be governance-whitelisted | Kuru must whitelist each `SilicaToken` and deploy each market. Request W44 to W47 tonight |
| Test USDC (`0xA402B424f392EAA05DBc8779e4502A1F6A96fEF1`) is admin-mintable, with no public faucet | Ask Kuru to mint test USDC to our provider, bot and judge wallets |
| Funds are deposited into `AccountCore` (`0xdbaaDe7B42c95399bb1E9614D51B5B9e2cf78038`) before trading | Providers and bots deposit once, then quote from their trading balance |
| Minimum order notional is 10 USDC | At about $2 per hour, the smallest order is 5 GPU-hours; the UI enforces this |
| Prices must be tick-aligned and fit in 32 bits | Read `getMarketParams` once and snap every price to the tick |
| Each user has 62 order slots per market | The market-maker bot quotes at most a few levels per side |
| Post-fill hooks can refresh a maker's quotes after a fill | Stretch goal: bond-aware quoting for providers |

### Placing an order through Kuru

```ts
import { createKuruClient, NativeSide, NativeTif, NativeExecInstruction } from "@toxicflow-labs/ts-sdk";

const kuru = createKuruClient({ publicClient, walletClient, account, addresses: { accountCore } });
const userId = await kuru.account.getRootAccountId({ rootOwner: account.address });

await kuru.spot.batch({
  market,                       // the Silica series market Kuru deployed
  userId,
  orders: [{
    side: NativeSide.SELL,      // provider offering GPU-hours
    quantity,                   // scaled by the market's size precision
    price,                      // tick-aligned, scaled by price precision
    tif: NativeTif.GTC,
    executionInstruction: NativeExecInstruction.POST_ONLY,
    minSizeAfterBlock: 0n,
  }],
  cancelSlotIdxs: [],
});
```

**Market data for the UI** comes from Kuru's Data Source REST API (markets, candles, trades) and its Exchange WebSocket (L2 book deltas, trades). Take the base URLs from Kuru's API docs at build time.

### Fallback: `SilicaBook`

A small onchain limit-order book, one instance per series, used only if Kuru can't list us in time.

- **Escrow:** asks escrow series tokens, bids escrow USDC, both inside the book contract.
- **Matching:** price-time priority, matched at placement time, capped at 20 fills per transaction to bound gas.
- **Price levels:** $0.01 ticks, each a FIFO queue.
- **Events:** `OrderPlaced`, `OrderCancelled`, `Trade`, which Envio indexes exactly like Kuru fills.

### The adapter

```ts
// packages/shared/orderbook.ts
export interface OrderBookAdapter {
  placeLimit(p: { seriesId: bigint; side: "buy" | "sell"; hours: number; price: number }): Promise<Hash>;
  cancel(orderRef: string): Promise<Hash>;
  getBook(seriesId: bigint, depth: number): Promise<{ bids: Level[]; asks: Level[] }>;
  onTrades(seriesId: bigint, cb: (t: Trade) => void): () => void;
}
// ORDERBOOK=kuru | silica selects the implementation at startup
```

## Chainlink CRE workflows

Two TypeScript workflows are Silica's settlement layer. Each runs on a cron trigger, fetches offchain data under node consensus, and delivers one signed report to `DeliveryOracle` through Chainlink's forwarder.

### How a CRE write reaches our contract

1. The workflow ABI-encodes its result and calls `runtime.report()` to get a signed report.
2. The DON (decentralized oracle network) reaches consensus on the report.
3. `evmClient.writeReport()` submits it to Chainlink's `KeystoneForwarder`.
4. The forwarder verifies signatures and calls `DeliveryOracle.onReport(metadata, report)`.

`DeliveryOracle` inherits Chainlink's `ReceiverTemplate`, which checks the caller is the configured forwarder and implements ERC-165. We override `_processReport` with Silica's logic.

### Workflow 1: Delivery Verifier

| Step | Capability | Detail |
| --- | --- | --- |
| Trigger | Cron | Hourly at minute 2 (`0 2 * * * *`); in demo mode a "delivery hour" is 5 minutes |
| Read open tickets | EVM read | `RedemptionManager.getOpenTickets(offset, limit)` |
| Fetch provider evidence | HTTP GET | `provider-agent /summary/{ticketId}/{hour}`: 12 heartbeat results plus a signature from the provider node key |
| Fetch buyer evidence | HTTP GET | `buyer-probe /summary/{ticketId}/{hour}`: 12 independent probe results plus the probe key's signature |
| Consensus | Node mode + aggregation | Each node parses both summaries into counts; identical-value aggregation on the counts and signatures |
| Decide | Workflow code | Both ≥ 11 of 12 → confirmed; both below → missed; otherwise disputed |
| Write | EVM write | One report holding every ticket's verdict for that hour |

**Signatures are verified onchain**, not in the workflow: `DeliveryOracle` runs `ecrecover` on each summary against the provider node key and probe key registered on the ticket. Faked evidence fails even if every node agrees on it.

### Workflow 2: Mark & Margin

| Step | Capability | Detail |
| --- | --- | --- |
| Trigger | Cron | Hourly at minute 5 |
| Fetch prices | HTTP GET | Kuru market data: best bid and ask per series → mid-price; median aggregation |
| Fetch reliability | HTTP POST | Envio GraphQL: each provider's confirmed and missed hours |
| Read positions | EVM read | `BondVault` positions and series marks |
| Compute | Workflow code | New mark per series; bond ratio per provider (30%, or 20% after 1,000 confirmed hours at 99% or better); list of under-bonded providers |
| Write | EVM write | One report with marks, ratios and margin calls |

### Report format

```solidity
struct Verdict { uint256 ticketId; uint32 hour; uint8 kind; bytes providerSig; bytes probeSig; } // kind: 0 confirm, 1 miss, 2 dispute
struct Mark    { uint256 seriesId; uint128 price; }
struct Ratio   { address provider; uint256 seriesId; uint16 bondRatioBps; }

struct Report {
    uint64    chainSelector;   // Monad Testnet; rejects cross-chain replay
    uint64    scheduledAt;     // cron slot time; must increase; rejects same-chain replay
    Verdict[] verdicts;
    Mark[]    marks;
    Ratio[]   ratios;
}
```

Both replay protections follow Chainlink's consumer-contract guidance. `scheduledAt` comes from the cron trigger's scheduled time, not wall-clock time, so every node agrees on it.

### Skeleton (Delivery Verifier)

```ts
import { CronCapability, HTTPClient, EVMClient, handler, Runner, type Runtime } from "@chainlink/cre-sdk";

const onCron = (runtime: Runtime<Config>) => {
  const tickets = readOpenTickets(runtime);                    // EVMClient read
  const evidence = new HTTPClient()
    .sendRequest(runtime, fetchSummaries, consensusOnCounts)(runtime.config)
    .result();                                                 // runs on every node, then aggregates
  const verdicts = decide(tickets, evidence);                  // 11-of-12 rule
  const report = runtime.report(encodeReport(verdicts)).result();
  new EVMClient(runtime.config.chainSelector)
    .writeReport(runtime, { receiver: runtime.config.oracle, report, gasConfig: { gasLimit: runtime.config.gasLimit } })
    .result();                                                 // check txStatus and receiver status
};

const initWorkflow = (config: Config) => [handler(new CronCapability().trigger({ schedule: config.schedule }), onCron)];
export async function main() { const r = await Runner.newRunner<Config>(); await r.run(initWorkflow); }
```

Check exact `runtime.report()` input and `EVMClient` construction against Chainlink's "Writing Data Onchain" guide for your SDK version.

### Simulation versus deployment

Chainlink's docs say `cre workflow simulate` uses a mock forwarder that records the report but does not call the consumer's `onReport()`. So simulation alone proves the workflow, not the onchain effect. The plan:

1. **Tonight:** run `cre account access` to request deploy access. It is reviewed by Chainlink and confirmed by email.
2. **If approved:** `cre workflow deploy` both workflows; the real `KeystoneForwarder` writes to Monad Testnet.
3. **If not approved in time:** record `cre workflow simulate` for the bounty video (simulation satisfies the bounty). For the live product, a testnet-only `relayReport()` on `DeliveryOracle` accepts the same signed report bytes from a `RELAYER_ROLE` while `simulationMode` is on. The README states this plainly.

**Setup commands:**

```bash
cre login
cre update                          # CLI v1.30.0+ for Monad Testnet
cre workflow supported-chains       # confirm Monad Testnet and its forwarder addresses
cre workflow simulate ./delivery-verifier --target staging-settings
cre account access                  # request deploy access
```

**Forwarder addresses:** deploy `DeliveryOracle` with the mock forwarder address for simulation and switch it with `setForwarderAddress()` to the `KeystoneForwarder` for deployment. Both come from Chainlink's Forwarder Directory or `cre workflow supported-chains`. Do not set workflow ID or author checks while simulating; the mock forwarder doesn't supply that metadata.

## Backend services

Three small Node.js + TypeScript services produce the offchain evidence and liquidity; none of them can move money on their own.

### Signed evidence format (shared by agent and probe)

Both services sign each hourly summary as EIP-712 typed data, so `DeliveryOracle` can verify it with OpenZeppelin's `EIP712` and `ECDSA` libraries.

```solidity
// domain: name "Silica", version "1", chainId 10143, verifyingContract = DeliveryOracle
struct HourSummary {
    uint256 ticketId;
    uint32  hour;          // hour index since the ticket opened
    uint8   okChecks;      // 0 to 12
    bytes32 gpuIdHash;     // keccak256 of the GPU UUID reported by nvidia-smi
}
```

### `provider-agent` (runs on the provider's GPU host)

1. **Watch:** subscribes to `Redeemed` events for its tickets over the Monad WebSocket RPC.
2. **Provision:** creates an isolated user or container with an SSH key or a Jupyter token for the ticket.
3. **Deliver access:** encrypts the credentials to the holder's X25519 key (a libsodium sealed box) and calls `postAccess(ticketId, ciphertext)` before the 30-minute deadline.
4. **Heartbeat:** every 5 minutes runs `nvidia-smi --query-gpu=uuid,name,utilization.gpu,memory.used --format=csv` and records the result.
5. **Summarize:** at each hour boundary, signs a `HourSummary` with the node key registered via `setNodeKey`.

| Endpoint | Returns |
| --- | --- |
| `GET /summary/:ticketId/:hour` | `HourSummary` plus signature |
| `GET /health` | Agent status |
| `POST /demo/fail` (demo mode only) | Stops heartbeats so the demo can show a slash |

**Demo mode:** `FAKE_GPU=1` returns simulated `nvidia-smi` output, so the agent runs on any VM; the README says so.

### `buyer-probe` (runs on the buyer's side)

- Every 5 minutes, connects to the delivered machine with the decrypted credentials and runs the same `nvidia-smi` query.
- A check counts as OK only if the machine answers and the GPU UUID hash matches the provider's.
- Signs its own `HourSummary` with the probe key the holder set at redemption, served at `GET /summary/:ticketId/:hour`.
- For the hackathon, we run the probe on the holder's behalf; in production the holder runs it.

### `mm-bot` (market maker)

- Quotes 3 levels per side around the series mark, with a configurable spread and sizes at or above Kuru's 10 USDC minimum.
- Refreshes quotes every 15 seconds and on each fill.
- **Never trades with itself.** Fills come only from separate, clearly labeled test-buyer wallets, and the README calls all of it "testnet simulated liquidity". This keeps us clear of the wash-trading rule.

### Shared service conventions

- `viem` clients with explicit `gas` on every transaction, because Monad charges the gas limit.
- Config validated with `zod` at startup; services refuse to start with a missing variable.
- Structured JSON logs, so each slash or confirmation can be traced in the demo.

## Envio indexer

Envio HyperIndex v3 turns every Silica event into a queryable read model, and two consumers depend on it: the web app's charts and the Mark & Margin workflow's reliability scores. Envio supports Monad Testnet natively through HyperSync (`https://monad-testnet.hypersync.xyz`), so no RPC is needed.

### `config.yaml`

```yaml
name: silica-indexer
contracts:
  - name: SeriesRegistry
    events:
      - event: "SeriesCreated(uint256 indexed seriesId, address token, bytes32 gpu, bytes32 region, uint64 deliveryStart, uint64 deliveryEnd)"
      - event: "MarkUpdated(uint256 indexed seriesId, uint128 price, uint64 scheduledAt)"
  - name: BondVault
    events:
      - event: "BondDeposited(address indexed provider, uint256 indexed seriesId, uint256 amount)"
      - event: "Minted(address indexed provider, uint256 indexed seriesId, uint64 hours)"
      - event: "MarginCall(address indexed provider, uint256 indexed seriesId, uint256 shortfall)"
      - event: "BondReleased(address indexed provider, uint256 indexed seriesId, uint256 amount)"
  - name: RedemptionManager
    events:
      - event: "Redeemed(uint256 indexed ticketId, uint256 indexed seriesId, address holder, address provider, uint32 hours, uint128 priceAtOpen)"
      - event: "HoursConfirmed(uint256 indexed ticketId, uint32 hours)"
      - event: "HoursSlashed(uint256 indexed ticketId, uint32 hours, uint256 payout)"
      - event: "HoursDisputed(uint256 indexed ticketId, uint32 hours)"
      - event: "TicketSettled(uint256 indexed ticketId)"
  - name: SilicaBook
    events:
      - event: "Trade(uint256 indexed seriesId, address maker, address taker, bool takerBuys, uint32 hours, uint128 price)"
chains:
  - id: 10143
    start_block: 0
    contracts:
      - name: SeriesRegistry
        address: "${ENVIO_SERIES_REGISTRY}"
      - name: BondVault
        address: "${ENVIO_BOND_VAULT}"
      - name: RedemptionManager
        address: "${ENVIO_REDEMPTION_MANAGER}"
      - name: SilicaBook
        address: "${ENVIO_SILICA_BOOKS}"
```

Addresses come from environment variables written by the deploy script. If Kuru lists our markets, add Kuru's `OrderBook` contract for our market addresses and decode its packed fill records with the Kuru SDK's decoder.

### `schema.graphql`

```graphql
type Series { id: ID!  gpu: String!  region: String!  deliveryStart: BigInt!  deliveryEnd: BigInt!
  token: String!  mark: BigInt!  openInterestHours: BigInt!  volumeHours: BigInt!  candles: [Candle!]! @derivedFrom(field: "series") }

type Provider { id: ID!  bondLocked: BigInt!  hoursMinted: BigInt!  hoursConfirmed: BigInt!  hoursMissed: BigInt!
  hoursDisputed: BigInt!  reliabilityBps: Int!  marginCalls: Int!  tickets: [Ticket!]! @derivedFrom(field: "provider") }

type Ticket { id: ID!  series: Series!  provider: Provider!  holder: String!  hours: Int!  confirmed: Int!
  missed: Int!  disputed: Int!  priceAtOpen: BigInt!  status: String!  openedAt: BigInt! }

type Candle { id: ID!  series: Series!  bucketStart: BigInt!  open: BigInt!  high: BigInt!  low: BigInt!  close: BigInt!  volumeHours: BigInt! }

type MarginCallEvent { id: ID!  provider: Provider!  series: Series!  shortfall: BigInt!  at: BigInt! }
```

### Handler example

```ts
import { indexer } from "envio";

indexer.onEvent({ contract: "RedemptionManager", event: "HoursConfirmed" }, async ({ event, context }) => {
  const ticket = await context.Ticket.getOrThrow(event.params.ticketId.toString());
  const provider = await context.Provider.getOrThrow(ticket.provider_id);
  const confirmed = provider.hoursConfirmed + BigInt(event.params.hours);
  const total = confirmed + provider.hoursMissed;
  context.Ticket.set({ ...ticket, confirmed: ticket.confirmed + Number(event.params.hours) });
  context.Provider.set({ ...provider, hoursConfirmed: confirmed,
    reliabilityBps: total === 0n ? 10_000 : Number((confirmed * 10_000n) / total) });
});
```

### Derived data

| Entity or field | Built from | Used by |
| --- | --- | --- |
| `Provider.reliabilityBps` | `HoursConfirmed`, `HoursSlashed` | Mark & Margin workflow (bond ratio), provider leaderboard |
| `Candle` (1-hour buckets) | `Trade` events | Price chart |
| `Series.mark` per series | `MarkUpdated` | Forward curve across delivery weeks |
| `Series.openInterestHours` | `Minted` minus `Redeemed` | Market stats |
| `MarginCallEvent` | `MarginCall` | Provider risk panel |

**Commands:** `pnpx envio init` to scaffold, `pnpm codegen` after each config or schema change, `pnpm dev` to run locally, then deploy to Envio Cloud for a public GraphQL endpoint.

## Frontend

The web app is a Next.js App Router project: server components render first paint from Envio data, client components handle wallets and live updates, and GSAP carries all motion. The goal is a trading screen a trader would trust with capital: dark, dense, legible, and fast.

### Routes

| Route | Purpose | Main components |
| --- | --- | --- |
| `/` | Landing and scroll story of how Silica works | `Hero`, `LifecycleStory`, `LiveStats` |
| `/markets` | All series and the forward curve | `SeriesGrid`, `ForwardCurve` |
| `/markets/[seriesId]` | Trading screen for one series | `OrderBook`, `PriceChart`, `OrderForm`, `BondRiskPanel`, `RecentTrades` |
| `/provider` | Provider console | `BondDeposit`, `MintForm`, `NodeKeyForm`, `PositionTable`, `MarginStatus` |
| `/tickets` | Holder's redemptions and delivery | `RedeemForm`, `TicketTimeline`, `AccessReveal` |
| `/status` | Judge-facing proof page | Contract addresses, latest CRE reports, explorer links |

### Data layer

| Data | Source | How it updates |
| --- | --- | --- |
| Series, candles, provider stats, tickets | Envio GraphQL via `graphql-request` | Server component on load, then TanStack Query polling every 2 seconds |
| Order book and recent trades | Kuru WebSocket (or `SilicaBook` events) | Live push into a small store |
| Balances, allowances, positions | `wagmi` `useReadContracts` (batched through Multicall3) | Refetch after each confirmed transaction |
| Writes | `wagmi` `useWriteContract` with explicit `gas` | Optimistic UI, then confirm from the receipt (about 1 second on Monad) |

### Wallet and encryption

- `wagmi` + RainbowKit, using `monadTestnet` from `viem/chains`, with a primary and a fallback RPC transport.
- **Holder encryption key without storage:** the app asks the wallet to sign a fixed message, hashes the signature into a seed, and derives the X25519 key pair from it. The same wallet always reproduces the same key, so access credentials can be decrypted on any device and nothing is saved.
- Access ciphertext is read from the `AccessPosted` event and decrypted in the browser only.

### Visual system

- Dark theme by default, with a numeric font using tabular figures so prices don't jitter.
- Colour carries meaning only: green for confirmed and bids, red for slashed and asks, amber for disputed and margin calls.
- Every risk number (bond coverage, slash payout, delivery window) is visible on the trading screen, because the track scores "clear risk disclosure".

### GSAP animation system

GSAP is fully free since Webflow's acquisition, including SplitText, DrawSVG, Flip and ScrollSmoother. Use 3.13 or later with `@gsap/react`.

**Setup, once, in a client module:**

```ts
// apps/web/animations/gsap.ts
"use client";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { Flip } from "gsap/Flip";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText, Flip, DrawSVGPlugin);
gsap.defaults({ ease: "power3.out", duration: 0.5 });
export { gsap, useGSAP, ScrollTrigger, SplitText, Flip };
```

**Component pattern:**

```tsx
"use client";
import { useRef } from "react";
import { gsap, useGSAP } from "@/animations/gsap";

export function BondGauge({ coverage }: { coverage: number }) {
  const root = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.to(".gauge-fill", { scaleX: coverage, transformOrigin: "left center" });
    });
    mm.add("(prefers-reduced-motion: reduce)", () => {
      gsap.set(".gauge-fill", { scaleX: coverage, transformOrigin: "left center" });
    });
  }, { scope: root, dependencies: [coverage] });
  return <div ref={root}><div className="gauge-fill" /></div>;
}
```

**Rules:** all GSAP runs inside `useGSAP` with a `scope` ref (it reverts on unmount); never call `gsap` during server render; wrap event-handler animations in `contextSafe`; animate only `transform` and `opacity`; use `gsap.quickTo` for high-frequency updates; honour `prefers-reduced-motion` through `gsap.matchMedia`.

**Motion inventory:**

| Where | Motion | GSAP features | Timing |
| --- | --- | --- | --- |
| Landing headline | Lines rise in, staggered | `SplitText`, stagger | 0.8s, 0.06s stagger |
| Lifecycle scroll story | Section pins; each step (bond, mint, trade, redeem, verify, slash) lights up as you scroll | `ScrollTrigger` pin + scrub, timeline labels | Scroll-linked |
| Forward curve | Line draws in on load; points glide to new marks | `DrawSVGPlugin`, `attr` tweens | 1.0s draw, 0.4s glide |
| Order book | Levels re-sort smoothly; size changes flash | `Flip`, `quickTo` on background colour | 0.3s |
| Fill confirmation | Balance numbers roll to new values | Tween on a proxy object with `snap` | 0.6s |
| Bond gauge | Fill eases to new coverage; margin call pulses | `scaleX` tween, `repeat` + `yoyo` | 0.5s, 1.2s pulse |
| Ticket timeline | Confirmed hours tick in; a slashed hour shakes and turns red | Stagger, keyframes | 0.04s per hour |
| Route changes | Content fades and lifts in | Timeline in `template.tsx` | 0.35s |

## Wiring it together

One deploy script writes every address and ABI into `packages/shared`; every other package reads from there or from environment variables generated from it.

### `packages/shared`

| File | Contents | Written by |
| --- | --- | --- |
| `addresses.10143.json` | All contract addresses, series IDs, token addresses, Kuru market addresses | `Deploy.s.sol` and `CreateSeries.s.sol` (plus a manual edit when Kuru lists markets) |
| `abis.ts` | Typed ABIs | `@wagmi/cli` with its Foundry plugin, after `forge build` |
| `orderbook.ts` | `OrderBookAdapter` interface and both implementations | Hand-written |
| `schemas.ts` | `zod` schemas for configs, `HourSummary`, API responses | Hand-written |
| `units.ts` | Hour, USDC and basis-point conversion helpers | Hand-written |

### Environment variables

| Package | Variables |
| --- | --- |
| `contracts` | `PRIVATE_KEY`, `RPC_URL`, `USDC_ADDRESS` (blank deploys `MockUSDC`), `FORWARDER_ADDRESS`, `CHAIN_SELECTOR` |
| `apps/web` | `NEXT_PUBLIC_RPC_URL`, `NEXT_PUBLIC_RPC_FALLBACK`, `NEXT_PUBLIC_ENVIO_URL`, `NEXT_PUBLIC_ORDERBOOK` (`kuru` or `silica`), `NEXT_PUBLIC_WALLETCONNECT_ID` |
| `indexer` | `ENVIO_SERIES_REGISTRY`, `ENVIO_BOND_VAULT`, `ENVIO_REDEMPTION_MANAGER`, `ENVIO_SILICA_BOOKS`, plus an Envio API token if your plan requires one |
| `cre` | `config.json`: `schedule`, `oracle`, `chainSelector`, `gasLimit`, service URLs; secrets: Envio and Kuru API keys |
| `services/provider-agent` | `PROVIDER_KEY`, `NODE_KEY`, `RPC_WS_URL`, `FAKE_GPU`, `DEMO_MODE` |
| `services/buyer-probe` | `PROBE_KEY`, `RPC_URL` |
| `services/mm-bot` | `MM_KEY`, `SPREAD_BPS`, `LEVELS`, `REFRESH_MS` |

Every service has a `.env.example`; real `.env` files are gitignored. Keys are testnet-only and never reused.

### Deployment order

1. **Contracts:** deploy `MockUSDC` (only if Kuru USDC isn't available), `SeriesRegistry`, `BondVault`, `RedemptionManager`, then `DeliveryOracle` with the mock forwarder address.
2. **Roles:** grant `ORACLE_ROLE` to `DeliveryOracle`, `MINTER_ROLE` to `BondVault` and `BURNER_ROLE` to `RedemptionManager` on each token, and `PROVIDER_ROLE` to test providers.
3. **Series:** `CreateSeries.s.sol` creates H100·APAC weeks 44 to 47 and writes token addresses to `packages/shared`.
4. **Verify** every contract on the Monad Testnet explorer, so judges can read the source.
5. **Kuru:** send token addresses for whitelisting and market deployment; record market addresses when they arrive. Until then, `NEXT_PUBLIC_ORDERBOOK=silica`.
6. **Indexer:** deploy to Envio Cloud with the addresses; note the GraphQL URL.
7. **CRE:** point `config.json` at `DeliveryOracle`, simulate both workflows, request deploy access.
8. **Services:** start `provider-agent`, `buyer-probe` and `mm-bot` on Railway.
9. **Web:** deploy to Vercel with the public variables.
10. **Seed:** providers deposit bonds and mint, the bot quotes, test buyers trade and redeem.

## Security model

The contracts trust only three things: their own roles, the Chainlink forwarder, and signatures from keys registered onchain. Every threat below maps to a control in code.

| Threat | Control |
| --- | --- |
| Forged delivery verdicts | `DeliveryOracle` accepts reports only from the configured forwarder (`ReceiverTemplate`); after deployment, also pin the workflow ID |
| Provider fakes heartbeats | A verdict needs the provider's and the probe's EIP-712 signatures, verified onchain; disagreement becomes a dispute, never a payout |
| Buyer fakes an outage to take the bond | The same rule: the provider's signed heartbeat keeps the hour disputed, not slashed |
| Replayed report | Report carries `chainSelector` and a strictly increasing `scheduledAt`; stale or wrong-chain reports revert |
| Slash inflated by moving the mark | Slash uses `priceAtOpen`, fixed at redemption |
| Provider mints beyond its bond | Mint rule checked on every mint; margin calls block minting |
| Reentrancy on USDC payouts | `ReentrancyGuard` on every function that moves funds; checks-effects-interactions order |
| Unsafe token calls | OpenZeppelin `SafeERC20` everywhere |
| Leaked access credentials | Credentials only travel encrypted to the holder's key, in an event; never stored onchain or on a server |
| Leaked keys in the repo | `.env` gitignored; separate testnet-only keys per service; no secrets in the submission |
| Relay backdoor left on | `relayReport()` works only while `simulationMode` is true and only for `RELAYER_ROLE`; turning it off is one admin call and it is documented in the README |
| Admin abuse | Testnet: single admin key, disclosed. Mainnet plan: multisig plus timelock on parameter changes |

## Testing strategy

Tests focus on the money paths: minting against bonds, redeeming, and paying or withholding slashes. Everything runs under Foundry's Monad execution mode so gas and limits match the real chain.

| Layer | Tool | What is covered |
| --- | --- | --- |
| Unit | `forge test --network monad` | Every function's happy path and each custom error |
| Fuzz | Foundry fuzzing | Mint rule never lets bond fall below requirement; slash payout never exceeds remaining bond; whole-hour redemption |
| Invariant | Foundry invariant tests | Vault USDC balance ≥ sum of all bonds; token supply = minted − redeemed; settled hours never exceed ticket hours |
| Oracle | Unit tests with signed fixtures | Valid report accepted; wrong forwarder, wrong chain, stale `scheduledAt`, bad signature all revert |
| Fork | `anvil --fork-url https://testnet-rpc.monad.xyz` | Full flow against live Kuru and USDC contracts before touching testnet |
| Workflows | `cre workflow simulate` | Both workflows end to end against the deployed contracts and running services |
| Indexer | Envio's built-in testing framework | Handlers produce the right `Provider` and `Ticket` values from sample events |
| End to end | Scripted scenario (`pnpm demo:happy`, `pnpm demo:slash`) | Mint, trade, redeem, deliver, confirm; and the same with a forced outage ending in a slash |

**Before recording the demo**, run both scenarios twice on testnet and keep the transaction hashes for the README and the `/status` page.

## Deployment and hosting

Every piece runs on a free tier, and judges get one link, one funded wallet and one status page.

| Component | Host | Notes |
| --- | --- | --- |
| Contracts | Monad Testnet | Verified on the explorer; addresses listed in the README and on `/status` |
| Web app | Vercel | Preview deploy per branch; production on `main` |
| Indexer | Envio Cloud | Public GraphQL endpoint used by the app and the CRE workflow |
| CRE workflows | Chainlink DON if deploy access is granted; otherwise local simulation | See "Simulation versus deployment" above |
| `provider-agent`, `buyer-probe`, `mm-bot` | Railway (one service each) | Always-on; logs kept for the demo |
| Secrets | Each host's secret store | Never committed |

### What judges receive

- **Live link** to the Vercel app.
- **A funded test wallet** (testnet MON plus test USDC) with its private key in the submission's access notes, labeled testnet-only.
- **`/status` page** listing every contract address, the latest CRE report, and explorer links to sample mint, trade, redeem, confirm and slash transactions.
- **README** with setup steps, architecture, attributions (OpenZeppelin, Chainlink `ReceiverTemplate`, Kuru SDK, Envio) and the AI-tool disclosure the rules require.

## Sources

- [Monad Testnet network information](https://docs.monad.xyz/developer-essentials/testnets)
- [Differences between Monad and Ethereum](https://docs.monad.xyz/developer-essentials/differences)
- [Foundry on Monad](https://docs.monad.xyz/tooling-and-infra/toolkits/foundry)
- [Chainlink CRE supported networks](https://docs.chain.link/cre/supported-networks-ts)
- [Chainlink CRE onchain write overview](https://docs.chain.link/cre/guides/workflow/using-evm-client/onchain-write/overview-ts)
- [Chainlink CRE consumer contracts and ReceiverTemplate](https://docs.chain.link/cre/guides/workflow/using-evm-client/onchain-write/building-consumer-contracts)
- [Chainlink CRE HTTP GET with consensus](https://docs.chain.link/cre/guides/workflow/using-http-client/get-request-ts)
- [Chainlink CRE deploy access](https://docs.chain.link/cre/account/deploy-access)
- [Kuru first trade (SDK quickstart)](https://kuru-testnet-docs.mintlify.site/sdk/quickstart.md)
- [Kuru testnet getting started](https://kuru-testnet-docs.mintlify.site/introduction/getting-started.md)
- [Kuru SpotRouter](https://kuru-testnet-docs.mintlify.site/contracts/spot-router.md)
- [Kuru post-fill hooks](https://kuru-testnet-docs.mintlify.site/matching-engine/post-fill-hooks.md)
- [Envio on Monad Testnet](https://envio.dev/chains/monad-testnet)
- [Envio config.yaml](https://docs.envio.dev/docs/HyperIndex/configuration-file)
- [Envio event handlers](https://docs.envio.dev/docs/HyperIndex/event-handlers)
- [GSAP official AI skills (free plugins, React usage)](https://github.com/greensock/gsap-skills)
