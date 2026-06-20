# SKILL: polymarket-orderbook-reader
Real-time orderbook data from Polymarket CLOB — bid/ask depth, spread calculation, midpoint, last trade price, price history, and fill estimation. No authentication required.

## Purpose
This skill provides read-only market data from Polymarket's CLOB API. It fetches orderbook snapshots, calculates spreads, retrieves midpoints and last trade prices, queries price history, and estimates fill prices for potential orders. All endpoints are public (no auth required), making this the lowest-friction entry point for market intelligence.

## Trigger Conditions
1. **Slash Command:** `/skill polymarket-orderbook-reader [flags]`
   - `--book=<token_id>`: Get full orderbook (bids/asks)
   - `--price=<token_id>`: Get best bid/ask prices
   - `--mid=<token_id>`: Get midpoint price
   - `--spread=<token_id>`: Get current spread
   - `--last=<token_id>`: Get last trade price
   - `--history=<token_id>`: Get price history
   - `--interval=<1h|6h|1d|1w|1m|max>`: History interval (default: 1d)
   - `--fill=<token_id>`: Estimate fill price for a given size
   - `--fill-size=<shares>`: Size for fill estimation
   - `--fill-side=<BUY|SELL>`: Side for fill estimation
   - `--batch=<id1,id2,...>`: Batch query up to 500 tokens
   - `--depth=<n>`: Orderbook depth (default: 20 levels)

2. **Keywords:** "polymarket orderbook", "prediction market spread", "polymarket price", "what's the bid ask on"

## Prerequisites
1. **Working Directory:** `~/.remote/@autoresearch/skills/working-polymarket-orderbook-reader/`
2. **Network:** Access to `https://clob.polymarket.com` (no authentication required for read endpoints)

---

## Core Logic: Processing an Orderbook

This block defines how to transform a raw orderbook API response into baseline fields. Every flag-specific section below that fetches a single-token orderbook refers back to these steps.

**Input:** A raw orderbook response object with `bids` and `asks` arrays (either may be an empty array `[]`).

**Steps:**

1. **Extract sides with guards:**
   ```
   bids = response.bids or []   # may be empty
   asks = response.asks or []   # may be empty

   has_bids = len(bids) > 0
   has_asks = len(asks) > 0
   ```

2. **Compute price levels (null when side is empty):**
   ```
   best_bid = max(level.price for level in bids)  if has_bids  else null
   best_ask = min(level.price for level in asks)  if has_asks  else null
   ```

3. **Compute spread and mid (only valid when BOTH sides exist):**
   ```
   if has_bids and has_asks:
       spread     = best_ask - best_bid
       mid        = (best_ask + best_bid) / 2
       spread_pct = (spread / mid) * 100   # mid is guaranteed non-zero (prices are 0–1)
   else:
       spread     = null
       mid        = null
       spread_pct = null
   ```

4. **Compute liquidity totals (0 when side is empty):**
   ```
   total_bid_liquidity = sum(level.size for level in bids)   # 0 if empty
   total_ask_liquidity = sum(level.size for level in asks)   # 0 if empty
   ```

5. **Slice top N levels:**
   ```
   top_bids = bids[:depth]   # empty list if no bids
   top_asks = asks[:depth]   # empty list if no asks
   ```

6. **Record market state:**
   ```
   one_sided = not (has_bids and has_asks)
   ```

**Output (baseline fields):**
`best_bid`, `best_ask`, `spread`, `spread_pct`, `mid`, `one_sided`, `total_bid_liquidity`, `total_ask_liquidity`, `top_bids`, `top_asks`

Null values for `best_bid`, `best_ask`, `spread`, `spread_pct`, and `mid` are valid and must be included in output — never omit them.

---

## Flag-Specific Execution

### --spread / --price / --mid / --book
These flags all require the same baseline data and no additional API calls.

1. **Fetch Orderbook:** Execute `GET /book?token_id=<TOKEN_ID>`.
2. **Process Orderbook:** Apply the `Core Logic: Processing an Orderbook` rules to the response to compute all baseline fields.
3. **Format Output:** Write `orderbook.json` containing all baseline fields.
   - `--price`: Emphasize `best_bid` and `best_ask` in console output (either may be null).
   - `--mid`: Emphasize `mid` in console output (null if one-sided; note if spread > $0.10 Polymarket UI shows last traded price instead).
   - `--spread`: Emphasize all five spread fields (`best_bid`, `best_ask`, `spread`, `spread_pct`, `mid`) plus `one_sided` in console output.
   - `--book`: Display `top_bids`/`top_asks` depth table plus `total_bid_liquidity`/`total_ask_liquidity` in console output.

