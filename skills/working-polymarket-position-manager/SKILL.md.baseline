# SKILL: polymarket-position-manager
Take-profit and stop-loss lifecycle management for Polymarket positions -- monitoring prices, triggering exits, tracking win rate, and managing position state.

## Purpose
This skill manages the full lifecycle of Polymarket trading positions after entry. It monitors current prices against configured take-profit (TP) and stop-loss (SL) levels, automatically triggers exit orders when conditions are met, tracks trading statistics (win rate, total P&L, average hold time), and supports multiple concurrent positions with per-position TP/SL configuration.

## Trigger Conditions
1. **Slash Command:** `/skill polymarket-position-manager [flags]`
   - `--monitor`: Start monitoring all open positions for TP/SL
   - `--add`: Register a new position for management
   - `--token-id=<id>`: Token ID of the position
   - `--entry-price=<float>`: Entry price
   - `--size=<float>`: Position size
   - `--side=<up|down>`: Position direction
   - `--tp=<float>`: Take profit delta in dollars (default: 0.10)
   - `--sl=<float>`: Stop loss delta in dollars (default: 0.05)
   - `--max-positions=<n>`: Max concurrent positions (default: 1)
   - `--stats`: Show trading statistics

2. **Keywords:** "manage polymarket positions", "set take profit", "stop loss prediction market", "position manager"

## Prerequisites
1. **Working Directory:** `~/.remote/@autoresearch/skills/working-polymarket-position-manager/`
2. **Dependencies:** `polymarket-orderbook-reader` or `polymarket-websocket-monitor` for price data, `polymarket-clob-trader` for exit execution
3. **For live exits:** `POLY_PRIVATE_KEY`, `POLY_SAFE_ADDRESS`

## Execution Steps

1. **Position Registration:**
   - Create Position with: id, side (up/down), token_id, entry_price, size, TP delta, SL delta
   - Calculate TP price: entry_price + tp_delta
   - Calculate SL price: entry_price - sl_delta
   - Track entry_time for hold duration

2. **Price Monitoring:**
   - Poll prices via orderbook-reader or subscribe via websocket-monitor
   - For each open position, check exit conditions on every price update

3. **Exit Logic:**
   - Take Profit: current_price >= entry_price + tp_delta -> sell at market
   - Stop Loss: current_price <= entry_price - sl_delta -> sell at market
   - Execute exit via `polymarket-clob-trader --side=SELL --type=FOK`

4. **Statistics Tracking:**
   - trades_opened, trades_closed, total_pnl
   - winning_trades (pnl >= 0), losing_trades (pnl < 0)
   - win_rate = winning / (winning + losing) * 100
   - Average hold time, max drawdown

5. **State Management:**
   - Max N concurrent positions (configurable)
   - Only one position per side (up/down)
   - Save state to `positions.json`

## Default Parameters
- Take profit: +$0.10
- Stop loss: -$0.05
- Max concurrent positions: 1

## Output Format
- **Console:** Position status table with P&L and TP/SL levels
- **`positions.json`:** Active and historical position data
- **`stats.json`:** Trading statistics

## Quality Gates
1. TP/SL prices calculated correctly from entry + delta
2. Exit orders triggered at exact threshold prices
3. Win/loss correctly categorized based on realized P&L
4. Win rate calculation is mathematically correct
5. Max position limit enforced
6. Position state persisted across monitoring restarts

## Integration Points
- **Upstream:** `polymarket-clob-trader` opens positions, `polymarket-flash-crash-detector` and `polymarket-5min-strategy` register positions after entry
- **Dependencies:** Price data from `polymarket-orderbook-reader` or `polymarket-websocket-monitor`
- **Downstream:** `polymarket-portfolio-tracker` aggregates position data
