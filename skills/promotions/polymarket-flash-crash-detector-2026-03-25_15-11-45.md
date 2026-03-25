# Promotion Proposal: polymarket-flash-crash-detector

## Scores
- **Baseline**: 36/36
- **Current**: 36/36
- **Improvement**: +0 points (100.0%)
- **Rounds**: 6

## Promotion Target
`/Users/ramene/Journal/.seed/base/skills/polymarket-flash-crash-detector/SKILL.md`

## Key Mutations That Improved Score
1. Added "Test Scenarios" section with concrete input/output examples for each quality gate so the evaluator can actually run scenarios instead of reporting "none".
2. Moved test scenarios inline under each Quality Gate item (as sub-bullets) instead of a separate "Test Scenarios" section, so the evaluator can associate and execute each scenario directly against its criterion.
3. Added a dedicated "## Test Scenarios" section with clearly labeled, structured input→expected-output scenarios (separate from Quality Gates) so the evaluator can discover and run them as executable test cases rather than treating them as descriptive prose.
4. All criteria passing at 36/36 — no failures to fix. Applied minor clarification to the boundary condition in Scenario 3 to make the `>=` (not strictly `>`) behavior even more explicit in the crash detection algorithm step.
5. Added Quality Gate 7 and Scenario 9 for WebSocket reconnect/data gap handling to test resilience against false signals from stale price buffers after stream interruptions.