---

### --last

1. **Fetch Orderbook:** Execute `GET /book?token_id=<TOKEN_ID>`.
2. **Process Orderbook:** Apply the `Core Logic: Processing an Orderbook` rules to compute all baseline fields.
3. **Fetch Last Trade:** Execute `GET /last-trade-price?token_id=<TOKEN_ID>`. Returns `{price, side}`. Store as `last_trade_price` and `last_trade_side`.
4. **Format Output:** Write `orderbook.json` merging all baseline fields with `last_trade_price` and `last_trade_side`.

---

### --history

1. **Fetch Orderbook:** Execute `GET /book?token_id=<TOKEN_ID>`.
2. **Process Orderbook:** Apply the `Core Logic: Processing an Orderbook` rules to compute all baseline fields.
3. **Map interval to API parameters:** Compute `now_ts` as the current unix timestamp (integer seconds), then use this table:

   | User `--interval` | `fidelity` param | `startTs` (now_ts minus offset) | `endTs`  |
   |-------------------|------------------|----------------------------------|----------|
   | `1h`              | `1`              | `now_ts - 3600`                  | `now_ts` |
   | `6h`              | `1`              | `now_ts - 21600`                 | `now_ts` |
   | `1d` (default)    | `60`             | `now_ts - 86400`                 | `now_ts` |
   | `1w`              | `60`             | `now_ts - 604800`                | `now_ts` |
   | `1m`              | `60`             | `now_ts - 2592000`               | `now_ts` |
   | `max`             | `60`             | (omit `startTs` and `endTs`)     | (omit)   |

4. **Fetch Price History:**
   ```
   # NOTE: The price history endpoint uses the query parameter name "market" (not "token_id").
   # Pass the TOKEN_ID value as the "market" parameter.

   # For all intervals except max:
   GET /prices-history?market=<TOKEN_ID>&interval=<INTERVAL>&fidelity=<FIDELITY>&startTs=<startTs>&endTs=<endTs>

   # For max interval:
   GET /prices-history?market=<TOKEN_ID>&interval=max&fidelity=60
   ```
   The response has a `history` key: `[{"t": <unix_timestamp>, "p": <float>}, ...]`. An empty array is a valid result.

5. **Format Output:** Write `orderbook.json` merging all baseline fields with:
   - `price_history` = `response.history`
   - `history_interval` = the user-supplied interval string
   - `history_start_ts` = first point's `t` value (or the requested `startTs`)
   - `history_end_ts` = last point's `t` value (or `now_ts`)

---

### --fill

1. **Fetch Orderbook:** Execute `GET /book?token_id=<TOKEN_ID>`.
2. **Process Orderbook:** Apply the `Core Logic: Processing an Orderbook` rules to compute all baseline fields.
3. **Compute Fill Estimate:**
   - If the required side is empty (no `asks` for BUY; no `bids` for SELL), immediately set `insufficient_liquidity: true`, `avg_fill_price: null`, and skip the walk.
   - For BUY: walk `asks` sorted ascending by price:
     ```
     remaining = fill_size
     total_cost = 0
     levels_consumed = []
     for each ask level (price, size) in ascending order:
         fill_qty = min(remaining, size)
         total_cost += fill_qty * price
         levels_consumed.append({price, fill_qty})
         remaining -= fill_qty
         if remaining == 0: break
     if remaining > 0: set insufficient_liquidity: true
     avg_fill_price = total_cost / fill_size
     ```
   - For SELL: walk `bids` sorted descending by price using the same logic.
   - `slippage_pct = abs(avg_fill_price - mid) / mid * 100` (uses `mid` from baseline as `reference_mid`)
   - If `mid` is null (one-sided book), set `slippage_pct: null` and note the one-sided state.
4. **Format Output:** Write `orderbook.json` merging all baseline fields with the `fill_estimate` object.

---

### --batch

1. **Fetch All Orderbooks:** Execute a single batch request:
   ```
   POST /books
   Body: {"token_ids": [<TOKEN_ID_1>, <TOKEN_ID_2>, ...]}
   ```
   This returns a list of orderbook objects, one per token_id. Do NOT make individual `GET /book` calls per token.

2. **Process Each Token:** For each orderbook object in the response, apply the `Core Logic: Processing an Orderbook` rules independently to compute all baseline fields for that token.

