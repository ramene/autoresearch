# SKILL: polymarket-market-analyzer
AI-powered market opportunity analysis for Polymarket -- scoring markets with BUY/SELL/HOLD/AVOID recommendations and confidence levels (0-100).

## Purpose
This skill analyzes individual Polymarket markets by combining orderbook data, volume metrics, liquidity, spread, and price trends into an actionable recommendation (BUY/SELL/HOLD/AVOID) with a confidence score from 0-100. It acts as the decision engine between market discovery and trade execution.

## Trigger Conditions
1. **Slash Command:** `/skill polymarket-market-analyzer [flags]`
   - `--analyze=<market_id|slug>`: Analyze a specific market
   - `--compare=<id1,id2,...>`: Compare up to 10 markets side-by-side
   - `--scan`: Analyze all markets from last discovery run
   - `--threshold=<n>`: Only show results with confidence >= n (default: 50)
   - `--focus=<risk|opportunity|liquidity>`: Analysis focus

2. **Keywords:** "analyze polymarket", "should I buy", "market opportunity score", "compare prediction markets"

## Prerequisites
1. **Working Directory:** `~/.remote/@autoresearch/skills/working-polymarket-market-analyzer/`
2. **Network:** Access to Gamma API and CLOB API (no auth for analysis)

## Execution Steps

1. **Gather Market Data:**
   - Fetch market details from Gamma API (question, tokens, metadata)
   - Fetch orderbook from CLOB API (bid/ask, depth)
   - Get volume data: volume_24h, volume_7d, volume_30d
   - Get liquidity in USD

2. **Calculate Metrics:**
   - Spread: (ask - bid), spread_pct = spread / mid * 100
   - Liquidity score: based on total_liquidity vs MIN_LIQUIDITY_REQUIRED ($10,000)
   - Volume score: based on volume_24h relative to market category
   - Price trend: compare current vs historical prices (1d, 7d)

3. **Risk Assessment:**
   - HIGH: liquidity < $10,000 OR spread > 5%
   - MEDIUM: volume_24h < $1,000
   - LOW: good liquidity AND tight spread AND healthy volume

4. **Generate Recommendation:**
   - AVOID (confidence 0-30): High risk -- low liquidity or wide spread
   - HOLD (confidence 40-60): Acceptable conditions, no clear edge
   - BUY (confidence 60-80): Tight spread, good liquidity, favorable pricing
   - SELL (confidence 60-80): Overvalued position, take profit opportunity
   - Strong signals (confidence 80-100): Multiple factors aligned

5. **Market Comparison (--compare):**
   - Analyze up to 10 markets in parallel
   - Rank by opportunity score
   - Side-by-side metrics table

6. **Output:**
   - Save analysis to `analysis.json`
   - Print recommendation with confidence and reasoning

## Output Format
- **Console:** Market recommendation with confidence score and reasoning
- **`analysis.json`:** Full analysis with all metrics and scores

## Quality Gates
1. Analysis considers all key metrics (spread, volume, liquidity, trend)
2. Risk assessment correctly categorizes market conditions
3. Recommendations are actionable and consistent with metrics
4. Confidence scores correlate with actual signal strength
5. Comparison ranks markets meaningfully

## Integration Points
- **Upstream:** `polymarket-market-discovery` provides markets to analyze
- **Downstream:** `polymarket-clob-trader` executes recommended trades
- **Cross-skill:** `polymarket-portfolio-tracker` provides existing position context
