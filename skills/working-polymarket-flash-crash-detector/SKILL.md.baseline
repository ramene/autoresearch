# SKILL: polymarket-flash-crash-detector
Detect probability crashes on Polymarket prediction markets -- monitoring for 30%+ price drops within 10-second windows and generating buy signals on oversold conditions.

## Purpose
This skill implements a flash crash detection strategy for Polymarket's short-duration prediction markets (5-minute, 15-minute). It monitors real-time prices via WebSocket, detects when a probability drops 30% or more within a 10-second lookback window, and generates buy signals on the assumption that sharp drops in prediction markets often overshoot and revert. Based on the discountry/polymarket-trading-bot flash crash strategy.

## Trigger Conditions
1. **Slash Command:** `/skill polymarket-flash-crash-detector [flags]`
   - `--coin=<BTC|ETH|SOL|XRP>`: Coin to monitor (default: ETH)
   - `--drop=<float>`: Drop threshold as absolute probability change (default: 0.30)
   - `--lookback=<seconds>`: Lookback window (default: 10)
   - `--size=<float>`: Trade size in USDC (default: 5.0)
   - `--take-profit=<float>`: TP in dollars (default: 0.10)
   - `--stop-loss=<float>`: SL in dollars (default: 0.05)
   - `--paper`: Paper trade mode (no real orders)
   - `--duration=<minutes>`: Monitoring duration (default: 60)

2. **Keywords:** "flash crash polymarket", "detect probability crash", "buy the dip prediction market", "oversold polymarket"

## Prerequisites
1. **Working Directory:** `~/.remote/@autoresearch/skills/working-polymarket-flash-crash-detector/`
2. **Dependencies:** `polymarket-websocket-monitor` for real-time data, `polymarket-clob-trader` for execution (if not paper trading)
3. **For live trading:** `POLY_PRIVATE_KEY`, `POLY_SAFE_ADDRESS`

## Execution Steps

1. **Market Discovery:**
   - Use `polymarket-market-discovery --5min --coin=<COIN>` to find active 5/15-minute markets
   - Get token IDs for both YES and NO outcomes

2. **Price Monitoring:**
   - Subscribe to WebSocket market channel for target token IDs
   - Maintain rolling price buffer with timestamps (lookback window)
   - On each price_change event, update buffer

3. **Crash Detection Algorithm:**
   - On each price update:
     a. Get current price
     b. Get max price from lookback window (last N seconds)
     c. Calculate drop: `drop = max_price - current_price`
     d. If `drop >= drop_threshold` (default 0.30): SIGNAL DETECTED
   - Signal represents probability overshooting downward

4. **Signal Execution:**
   - Paper mode: Log signal with timestamp, prices, drop magnitude
   - Live mode: Place buy order via `polymarket-clob-trader`:
     - Side: BUY
     - Token: The dropped token (buy low)
     - Size: configured USDC amount
     - Type: FOK (fill or kill for immediate execution)
     - Price: current_price (market order with slippage limit)

5. **Position Management:**
   - After entry, monitor price for TP/SL:
     - Take profit: entry_price + take_profit_delta (default +$0.10)
     - Stop loss: entry_price - stop_loss_delta (default -$0.05)
   - On TP/SL trigger: place sell order, log result

6. **Statistics:**
   - Track: signals detected, trades executed, wins, losses, total P&L, win rate
   - Log all events to `flash_crash_log.jsonl`
   - Print periodic status updates

## Default Parameters
- Drop threshold: 0.30 (30% probability drop)
- Lookback window: 10 seconds
- Trade size: $5.00
- Take profit: +$0.10
- Stop loss: -$0.05
- Max concurrent positions: 1

## Output Format
- **Console:** Real-time monitoring display with detected signals and trade status
- **`flash_crash_log.jsonl`:** Event log with signals, trades, and P&L

## Quality Gates
1. Price buffer correctly maintains rolling window of N seconds
2. Crash detection triggers at exact threshold (30% drop in 10s)
3. Paper trade mode logs signals without placing real orders
4. TP/SL exit conditions evaluated correctly
5. Win rate and P&L statistics tracked accurately
6. WebSocket connection maintained throughout monitoring period

## Integration Points
- **Upstream:** `polymarket-market-discovery --5min` finds target markets
- **Dependencies:** `polymarket-websocket-monitor` for real-time data, `polymarket-clob-trader` for execution
- **Downstream:** `polymarket-position-manager` manages position lifecycle
