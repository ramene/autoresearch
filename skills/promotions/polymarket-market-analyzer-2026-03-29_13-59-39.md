# Promotion Proposal: polymarket-market-analyzer

## Scores
- **Baseline**: 20/25
- **Current**: 25/25
- **Improvement**: +5 points (100.0%)
- **Rounds**: 5

## Promotion Target
`/Users/ramene/Journal/.seed/base/skills/polymarket-market-analyzer/SKILL.md`

## Key Mutations That Improved Score
1. Add explicit Safety Limits section with defined thresholds that directly feed into Risk Assessment — the "Safety limits inform risk assessment" criterion was failing because limits were buried inline rather than being a named, referenceable constraint set.
2. Add explicit "MANDATORY: No cached data" constraint to Step 1 with a preflight check that aborts if any data fetch fails — all three S4 failures trace to the same root: the skill allows silent fallback to stale/missing data, which then corrupts the risk tier and recommendation.
3. Replace the vague "unless strong trend signal" clause in recommendation generation with an explicit quantitative threshold (price_trend > ±10% over 7d AND volume_24h > 2× MIN_VOLUME_24H) so the MEDIUM risk → HOLD vs BUY/SELL decision is deterministic.
4. Add a concrete confidence score formula for each risk tier so the score within a range is deterministic rather than arbitrary — fixes "Recommendations are actionable with confidence scores" by eliminating evaluator ambiguity about how 72 vs 85 is reached.
5. Add explicit `analysis.json` schema skeleton to the Output Format section so the file structure is deterministic and cannot drift across runs, guarding against future regression on the "Recommendations are actionable" criterion.

