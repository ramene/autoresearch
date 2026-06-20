# Autoresearch Changelog: defi-arbitrage-executor

## Genesis
- Created from want: want-018
- Hypothesis: The system is connected to rich financial data streams (DeFi, TradFi) with over 100 tools but has zero skills to act on this data, representing a massive untapped capability.
- Score: 0.95
- Criteria: 6
- Scenarios: 6

## Round 0
- **Score**: 36/36 (baseline)
- **Failures**: none
- **Per-criteria**: Identify price discrepancies across at least 2 DEXes: 6/6, Calculate net profit after gas costs before recommending execution: 6/6, Enforce the configured budget limit before any on-chain transaction: 6/6, Handle failed transactions gracefully without losing funds: 6/6, Provide a clear, actionable summary of opportunities found: 6/6, Work on both testnet (BASE Sepolia) and mainnet (BASE) configurations: 6/6

## Round 1 — Mutation Applied
- **Mutation**: Added explicit partial-failure handling in Step 3 — scanner must emit per-DEX error fields and the agent must warn+exclude failed DEXes rather than silently skipping them or propagating stale/zero prices into profit calculations.

## Round 2 — Mutation Applied
- **Mutation**: Clarify that V3-style DEXes (UniswapV3, Aerodrome) require a Quoter contract address for price queries, not the router — routers don't expose getAmountsOut on V3; failing to distinguish these would cause all DEX queries to silently fail or revert.

## Round 3 — Mutation Applied
- **Mutation**: Added slippage tolerance parameter (`--slippage=<bps>`, default 50 bps) to prevent executor transactions from reverting or executing at unfavorable prices due to price movement between quote and execution time.

## Round 4 — Mutation Applied
- **Mutation**: Added approval transaction gas costs (~50k gas each, totaling ~100k extra) to the profitability calculation in Step 4c, so net profit reflects all 4 on-chain transactions (2 approvals + 2 swaps) rather than just the 2 swaps.

## Round 5 — Mutation Applied
- **Mutation**: Added pre-approval allowance check in Step 7 to skip redundant `approve` transactions when sufficient allowance already exists, saving gas on repeated trades with the same token pairs.

## Round 6 — Mutation Applied
- **Mutation**: Add `fee_tier` field to monitored_pairs config and pass it to `quoteExactInputSingle` in the scanner, since V3-style DEX quoters require a pool fee tier to route to the correct liquidity pool — omitting it causes all price queries to silently fail or return stale data.

## Round 7 — Mutation Applied
- **Mutation**: Add explicit token decimal normalization to scanner.js — the script must call `decimals()` on each token contract and use `ethers.formatUnits` to convert raw BigInt quotes to human-readable prices before comparing across DEXes, preventing incorrect profit calculations due to decimal mismatch (e.g., WETH=18 vs USDC=6).

## Round 8 — Mutation Applied
- **Mutation**: Add receipt-based amount chaining in executor.js — parse the actual token transfer amount from Swap 1's receipt logs (ERC-20 Transfer event) and use that as Swap 2's exact input amount, replacing the pre-quoted value to prevent allowance mismatches and incorrect Swap 2 sizing.

## Round 9 — Mutation Applied
- **Mutation**: Evolve from single-pair to multi-hop arbitrage by replacing `monitored_pairs` with `monitored_routes` (path arrays with alternating token addresses and fee tiers), and updating scanner.js to use `quoteExactInput` for multi-hop paths vs `quoteExactInputSingle` for direct swaps.

## Round 10 — Mutation Applied
- **Mutation**: Add explicit ETH price oracle call (via a simple RPC-based check or fallback constant) in Step 4c so gas costs are accurately denominated in USD when populating `net_profit_usd` in opportunities.json, preventing silent underestimation when ETH price is volatile.
