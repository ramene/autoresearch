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
   - `--export`: Print the path of the written `portfolio.json` to stdout (the file is always written regardless of this flag)

2. **Keywords:** "polymarket positions", "prediction market P&L", "portfolio risk score", "what are my polymarket positions"

## Prerequisites
1. **Working Directory:** `~/.remote/@autoresearch/skills/working-polymarket-portfolio-tracker/`
2. **Environment:** `POLY_PRIVATE_KEY`, `POLY_SAFE_ADDRESS`
3. **Network:** Access to `https://data-api.polymarket.com` and `https://clob.polymarket.com`

## Execution Steps

1. **Fetch Positions:**
   - Derive the funder address from `POLY_SAFE_ADDRESS` (use as-is; it is the ERC-1155 holder address)
   - Query **all** positions (including fully closed ones) by using `sizeThreshold=0`:
     ```
     GET https://data-api.polymarket.com/positions?user=<POLY_SAFE_ADDRESS>&sizeThreshold=0&limit=500
     ```
     Response fields per position: `asset` (token_id), `size`, `avgPrice`, `initialValue`, `currentValue`, `cashPnl`, `percentPnl`, `market` (condition_id), `outcome`, `title`
   - **Important:** Use `sizeThreshold=0` (not 0.01) so that fully closed positions (size == 0) are returned. Closed positions have `cashPnl` that must be counted in realized P&L totals and included in the export.
   - For current prices, query the CLOB mid-price **only for positions where `size > 0`**:
     ```
     GET https://clob.polymarket.com/midpoint?token_id=<asset>
     ```
     Response: `{ "mid": "<price>" }`
     **Critical:** The CLOB API returns `mid` as a JSON string (e.g., `"0.71"`). You MUST parse it as a float before using it in any calculation: `current_price = float(response["mid"])`. Never use the raw string value.
   - **Closed positions (`size == 0`):** Do NOT query the CLOB. Set `current_price = 0`, `current_value = 0` for these positions.
   - For open positions (`size > 0`): **always compute `current_value = current_price * size`** using the CLOB midpoint fetched above. Do NOT use the Data API's `currentValue` field — it may reflect a stale price that would be inconsistent with `current_price`, corrupting unrealized P&L, total exposure, and risk scores. All calculations must use a single consistent price source (the CLOB midpoint).
   - **Display filter:** Show only positions where `size > 0.01` in the console table (ignore dust). However, include ALL positions (including closed ones with `size == 0`) in P&L totals and the `portfolio.json` export.

