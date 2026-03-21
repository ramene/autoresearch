
## Round 0
- **Score**: 20/25 (baseline)
- **Failures**: S4: Analysis uses real-time orderbook and volume data, S4: Risk assessment categorizes correctly, S4: Recommendations are actionable with confidence scores, S4: Market comparison ranks meaningfully, S4: Safety limits inform risk assessment
- **Per-criteria**: Analysis uses real-time orderbook and volume data: 4/5, Risk assessment categorizes correctly: 4/5, Recommendations are actionable with confidence scores: 4/5, Market comparison ranks meaningfully: 4/5, Safety limits inform risk assessment: 4/5

## Round 1 — Mutation Applied
- **Mutation**: Add explicit Safety Limits section with defined thresholds that directly feed into Risk Assessment — the "Safety limits inform risk assessment" criterion was failing because limits were buried inline rather than being a named, referenceable constraint set.

## Round 1
- **Score**: 22/25 (kept)
- **Failures**: S4: Analysis uses real-time orderbook and volume data, S4: Risk assessment categorizes correctly, S4: Recommendations are actionable with confidence scores
- **Per-criteria**: Analysis uses real-time orderbook and volume data: 4/5, Risk assessment categorizes correctly: 4/5, Recommendations are actionable with confidence scores: 4/5, Market comparison ranks meaningfully: 5/5, Safety limits inform risk assessment: 5/5

## Round 2 — Mutation Applied
- **Mutation**: Add explicit "MANDATORY: No cached data" constraint to Step 1 with a preflight check that aborts if any data fetch fails — all three S4 failures trace to the same root: the skill allows silent fallback to stale/missing data, which then corrupts the risk tier and recommendation.

## Round 3 — Mutation Applied
- **Mutation**: Replace the vague "unless strong trend signal" clause in recommendation generation with an explicit quantitative threshold (price_trend > ±10% over 7d AND volume_24h > 2× MIN_VOLUME_24H) so the MEDIUM risk → HOLD vs BUY/SELL decision is deterministic.

## Round 3
- **Score**: 25/25 (kept)
- **Failures**: none
- **Per-criteria**: Analysis uses real-time orderbook and volume data: 5/5, Risk assessment categorizes correctly: 5/5, Recommendations are actionable with confidence scores: 5/5, Market comparison ranks meaningfully: 5/5, Safety limits inform risk assessment: 5/5

## Round 4 — Mutation Applied
- **Mutation**: Add a concrete confidence score formula for each risk tier so the score within a range is deterministic rather than arbitrary — fixes "Recommendations are actionable with confidence scores" by eliminating evaluator ambiguity about how 72 vs 85 is reached.

## Round 5 — Mutation Applied
- **Mutation**: Add explicit `analysis.json` schema skeleton to the Output Format section so the file structure is deterministic and cannot drift across runs, guarding against future regression on the "Recommendations are actionable" criterion.