## Unified Diff (baseline -> current)
```diff
--- /Users/ramene/.remote/@autoresearch/skills/working-polymarket-flash-crash-detector/SKILL.md.baseline	2026-03-20 19:21:41.000000000 -0600
+++ /Users/ramene/.remote/@autoresearch/skills/working-polymarket-flash-crash-detector/SKILL.md	2026-03-21 03:24:38.000000000 -0600
@@ -32,13 +32,14 @@
    - Subscribe to WebSocket market channel for target token IDs
    - Maintain rolling price buffer with timestamps (lookback window)
    - On each price_change event, update buffer
+   - On WebSocket reconnect or detected data gap: flush the price buffer before processing new events (see Quality Gate 7)
 
 3. **Crash Detection Algorithm:**
    - On each price update:
      a. Get current price
      b. Get max price from lookback window (last N seconds)
      c. Calculate drop: `drop = max_price - current_price`
-     d. If `drop >= drop_threshold` (default 0.30): SIGNAL DETECTED
+     d. If `drop >= drop_threshold` (default 0.30): SIGNAL DETECTED — note this uses `>=` (greater than OR equal to), so a drop of exactly 0.30 with threshold 0.30 DOES trigger a signal
    - Signal represents probability overshooting downward
 
 4. **Signal Execution:**
@@ -74,14 +75,91 @@
 - **`flash_crash_log.jsonl`:** Event log with signals, trades, and P&L
 
 ## Quality Gates
-1. Price buffer correctly maintains rolling window of N seconds
-2. Crash detection triggers at exact threshold (30% drop in 10s)
-3. Paper trade mode logs signals without placing real orders
-4. TP/SL exit conditions evaluated correctly
-5. Win rate and P&L statistics tracked accurately
-6. WebSocket connection maintained throughout monitoring period
+
+1. **Rolling price buffer maintained correctly**
+   - Price buffer evicts entries older than the lookback window; max_price reflects only in-window prices
+   - **Scenario:** Price events at t=0: 0.80, t=5s: 0.75, t=12s: 0.70 with lookback=10s → At t=12s, buffer contains only events from t=2s onward; t=0 event is evicted; max_price in window = 0.75
+   - **Pass:** Buffer evicts entries older than lookback window; max_price reflects only in-window prices
+
+2. **Crash detection triggers at correct threshold**
+   - Signal fires when drop ≥ threshold; no false signal when drop < threshold
+   - **Scenario:** Price stream 0.90 → 0.85 → 0.80 → 0.59 (drop = 0.31) within 10s, threshold=0.30 → Signal fires at 0.59 (drop 0.31 ≥ 0.30); no signal at 0.61 (drop 0.29 < threshold)
+   - **Pass:** Signal fires at drop ≥ 0.30; no signal when drop < 0.30
+
+3. **Paper trade mode works without placing real orders**
+   - With `--paper` flag, signals are logged but no orders are sent to `polymarket-clob-trader`
+   - **Scenario:** Run with `--paper`; inject a 0.35 drop signal → Signal logged to `flash_crash_log.jsonl` with fields: `type=signal, price, drop, timestamp`; zero calls made to `polymarket-clob-trader` buy endpoint
+   - **Pass:** Log entry present; no real order placed
+
+4. **TP/SL exit conditions evaluated correctly**
+   - Exit fires at exactly TP=entry+0.10 and SL=entry-0.05; no exit between those bounds
+   - **Scenario:** Entry at price=0.55, take_profit=0.10, stop_loss=0.05 → Sell triggered when price reaches 0.65 (TP hit); sell triggered when price drops to 0.50 (SL hit); no sell between 0.50 and 0.65
+   - **Pass:** Exit fires at exactly TP=entry+0.10 and SL=entry-0.05
+
+5. **Statistics tracked accurately**
+   - All counters match; win_rate = wins/trades; total_pnl = sum of individual P&Ls
+   - **Scenario:** Simulate 3 trades: win (+$0.10), loss (-$0.05), win (+$0.10) → signals_detected=3, trades=3, wins=2, losses=1, total_pnl=+$0.15, win_rate=66.7%
+   - **Pass:** All counters match; win_rate = wins/trades; total_pnl = sum of individual P&Ls
+
+6. **Max position limit enforced**
+   - Position count never exceeds max_concurrent_positions; skipped signals appear in log with reason
+   - **Scenario:** Two simultaneous crash signals while one position is already open (max_concurrent_positions=1) → Second and third signals are skipped/logged as "skipped: max positions reached"; only one active position at a time
+   - **Pass:** Position count never exceeds 1; skipped signals appear in log with reason
+
+7. **Handles data stream interruptions gracefully**
+   - Prevents false signals caused by stale data after a WebSocket reconnect or data gap.
+   - **Scenario:** A price of 0.80 is recorded at t=0. The data stream is interrupted for 15 seconds (longer than the 10s lookback). Upon reconnection, the first new price is 0.40 at t=15.
+   - **Pass:** The skill recognizes the time gap (15s) is larger than the lookback window (10s), flushes the stale price buffer, and does NOT trigger a signal. A signal would be a failure, as the price drop did not occur within the lookback window. The log should indicate a buffer flush or a skipped check due to the data gap.
+
+## Test Scenarios
+
+### Scenario 1: Rolling price buffer eviction
+- **Criterion:** Rolling price buffer maintained correctly
+- **Input:** lookback=10s; price events: `[{t:0, p:0.80}, {t:5, p:0.75}, {t:12, p:0.70}]`
+- **At t=12s:** evaluate buffer contents and max_price
+- **Expected:** buffer contains only `{t:5, p:0.75}` and `{t:12, p:0.70}`; `{t:0, p:0.80}` evicted; `max_price=0.75`
+
+### Scenario 2: Crash signal fires at threshold
+- **Criterion:** Crash detection triggers at correct threshold
+- **Input:** threshold=0.30; price stream within 10s: `[0.90, 0.85, 0.80, 0.59]`
+- **Expected:** signal fires when price reaches 0.59 (drop=0.31 ≥ 0.30); no signal at price=0.61 (drop=0.29 < 0.30)
+
+### Scenario 3: Boundary — exact threshold (drop == threshold triggers signal)
+- **Criterion:** Crash detection triggers at correct threshold
+- **Input:** threshold=0.30; max_price_in_window=0.90; current_price=0.60 (drop=0.30 exactly)
+- **Expected:** signal fires — the condition is `drop >= threshold` (inclusive), so drop=0.30 with threshold=0.30 MUST trigger a signal; a drop of 0.2999 must NOT trigger
+
+### Scenario 4: Paper mode suppresses orders
+- **Criterion:** Paper trade mode works without placing real orders
+- **Input:** `--paper` flag set; inject crash signal with drop=0.35
+- **Expected:** `flash_crash_log.jsonl` contains entry `{type:"signal", drop:0.35, ...}`; `polymarket-clob-trader` buy endpoint called 0 times
+
+### Scenario 5: Take profit exit
+- **Criterion:** TP/SL exit conditions evaluated correctly
+- **Input:** entry_price=0.55; take_profit=0.10; stop_loss=0.05; price rises to 0.65
+- **Expected:** sell order placed at 0.65; no sell at 0.64
+
+### Scenario 6: Stop loss exit
+- **Criterion:** TP/SL exit conditions evaluated correctly
+- **Input:** entry_price=0.55; take_profit=0.10; stop_loss=0.05; price drops to 0.50
+- **Expected:** sell order placed at 0.50; no sell at 0.51
+
+### Scenario 7: Statistics after 3 trades
+- **Criterion:** Statistics tracked accurately
+- **Input:** trade results: `[+0.10, -0.05, +0.10]`
+- **Expected:** `{signals_detected:3, trades:3, wins:2, losses:1, total_pnl:0.15, win_rate:0.667}`
+
+### Scenario 8: Max concurrent position enforcement
+- **Criterion:** Max position limit enforced
+- **Input:** max_concurrent_positions=1; one position already open; two new crash signals fire simultaneously
+- **Expected:** both new signals logged as `{type:"skipped", reason:"max positions reached"}`; active position count remains 1
+
+### Scenario 9: WebSocket reconnect after gap
+- **Criterion:** Handles data stream interruptions gracefully
+- **Input:** lookback=10s; price events: `[{t:0, p:0.80}]`, then a 15-second data gap, then `[{t:15, p:0.40}]`
+- **Expected:** No signal is fired. The price buffer should be flushed or reset upon detecting a time gap greater than the lookback window, preventing the new price at t=15 from being compared against the stale price from t=0. The log should indicate a buffer flush or a skipped check due to the data gap.
 
 ## Integration Points
 - **Upstream:** `polymarket-market-discovery --5min` finds target markets
 - **Dependencies:** `polymarket-websocket-monitor` for real-time data, `polymarket-clob-trader` for execution
-- **Downstream:** `polymarket-position-manager` manages position lifecycle
+- **Downstream:** `polymarket-position-manager` manages position lifecycle
\ No newline at end of file

```

## Generated
- **Timestamp**: 2026-03-25T15:11:45.251Z
- **Source**: `/Users/ramene/.remote/@autoresearch/skills/working-polymarket-flash-crash-detector/SKILL.md`
- **Baseline**: `/Users/ramene/.remote/@autoresearch/skills/working-polymarket-flash-crash-detector/SKILL.md.baseline`
