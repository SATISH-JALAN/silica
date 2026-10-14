# Tokens and faucet

## SilicaToken

`contracts/src/SilicaToken.sol` · the GPU-hour token, one deployment per series.

| | |
| --- | --- |
| Standard | ERC-20, 18 decimals |
| Name / symbol | e.g. `Silica H100 APAC W42` / `SIL-H100-APAC-W42` |
| `mint(to, amount)` | `MINTER_ROLE`, held by `BondVault` |
| `burn(from, amount)` | `BURNER_ROLE`, held by `RedemptionManager` |

Nobody else can mint or burn. Supply always equals minted minus redeemed hours, which the invariant suite checks after every random step.

## MockUSDC

`contracts/src/MockUSDC.sol` · the testnet quote and bond currency.

| | |
| --- | --- |
| Decimals | 6 |
| `faucet()` | sends `FAUCET_AMOUNT` (1,000 USDC) to the caller, at most once per `FAUCET_COOLDOWN` (1 hour) per address |
| `mint(to, amount)` | owner only, used by the seed script |
| Error | `FaucetCooldown(nextAt)` |

The app's **Get test USDC** button calls `faucet()`, so any wallet can try the full flow without asking anyone for funds.

::: info Why not Kuru's test USDC
Kuru's testnet USDC is admin-minted and has no public faucet. A public faucet lets judges and testers self-serve. Once Kuru lists the books, they quote against Kuru's USDC as planned.
:::
