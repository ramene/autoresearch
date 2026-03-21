# SKILL: polymarket-portfolio-tracker
Track Polymarket positions, calculate FIFO P&L, monitor unrealized gains/losses, and generate risk scores across the portfolio.

## Purpose
This skill tracks all active positions on Polymarket, calculates profit/loss using FIFO accounting, monitors portfolio-wide risk metrics (exposure utilization, concentration, drawdown), and generates structured portfolio reports. It provides the intelligence layer between raw position data and strategic decision-making.

## Trigger Conditions
1. **Slash Command:** `/skill polymarket-portfolio-tracker [flags]`
   - `--positions`: List all active positions with current P&L
   - `--pnl`: Calculate realized + unrealized P&L summary
   - `--risk`: Generate risk score and exposure analysis
   - `--history`: Show trade history with FIFO cost basis
   - `--market=<id>`: Filter to specific market
   - `--export`: Export portfolio data to JSON

2. **Keywords:** "polymarket positions", "prediction market P&L", "portfolio risk score", "what are my polymarket positions"

## Prerequisites
1. **Working Directory:** `~/.remote/@autoresearch/skills/working-polymarket-portfolio-tracker/`
2. **Environment:** `POLY_PRIVATE_KEY`, `POLY_SAFE_ADDRESS`
3. **Network:** Access to `https://data-api.polymarket.com` and `https://clob.polymarket.com`

## Execution Steps

1. **Fetch Positions:**
   - Query Data API for current positions by funder address
   - For each position: token_id, size, avg_entry_price, current_price
   - Fetch current market prices via CLOB API

2. **Calculate P&L (FIFO):**
   - Track cost basis using First-In-First-Out accounting
   - Unrealized P&L = (current_price - avg_entry_price) * size for each position
   - Realized P&L = sum of closed position profits/losses
   - Total P&L = realized + unrealized

3. **Risk Scoring:**
   - Exposure utilization: total_exposure / MAX_TOTAL_EXPOSURE_USD ($5,000)
   - Concentration risk: largest_position / total_exposure
   - Drawdown: max portfolio value decline from peak
   - Risk score: 0-100 composite (low=0-30, medium=31-60, high=61-100)

4. **Generate Report:**
   - Position summary table: market, side, size, entry, current, P&L, P&L%
   - Portfolio metrics: total exposure, total P&L, win rate, risk score
   - Save to `portfolio.json`

## Safety Limits
- MAX_ORDER_SIZE_USD = $1,000
- MAX_TOTAL_EXPOSURE_USD = $5,000
- MAX_POSITION_SIZE_PER_MARKET = $2,000

## Output Format
- **Console:** Portfolio summary table and risk metrics
- **`portfolio.json`:** Full position data with P&L calculations

## Quality Gates
1. All active positions fetched with current prices
2. FIFO P&L calculation is mathematically correct
3. Risk score reflects actual portfolio concentration and exposure
4. Safety limit utilization reported accurately
5. Export format compatible with downstream analysis

## Integration Points
- **Upstream:** `polymarket-clob-trader` creates positions tracked here
- **Downstream:** `polymarket-position-manager` uses P&L data for TP/SL decisions
- **Cross-skill:** `polymarket-market-analyzer` considers existing positions in recommendations
