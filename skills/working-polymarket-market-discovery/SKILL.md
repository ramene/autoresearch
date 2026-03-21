# SKILL: polymarket-market-discovery
Search, filter, and discover Polymarket prediction markets via the Gamma API — trending markets, category browsing, closing-soon alerts, and 5-minute market auto-discovery for rapid trading.

## Purpose
This skill provides market discovery and filtering for Polymarket's prediction markets. It uses the Gamma API (no auth required) to search by text/slug/keywords, get trending markets by volume, filter by category/tag, find markets closing soon, discover sports and crypto markets, and auto-discover 5-minute markets for rapid trading strategies. This is the primary market intelligence gathering skill that feeds into analysis and trading skills.

## Trigger Conditions
1. **Slash Command:** `/skill polymarket-market-discovery [flags]`
   - `--search=<query>`: Search markets by text, slug, or keywords
   - `--trending`: Get markets with highest trading volume
   - `--timeframe=<24h|7d|30d>`: Volume calculation period (default: 24h)
   - `--category=<tag>`: Filter by category (Politics, Sports, Crypto, etc.)
   - `--closing-soon=<hours>`: Markets closing within N hours (default: 24)
   - `--sports[=<type>]`: Sports markets, optionally filtered by sport (NFL, NBA, Soccer)
   - `--crypto[=<symbol>]`: Crypto markets, optionally filtered by symbol (BTC, ETH)
   - `--5min`: Auto-discover 5-minute resolution markets for rapid trading
   - `--event=<slug|id>`: Get all markets for a specific event
   - `--featured`: Get featured/promoted markets
   - `--limit=<n>`: Max results (default: 20, max: 500)
   - `--active-only`: Only active, non-closed markets (default: true)

2. **Keywords:** "find polymarket markets", "trending prediction markets", "what markets are closing soon", "polymarket crypto markets", "5 minute markets polymarket"

## Prerequisites
1. **Working Directory:** `~/.remote/@autoresearch/skills/working-polymarket-market-discovery/`
2. **Network:** Access to `https://gamma-api.polymarket.com` (no authentication required)

## API Configuration

| API | Base URL | Auth | Purpose |
|-----|----------|------|---------|
| Gamma API | `https://gamma-api.polymarket.com` | None | Events, markets, search, tags |
| Data API | `https://data-api.polymarket.com` | None | Trades, positions, user data |

## Execution Steps

1. **Parse Request:**
   - Determine discovery mode from flags/keywords
   - Set default parameters (active=true, closed=false, limit=20)

2. **Search Markets (--search):**
   - `GET /markets?query=<text>&active=true&closed=false&limit=<n>`
   - Also try `GET /events?slug=<text>` for slug-based lookup
   - Return matching markets with token IDs, prices, volumes

3. **Trending Markets (--trending):**
   - `GET /markets?active=true&closed=false&limit=100`
   - Sort by volume field based on timeframe: `volume24hr`, `volume7d`, `volume30d`
   - Filter out markets with end_date in the past
   - Return top N by volume

4. **Category Filter (--category):**
   - `GET /markets?tag=<category>&active=true&closed=false&limit=<n>`
   - Discover available tags: `GET /tags`

5. **Closing Soon (--closing-soon):**
   - `GET /markets?active=true&closed=false&limit=100`
   - Parse `end_date_iso` or `endDate` for each market
   - Filter markets where end_date <= now + hours
   - Sort by end_date ascending (soonest first)

6. **5-Minute Market Discovery (--5min):**
   - Search for markets with "5 minute" or "15 minute" in title/question
   - Filter by crypto coins: BTC, ETH, SOL, XRP
   - Look for active markets with short resolution windows
   - Return token IDs for both YES and NO outcomes
   - This feeds directly into flash-crash-detector and 5min-strategy skills

7. **Event Markets (--event):**
   - `GET /events?slug=<slug>` or `GET /events/<id>`
   - Extract all markets from the event response
   - Return with condition IDs, token IDs, and current prices

8. **Pagination:**
   - Use `limit` and `offset` parameters
   - Continue fetching while `has_more: true`
   - Combine all pages before sorting/filtering

9. **Format Output:**
   - Save results to `markets.json` in working directory
   - Print summary table to console with: question, price (YES/NO), volume_24h, liquidity, end_date

## Key Market Fields

| Field | Description |
|-------|-------------|
| `tokenID` / `asset_id` | ERC1155 token ID for an outcome |
| `conditionID` | Condition ID — identifies the market |
| `slug` | URL-friendly identifier |
| `minimum_tick_size` | Price increment precision |
| `neg_risk` | true for multi-outcome events |
| `tokens` | Array of {token_id, outcome} for both outcomes |
| `volume24hr` | 24-hour trading volume |
| `liquidity` | Available market liquidity |

## Sort Parameters

| Parameter | Values |
|-----------|--------|
| `order` | `volume_24hr`, `volume`, `liquidity`, `start_date`, `end_date`, `competitive` |
| `ascending` | `true` / `false` |
| `active` | `true` / `false` |
| `closed` | `true` / `false` |
| `limit` | 1–500 |
| `offset` | Pagination offset |

## Output Format
- **Console:** Markdown table of discovered markets with key metrics
- **`markets.json`:** Full market data including token IDs, condition IDs, and metadata

## Quality Gates
1. Search returns relevant markets matching the query
2. Trending markets sorted correctly by specified timeframe volume
3. Category filtering returns only markets with the requested tag
4. Closing-soon correctly identifies markets within the time window
5. 5-minute market discovery finds short-resolution crypto markets
6. Pagination handles large result sets without missing markets
7. Output includes all necessary IDs for downstream trading skills

## Integration Points
- **Upstream:** User request or autoresearch want-engine triggers discovery
- **Downstream:** `polymarket-market-analyzer` analyzes discovered markets, `polymarket-clob-trader` executes trades on selected markets
- **Cross-skill:** `polymarket-flash-crash-detector` and `polymarket-5min-strategy` consume 5-minute market discoveries