2. **Calculate P&L (FIFO):**

   The Data API returns pre-computed FIFO fields. Use them directly:

   **Per position:**
   - `cost_basis` = `initialValue` (total USDC spent to acquire current + previously sold shares, as tracked by the API's FIFO ledger)
   - `avg_price`:
     - If `size > 0`: use `avgPrice` from the API (FIFO cost per share for currently-held shares)
     - If `size == 0`: set `avg_price = 0` — the position is fully closed; there are no currently-held shares, so the historical `avgPrice` from the API is not meaningful for the export
   - `unrealized_pnl`:
     - If `size > 0`: `(current_price - avgPrice) * size`
     - If `size == 0`: `0`
   - `realized_pnl` = `cashPnl` — **always include this field regardless of whether `size > 0` or `size == 0`**. Partial closes generate `cashPnl` while leaving `size > 0`.
   - `total_position_pnl` = `unrealized_pnl` + `realized_pnl` (= `cashPnl`)
   - `unrealized_pnl_pct`:
     - If `cost_basis > 0` and `size > 0`: `(unrealized_pnl / cost_basis) * 100`
     - Otherwise: `0` (avoids division by zero for closed positions)

   **Portfolio totals:**
   - `total_unrealized_pnl` = sum of `unrealized_pnl` across all positions where `size > 0`
   - `total_realized_pnl` = sum of `cashPnl` across **ALL** positions (open, partially-closed, and fully-closed)
   - `total_pnl` = `total_unrealized_pnl` + `total_realized_pnl`
   - `win_rate` = count(positions where `cashPnl > 0`) / count(positions where `cashPnl != 0`) — stored as a float between 0 and 1 (e.g., 0.6 means 60%). If no positions have `cashPnl != 0`, set `win_rate = 0`.

   **Important:** Do NOT restrict `cashPnl` summation to `size == 0`. A position with `size = 50` and `cashPnl = 30` has already locked in $30 realized profit from a partial exit — this must be counted.

3. **Risk Scoring:**
   - `total_exposure` = sum of `current_value` across all positions where `size > 0`
   - `exposure_utilization` (ratio) = total_exposure / MAX_TOTAL_EXPOSURE_USD ($5,000)
   - `exposure_utilization_pct` (percentage) = `exposure_utilization * 100`
   - `concentration_risk` (ratio):
     - If `total_exposure > 0`: `largest_position_value / total_exposure` (where `largest_position_value` = max `current_value` among positions where `size > 0`)
     - If `total_exposure == 0` (all positions closed or no positions): `0`
   - `concentration_pct` (percentage) = `concentration_risk * 100`
   - `drawdown` (ratio):
     - If `total_exposure == 0` (all positions fully closed or no open positions): set `drawdown = 0`. A fully exited portfolio has no active drawdown — positions were sold/resolved, not drawn down.
     - If `total_exposure > 0`:
       - `peak` = sum of `initialValue` across **positions where `size > 0` (open positions only)**. Do NOT include closed positions (`size == 0`) in the peak calculation — their `initialValue` represents already-exited capital and would incorrectly inflate peak, making a healthy portfolio appear heavily drawn down.
       - If peak > 0: `drawdown = max(0, peak - total_exposure) / peak`
       - If peak == 0: `drawdown = 0`
   - `drawdown_pct` (percentage) = `drawdown * 100`
   - Risk score: 0-100 composite (low=0-30, medium=31-60, high=61-100)
     - exposure_score = min(exposure_utilization * 100, 100) * 0.4
     - concentration_score = min(concentration_risk * 100, 100) * 0.4
     - drawdown_score = min(drawdown * 100, 100) * 0.2
     - risk_score = round(exposure_score + concentration_score + drawdown_score)
   - **All-closed portfolio:** When `total_exposure == 0`, all sub-scores are 0, so `risk_score = 0`.

4. **Generate Report:**
   - Position summary table (active positions only, `size > 0.01`): market title, outcome, size, avgPrice, current_price, unrealized_pnl, realized_pnl (cashPnl), total_position_pnl, pnl_pct
   - Portfolio metrics: total_exposure, total_unrealized_pnl, total_realized_pnl, total_pnl, win_rate, risk_score, exposure_utilization_pct
   - **Always write `portfolio.json`** to the working directory on every execution, regardless of which flags were passed. The `--export` flag only controls whether the output path is echoed to stdout — it does not gate the file write. If the file already exists, overwrite it.
   - The top-level `portfolio.json` object must contain exactly four keys in this order: `timestamp`, `positions`, `summary`, `safety_limits`. The `timestamp` field is a **top-level field** (not inside `summary`) and must be an ISO 8601 UTC datetime string representing when the report was generated (e.g., `"2024-01-15T10:30:00Z"`).
   - The `positions` array in `portfolio.json` must contain **ALL positions** returned by the API (open, partial, and closed). Do not apply the `size > 0.01` display filter to the export.

   **JSON type rules (strictly enforced):**
   - All numeric fields (`size`, `avg_price`, `current_price`, `cost_basis`, `current_value`, `unrealized_pnl`, `realized_pnl`, `total_position_pnl`, `unrealized_pnl_pct`, and all `summary` numeric fields) must be JSON numbers — **not strings**.
   - `timestamp` must be a JSON string (ISO 8601), at the **top level** of the JSON object.
   - `token_id`, `title`, `market`, `outcome` must be JSON strings.
   - `risk_score` must be a JSON integer.

   **Schema with field annotations:**
   ```json
   {
     "timestamp": "2024-01-15T10:30:00Z",
     "positions": [
       {
         "token_id": "<asset field from API — string>",
         "title": "<title — string>",
         "market": "<condition_id — string>",
         "outcome": "<outcome — string>",
         "size": 150.0,
         "avg_price": 0.62,
         "current_price": 0.71,
         "cost_basis": 93.0,
         "current_value": 106.5,
         "unrealized_pnl": 13.5,
         "realized_pnl": 12.0,
         "total_position_pnl": 25.5,
         "unrealized_pnl_pct": 14.52
       }
     ],
     "summary": {
       "total_exposure": 106.5,
       "total_unrealized_pnl": 13.5,
       "total_realized_pnl": 12.0,
       "total_pnl": 25.5,
       "win_rate": 0.6,
       "risk_score": 18,
       "exposure_utilization_pct": 2.13,
       "concentration_pct": 100.0,
       "drawdown_pct": 0.0
     },
     "safety_limits": {
       "max_order_size_usd": 1000,
       "max_total_exposure_usd": 5000,
       "max_position_per_market_usd": 2000,
       "exposure_used_pct": 2.13
     }
   }
   ```

   Note in the schema example: `current_value` (106.5) equals `current_price` (0.71) × `size` (150.0). This is always true because `current_value` is always derived as `current_price * size`, never taken from the Data API.

   **Closed position example** (size == 0, `avg_price` and all activity fields set to 0 except `cost_basis` and `realized_pnl`):
   ```json
   {
     "token_id": "abc123",
     "title": "Will X happen?",
     "market": "0xdeadbeef",
     "outcome": "Yes",
     "size": 0,
     "avg_price": 0,
     "current_price": 0,
     "cost_basis": 50.0,
     "current_value": 0,
     "unrealized_pnl": 0,
     "realized_pnl": 18.5,
     "total_position_pnl": 18.5,
     "unrealized_pnl_pct": 0
   }
   ```

   **All-closed portfolio example** (when every position has size == 0, total_exposure == 0):
   ```json
   {
     "summary": {
       "total_exposure": 0,
       "total_unrealized_pnl": 0,
       "total_realized_pnl": 45.0,
       "total_pnl": 45.0,
       "win_rate": 0.75,
       "risk_score": 0,
       "exposure_utilization_pct": 0.0,
       "concentration_pct": 0.0,
       "drawdown_pct": 0.0
     }
   }
   ```

   Note: `risk_score` is 0 and `drawdown_pct` is 0.0 in the all-closed case because there are no open positions. A fully exited portfolio is not "drawn down" — it has been resolved. Do NOT compute drawdown as `initialValue / initialValue = 100%` for the closed state.

   **Field computation reference:**
   - `current_value` (per position) = `current_price * size` for open positions (`size > 0`); `0` for closed positions (`size == 0`)
   - `total_exposure` = sum of `current_value` across all positions where `size > 0`
   - `total_unrealized_pnl` = sum of `unrealized_pnl` across all positions where `size > 0`
   - `total_realized_pnl` = sum of `cashPnl` across ALL positions regardless of `size`
   - `total_pnl` = `total_unrealized_pnl` + `total_realized_pnl`
   - `win_rate` = count(`cashPnl > 0`) / count(`cashPnl != 0`), as float 0–1; 0 if denominator is 0
   - `risk_score` = integer 0–100 composite score (see Step 3); 0 when `total_exposure == 0`
   - `exposure_utilization_pct` = `total_exposure / 5000 * 100`, as float
   - `concentration_pct` = largest single position `current_value` / `total_exposure * 100`, as float; **0 if `total_exposure == 0`**
   - `drawdown_pct` = drawdown ratio * 100, as float; **0 if `total_exposure == 0` OR if peak == 0**; peak is computed from open positions only (`size > 0`) to avoid inflating peak with already-exited capital from closed positions
   - `exposure_used_pct` (in `safety_limits`) = same value as `summary.exposure_utilization_pct`

   **`safety_limits` object construction:** The `safety_limits` object in the JSON export must be fully populated on every execution. It must contain exactly four fields:
   - `max_order_size_usd`: hardcoded constant `1000` (integer, from MAX_ORDER_SIZE_USD in Safety Limits)
   - `max_total_exposure_usd`: hardcoded constant `5000` (integer, from MAX_TOTAL_EXPOSURE_USD in Safety Limits)
   - `max_position_per_market_usd`: hardcoded constant `2000` (integer, from MAX_POSITION_SIZE_PER_MARKET in Safety Limits)
   - `exposure_used_pct`: calculated float, identical to `summary.exposure_utilization_pct`

   Do not omit any of these four fields. The three `max_*` fields are always the same hardcoded values regardless of portfolio state.

## Safety Limits
- MAX_ORDER_SIZE_USD = $1,000
- MAX_TOTAL_EXPOSURE_USD = $5,000
- MAX_POSITION_SIZE_PER_MARKET = $2,000

## Output Format
- **Console:** Portfolio summary table (active positions only) and risk metrics
- **`portfolio.json`:** Always written on every execution. Top-level structure: `{ "timestamp": "<ISO 8601 UTC string>", "positions": [...], "summary": {...}, "safety_limits": {...} }`. Full position data including closed positions, with P&L calculations. All numeric fields are JSON numbers, not strings.

## Quality Gates
1. All positions fetched with `sizeThreshold=0` — includes open, partial, and closed positions
2. FIFO P&L calculation is mathematically correct; `cashPnl` summed across ALL positions regardless of `size`
3. Closed positions (`size == 0`) have `avg_price=0`, `current_price=0`, `current_value=0`, `unrealized_pnl=0`, `unrealized_pnl_pct=0` in export; `cost_basis` retains the `initialValue` from the API
4. `unrealized_pnl_pct` never divides by zero — returns 0 when `cost_basis == 0` or `size == 0`
5. `concentration_pct` never divides by zero — returns 0 when `total_exposure == 0` (all positions closed)
6. `drawdown_pct` never divides by zero — returns 0 when peak == 0; also returns 0 when `total_exposure == 0` (fully exited portfolio is not the same as a drawn-down portfolio); peak is always computed from open positions only (`size > 0`) to avoid inflating peak with already-exited capital from closed positions
7. Risk score reflects actual portfolio concentration and exposure; all sub-scores are 0 when portfolio is fully closed (`total_exposure == 0`), so `risk_score = 0`
8. Safety limit utilization reported accurately; `exposure_used_pct` = 0 when no open positions
9. Export format compatible with downstream analysis — includes all positions and `title` field
10. All `summary` fields are present in `portfolio.json` with correct JSON types: `win_rate` as float 0–1, `*_pct` fields as floats (numbers), `risk_score` as integer. The top-level `timestamp` field (outside of `summary`, at the root of the JSON object) must be an ISO 8601 UTC string — it is NOT a `summary` field.
11. No numeric field in `portfolio.json` is emitted as a JSON string — all numbers are bare JSON numeric literals
12. `portfolio.json` is written on every invocation — not gated behind `--export` flag
13. `safety_limits` object contains all four required fields: `max_order_size_usd` (1000), `max_total_exposure_usd` (5000), `max_position_per_market_usd` (2000), and `exposure_used_pct` (float equal to `summary.exposure_utilization_pct`)
14. The CLOB `mid` field is always parsed as a float (e.g., `float(response["mid"])`) before use — the CLOB API returns it as a JSON string, and using it raw would corrupt all downstream numeric calculations
15. `current_value` for open positions is always computed as `current_price * size` (using the CLOB midpoint) — never taken from the Data API's `currentValue` field. This ensures `current_value`, `current_price`, `unrealized_pnl`, and `total_exposure` are all derived from a single consistent price source.

## Integration Points
- **Upstream:** `polymarket-clob-trader` creates positions tracked here
- **Downstream:** `polymarket-position-manager` uses P&L data for TP/SL decisions
- **Cross-skill:** `polymarket-market-analyzer` considers existing positions in recommendations