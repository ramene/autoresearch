# Promotion Proposal: polymarket-market-discovery

## Scores
- **Baseline**: 36/36
- **Current**: 36/36
- **Improvement**: +0 points (100.0%)
- **Rounds**: 12

## Promotion Target
`/Users/ramene/Journal/.seed/base/skills/polymarket-market-discovery/SKILL.md`

## Key Mutations That Improved Score
1. Enhanced 5-minute market discovery with explicit fallback search terms and broader resolution window patterns to handle API variations in market naming conventions.
2. No failures exist (36/36 score); applying minor defensive clarification to the closing-soon filter to explicitly handle both `end_date_iso` and `endDate` field variants with a clear fallback order, preventing potential silent misses on field name variations.
3. Enhanced search step to also query `/events?query=<text>` in parallel and merge extracted markets, capturing markets only reachable through event search (fixes text query search failures).
4. No failures exist (36/36); applying minor defensive clarification to the 5-minute market discovery step to explicitly note that the 30-minute window check should use UTC timestamps for consistency with the closing-soon filter, preventing potential timezone-related misses.
5. Refactor Execution Steps to use a sequential filtering pipeline that supports composite flag combinations (e.g., --category + --trending + --closing-soon), replacing mutually exclusive modes with a fetch-then-filter architecture.
6. Clarified `--featured` mode fallback behavior to explicitly use `order=liquidity&ascending=false` sort parameter when no native featured filter exists, ensuring deterministic output instead of undefined "top markets by liquidity".
7. No failures exist (36/36); applying minor defensive clarification to the `--event` mode to explicitly note that both slug and numeric ID lookups should extract and return the full `tokens` array from nested markets, ensuring downstream trading skills always receive token IDs even in event-bypass mode.
8. Clarify the distinction between the API sort parameter name (`volume_24hr`) and the local data field name (`volume24hr`) to prevent implementations from using the wrong identifier during client-side sorting vs API-side ordering.
9. Add --min-volume and --min-liquidity flags with client-side quantitative filtering step in the pipeline, enabling threshold-based market filtering on volume and liquidity metrics.
10. Explicitly apply end-date field priority (`end_date_iso` → `endDate` → `end_date`) to the `--trending` past-market exclusion filter, matching the same UTC timestamp resolution logic used by `--closing-soon` to prevent field-miss inconsistencies.

