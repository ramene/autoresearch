
## Round 0
- **Score**: 20/25 (baseline)
- **Failures**: S5: Positions accurately reflect on-chain state, S5: FIFO P&L calculation is mathematically correct, S5: Risk score reflects portfolio concentration and exposure, S5: Safety limit utilization reported accurately, S5: Export format is structured and complete
- **Per-criteria**: Positions accurately reflect on-chain state: 4/5, FIFO P&L calculation is mathematically correct: 4/5, Risk score reflects portfolio concentration and exposure: 4/5, Safety limit utilization reported accurately: 4/5, Export format is structured and complete: 4/5

## Round 1 — Mutation Applied
- **Mutation**: Added explicit API endpoint URLs, query parameters, and response field mappings to Step 1 — the position fetch is the foundation all other calculations depend on, and vague "query Data API" instructions are the most likely cause of uniform failures across all criteria.

## Round 2 — Mutation Applied
- **Mutation**: Fixed Step 2 FIFO P&L calculation — the current logic incorrectly ignores `cashPnl` on partially-closed positions (only counting it when `size == 0`), causing mathematically wrong totals in all scenarios with mixed open/partial-close positions.

## Round 2
- **Score**: 23/25 (kept)
- **Failures**: S5: Positions accurately reflect on-chain state, S5: Export format is structured and complete
- **Per-criteria**: Positions accurately reflect on-chain state: 4/5, FIFO P&L calculation is mathematically correct: 5/5, Risk score reflects portfolio concentration and exposure: 5/5, Safety limit utilization reported accurately: 5/5, Export format is structured and complete: 4/5

## Round 3 — Mutation Applied
- **Mutation**: Changed sizeThreshold from 0.01 to 0 in the positions API query and added explicit instructions to include ALL positions (including closed ones) in P&L totals and export, while limiting the display table to active positions (size > 0.01).

## Round 4 — Mutation Applied
- **Mutation**: Added explicit closed-position handling — when `size == 0`, skip the CLOB midpoint query and set `current_price=0`, `current_value=0`, `unrealized_pnl=0`, `unrealized_pnl_pct=0` in the export, preventing division-by-zero and ensuring the export is structurally complete for all position states.

## Round 4
- **Score**: 24/25 (kept)
- **Failures**: S5: Export format is structured and complete
- **Per-criteria**: Positions accurately reflect on-chain state: 5/5, FIFO P&L calculation is mathematically correct: 5/5, Risk score reflects portfolio concentration and exposure: 5/5, Safety limit utilization reported accurately: 5/5, Export format is structured and complete: 4/5

## Round 5 — Mutation Applied
- **Mutation**: Expanded the `summary` object in the JSON export schema to include explicit value mappings for each field (matching the same annotation style used in the `positions` array), eliminating ambiguity about ratio vs. percentage formatting and ensuring completeness.

## Round 6 — Mutation Applied
- **Mutation**: Add a concrete worked example of portfolio.json output with actual numeric values (not string placeholders) to clarify that numeric fields must be JSON numbers, not strings.

## Round 7 — Mutation Applied
- **Mutation**: Clarify that portfolio.json is always written on every execution regardless of which flags are used, not only when --export is passed — the --export flag only controls whether the path is printed to stdout.

## Round 8 — Mutation Applied
- **Mutation**: Add explicit zero-guard for `total_exposure == 0` in Step 3's concentration_risk calculation to prevent division-by-zero when all positions are closed, which likely causes all 4 criteria to fail in the all-closed-positions scenario.

## Round 9 — Mutation Applied
- **Mutation**: Add explicit zero-guard for drawdown when `total_exposure == 0` (all positions closed/resolved), since "portfolio drawn to zero via exits" ≠ "portfolio drawdown" — the formula otherwise computes 100% drawdown for any fully-exited portfolio, contradicting the all-closed example that shows 0.0.

## Round 10 — Mutation Applied
- **Mutation**: Add explicit rule to zero out `avg_price` for closed positions (`size == 0`) in Step 2 instructions and Quality Gate 3, matching the closed-position example which already shows `avg_price: 0` but whose rationale was never stated.

## Round 11 — Mutation Applied
- **Mutation**: Add explicit instruction in Step 4 mandating that the `safety_limits` object must be fully populated with both the calculated `exposure_used_pct` and the three hardcoded constants from the Safety Limits section.

## Round 12 — Mutation Applied
- **Mutation**: Restrict `peak` in the drawdown calculation to only open positions (`size > 0`), preventing closed positions' `initialValue` from inflating peak and producing incorrect drawdown/risk_score in mixed open+closed portfolios.

## Round 13 — Mutation Applied
- **Mutation**: Add explicit instruction to parse the CLOB `mid` field as a float before using it in calculations, since the API returns it as a JSON string — this would corrupt all numeric computations and cause all 5 criteria to fail in any scenario with open positions.

## Round 14 — Mutation Applied
- **Mutation**: Fix Quality Gate 10 which erroneously lists `timestamp` among `summary` fields — `timestamp` is a top-level JSON field, not inside `summary` — and add an explicit instruction in Step 4 to include `timestamp` at the top level of `portfolio.json`.

## Round 15 — Mutation Applied
- **Mutation**: Always compute current_value = current_price * size from the CLOB midpoint instead of preferring Data API's currentValue, eliminating price-source inconsistency that corrupts unrealized_pnl, total_exposure, risk scores, and the export.
