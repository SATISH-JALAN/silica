# Testnet proof

Everything below is a real Monad Testnet transaction or a live query. Explorer: [testnet.monadvision.com](https://testnet.monadvision.com).

## Protocol totals

Indexed by Envio at the time of writing:

<div class="stats">
  <div class="stat"><b>7</b><span>tickets</span></div>
  <div class="stat"><b>24</b><span>hours redeemed</span></div>
  <div class="stat"><b>15</b><span>hours confirmed</span></div>
  <div class="stat"><b>9</b><span>hours missed</span></div>
  <div class="stat"><b>$27.29</b><span>slashed to buyers</span></div>
  <div class="stat"><b>15</b><span>trades</span></div>
  <div class="stat"><b>$228.94</b><span>volume</span></div>
  <div class="stat"><b>24</b><span>oracle reports</span></div>
</div>

<Fig name="proofOutcomes" />

## Chainlink CRE, through Chainlink's forwarder

| What | Tx |
| --- | --- |
| `delivery-verifier --broadcast`: ticket 7 hour 0 **missed**, $3.05 to the buyer | [`0xf39c4691…53b8`](https://testnet.monadvision.com/tx/0xf39c4691e4c0e35b5a0ce69833f7cee6a0fa7e7e53cbbc61f3e256aa874453b8) |
| `mark-and-margin --broadcast`: 1 mark, 5 ratios, 6 margin checks; NeoGPU **margin-called** on 4 series | [`0x8dc3ab5e…19b0`](https://testnet.monadvision.com/tx/0x8dc3ab5edb43d9b5952eb7aa158c214cfd487960ed1dc2076c9e5efb2dfa19b0) |
| `delivery-verifier --broadcast`: ticket 4 hour 0 **confirmed** | [`0x98907a4d…9089`](https://testnet.monadvision.com/tx/0x98907a4d485a6b0dfbb2d074388959783a152fbb92d12d33fb0166abd2209089) |
| `delivery-verifier --broadcast`: ticket 4 hour 1 **confirmed** | [`0xf9c10beb…d168`](https://testnet.monadvision.com/tx/0xf9c10beb5c460b3c9b35e45a9073f94bc24115c2225bb72cb61e4f1fb503d168) |

## The outage scenario (ticket #2)

Buyer paid **$6.06** = 2 hours × $2.02 × 1.5.

| Step | Tx |
| --- | --- |
| Buy W42 hours | [`0x212cecb6…56d3`](https://testnet.monadvision.com/tx/0x212cecb6f65d15fc14bc5d5ab57bad80126f65b1191da75273af42a11a7956d3) |
| Redeem | [`0x0d453a4b…4bdb`](https://testnet.monadvision.com/tx/0x0d453a4b9ca542d4b85a2fe214ce23ba5f7cc23bbe13c27092cf8bc3e8df4bdb) |
| Sealed access posted | [`0x17969401…df57`](https://testnet.monadvision.com/tx/0x17969401bb2f7a741b9badca6e2df7b740962d8e0d97abd18532904b4d73df57) |
| Hour 0 confirmed | [`0x2a054d06…6412`](https://testnet.monadvision.com/tx/0x2a054d06edd32d158b03992f3b78d4ed5e5b49b914a4931ef3e8fed8aaf86412) |
| Hour 1 slashed | [`0x01889e32…29ca`](https://testnet.monadvision.com/tx/0x01889e326fef3d4eddd8f0a90080bcce38d38f47415961259d07464ae85229ca) |
| Hour 2 slashed | [`0x8b9265b4…7e0a`](https://testnet.monadvision.com/tx/0x8b9265b49afcfd969fc1eb437869810ee36e247c72cbd7a4290dbbce72667e0a) |
| Hour 3 confirmed | [`0x733bc986…3102`](https://testnet.monadvision.com/tx/0x733bc986360ed7fc9e45c807446ec9520dc5db07d6431e45723f2313238b3102) |

## The happy path through CRE (ticket #4)

| Step | Tx |
| --- | --- |
| Buy | [`0xc01a8702…ebd5`](https://testnet.monadvision.com/tx/0xc01a870231fa911854630fe51149f55dc67dce28ac85dfbdca3fa59e7162ebd5) |
| Redeem | [`0xd6567e1b…8ab9`](https://testnet.monadvision.com/tx/0xd6567e1b2b04f7e089b0f298d6f8cd3c9addc70b3e082f9efcd97f8c98ed8ab9) |
| Access posted | [`0xbd095c9b…0374`](https://testnet.monadvision.com/tx/0xbd095c9ba8bd931be9a7133d9bef5d845cbc448b42d7a7dafd9f8f2df9c40374) |
| Hours 0 and 1 confirmed via CRE | see the CRE table above |

## Verify it yourself

```bash
# a ticket's onchain state: (seriesId, holder, provider, hrs, confirmed, missed, disputed, …)
cast call 0xf21bd145cd5C7d306033bfdF5FE9Cf87c3738dab \
  'getTicket(uint256)((uint256,address,address,uint32,uint32,uint32,uint32,uint128,uint64,uint64,uint64,bytes32,address,address,uint8))' \
  7 --rpc-url https://testnet-rpc.monad.xyz

# the CRE writes went to Chainlink's simulation forwarder
cast tx 0xf39c4691e4c0e35b5a0ce69833f7cee6a0fa7e7e53cbbc61f3e256aa874453b8 to --rpc-url https://testnet-rpc.monad.xyz
# → 0xB9F79d863261869B234c481D1f9A7af84AeAd192
```

```graphql
# Envio: every report and the path it took
{ CreReport(order_by: {id: desc}, limit: 10) { id verdicts applied marks ratios checks relayed txHash } }
```

## Contracts

All 11 contracts and the 5 Kuru feeds are verified on MonadVision (Sourcify, exact match). Addresses: [Contracts overview](/contracts/overview).