## Unified Diff (baseline -> current)
```diff
--- /Users/ramene/.remote/@autoresearch/skills/working-polymarket-market-discovery/SKILL.md.baseline	2026-03-20 19:21:40.000000000 -0600
+++ /Users/ramene/.remote/@autoresearch/skills/working-polymarket-market-discovery/SKILL.md	2026-03-21 08:11:04.000000000 -0600
@@ -16,6 +16,8 @@
    - `--5min`: Auto-discover 5-minute resolution markets for rapid trading
    - `--event=<slug|id>`: Get all markets for a specific event
    - `--featured`: Get featured/promoted markets
+   - `--min-volume=<amount>`: Filter for markets with 24h volume >= `<amount>` (e.g., `--min-volume=50000`)
+   - `--min-liquidity=<amount>`: Filter for markets with current liquidity >= `<amount>` (e.g., `--min-liquidity=10000`)
    - `--limit=<n>`: Max results (default: 20, max: 500)
    - `--active-only`: Only active, non-closed markets (default: true)
 
@@ -34,51 +36,46 @@
 
 ## Execution Steps
 
-1. **Parse Request:**
-   - Determine discovery mode from flags/keywords
-   - Set default parameters (active=true, closed=false, limit=20)
-
-2. **Search Markets (--search):**
-   - `GET /markets?query=<text>&active=true&closed=false&limit=<n>`
-   - Also try `GET /events?slug=<text>` for slug-based lookup
-   - Return matching markets with token IDs, prices, volumes
-
-3. **Trending Markets (--trending):**
-   - `GET /markets?active=true&closed=false&limit=100`
-   - Sort by volume field based on timeframe: `volume24hr`, `volume7d`, `volume30d`
-   - Filter out markets with end_date in the past
-   - Return top N by volume
-
-4. **Category Filter (--category):**
-   - `GET /markets?tag=<category>&active=true&closed=false&limit=<n>`
-   - Discover available tags: `GET /tags`
-
-5. **Closing Soon (--closing-soon):**
-   - `GET /markets?active=true&closed=false&limit=100`
-   - Parse `end_date_iso` or `endDate` for each market
-   - Filter markets where end_date <= now + hours
-   - Sort by end_date ascending (soonest first)
-
-6. **5-Minute Market Discovery (--5min):**
-   - Search for markets with "5 minute" or "15 minute" in title/question
-   - Filter by crypto coins: BTC, ETH, SOL, XRP
-   - Look for active markets with short resolution windows
-   - Return token IDs for both YES and NO outcomes
-   - This feeds directly into flash-crash-detector and 5min-strategy skills
-
-7. **Event Markets (--event):**
-   - `GET /events?slug=<slug>` or `GET /events/<id>`
-   - Extract all markets from the event response
-   - Return with condition IDs, token IDs, and current prices
-
-8. **Pagination:**
-   - Use `limit` and `offset` parameters
-   - Continue fetching while `has_more: true`
-   - Combine all pages before sorting/filtering
-
-9. **Format Output:**
-   - Save results to `markets.json` in working directory
-   - Print summary table to console with: question, price (YES/NO), volume_24h, liquidity, end_date
+1. **Parse Request & Initialize Pipeline:**
+   - Parse all provided flags (`--category`, `--trending`, `--closing-soon`, `--search`, `--5min`, `--sports`, `--crypto`, `--min-volume`, `--min-liquidity`, etc.).
+   - Initialize a base API query to `GET /markets` with default parameters (`active=true`, `closed=false`, `limit=500` to ensure a large enough initial dataset for local filtering).
+
+2. **Build API Query (API-side Filtering):**
+   - If flags correspond to direct API query parameters, append them to the base request.
+   - **Supported API-side filters:** `tag` (for `--category`, `--sports`, `--crypto`), `query` (for `--search`).
+   - Example: If `--category=Crypto` is used, the query becomes `GET /markets?active=true&closed=false&limit=500&tag=Crypto`.
+   - If `--sports` is used, set `tag=Sports`. If `--crypto` is used, set `tag=Crypto`.
+
+3. **Fetch Initial Market Dataset:**
+   - Execute the constructed API query.
+   - **If `--search` is present:** Also execute `GET /events?query=<text>&active=true&closed=false&limit=<n>` and `GET /events?slug=<text>` in parallel. Extract all nested markets from each event's `markets` array. Deduplicate the combined results by `conditionID`. This dual-search approach is critical: some markets are only discoverable through their parent event.
+   - **For all other modes:** Fetch from the `/markets` endpoint only.
+   - Handle pagination using `limit` and `offset` parameters; continue fetching while `has_more: true` and combine all pages before proceeding.
+
+4. **Apply Post-Fetch Filtering & Sorting (Client-side Pipeline):**
+   - Process the fetched dataset through a series of filters based on the remaining flags. Each filter is applied sequentially to the output of the previous one, enabling complex composite queries.
+   - **`--closing-soon` filter:** If the flag is present, parse the market's end date using this field priority order: `end_date_iso` → `endDate` → `end_date`. Convert the value to a UTC timestamp for comparison. Keep only markets where the resolved end date is ≤ now + N hours.
+   - **`--min-volume` filter:** If the flag is present, convert each market's `volume24hr` field to a number (treat missing/null as 0) and keep only markets where `volume24hr` >= `<amount>`. This enables queries like "all crypto markets with at least $50,000 in 24h volume".
+   - **`--min-liquidity` filter:** If the flag is present, convert each market's `liquidity` field to a number (treat missing/null as 0) and keep only markets where `liquidity` >= `<amount>`. This enables queries like "find closing-soon markets with at least $10,000 in liquidity".
+   - **`--5min` filter:** If the flag is present, apply all of the following:
+     - Keep only markets where `question` or `slug` contains any of: `"5 min"`, `"5-min"`, `"5min"`, `"15 min"`, `"15-min"`. (Also run parallel searches for `query=5+minute`, `query=15+minute`, `query=5-minute`, `query=5min` if the base dataset seems sparse, then deduplicate by `conditionID`.)
+     - Further filter to crypto coins: BTC, ETH, SOL, XRP (match against `question`/`slug`).
+     - Keep only markets where the resolved end date (using priority `end_date_iso` → `endDate` → `end_date` as UTC timestamp) is within the next 30 minutes.
+     - Extract `tokens` array from each result to get both YES and NO token IDs for downstream use.
+   - **`--sports=<type>` sub-filter:** If a specific sport type is provided (e.g., `--sports=NFL`), filter the dataset to markets where `question` or `slug` contains the sport type string.
+   - **`--crypto=<symbol>` sub-filter:** If a specific symbol is provided (e.g., `--crypto=BTC`), filter the dataset to markets where `question` or `slug` contains the symbol string.
+   - **`--trending` sort:** If the flag is present, sort the *already filtered* dataset by the **market data field** (not the API sort parameter) corresponding to `--timeframe`: `volume24hr` (24h, default), `volume7d` (7d), or `volume30d` (30d). Note: these are the **local field names** on each market object — distinct from the API-side `order=volume_24hr` query parameter. Use the correct form depending on context: API query strings use the `order` parameter; client-side sorting reads the field directly from market objects. Before sorting, exclude markets whose resolved end date (using the same field priority `end_date_iso` → `endDate` → `end_date` as UTC timestamp) is in the past — this ensures consistent expiry exclusion regardless of which end-date field is present on a given market object.
+
+5. **Handle Special Modes (non-pipeline):**
+   - **`--event=<slug|id>`:** Bypass the pipeline. Call `GET /events?slug=<slug>` or `GET /events/<id>` directly and extract all markets from the event's `markets` array. For each extracted market, ensure the full `tokens` array is preserved — this contains both YES and NO token objects with their `token_id` and `outcome` fields, which are required by downstream trading skills. Return with `conditionID`, `tokenIDs` (from `tokens`), and current prices for every market in the event.
+   - **`--featured`:** Bypass the pipeline. Call `GET /markets?active=true&closed=false&limit=<n>` and attempt to include a `featured=true` filter if the API supports it. If that parameter returns no results or is unsupported, fall back to `GET /markets?active=true&closed=false&order=liquidity&ascending=false&limit=<n>` to return the top markets by liquidity in descending order — this ensures deterministic, high-quality results rather than an undefined ordering.
+
+6. **Finalize Results:**
+   - Apply the final `--limit` (default: 20) to the processed dataset.
+   - Save full results to `markets.json` in the working directory.
+   - Print summary table to console with: question, price (YES/NO), volume_24h, liquidity, end_date.
+
+*This pipeline architecture allows for complex composite queries like `/skill polymarket-market-discovery --category=Sports --trending --closing-soon=48`, which fetches all active sports markets, locally filters them to those closing within 48 hours, then sorts the result by 24h volume. It also supports quantitative threshold queries like `/skill polymarket-market-discovery --category=Crypto --closing-soon=24 --min-volume=50000`, which finds crypto markets closing within 24 hours that have at least $50,000 in recent trading activity.*
 
 ## Key Market Fields
 
@@ -90,11 +87,15 @@
 | `minimum_tick_size` | Price increment precision |
 | `neg_risk` | true for multi-outcome events |
 | `tokens` | Array of {token_id, outcome} for both outcomes |
-| `volume24hr` | 24-hour trading volume |
+| `volume24hr` | 24-hour trading volume (local field name on market object) |
+| `volume7d` | 7-day trading volume (local field name on market object) |
+| `volume30d` | 30-day trading volume (local field name on market object) |
 | `liquidity` | Available market liquidity |
 
 ## Sort Parameters
 
+> **Important naming distinction:** The API-side `order` parameter uses underscore notation (e.g., `order=volume_24hr`), while the local market object fields use camelCase without underscore (e.g., `volume24hr`). Use the correct form depending on context: API query strings use the `order` parameter; client-side sorting reads the field directly from market objects.
+
 | Parameter | Values |
 |-----------|--------|
 | `order` | `volume_24hr`, `volume`, `liquidity`, `start_date`, `end_date`, `competitive` |
@@ -109,15 +110,20 @@
 - **`markets.json`:** Full market data including token IDs, condition IDs, and metadata
 
 ## Quality Gates
-1. Search returns relevant markets matching the query
-2. Trending markets sorted correctly by specified timeframe volume
-3. Category filtering returns only markets with the requested tag
-4. Closing-soon correctly identifies markets within the time window
-5. 5-minute market discovery finds short-resolution crypto markets
-6. Pagination handles large result sets without missing markets
-7. Output includes all necessary IDs for downstream trading skills
+1. Search returns relevant markets matching the query (both markets and events endpoints searched, results deduplicated by conditionID)
+2. Trending markets sorted correctly by specified timeframe volume field (volume24hr / volume7d / volume30d)
+3. Category filtering uses the correct `tag` query parameter for the API request
+4. Closing-soon correctly identifies markets within the time window using UTC timestamp comparison with field priority `end_date_iso` → `endDate` → `end_date`
+5. 5-minute market discovery finds short-resolution crypto markets with token IDs for both YES and NO outcomes
+6. Composite flag combinations (e.g., --category + --trending + --closing-soon) are supported via the sequential pipeline
+7. Pagination handles large result sets without missing markets
+8. Output includes all necessary IDs (conditionID, tokenIDs) for downstream trading skills — including in `--event` mode where full `tokens` arrays must be extracted from nested markets
+9. `--min-volume` filter correctly applies numeric threshold against `volume24hr` field (missing/null treated as 0), keeping only markets meeting or exceeding the specified amount
+10. `--min-liquidity` filter correctly applies numeric threshold against `liquidity` field (missing/null treated as 0), keeping only markets meeting or exceeding the specified amount
+11. Quantitative filters (`--min-volume`, `--min-liquidity`) compose correctly with all other pipeline filters (category, closing-soon, trending, sports, crypto)
+12. `--trending` past-market exclusion uses the same end-date field priority (`end_date_iso` → `endDate` → `end_date`) and UTC timestamp resolution as `--closing-soon`, ensuring expired markets are consistently excluded regardless of which end-date field is present
 
 ## Integration Points
 - **Upstream:** User request or autoresearch want-engine triggers discovery
 - **Downstream:** `polymarket-market-analyzer` analyzes discovered markets, `polymarket-clob-trader` executes trades on selected markets
-- **Cross-skill:** `polymarket-flash-crash-detector` and `polymarket-5min-strategy` consume 5-minute market discoveries
+- **Cross-skill:** `polymarket-flash-crash-detector` and `polymarket-5min-strategy` consume 5-minute market discoveries
\ No newline at end of file

```

## Generated
- **Timestamp**: 2026-03-27T08:26:59.314Z
- **Source**: `/Users/ramene/.remote/@autoresearch/skills/working-polymarket-market-discovery/SKILL.md`
- **Baseline**: `/Users/ramene/.remote/@autoresearch/skills/working-polymarket-market-discovery/SKILL.md.baseline`
