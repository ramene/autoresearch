# SKILL: polymarket-paper-trader (Orchestrator)
End-to-end Polymarket paper trading via `paper_trader.py` — the single executable pipeline that chains market discovery, orderbook analysis, flash crash detection, and position management.

## When to Use
- "paper trade on polymarket"
- "run the flash crash strategy"
- "simulate polymarket trading"
- "chain the polymarket skills together"
- "test the 5-minute market strategy"

## Execution

### Primary: Run the Pipeline Script

The pipeline script `paper_trader.py` is the single source of truth. It implements all 7 stages of the trading chain internally. The skill's job is to invoke it correctly.

```bash
# Default — monitor ETH for 60 minutes
python3 ~/.remote/@autoresearch/skills/working-polymarket-flash-crash-detector/paper_trader.py

# Custom parameters
python3 ~/.remote/@autoresearch/skills/working-polymarket-flash-crash-detector/paper_trader.py \
  --coin ETH \
  --size 10 \
  --drop 0.30 \
  --lookback 10 \
  --take-profit 0.10 \
  --stop-loss 0.05 \
  --duration 60
```

The script auto-detects its environment:
- If `polymarket-trading-bot` is on the path → imports its battle-tested `GammaClient`, `PriceTracker`, `PositionManager`
- If not → uses built-in inline implementations (zero external dependencies beyond `websockets`)
- If `websockets` isn't installed → falls back to REST polling mode
- No wallet credentials needed in any mode

### Quick Scan (Steps 1-3 only)

For a fast viability check without monitoring, run the script with `--duration 0` or use the MCP tools directly:

```bash
# Via script (prints market info then exits)
python3 paper_trader.py --coin ETH --duration 0

# Via MCP tools (if polymarket-mcp is available)
# 1. search_markets(query="ETH updown 15m")
# 2. get_orderbook(token_id=<up_token_id>, depth=10)
# 3. analyze_market_opportunity(market_id=<condition_id>)
```

## What the Pipeline Does

`paper_trader.py` executes 7 stages in a single process:

```
Stage 1: Market Discovery
  └─ GammaClient.get_market_info(coin)
  └─ Finds active 15-min market, extracts token_ids
  └─ Gate: abort if no active market

Stage 2: Orderbook Viability
  └─ GET /book?token_id={up_token}
  └─ Calculates spread, liquidity, risk level
  └─ Gate: warn but continue (paper mode)

Stage 3: Market Analysis
  └─ Scores: risk (high/medium/low), recommendation, confidence
  └─ Logged to stdout

Stage 4: WebSocket Monitor
  └─ Connects to wss://ws-subscriptions-clob.polymarket.com/ws/market
  └─ Subscribes to both up/down token IDs
  └─ Maintains PING heartbeat every 10s
  └─ Falls back to REST polling if WS unavailable

Stage 5: Flash Crash Detection
  └─ PriceTracker with rolling 10-second window
  └─ Fires signal when drop >= 0.30 (configurable)
  └─ Records signal to paper_trades.jsonl

Stage 6: Position Management
  └─ PositionManager with TP +$0.10, SL -$0.05
  └─ Max 1 position, checks every price tick
  └─ Logs entry/exit to paper_trades.jsonl

Stage 7: Summary
  └─ Prints win rate, P&L, signal count
  └─ Saves paper_summary.json
```

## Parameters

| Parameter | Default | Flag | Description |
|-----------|---------|------|-------------|
| Coin | ETH | `--coin` | BTC, ETH, SOL, XRP |
| Size | $10.00 | `--size` | USDC per simulated trade |
| Drop threshold | 0.30 | `--drop` | Probability drop to trigger signal |
| Lookback | 10s | `--lookback` | Rolling window for crash detection |
| Take profit | +$0.10 | `--take-profit` | Exit delta (profit) |
| Stop loss | -$0.05 | `--stop-loss` | Exit delta (loss) |
| Duration | 60 min | `--duration` | Monitoring duration (0 = scan only) |

## Output Files

All output lives in the skill working directory:
```
~/.remote/@autoresearch/skills/working-polymarket-flash-crash-detector/
├── paper_trades.jsonl    # Line-delimited trade log (append-only)
├── paper_summary.json    # Latest session summary
├── paper_trader.py       # The pipeline script (source of truth)
└── ORCHESTRATOR.md       # This file (how to invoke it)
```

### paper_trades.jsonl format
```json
{"timestamp":"...","event":"signal","side":"up","price":0.35,"size":0,"pnl":0,"details":"drop=0.32 (47.1%)"}
{"timestamp":"...","event":"entry","side":"up","price":0.35,"size":28.5,"pnl":0,"details":"tp=0.45 sl=0.30"}
{"timestamp":"...","event":"exit_tp","side":"up","price":0.45,"size":28.5,"pnl":2.85,"details":""}
```

## MCP Integration

When `polymarket-mcp` is available, use it for the **quick scan** path (Steps 1-3). For the **full monitoring loop** (Steps 4-7), always use `paper_trader.py` because:
- MCP tools are request-response, not streaming
- The script manages WebSocket lifecycle, heartbeat, and market rotation internally
- The script's PriceTracker and PositionManager maintain state across ticks

MCP tools are useful for:
- Pre-flight checks before running the script
- Post-run analysis (fetching final market state)
- Comparing results against `analyze_market_opportunity` scoring

## Transitioning to Live Trading

When the user provides `POLY_PRIVATE_KEY` and `POLY_SAFE_ADDRESS`:

1. Update `paper_trader.py` to accept `--live` flag
2. In live mode, replace simulated entries/exits with actual CLOB API calls
3. The script already imports from `polymarket-trading-bot` when available, which has the full `TradingBot` class
4. Safety limits enforced: $1,000 max order, $5,000 max exposure

**Never auto-enable live trading.** Always require `--live` flag plus explicit user confirmation.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "No active 15-minute market" | Markets rotate every 15 min. Wait or try different coin. |
| "websockets not installed" | `pip install websockets` — script falls back to polling without it |
| Import errors from trading-bot | Script has inline fallbacks. Works without trading-bot on path. |
| "Empty orderbook" | Market may have just opened or resolved. Wait for next cycle. |
