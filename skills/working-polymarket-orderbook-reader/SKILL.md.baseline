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

## Execution Steps

1. **Orderbook (--book):**
   - `GET /book?token_id=<TOKEN_ID>`
   - Returns: `{bids: [{price, size}...], asks: [{price, size}...], tick_size, min_order_size, neg_risk}`
   - Display top N levels of depth for bids and asks
   - Calculate total bid/ask liquidity

2. **Prices (--price):**
   - BUY price (best ask): `GET /price?token_id=<TOKEN_ID>&side=BUY`
   - SELL price (best bid): `GET /price?token_id=<TOKEN_ID>&side=SELL`

3. **Midpoint (--mid):**
   - `GET /midpoint?token_id=<TOKEN_ID>` → `{mid: "0.50"}`
   - Note: If bid-ask spread > $0.10, Polymarket UI shows last traded price instead

4. **Spread (--spread):**
   - Fetch both bid and ask, calculate: spread = ask - bid
   - Also calculate spread percentage: (spread / mid) * 100

5. **Last Trade Price (--last):**
   - Returns: `{price, side}` — last executed trade

6. **Price History (--history):**
   - Query with interval: `1h`, `6h`, `1d`, `1w`, `1m`, `max`
   - Or absolute range with `startTs`/`endTs`
   - Each data point: `{t: timestamp, p: price}`
   - Fidelity parameter controls data points per interval

7. **Fill Estimation (--fill):**
   - Walk the orderbook to estimate execution price for a given size
   - `client.calculateMarketPrice(tokenID, side, size, orderType)`
   - Report: estimated avg fill price, total cost, slippage from mid

8. **Batch Queries (--batch):**
   - All queries have batch variants (up to 500 tokens):
   - `POST /books`, `POST /prices`, `POST /midpoints`, `POST /spreads`
   - Submit all token IDs in single request for efficiency

## Output Format
- **Console:** Formatted orderbook display with depth, spread summary, and price data
- **`orderbook.json`:** Full orderbook snapshot with metadata

## Quality Gates
1. Orderbook data correctly parsed with bid/ask levels
2. Spread calculated accurately from best bid/ask
3. Price history returns data points at correct intervals
4. Fill estimation walks orderbook correctly for given size
5. Batch queries handle up to 500 tokens efficiently
6. All data includes timestamps for freshness verification

## Integration Points
- **Upstream:** `polymarket-market-discovery` provides token IDs to query
- **Downstream:** `polymarket-market-analyzer` uses orderbook data for opportunity scoring, `polymarket-flash-crash-detector` monitors price drops via real-time reads
- **Cross-skill:** `polymarket-websocket-monitor` provides streaming alternative to polling
