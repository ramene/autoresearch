# SKILL: polymarket-gasless-trader
Gasless transactions on Polymarket via the Builder Program relayer -- deploy Safe wallets, approve tokens, execute CTF operations, and submit orders without requiring POL for gas fees.

## Purpose
This skill enables gas-free trading on Polymarket through the Builder Program's relayer infrastructure. Users only need USDC.e -- Polymarket's relayer pays all gas fees. It handles Safe wallet deployment, token approvals, CTF operations (split/merge/redeem), and batch transaction execution through the relayer API. Requires Builder Program membership and builder API credentials.

## Trigger Conditions
1. **Slash Command:** `/skill polymarket-gasless-trader [flags]`
   - `--deploy`: Deploy Safe wallet for new user
   - `--approve`: Approve token spending for exchange contracts
   - `--execute`: Execute transaction(s) via relayer
   - `--status=<tx_id>`: Check relayer transaction status
   - `--batch`: Execute multiple operations atomically

2. **Keywords:** "gasless polymarket", "no gas fee trading", "deploy safe wallet polymarket", "builder program"

## Prerequisites
1. **Working Directory:** `~/.remote/@autoresearch/skills/working-polymarket-gasless-trader/`
2. **Environment:** `POLY_PRIVATE_KEY`, `POLY_BUILDER_API_KEY`, `POLY_BUILDER_SECRET`, `POLY_BUILDER_PASSPHRASE`
3. **Builder Program:** Must be enrolled at polymarket.com/settings?tab=builder
4. **Dependencies:** `@polymarket/builder-relayer-client`, `@polymarket/builder-signing-sdk`

## Relayer Configuration

| Setting | Value |
|---------|-------|
| Relayer URL | `https://relayer-v2.polymarket.com/` |
| Chain ID | 137 (Polygon) |
| Wallet Types | Safe (deploy first) or Proxy (auto-deploy) |

## Transaction States

| State | Terminal | Description |
|-------|----------|-------------|
| STATE_NEW | No | Received by relayer |
| STATE_EXECUTED | No | Submitted onchain |
| STATE_MINED | No | Included in block |
| STATE_CONFIRMED | Yes | Finalized |
| STATE_FAILED | Yes | Failed permanently |
| STATE_INVALID | Yes | Rejected |

## Execution Steps

1. **Safe Wallet Deployment:** `client.deploy()` -> wait for proxyAddress
2. **Token Approvals:** Encode approve(spender, maxUint256) call, execute via relayer
3. **Batch Transactions:** Package multiple ops, execute atomically
4. **Status Tracking:** Poll transaction state until terminal

## Output Format
- **Console:** Transaction status and hash
- **`gasless_log.json`:** Transaction history

## Quality Gates
1. Builder authentication with HMAC headers succeeds
2. Safe wallet deployed successfully with returned address
3. Relayer transactions reach CONFIRMED state
4. Batch operations execute atomically
5. Error states handled gracefully (FAILED, INVALID)

## Integration Points
- **Cross-skill:** Enables gas-free operation for `polymarket-clob-trader` and `polymarket-ctf-operations`
- **Upstream:** Builder credentials configured at polymarket.com/settings
