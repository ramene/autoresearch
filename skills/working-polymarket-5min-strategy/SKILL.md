# SKILL: polymarket-5min-strategy
Mundave-style 5-minute market trading strategy -- using CVD (Cumulative Volume Delta) and Binance liquidation signals to trade Polymarket short-duration crypto prediction markets with $10 position sizes.

## Purpose
This skill implements the 5-minute market trading strategy described in the Mundave transcript. It combines HyperLiquid CVD (Cumulative Volume Delta -- tracking whether buyers or sellers dominate) with Binance liquidation data (large forced position closures that signal market direction) to generate directional signals on Polymarket's 5-minute crypto resolution markets. Target position size: $10/trade with asymmetric TP/SL.

## Trigger Conditions
1. **Slash Command:** `/skill polymarket-5min-strategy [flags]`
   - `--coin=<BTC|ETH|SOL>`: Target cryptocurrency (default: ETH)
   - `--size=<float>`: Trade size in USDC (default: 10.0)
   - `--paper`: Paper trade mode
   - `--duration=<minutes>`: Strategy duration (default: 120)
   - `--cvd-threshold=<float>`: CVD divergence threshold for signal (default: 50000.0)
   - `--liq-threshold=<float>`: Liquidation volume threshold for signal (default: 500000.0)

2. **Keywords:** "5 minute strategy polymarket", "mundave strategy", "CVD trading prediction market", "liquidation signal polymarket"

## Prerequisites
1. **Working Directory:** `~/.remote/@autoresearch/skills/working-polymarket-5min-strategy/`
2. **Dependencies:** `polymarket-market-discovery`, `polymarket-websocket-monitor`, `polymarket-clob-trader`
3. **External Data:** HyperLiquid CVD feed, Binance liquidation stream (via public WebSocket APIs)
4. **For live trading:** `POLY_PRIVATE_KEY`, `POLY_SAFE_ADDRESS`

## Data Schemas & Formulas

### CVD Calculation
CVD is computed from trade ticks over a rolling window (default: 300 seconds = 5 minutes):
```
For each trade tick:
  if side == "BUY":  cvd += size
  if side == "SELL": cvd -= size

cvd_delta = cvd_current - cvd_prev_window
price_delta = price_current - price_prev_window

# Divergence signal (using default cvd_threshold = 50000.0):
bullish_divergence = (price_delta < 0) and (cvd_delta > cvd_threshold)
bearish_divergence = (price_delta > 0) and (cvd_delta < -cvd_threshold)
```

### Liquidation Event Schema (Binance forceOrder stream)
```json
{
  "o": {
    "s": "ETHUSDT",      // symbol
    "S": "BUY|SELL",     // side of liquidated order
    "q": "1.500",        // original quantity
    "p": "2000.00",      // price
    "T": 1234567890000   // trade time ms
  }
}
```
- `S == "BUY"` = long position being liquidated → bearish signal
- `S == "SELL"` = short position being liquidated → bullish signal
- Aggregate `q * p` (notional) over a 60-second rolling window per symbol
- Signal fires when rolling notional exceeds `liq_threshold` (default: $500,000)

### Signal Combination Rules
| CVD Signal   | Liquidation Signal | Direction | Confidence |
|---|---|---|---|
| bullish_divergence | short_liq_cluster | BUY (UP/YES) | HIGH |
| bearish_divergence | long_liq_cluster  | SELL (DOWN/NO) | HIGH |
| bullish_divergence | none              | BUY (UP/YES) | MEDIUM |
| bearish_divergence | none              | SELL (DOWN/NO) | MEDIUM |
| none               | short_liq_cluster | BUY (UP/YES) | LOW |
| none               | long_liq_cluster  | SELL (DOWN/NO) | LOW |
| bullish_divergence | long_liq_cluster  | NO_TRADE | — |
| bearish_divergence | short_liq_cluster | NO_TRADE | — |
| conflicting        | conflicting       | NO_TRADE | — |

Only execute trades at MEDIUM or HIGH confidence.

