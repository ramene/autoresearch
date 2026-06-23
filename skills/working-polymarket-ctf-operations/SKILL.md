# SKILL: polymarket-ctf-operations
ERC1155 Conditional Token Framework operations on Polymarket -- split USDC.e into outcome tokens, merge tokens back to USDC.e, redeem winning tokens after resolution, and compute token IDs.

## Purpose
This skill handles direct interaction with Polymarket's Conditional Token Framework (CTF) smart contracts on Polygon. It enables splitting USDC.e into YES/NO outcome token pairs, merging complete sets back into USDC.e, redeeming winning tokens after market resolution, computing token IDs from condition parameters, and managing approvals for the relevant exchange contracts. These are on-chain operations that complement the CLOB orderbook trading.

## Quick Reference

| Rule | Detail |
|------|--------|
| Split/Merge/Redeem spender | Always the **CTF contract** (`0x4D97DCd97eC945f40cF65F87097ACe5EA0476045`) |
| Trading spender | CTF Exchange or Neg Risk CTF Exchange — **never** for split/merge/redeem |
| Neg risk flag | Pass `negRisk: true` for neg risk markets; use Neg Risk Adapter for conversions |

## Trigger Conditions
1. **Slash Command:** `/skill polymarket-ctf-operations [flags]`
   - `--split`: Split USDC.e into outcome tokens
   - `--merge`: Merge outcome token pair back to USDC.e
   - `--redeem`: Redeem winning tokens after resolution
   - `--condition-id=<id>`: Market condition ID
   - `--amount=<float>`: Amount of USDC.e to split/merge
   - `--compute-id`: Compute token IDs from parameters
   - `--neg-risk`: Use negative risk adapter
   - `--approve`: Set token approvals for exchange contracts

2. **Keywords:** "split polymarket tokens", "merge prediction tokens", "redeem winning tokens", "CTF operations"

## Prerequisites
1. **Working Directory:** `~/.remote/@autoresearch/skills/working-polymarket-ctf-operations/`
2. **Environment:** `POLY_PRIVATE_KEY`, `POLY_SAFE_ADDRESS`, `POLY_RPC_URL` (Polygon RPC)
3. **On-chain:** USDC.e balance on Polygon, sufficient POL for gas (unless using gasless)

## Contract Addresses (Polygon)

| Contract | Address | Purpose |
|----------|---------|---------|
| USDC.e | `0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174` | Collateral |
| CTF | `0x4D97DCd97eC945f40cF65F87097ACe5EA0476045` | Token operations |
| CTF Exchange | `0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E` | Standard trading |
| Neg Risk CTF Exchange | `0xC5d563A36AE78145C45a50134d48A1215220f80a` | Neg risk trading |
| Neg Risk Adapter | `0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296` | Conversions |

## Approval Matrix

> **Critical rule:** `splitPosition`, `mergePositions`, and `redeemPositions` are all called **directly on the CTF contract** — so for these operations, the CTF contract itself is the spender. The exchange contracts (CTF Exchange, Neg Risk CTF Exchange) are only spenders when placing **trade orders** through the CLOB.

**Always set approvals before performing any operation.** Each operation requires a specific token/spender pair:

| Operation | Token to Approve | Spender (approve this address) |
|-----------|-----------------|-------------------------------|
| Split (standard) | USDC.e (`0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174`) | CTF (`0x4D97DCd97eC945f40cF65F87097ACe5EA0476045`) |
| Merge (standard) | CTF ERC1155 tokens | CTF (`0x4D97DCd97eC945f40cF65F87097ACe5EA0476045`) |
| Redeem (standard) | CTF ERC1155 tokens | CTF (`0x4D97DCd97eC945f40cF65F87097ACe5EA0476045`) |
| Split/Merge (neg risk) | USDC.e (`0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174`) | Neg Risk Adapter (`0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296`) |
| Trade (standard market) | CTF ERC1155 tokens | CTF Exchange (`0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E`) |
| Trade (neg risk market) | CTF ERC1155 tokens | Neg Risk CTF Exchange (`0xC5d563A36AE78145C45a50134d48A1215220f80a`) |
| Neg risk conversion | CTF ERC1155 tokens | Neg Risk Adapter (`0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296`) |

