# Promotion Proposal: polymarket-position-manager

## Scores
- **Baseline**: 23/25
- **Current**: 25/25
- **Improvement**: +2 points (100.0%)
- **Rounds**: 11

## Promotion Target
`/Users/ramene/Journal/.seed/base/skills/polymarket-position-manager/SKILL.md`

## Key Mutations That Improved Score
1. Added explicit pre-registration limit check with rejection logic to Step 1, making it clear that the limit must be enforced BEFORE accepting a new position.
2. Added side-aware TP/SL calculation and P&L logic for both "up" (long) and "down" (short) positions, since the current formula only works for long positions and causes all three criteria to fail for any "down" position test case.
3. Add side-aware (long vs short) TP/SL price calculation and exit trigger logic — "down" positions have inverted TP/SL thresholds and conditions compared to "up" positions.
4. Added explicit pre-registration guard in Step 1 that hard-rejects new positions when at capacity, making limit enforcement a prerequisite gate rather than a side note in Step 5.
5. No failures detected in current evaluation — all criteria pass 5/5. Reinforce the side-aware TP/SL and exit logic with a concrete numeric example to prevent regression in edge cases.
6. All criteria are passing at 25/25 with no failures — no mutation needed, returning skill unchanged.
7. All criteria pass 5/5 with no failures — add a concrete numeric example for the "down" side P&L calculation to reinforce correctness and prevent regression.
8. All criteria pass 25/25 with no failures — returning skill unchanged to avoid regression.
9. All criteria pass 5/5 with no failures — reinforce side uniqueness check documentation with explicit example to prevent potential regression on concurrent position edge cases.

## Unified Diff (baseline -> current)
```diff
--- /Users/ramene/.remote/@autoresearch/skills/working-polymarket-position-manager/SKILL.md.baseline	2026-03-20 19:21:41.000000000 -0600
+++ /Users/ramene/.remote/@autoresearch/skills/working-polymarket-position-manager/SKILL.md	2026-03-21 04:05:17.000000000 -0600
@@ -27,21 +27,36 @@
 ## Execution Steps
 
 1. **Position Registration:**
-   - Create Position with: id, side (up/down), token_id, entry_price, size, TP delta, SL delta
-   - Calculate TP price: entry_price + tp_delta
-   - Calculate SL price: entry_price - sl_delta
+   - **GATE — enforce limits FIRST, before any other registration logic:**
+     - Load current `positions.json` and count open positions
+     - If `open_count >= max_positions`: **REJECT** with error `"Position limit reached (max_positions=N). Close an existing position before adding a new one."` — do NOT proceed
+     - If a position with the same `side` already exists and is open: **REJECT** with error `"A position for side=<side> is already open."` — do NOT proceed
+   - Only after passing both checks: Create Position with: id, side (up/down), token_id, entry_price, size, TP delta, SL delta
+   - Calculate TP and SL prices **based on side**:
+     - **up (long/YES):** `tp_price = entry_price + tp_delta`, `sl_price = entry_price - sl_delta`
+     - **down (short/NO):** `tp_price = entry_price - tp_delta`, `sl_price = entry_price + sl_delta`
+   - Example: entry=0.60, tp_delta=0.10, sl_delta=0.05
+     - up: tp_price=0.70, sl_price=0.55
+     - down: tp_price=0.50, sl_price=0.65
    - Track entry_time for hold duration
 
 2. **Price Monitoring:**
    - Poll prices via orderbook-reader or subscribe via websocket-monitor
    - For each open position, check exit conditions on every price update
 
-3. **Exit Logic:**
-   - Take Profit: current_price >= entry_price + tp_delta -> sell at market
-   - Stop Loss: current_price <= entry_price - sl_delta -> sell at market
+3. **Exit Logic (side-aware):**
+   - **up (long):**
+     - Take Profit: `current_price >= tp_price` → sell at market
+     - Stop Loss: `current_price <= sl_price` → sell at market
+   - **down (short):**
+     - Take Profit: `current_price <= tp_price` → sell at market
+     - Stop Loss: `current_price >= sl_price` → sell at market
    - Execute exit via `polymarket-clob-trader --side=SELL --type=FOK`
 
-4. **Statistics Tracking:**
+4. **P&L and Statistics Tracking:**
+   - Calculate realized P&L **based on side**:
+     - **up:** `pnl = (exit_price - entry_price) * size`
+     - **down:** `pnl = (entry_price - exit_price) * size`
    - trades_opened, trades_closed, total_pnl
    - winning_trades (pnl >= 0), losing_trades (pnl < 0)
    - win_rate = winning / (winning + losing) * 100
@@ -63,14 +78,14 @@
 - **`stats.json`:** Trading statistics
 
 ## Quality Gates
-1. TP/SL prices calculated correctly from entry + delta
-2. Exit orders triggered at exact threshold prices
-3. Win/loss correctly categorized based on realized P&L
+1. TP/SL prices calculated correctly from entry + delta, **direction-aware** (up vs down)
+2. Exit orders triggered at exact threshold prices using side-correct comparisons
+3. Win/loss correctly categorized based on realized P&L (side-aware pnl formula)
 4. Win rate calculation is mathematically correct
-5. Max position limit enforced
+5. Max position limit enforced — new registrations are **rejected** when at capacity, not silently queued
 6. Position state persisted across monitoring restarts
 
 ## Integration Points
 - **Upstream:** `polymarket-clob-trader` opens positions, `polymarket-flash-crash-detector` and `polymarket-5min-strategy` register positions after entry
 - **Dependencies:** Price data from `polymarket-orderbook-reader` or `polymarket-websocket-monitor`
-- **Downstream:** `polymarket-portfolio-tracker` aggregates position data
+- **Downstream:** `polymarket-portfolio-tracker` aggregates position data
\ No newline at end of file

```

## Generated
- **Timestamp**: 2026-03-27T08:26:59.330Z
- **Source**: `/Users/ramene/.remote/@autoresearch/skills/working-polymarket-position-manager/SKILL.md`
- **Baseline**: `/Users/ramene/.remote/@autoresearch/skills/working-polymarket-position-manager/SKILL.md.baseline`
