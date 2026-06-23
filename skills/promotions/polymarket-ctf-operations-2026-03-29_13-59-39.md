# Promotion Proposal: polymarket-ctf-operations

## Scores
- **Baseline**: 22/25
- **Current**: 25/25
- **Improvement**: +3 points (100.0%)
- **Rounds**: 5

## Promotion Target
`/Users/ramene/Journal/.seed/base/skills/polymarket-ctf-operations/SKILL.md`

## Key Mutations That Improved Score
1. Add an explicit approval matrix table defining which address to approve for each operation, since the "Approval matrix" is referenced in Quality Gates but never actually defined, causing incorrect contract targeting in scenarios 2, 3, and 5.
2. Fix Approval Matrix by correcting Merge (standard) spender from CTF Exchange to CTF contract, and adding missing Redeem row (CTF ERC1155 → CTF contract), since mergePositions and redeemPositions are called on the CTF contract directly, not the exchange.
3. No failures remain (5/5 on all criteria) — reinforce the approval matrix with a "Key distinction" callout clarifying that Split/Merge/Redeem approve the CTF contract directly while trading operations approve the exchange contracts, to make the correct behavior even more explicit and resilient.
4. No failures remain (5/5 on all criteria) — add a concise "Quick Reference" section at the top summarizing the three most critical rules (approval targets, operation flow, neg risk flag) to make the skill more scannable and resilient to edge cases.
5. No failures remain (5/5 on all criteria) — add a "Common Pitfalls" section documenting the three most frequent mistakes (wrong spender for merge/redeem, missing setApprovalForAll for ERC1155, attempting redeem on unresolved market) to make the skill more resilient to edge cases.