- **USDC.e approvals:** call `approve(spender, amount)` on the USDC.e contract
- **CTF ERC1155 approvals:** call `setApprovalForAll(spender, true)` on the CTF contract
- **Key distinction:** Split, Merge, and Redeem all call the CTF contract directly → approve **CTF** as spender. Trading calls the exchange contracts → approve the respective **exchange** as spender. Never approve an exchange contract for split/merge/redeem operations.

## Common Pitfalls

> These are the most frequent mistakes — check each before executing any operation.

1. **Wrong spender for Merge/Redeem:** `mergePositions` and `redeemPositions` are called on the CTF contract — approve the **CTF contract** as spender, NOT the CTF Exchange. The exchange contract is only ever the spender for CLOB trade orders.

2. **Using `approve` instead of `setApprovalForAll` for ERC1155 tokens:** CTF outcome tokens are ERC1155. To grant the CTF contract permission to burn/transfer them during merge or redeem, you must call `setApprovalForAll(CTF_ADDRESS, true)` on the CTF contract — not `approve()`, which is an ERC20 method and will revert.

3. **Attempting redeem on an unresolved market:** `redeemPositions` will revert if the market has no payout vector yet. Always verify the condition is resolved (non-zero payout vector) before calling redeem. Losing tokens return $0 — this is expected behavior, not a bug.

## Execution Steps

1. **Split:** `$100 USDC.e -> 100 Yes + 100 No tokens`
   - Approve USDC.e for CTF contract (see Approval Matrix)
   - Call `splitPosition(USDC.e, 0x0, conditionId, [1,2], amount)`
   - Verify token balances after split

2. **Merge:** `100 Yes + 100 No -> $100 USDC.e`
   - Requires equal amounts of both outcome tokens
   - Approve CTF ERC1155 tokens for CTF contract (see Approval Matrix)
   - Call `mergePositions(USDC.e, 0x0, conditionId, [1,2], amount)`
   - Verify USDC.e balance after merge

3. **Redeem:** Exchange winning tokens for USDC.e after resolution
   - Market must be resolved (check payout vector)
   - Approve CTF ERC1155 tokens for CTF contract (see Approval Matrix)
   - Call `redeemPositions(USDC.e, 0x0, conditionId, [1,2])`
   - Burns entire token balance, no amount parameter
   - Winning tokens -> USDC.e, losing tokens -> $0

4. **Token ID Computation:**
   - Step 1: `getConditionId(oracle, questionId, 2)` -- UMA CTF Adapter oracle
   - Step 2: `getCollectionId(bytes32(0), conditionId, indexSet)` -- indexSet: 1=Yes, 2=No
   - Step 3: `getPositionId(USDC.e, collectionId)`

5. **Negative Risk Operations:**
   - Multi-outcome events where only one can win
   - No token in one market can convert to Yes tokens in all others
   - Uses Neg Risk Adapter contract for conversions
   - Pass `negRisk: true` when placing orders

## Output Format
- **Console:** Transaction hash and operation result
- **`ctf_operations.json`:** Operation log with tx hashes and balances

## Quality Gates
1. Split produces correct amounts of both outcome tokens
2. Merge returns correct USDC.e amount
3. Redeem only succeeds on resolved markets
4. Token ID computation matches API-provided IDs
5. Approval matrix correctly targets CTF contract for split/merge/redeem, exchange contracts only for trading
6. Gas estimation accurate for each operation

## Integration Points
- **Cross-skill:** `polymarket-clob-trader` for orderbook trading (off-chain), this skill for on-chain operations
- **Downstream:** `polymarket-portfolio-tracker` tracks token balances from split/merge/redeem