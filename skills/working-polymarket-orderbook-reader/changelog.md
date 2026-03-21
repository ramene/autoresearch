
## Round 0
- **Score**: 33/36 (baseline)
- **Failures**: S5: Spread and midpoint calculated correctly, S5: Fill estimation walks orderbook for accurate slippage, S5: Output includes sufficient data for downstream analysis
- **Per-criteria**: Orderbook correctly parsed with price/size levels: 6/6, Spread and midpoint calculated correctly: 5/6, Fill estimation walks orderbook for accurate slippage: 5/6, Batch queries handle multiple tokens efficiently: 6/6, Price history returns data at correct intervals: 6/6, Output includes sufficient data for downstream analysis: 5/6

## Round 1 — Mutation Applied
- **Mutation**: Add explicit orderbook-walking algorithm for fill estimation with required output fields, fixing vague slippage calculation that causes downstream data insufficiency

## Round 2 — Mutation Applied
- **Mutation**: In step 7 (Fill Estimation), add explicit derivation of best_bid, best_ask, and mid from the fetched orderbook before computing slippage (mirroring step 4's spread logic), and add `reference_mid` to required output fields so slippage is always anchored to the live orderbook state.

## Round 3 — Mutation Applied
- **Mutation**: Restructure Output Format to separate "always-required baseline fields" from conditional fields, so every query mode (spread, history, price) produces a complete downstream-usable snapshot with token_id, timestamp, best_bid, best_ask, spread, mid, and liquidity totals — not just fill-estimation scenarios.

## Round 4 — Mutation Applied
- **Mutation**: Add a mandatory Step 0 that always fetches the full orderbook via GET /book before any other endpoint call, so baseline fields are guaranteed regardless of which flag is used — fixing spread, fill, and downstream data failures in non-spread query modes.

## Round 4
- **Score**: 34/36 (kept)
- **Failures**: S5: Spread and midpoint calculated correctly, S5: Output includes sufficient data for downstream analysis
- **Per-criteria**: Orderbook correctly parsed with price/size levels: 6/6, Spread and midpoint calculated correctly: 5/6, Fill estimation walks orderbook for accurate slippage: 6/6, Batch queries handle multiple tokens efficiently: 6/6, Price history returns data at correct intervals: 6/6, Output includes sufficient data for downstream analysis: 5/6

## Round 5 — Mutation Applied
- **Mutation**: Refactor Execution Steps into a unified linear pipeline with a single "Execution Flow" section that merges the mandatory pre-step into universal steps followed by conditional augmentation, removing all deprecated `/price` and `/midpoint` endpoint mentions from individual steps to eliminate ambiguity.