## Unified Diff (baseline -> current)
```diff
--- /Users/ramene/.remote/@autoresearch/skills/working-polymarket-market-analyzer/SKILL.md.baseline	2026-03-20 19:21:41.000000000 -0600
+++ /Users/ramene/.remote/@autoresearch/skills/working-polymarket-market-analyzer/SKILL.md	2026-03-21 03:36:33.000000000 -0600
@@ -18,53 +18,154 @@
 1. **Working Directory:** `~/.remote/@autoresearch/skills/working-polymarket-market-analyzer/`
 2. **Network:** Access to Gamma API and CLOB API (no auth for analysis)
 
+## Safety Limits
+These thresholds are the ground truth for all risk assessments. Every recommendation MUST check against these before scoring:
+
+| Limit | Threshold | Risk Impact |
+|-------|-----------|-------------|
+| MIN_LIQUIDITY | $10,000 | Below → HIGH risk, forces AVOID |
+| MAX_SPREAD_PCT | 5% | Above → HIGH risk, forces AVOID |
+| MIN_VOLUME_24H | $1,000 | Below → MEDIUM risk, penalize confidence |
+| MIN_VOLUME_7D | $5,000 | Below → MEDIUM risk, penalize confidence |
+| MAX_CONFIDENCE_HIGH_RISK | 30 | Cap confidence when any HIGH risk trigger fires |
+| MAX_CONFIDENCE_MEDIUM_RISK | 60 | Cap confidence when any MEDIUM risk trigger fires |
+
+Any market breaching a HIGH risk threshold receives confidence ≤ 30 and an AVOID recommendation, regardless of other signals.
+
 ## Execution Steps
 
-1. **Gather Market Data:**
-   - Fetch market details from Gamma API (question, tokens, metadata)
-   - Fetch orderbook from CLOB API (bid/ask, depth)
-   - Get volume data: volume_24h, volume_7d, volume_30d
-   - Get liquidity in USD
+1. **Gather Market Data (Real-Time) — MANDATORY PREFLIGHT:**
+   > **CRITICAL: Every field below MUST be fetched live in the current execution. Using cached, estimated, or placeholder values is a hard failure. If any fetch fails, abort analysis for that market and report the fetch error explicitly — do NOT proceed with partial data.**
+
+   Required live fetches (all must succeed before proceeding to Step 2):
+   - `market_details` — Gamma API: question, tokens, metadata, current YES/NO prices
+   - `orderbook` — CLOB API: best_bid, best_ask, full depth at multiple price levels
+   - `volume_24h`, `volume_7d`, `volume_30d` — live volume data from CLOB API
+   - `liquidity_usd` — total current liquidity in USD
+   - `price_history` — 1d and 7d lookback for trend calculation
+
+   After fetching, log each value with its source and timestamp before proceeding.
 
 2. **Calculate Metrics:**
-   - Spread: (ask - bid), spread_pct = spread / mid * 100
-   - Liquidity score: based on total_liquidity vs MIN_LIQUIDITY_REQUIRED ($10,000)
-   - Volume score: based on volume_24h relative to market category
-   - Price trend: compare current vs historical prices (1d, 7d)
-
-3. **Risk Assessment:**
-   - HIGH: liquidity < $10,000 OR spread > 5%
-   - MEDIUM: volume_24h < $1,000
-   - LOW: good liquidity AND tight spread AND healthy volume
-
-4. **Generate Recommendation:**
-   - AVOID (confidence 0-30): High risk -- low liquidity or wide spread
-   - HOLD (confidence 40-60): Acceptable conditions, no clear edge
-   - BUY (confidence 60-80): Tight spread, good liquidity, favorable pricing
-   - SELL (confidence 60-80): Overvalued position, take profit opportunity
-   - Strong signals (confidence 80-100): Multiple factors aligned
+   - Spread: `ask - bid`; spread_pct = `spread / mid_price * 100`
+   - Liquidity score: `total_liquidity / MIN_LIQUIDITY` (capped at 1.0)
+   - Volume score: `volume_24h / MIN_VOLUME_24H` (capped at 1.0)
+   - Price trend: `(current_price - price_7d_ago) / price_7d_ago * 100`
+
+3. **Risk Assessment (Apply Safety Limits First):**
+   - Check each Safety Limit in order; first breach sets the risk tier:
+     - **HIGH risk** if: `liquidity < $10,000` OR `spread_pct > 5%`
+     - **MEDIUM risk** if: `volume_24h < $1,000` OR `volume_7d < $5,000`
+     - **LOW risk** if: no Safety Limits breached
+   - Record which specific limits triggered and include in output reasoning
+
+4. **Generate Recommendation (use this decision matrix exactly — no deviations):**
+
+   | Risk Tier | Condition | Recommendation | Confidence Range |
+   |-----------|-----------|----------------|-----------------|
+   | HIGH | Any HIGH safety limit breached | **AVOID** | 0–30 |
+   | MEDIUM | MEDIUM limit breached AND `price_trend ≤ +10%` AND `price_trend ≥ -10%` | **HOLD** | 31–60 |
+   | MEDIUM | MEDIUM limit breached AND `price_trend > +10%` AND `volume_24h > 2 × MIN_VOLUME_24H` | **BUY** | 50–60 |
+   | MEDIUM | MEDIUM limit breached AND `price_trend < -10%` AND `volume_24h > 2 × MIN_VOLUME_24H` | **SELL** | 50–60 |
+   | LOW | No limits breached, price below fair value, tight spread | **BUY** | 60–100 |
+   | LOW | No limits breached, overvalued position | **SELL** | 60–100 |
+   | LOW | No limits breached, no clear signal | **HOLD** | 60–75 |
+
+   - **Strong BUY/SELL** (confidence 80–100): LOW risk tier only, multiple factors aligned (trend > ±15%, volume > 5× MIN_VOLUME_24H, spread_pct < 2%)
+
+   **Confidence Score Formula (compute exact score, not just range):**
+
+   Start with the range floor, then add points based on signal strength:
+
+   | Signal | Points Added |
+   |--------|-------------|
+   | `abs(price_trend) > 15%` | +10 |
+   | `abs(price_trend) > 25%` | +10 (cumulative, so +20 total) |
+   | `volume_24h > 5 × MIN_VOLUME_24H` | +10 |
+   | `volume_24h > 10 × MIN_VOLUME_24H` | +10 (cumulative, so +20 total) |
+   | `spread_pct < 2%` | +5 |
+   | `spread_pct < 1%` | +5 (cumulative, so +10 total) |
+   | `liquidity_usd > 10 × MIN_LIQUIDITY` | +5 |
+
+   Sum the points, add to range floor, cap at the range ceiling. Apply Safety Limit caps last.
+
+   **Examples:**
+   - LOW risk BUY, trend=+18%, volume=6×min, spread=1.5%: floor(60) + 10 + 10 + 5 = **85**
+   - MEDIUM risk HOLD, trend=+5%, volume=1.5×min, spread=3%: floor(31) + 0 + 0 + 0 = **31**, capped at 60 → **31**
+   - HIGH risk AVOID: floor(0) + points, capped at 30 → max **30**
+
+   Output must include: recommendation, exact confidence score (with calculation shown), risk tier, which limits (if any) triggered, and which row of the decision matrix was applied.
 
 5. **Market Comparison (--compare):**
-   - Analyze up to 10 markets in parallel
-   - Rank by opportunity score
-   - Side-by-side metrics table
+   - Analyze up to 10 markets in parallel using the same Safety Limits
+   - Rank by opportunity score (confidence × (1 - risk_penalty))
+   - Side-by-side metrics table with risk tier and triggered limits visible
+   - Highlight the top-ranked market and explain why it ranks above others
 
 6. **Output:**
-   - Save analysis to `analysis.json`
-   - Print recommendation with confidence and reasoning
+   - Save analysis to `analysis.json` using the exact schema below
+   - Print recommendation with confidence, risk tier, triggered Safety Limits, and reasoning
 
 ## Output Format
-- **Console:** Market recommendation with confidence score and reasoning
-- **`analysis.json`:** Full analysis with all metrics and scores
+
+**Console:** Market recommendation with exact confidence score (calculation shown), risk tier, triggered Safety Limits, and reasoning.
+
+**`analysis.json` — required schema (all fields mandatory, no omissions):**
+```json
+{
+  "fetched_at": "<ISO-8601 timestamp>",
+  "market_id": "<string>",
+  "question": "<string>",
+  "live_data": {
+    "best_bid": "<number>",
+    "best_ask": "<number>",
+    "volume_24h": "<number>",
+    "volume_7d": "<number>",
+    "volume_30d": "<number>",
+    "liquidity_usd": "<number>",
+    "price_7d_ago": "<number>",
+    "current_price": "<number>"
+  },
+  "calculated_metrics": {
+    "spread": "<number>",
+    "spread_pct": "<number>",
+    "price_trend_pct": "<number>",
+    "liquidity_score": "<number 0-1>",
+    "volume_score": "<number 0-1>"
+  },
+  "safety_limit_checks": {
+    "liquidity_ok": "<bool>",
+    "spread_ok": "<bool>",
+    "volume_24h_ok": "<bool>",
+    "volume_7d_ok": "<bool>",
+    "triggered_limits": ["<limit name>", "..."]
+  },
+  "risk_tier": "HIGH|MEDIUM|LOW",
+  "recommendation": "BUY|SELL|HOLD|AVOID",
+  "confidence": {
+    "range_floor": "<number>",
+    "points_added": "<number>",
+    "raw_score": "<number>",
+    "final_score": "<number>",
+    "calculation": "<string showing step-by-step arithmetic>"
+  },
+  "matrix_row_applied": "<string quoting the exact decision matrix row used>",
+  "reasoning": "<string>"
+}
+```
+
+For `--compare` runs, the file contains a `"markets"` array of the above objects plus a `"ranking"` array of market IDs ordered by opportunity score.
 
 ## Quality Gates
-1. Analysis considers all key metrics (spread, volume, liquidity, trend)
-2. Risk assessment correctly categorizes market conditions
-3. Recommendations are actionable and consistent with metrics
-4. Confidence scores correlate with actual signal strength
-5. Comparison ranks markets meaningfully
+1. Every analysis fetches live orderbook and volume data (no stale/cached values) — abort if any fetch fails
+2. All fetched values are logged with source and timestamp before risk assessment begins
+3. Risk assessment explicitly checks all Safety Limits and records which triggered
+4. Confidence scores are computed using the formula in Step 4 and capped per Safety Limits
+5. Recommendations map directly to the decision matrix in Step 4 — the specific matrix row applied AND the confidence calculation must be stated
+6. Comparison ranking uses consistent opportunity score formula across all markets
+7. `analysis.json` must conform to the schema in the Output Format section — no missing fields
 
 ## Integration Points
 - **Upstream:** `polymarket-market-discovery` provides markets to analyze
 - **Downstream:** `polymarket-clob-trader` executes recommended trades
-- **Cross-skill:** `polymarket-portfolio-tracker` provides existing position context
+- **Cross-skill:** `polymarket-portfolio-tracker` provides existing position context
\ No newline at end of file

```

## Generated
- **Timestamp**: 2026-03-29T13:59:39.519Z
- **Source**: `/Users/ramene/.remote/@autoresearch/skills/working-polymarket-market-analyzer/SKILL.md`
- **Baseline**: `/Users/ramene/.remote/@autoresearch/skills/working-polymarket-market-analyzer/SKILL.md.baseline`