## Unified Diff (baseline -> current)
```diff
--- /Users/ramene/.remote/@autoresearch/skills/working-polymarket-ctf-operations/SKILL.md.baseline	2026-03-20 19:21:41.000000000 -0600
+++ /Users/ramene/.remote/@autoresearch/skills/working-polymarket-ctf-operations/SKILL.md	2026-03-21 03:11:23.000000000 -0600
@@ -4,6 +4,14 @@
 ## Purpose
 This skill handles direct interaction with Polymarket's Conditional Token Framework (CTF) smart contracts on Polygon. It enables splitting USDC.e into YES/NO outcome token pairs, merging complete sets back into USDC.e, redeeming winning tokens after market resolution, computing token IDs from condition parameters, and managing approvals for the relevant exchange contracts. These are on-chain operations that complement the CLOB orderbook trading.
 
+## Quick Reference
+
+| Rule | Detail |
+|------|--------|
+| Split/Merge/Redeem spender | Always the **CTF contract** (`0x4D97DCd97eC945f40cF65F87097ACe5EA0476045`) |
+| Trading spender | CTF Exchange or Neg Risk CTF Exchange — **never** for split/merge/redeem |
+| Neg risk flag | Pass `negRisk: true` for neg risk markets; use Neg Risk Adapter for conversions |
+
 ## Trigger Conditions
 1. **Slash Command:** `/skill polymarket-ctf-operations [flags]`
    - `--split`: Split USDC.e into outcome tokens
@@ -32,20 +40,52 @@
 | Neg Risk CTF Exchange | `0xC5d563A36AE78145C45a50134d48A1215220f80a` | Neg risk trading |
 | Neg Risk Adapter | `0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296` | Conversions |
 
+## Approval Matrix
+
+> **Critical rule:** `splitPosition`, `mergePositions`, and `redeemPositions` are all called **directly on the CTF contract** — so for these operations, the CTF contract itself is the spender. The exchange contracts (CTF Exchange, Neg Risk CTF Exchange) are only spenders when placing **trade orders** through the CLOB.
+
+**Always set approvals before performing any operation.** Each operation requires a specific token/spender pair:
+
+| Operation | Token to Approve | Spender (approve this address) |
+|-----------|-----------------|-------------------------------|
+| Split (standard) | USDC.e (`0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174`) | CTF (`0x4D97DCd97eC945f40cF65F87097ACe5EA0476045`) |
+| Merge (standard) | CTF ERC1155 tokens | CTF (`0x4D97DCd97eC945f40cF65F87097ACe5EA0476045`) |
+| Redeem (standard) | CTF ERC1155 tokens | CTF (`0x4D97DCd97eC945f40cF65F87097ACe5EA0476045`) |
+| Split/Merge (neg risk) | USDC.e (`0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174`) | Neg Risk Adapter (`0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296`) |
+| Trade (standard market) | CTF ERC1155 tokens | CTF Exchange (`0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E`) |
+| Trade (neg risk market) | CTF ERC1155 tokens | Neg Risk CTF Exchange (`0xC5d563A36AE78145C45a50134d48A1215220f80a`) |
+| Neg risk conversion | CTF ERC1155 tokens | Neg Risk Adapter (`0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296`) |
+
+- **USDC.e approvals:** call `approve(spender, amount)` on the USDC.e contract
+- **CTF ERC1155 approvals:** call `setApprovalForAll(spender, true)` on the CTF contract
+- **Key distinction:** Split, Merge, and Redeem all call the CTF contract directly → approve **CTF** as spender. Trading calls the exchange contracts → approve the respective **exchange** as spender. Never approve an exchange contract for split/merge/redeem operations.
+
+## Common Pitfalls
+
+> These are the most frequent mistakes — check each before executing any operation.
+
+1. **Wrong spender for Merge/Redeem:** `mergePositions` and `redeemPositions` are called on the CTF contract — approve the **CTF contract** as spender, NOT the CTF Exchange. The exchange contract is only ever the spender for CLOB trade orders.
+
+2. **Using `approve` instead of `setApprovalForAll` for ERC1155 tokens:** CTF outcome tokens are ERC1155. To grant the CTF contract permission to burn/transfer them during merge or redeem, you must call `setApprovalForAll(CTF_ADDRESS, true)` on the CTF contract — not `approve()`, which is an ERC20 method and will revert.
+
+3. **Attempting redeem on an unresolved market:** `redeemPositions` will revert if the market has no payout vector yet. Always verify the condition is resolved (non-zero payout vector) before calling redeem. Losing tokens return $0 — this is expected behavior, not a bug.
+
 ## Execution Steps
 
 1. **Split:** `$100 USDC.e -> 100 Yes + 100 No tokens`
-   - Approve USDC.e for CTF contract
+   - Approve USDC.e for CTF contract (see Approval Matrix)
    - Call `splitPosition(USDC.e, 0x0, conditionId, [1,2], amount)`
    - Verify token balances after split
 
 2. **Merge:** `100 Yes + 100 No -> $100 USDC.e`
    - Requires equal amounts of both outcome tokens
+   - Approve CTF ERC1155 tokens for CTF contract (see Approval Matrix)
    - Call `mergePositions(USDC.e, 0x0, conditionId, [1,2], amount)`
    - Verify USDC.e balance after merge
 
 3. **Redeem:** Exchange winning tokens for USDC.e after resolution
    - Market must be resolved (check payout vector)
+   - Approve CTF ERC1155 tokens for CTF contract (see Approval Matrix)
    - Call `redeemPositions(USDC.e, 0x0, conditionId, [1,2])`
    - Burns entire token balance, no amount parameter
    - Winning tokens -> USDC.e, losing tokens -> $0
@@ -70,9 +110,9 @@
 2. Merge returns correct USDC.e amount
 3. Redeem only succeeds on resolved markets
 4. Token ID computation matches API-provided IDs
-5. Approval matrix correctly targets exchange contracts
+5. Approval matrix correctly targets CTF contract for split/merge/redeem, exchange contracts only for trading
 6. Gas estimation accurate for each operation
 
 ## Integration Points
 - **Cross-skill:** `polymarket-clob-trader` for orderbook trading (off-chain), this skill for on-chain operations
-- **Downstream:** `polymarket-portfolio-tracker` tracks token balances from split/merge/redeem
+- **Downstream:** `polymarket-portfolio-tracker` tracks token balances from split/merge/redeem
\ No newline at end of file

```

## Generated
- **Timestamp**: 2026-03-29T13:59:39.486Z
- **Source**: `/Users/ramene/.remote/@autoresearch/skills/working-polymarket-ctf-operations/SKILL.md`
- **Baseline**: `/Users/ramene/.remote/@autoresearch/skills/working-polymarket-ctf-operations/SKILL.md.baseline`
