# SKILL: polymarket-bridge
Cross-chain deposit and withdrawal for Polymarket -- bridge assets from 15+ chains (Ethereum, Solana, Bitcoin, Arbitrum, Base, etc.) to USDC.e on Polygon and withdraw back.

## Purpose
This skill handles cross-chain movement of funds to and from Polymarket. It creates deposit addresses for receiving assets from multiple chains (EVM, Solana, Bitcoin, Tron), monitors deposit status, previews withdrawal fees, executes withdrawals to destination chains, and tracks transaction status. All bridging goes through Polymarket's bridge API which handles routing, swapping, and delivery.

## Trigger Conditions
1. **Slash Command:** `/skill polymarket-bridge [flags]`
   - `--deposit`: Create deposit addresses for receiving funds
   - `--withdraw`: Initiate withdrawal to destination chain
   - `--to-chain=<chain_id>`: Destination chain ID
   - `--to-token=<address>`: Destination token address
   - `--recipient=<address>`: Recipient address
   - `--status=<address>`: Check deposit/withdrawal status
   - `--quote`: Preview withdrawal fees and output
   - `--supported`: List supported assets and chains
   - `--amount=<float>`: Amount for withdrawal

2. **Keywords:** "deposit to polymarket", "withdraw from polymarket", "bridge to polygon", "transfer USDC to polymarket"

## Prerequisites
1. **Working Directory:** `~/.remote/@autoresearch/skills/working-polymarket-bridge/`
2. **Network:** Access to `https://bridge.polymarket.com`
3. **For deposits:** Funds on source chain
4. **For withdrawals:** USDC.e balance on Polymarket wallet

## Bridge API

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/deposit` | POST | Create deposit addresses |
| `/withdraw` | POST | Create withdrawal addresses |
| `/quote` | POST | Preview fees/output |
| `/status/{address}` | GET | Track transaction status |
| `/supported-assets` | GET | List supported chains/tokens |

## Supported Chains (15+)

| Chain | Type | Min Deposit | Example Tokens |
|-------|------|-------------|----------------|
| Ethereum | EVM | $7 | ETH, USDC, USDT, WBTC |
| Polygon | EVM | $2 | POL, USDC, USDT |
| Arbitrum | EVM | $2 | ETH, ARB, USDC |
| Base | EVM | $2 | ETH, USDC |
| Optimism | EVM | $2 | ETH, OP, USDC |
| Solana | SVM | $2 | SOL, USDC |
| Bitcoin | BTC | $9 | BTC |
| Tron | TVM | $9 | USDT |
| HyperEVM | EVM | $2 | HYPE, USDC |

## Transaction Statuses

| Status | Terminal | Description |
|--------|----------|-------------|
| DEPOSIT_DETECTED | No | Funds seen on source chain |
| PROCESSING | No | Being routed/swapped |
| SUBMITTED | No | Submitted to Polygon |
| COMPLETED | Yes | Success |
| FAILED | Yes | Error |

## Execution Steps

### Deposit Flow (MANDATORY ORDER — do not skip steps)
1. **Check supported assets first (REQUIRED):** GET /supported-assets and confirm the source chain and token are listed. If not supported, abort and inform the user. Do not proceed to any subsequent step if this check fails.
2. **Enforce minimum deposit (REQUIRED):** Verify the deposit amount meets the chain's minimum (see table above). If below minimum, abort — deposits below minimum will not be processed. Do not generate a deposit address if this check fails.
3. **Generate deposit address:** POST /deposit with wallet address → receive EVM/SVM/BTC/TVM addresses appropriate for the source chain type.
4. **Instruct user to send funds** to the returned address.
5. **Poll status:** GET /status/{address} every 10–30 seconds until COMPLETED or FAILED.

### Withdrawal Flow (MANDATORY ORDER — do not skip steps)
1. **Check supported assets first (REQUIRED):** GET /supported-assets to confirm destination chain and token are supported. If not supported, abort and inform the user. Do not proceed to any subsequent step if this check fails.
2. **Preview quote (REQUIRED — user must explicitly confirm before proceeding):** POST /quote with amount, destination chain, and token. This step is mandatory regardless of whether fees are zero or subsidized. Display ALL of the following to the user before proceeding:
   - **Estimated output amount** (what the recipient will receive)
   - **Fee amount** (total fees deducted; display even if zero)
   - **Fee breakdown** (bridge fee, gas fee, etc. if provided by API)
   - **Destination chain and token**
   After displaying this information, explicitly ask the user to confirm they want to proceed. **Do not call POST /withdraw until the user has responded with explicit confirmation.** If the user does not confirm, abort.
3. **Execute withdrawal:** POST /withdraw → receive destination address → send USDC.e from Polymarket wallet.
4. **Poll status:** GET /status/{address} every 10–30 seconds until COMPLETED or FAILED.

### Status Check
- Poll every 10–30 seconds until status is COMPLETED or FAILED (both are terminal).
- **Timeout handling:** If the transaction has not reached a terminal state after 30 minutes, stop polling, report the last observed status to the user, and advise them to re-check manually using `--status=<address>`. Do not continue polling indefinitely.

## Caveats
- Withdrawals >$50,000: break into smaller amounts
- Deposits below minimum will not be processed
- Always check /supported-assets before depositing (assets change)
- Always show the /quote output to the user before executing a withdrawal — even when Polymarket subsidizes fees, the estimated output amount must be confirmed by the user

## Output Format
- **Console:** Deposit addresses or withdrawal status
- **`bridge_log.json`:** Transaction history with status tracking

## Quality Gates
1. Deposit addresses generated for correct chain type
2. Withdrawal quote previews accurate fees — estimated output, fee amount, and fee breakdown all displayed before execution
3. Status polling correctly identifies terminal states
4. Supported assets checked before operations (both deposit and withdrawal)
5. Minimum deposit amounts enforced before generating deposit addresses

## Integration Points
- **Upstream:** User needs to fund Polymarket account
- **Downstream:** Funded account enables `polymarket-clob-trader` operations
- **Cross-skill:** `polymarket-portfolio-tracker` reflects deposited/withdrawn amounts