3. **Format Output:** Write `orderbook.json` with the batch structure:
   ```json
   {
     "timestamp": "<ISO8601>",
     "batch_results": [
       {
         "token_id": "<TOKEN_ID>",
         "best_bid": <float|null>,
         "best_ask": <float|null>,
         "spread": <float|null>,
         "spread_pct": <float|null>,
         "mid": <float|null>,
         "one_sided": <bool>,
         "total_bid_liquidity": <float>,
         "total_ask_liquidity": <float>,
         "top_bids": [...],
         "top_asks": [...]
       },
       ...
     ]
   }
   ```
   Every entry must include all baseline fields. Null values for `spread`/`mid` on one-sided tokens are valid and must be included explicitly.

---

## Output Format

Every invocation must write `orderbook.json` to the working directory.

### Baseline Fields (always required for single-token modes)
```json
{
  "token_id": "<TOKEN_ID>",
  "timestamp": "<ISO8601>",
  "best_bid": <float|null>,
  "best_ask": <float|null>,
  "spread": <float|null>,
  "spread_pct": <float|null>,
  "mid": <float|null>,
  "one_sided": <bool>,
  "total_bid_liquidity": <float>,
  "total_ask_liquidity": <float>,
  "top_bids": [{"price": <float>, "size": <float>}, ...],
  "top_asks": [{"price": <float>, "size": <float>}, ...]
}
```
- `top_bids`/`top_asks`: top N levels (default 20); empty array `[]` when that side has no levels.
- `one_sided`: `true` when bids or asks array is empty; `false` otherwise.
- `total_bid_liquidity` / `total_ask_liquidity`: `0.0` when the respective side is empty.
- Null is valid for `best_bid`, `best_ask`, `spread`, `spread_pct`, `mid` — always include these keys even when null.

### Operation-Specific Fields (merged into baseline)

**`--last`** adds:
```json
{ "last_trade_price": <float>, "last_trade_side": "<BUY|SELL>" }
```

**`--history`** adds:
```json
{
  "price_history": [{"t": <timestamp>, "p": <float>}, ...],
  "history_interval": "<1h|6h|1d|1w|1m|max>",
  "history_start_ts": <int>,
  "history_end_ts": <int>
}
```

**`--fill`** adds:
```json
{
  "fill_estimate": {
    "fill_size": <float>,
    "fill_side": "<BUY|SELL>",
    "avg_fill_price": <float|null>,
    "total_cost": <float|null>,
    "slippage_pct": <float|null>,
    "reference_mid": <float|null>,
    "liquidity_available": <float>,
    "insufficient_liquidity": <bool>,
    "levels_consumed": [{"price": <float>, "fill_qty": <float>}, ...]
  }
}
```

**`--batch`** uses the batch structure defined in the `--batch` flag section above.

- **Console:** Formatted summary of all computed values with depth display. Flag one-sided markets clearly.

## Quality Gates
1. Orderbook data correctly parsed with bid/ask levels — including the case where one or both sides are empty arrays.
2. Spread and midpoint calculated correctly from best bid/ask. When either side is empty, spread and mid are null — this is correct, not an error.
3. Price history returns data points at correct intervals: the `fidelity` and `startTs`/`endTs` parameters must be set per the interval mapping table in the `--history` section — e.g., `1h` → fidelity=1 + startTs=now-3600, `1d` → fidelity=60 + startTs=now-86400. The price history endpoint uses the `market` query parameter (not `token_id`) to identify the token.
4. Fill estimation uses `mid` from the `Core Logic` baseline as `reference_mid`, then walks orderbook level-by-level accumulating cost correctly. Reports `insufficient_liquidity: true` immediately when the required side is empty.
5. Batch queries handle up to 500 tokens efficiently using a single `POST /books` request; all per-token baseline fields (including spread, spread_pct, mid — or null for one-sided tokens) are computed from that single response.
6. All data includes timestamps for freshness verification.
7. Every output (all modes) includes the full baseline fields so downstream skills always receive a complete market snapshot. Null fields are included explicitly, never omitted.

## Integration Points
- **Upstream:** `polymarket-market-discovery` provides token IDs to query
- **Downstream:** `polymarket-market-analyzer` uses orderbook data for opportunity scoring, `polymarket-flash-crash-detector` monitors price drops via real-time reads
- **Cross-skill:** `polymarket-websocket-monitor` provides streaming alternative to polling