### Trade Record Schema (`strategy_log.jsonl`)
Each line is a JSON object:
```json
{
  "ts": "ISO8601",
  "type": "signal|trade|outcome",
  "coin": "ETH",
  "direction": "BUY|SELL",
  "confidence": "HIGH|MEDIUM|LOW",
  "cvd_delta": 0.0,
  "liq_notional": 0.0,
  "market_id": "0x...",
  "token_id": "0x...",
  "size_usdc": 10.0,
  "entry_price": 0.0,
  "tp_price": 0.0,
  "sl_price": 0.0,
  "exit_price": null,
  "pnl": null,
  "paper": true
}
```

### Metrics Schema
```json
{
  "total_trades": 0,
  "wins": 0,
  "losses": 0,
  "win_rate": 0.0,
  "total_pnl_usdc": 0.0,
  "avg_win": 0.0,
  "avg_loss": 0.0,
  "sharpe_ratio": 0.0,
  "signal_accuracy": 0.0
}
```
- `win_rate = wins / total_trades` (only closed trades)
- `sharpe_ratio = mean(pnl_series) / std(pnl_series) * sqrt(252)` (annualized)
- `signal_accuracy = trades_that_moved_in_predicted_direction / total_trades`

## Execution Steps

1. **Market Discovery:**
   - Find active 5-minute resolution markets for target coin
   - Get token IDs for UP/DOWN (or YES/NO) outcomes

2. **Signal Sources:**
   a. **CVD (Cumulative Volume Delta):**
      - Connect to HyperLiquid or aggregator WebSocket
      - Track buy volume vs sell volume over rolling window using formula above
      - CVD rising = buyers dominating (bullish)
      - CVD falling = sellers dominating (bearish)
      - Signal: CVD divergence from price (price drops but CVD rises = bullish signal)

   b. **Binance Liquidation Data:**
      - Monitor Binance liquidation stream via `wss://fstream.binance.com/ws/!forceOrder@arr`
      - Parse events using liquidation event schema above
      - Large long liquidations = bearish signal (cascade selling)
      - Large short liquidations = bullish signal (short squeeze)
      - Signal: rolling notional exceeds `liq_threshold` within 60-second window

3. **Signal Combination:**
   - Apply signal combination rules table above
   - Only execute at MEDIUM or HIGH confidence
   - BUY signal: place on UP/YES token
   - SELL signal: place on DOWN/NO token

4. **Execution:**
   - **ALWAYS enforce**: `size_usdc = min(requested_size, 10.0)` — cap at $10 default; never exceed without explicit `--size` override
   - Paper mode: log signal and hypothetical trade to `strategy_log.jsonl`, no API calls
   - Live mode: place trade via `polymarket-clob-trader`
   - Set TP at `entry_price + 0.10`, SL at `entry_price - 0.05`
   - Max 1 open position per market at a time

5. **Tracking:**
   - Write every signal, trade, and outcome as a JSON line to `strategy_log.jsonl` using trade record schema
   - Update metrics after each closed trade using metrics schema formulas
   - Periodic summary output every 10 minutes

## Default Parameters
- Trade size: $10.00 (Mundave recommendation) — hard cap enforced in execution
- Take profit: +$0.10
- Stop loss: -$0.05
- Risk/reward ratio: 2:1
- Max concurrent positions: 1
- CVD window: 300 seconds
- CVD divergence threshold: 50,000.0 (absolute units of cumulative volume delta)
- Liquidation rolling window: 60 seconds
- Liquidation threshold: $500,000 notional
- Min confidence to trade: MEDIUM

## Output Format
- **Console:** Real-time strategy display with signals and trade status
- **`strategy_log.jsonl`:** Full signal and trade history (one JSON object per line)

## Quality Gates
1. CVD correctly calculated from volume data using buy/sell tick formula
2. Liquidation signals parsed from Binance forceOrder stream using event schema
3. Signal combination logic produces directional trades per combination rules table
4. Position size hard-capped at $10.00 default; validated before every order submission
5. Win rate and P&L tracked accurately per metrics schema after each closed trade
6. Paper mode produces no real API calls; all activity written to `strategy_log.jsonl`

## Integration Points
- **Upstream:** `polymarket-market-discovery --5min` finds markets, external CVD/liquidation feeds
- **Dependencies:** `polymarket-clob-trader` for execution, `polymarket-websocket-monitor` for Polymarket prices
- **Downstream:** `polymarket-position-manager` for lifecycle management