
## Round 0
- **Score**: 22/25 (baseline)
- **Failures**: S2: Approvals set for correct contracts, S3: Approvals set for correct contracts, S5: Approvals set for correct contracts
- **Per-criteria**: Split produces correct token amounts: 5/5, Merge returns correct USDC.e: 5/5, Redeem only works on resolved markets: 5/5, Correct contracts used for neg risk vs standard: 5/5, Approvals set for correct contracts: 2/5

## Round 1 — Mutation Applied
- **Mutation**: Add an explicit approval matrix table defining which address to approve for each operation, since the "Approval matrix" is referenced in Quality Gates but never actually defined, causing incorrect contract targeting in scenarios 2, 3, and 5.

## Round 2 — Mutation Applied
- **Mutation**: Fix Approval Matrix by correcting Merge (standard) spender from CTF Exchange to CTF contract, and adding missing Redeem row (CTF ERC1155 → CTF contract), since mergePositions and redeemPositions are called on the CTF contract directly, not the exchange.

## Round 2
- **Score**: 25/25 (kept)
- **Failures**: none
- **Per-criteria**: Split produces correct token amounts: 5/5, Merge returns correct USDC.e: 5/5, Redeem only works on resolved markets: 5/5, Correct contracts used for neg risk vs standard: 5/5, Approvals set for correct contracts: 5/5

## Round 3 — Mutation Applied
- **Mutation**: No failures remain (5/5 on all criteria) — reinforce the approval matrix with a "Key distinction" callout clarifying that Split/Merge/Redeem approve the CTF contract directly while trading operations approve the exchange contracts, to make the correct behavior even more explicit and resilient.

## Round 4 — Mutation Applied
- **Mutation**: No failures remain (5/5 on all criteria) — add a concise "Quick Reference" section at the top summarizing the three most critical rules (approval targets, operation flow, neg risk flag) to make the skill more scannable and resilient to edge cases.

## Round 5 — Mutation Applied
- **Mutation**: No failures remain (5/5 on all criteria) — add a "Common Pitfalls" section documenting the three most frequent mistakes (wrong spender for merge/redeem, missing setApprovalForAll for ERC1155, attempting redeem on unresolved market) to make the skill more resilient to edge cases.
