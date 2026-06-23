# SKILL: mae-trading-report

Generate accurate, consistent, trustworthy trading reports across dashboard (tunafish:3333) and email (Resend) from a SINGLE source of truth (IBKR IB Gateway).

## Purpose

The mae trading system produces hourly reports showing portfolio value, P&L, positions, signals, and market analysis. Currently the reports mix two data sources (in-memory paper book and IBKR real account) producing contradictory numbers — $0.00 P&L in the chain log alongside +$2,247 from IBKR. This skill ensures ONE set of numbers appears everywhere: dashboard hero, position table, email header, email positions, and the chain log itself.

## Trigger Conditions

1. **Slash Command:** `/skill mae-trading-report`
2. **Keywords:** "trading report", "dashboard P&L", "email report", "fix P&L", "position data"
3. **Automatic:** After each hourly trading loop completes on tunafish

## Prerequisites

- IBKR IB Gateway running on tunafish port 4002
- Ollama running on tunafish port 11434 (Plutus 8B, QwQ 32B)
- Node.js with @stoqey/ib installed
- Dashboard server (Express + Socket.IO) on port 3333
- Resend API key for email delivery
- Trading loop cron (hourly)

## Core Problem

The `run-trading-chain.ts` script:
1. RESETS the in-memory paper book every run (destroys history)
2. Places trades in the paper book (entry price = live price, so P&L = $0 always)
3. Logs positions with $0.00 P&L in sections [8], [9], [10]
4. THEN appends real IBKR data via query-ibkr-positions.mjs

The result: the same log file contains "$0.00 P&L" AND "+$2,247.36 P&L" — contradictory and untrustworthy.

## Execution Steps

### Step 1: Eliminate the paper book from the trading chain
- Modify `run-trading-chain.ts` to NOT reset or use the in-memory paper book
- Instead, read current IBKR positions as the starting state
- Use Plutus + QwQ analysis to RECOMMEND trades (not execute in paper book)
- Log recommendations with confidence scores
- If IBKR is connected: execute recommended trades on IBKR paper account
- If IBKR is not connected: log recommendations only, mark as "NOT EXECUTED"

### Step 2: Single P&L computation
- Create a shared function `computeIBKRPnL()` used by BOTH dashboard and email
- Formula: `P&L = (NetLiquidation - TotalCashValue) - sum(avgPrice * qty)`
- Per-position P&L: proportional share of total holdings vs cost basis
- This function lives in one file, imported by both dashboard server and email script
- NO other P&L computation anywhere in the codebase

### Step 3: Dashboard data flow
- Dashboard server polls IBKR every 30 seconds via `pollIBKR()`
- MUST wait for BOTH `positionEnd` AND `accountSummaryEnd` before emitting
- Emit `ibkr:update` with { positions, account: {NetLiquidation, TotalCashValue, BuyingPower}, connected }
- Dashboard HTML reads `ibkrAccount` for hero P&L
- Dashboard HTML reads `ibkrPositions` for position table with per-position P&L
- Paper positions (BTC, ETH) are NOT shown when IBKR is connected

### Step 4: Email data flow
- Trading loop runs chain → appends IBKR query output to log
- Email script reads `IBKR_POS:` lines for positions with real P&L per position
- Email script reads `[IBKR] Unrealized P&L:` for total P&L
- Email header shows IBKR P&L (not paper P&L)
- Email positions section shows IBKR positions (not paper positions)
- Full Chain Log section shows the raw log (including the IBKR section)

### Step 5: Chain log integrity
- Sections [8]-[10] should show IBKR positions, not paper book
- Or: remove sections [8]-[10] from the paper book and replace with IBKR query
- The log should have ONE consistent set of numbers from top to bottom
- No "$0.00 P&L" appearing anywhere if IBKR shows +$2,247

### Step 6: QwQ reasoning freshness
- The QwQ-32B analysis currently produces the same output every run
- Add market-specific context to the prompt: current P&L, position performance, recent price changes
- The analysis should reference actual position performance, not generic market commentary

## Output Format

### Dashboard (tunafish:3333)
- Hero: Portfolio Value (IBKR holdings), Unrealized P&L (IBKR), Cash (IBKR), Trades
- Positions table: Symbol, Qty, Avg, Live, P&L (per-position from IBKR), Signal, Source
- All numbers from IBKR. Zero paper book data when IBKR is connected.
- TradingView Lightweight Chart for equity curve

### Email (Resend)
- Header: mae, date/time (America/Merida timezone)
- Stats row: Portfolio, P&L (from IBKR), Trades
- Signals: colored badges per asset
- Positions table: Symbol, Qty, Avg, P&L (from IBKR)
- Plutus analysis excerpt
- Expandable full chain log
- Footer: mae · tunafish M4 Max · Plutus 8B + QwQ 32B

### Chain Log
- Consistent P&L throughout — no contradictory sections
- IBKR positions as the primary position display
- Paper book removed or clearly marked as "SIMULATION ONLY"

## Quality Gates

1. **P&L Consistency:** Dashboard hero P&L === Email header P&L === IBKR query P&L (tolerance: $0.01)
2. **No Zero P&L:** If IBKR has positions with real P&L, $0.00 must NOT appear in any formatted output
3. **Single Source:** All P&L computations use the same formula: (NetLiq - Cash) - sum(avgPrice * qty)
4. **Position Accuracy:** Dashboard positions match IBKR positions exactly (symbol, qty, avgPrice)
5. **Data Freshness:** IBKR data polled within last 60 seconds, prices within last 5 minutes
6. **No Paper Mixing:** When IBKR is connected, paper BTC/ETH do NOT appear in positions
7. **Log Integrity:** The chain log does not contain contradictory P&L numbers
8. **QwQ Freshness:** QwQ analysis references current position P&L, not generic text

## Integration Points

- `run-trading-chain.ts` — the hourly chain script (needs rewrite to remove paper book)
- `run-trading-loop.sh` — the cron wrapper (appends IBKR query)
- `query-ibkr-positions.mjs` — standalone IBKR query (WORKS CORRECTLY)
- `send-trading-report.mjs` — styled HTML email (reads IBKR from log)
- `dashboard/server.mjs` — Express + Socket.IO server (polls IBKR)
- `dashboard/public/index.html` — dashboard UI (renders IBKR data)
- `@stoqey/ib` — IBKR API client library

## Error Handling

- If IBKR Gateway is offline: show "IBKR OFFLINE" in dashboard, email shows "No IBKR data"
- If IBKR returns no positions: show "No positions" not fake data
- If account summary doesn't arrive: wait 3 seconds then use what we have
- If email send fails: log error, do NOT retry (Resend handles delivery)

## Key Files

- Dashboard: `tunafish:~/.remote/@plans/mae-trading-paper-sprint/dashboard/`
- Email: `tunafish:~/.remote/@plans/mae-trading-paper-sprint/send-trading-report.mjs`
- Chain: `tunafish:~/.remote/@plans/mae-trading-paper-sprint/run-trading-chain.ts`
- Loop: `tunafish:~/.remote/@plans/mae-trading-paper-sprint/run-trading-loop.sh`
- IBKR: `tunafish:~/.remote/@plans/mae-trading-paper-sprint/query-ibkr-positions.mjs`
