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

## ⚠️ INVIOLABLE CONSTRAINT: Single Formula Law

**This constraint supersedes all other instructions. No exceptions.**

There is exactly ONE function that may read or return P&L data in this entire codebase: `getIBKRPnL()`.

### Required implementation (copy exactly — no variations permitted):

```javascript
// ibkr-pnl.mjs — THE ONLY FILE THAT MAY TOUCH P&L FIELDS
export async function getIBKRPnL(ibkrClient) {
  const account = await ibkrClient.getAccountSummary(); // waits for accountSummaryEnd
  const positions = await ibkrClient.getPositions();    // waits for positionEnd

  // READ-ONLY passthrough — zero arithmetic, zero recomputation
  return {
    totalUnrealizedPnL: account.UnrealizedPnL,   // IBKR native field, untouched
    netLiquidation:     account.NetLiquidation,   // IBKR native field, untouched
    totalCashValue:     account.TotalCashValue,   // IBKR native field, untouched
    buyingPower:        account.BuyingPower,      // IBKR native field, untouched
    positions: positions.map(p => ({
      symbol:         p.symbol,
      qty:            p.pos,
      avgPrice:       p.avgCost,
      unrealizedPnL:  p.unrealizedPNL,            // IBKR native field, untouched
    })),
  };
}
```

**What this function MUST NOT contain:**
- No `livePrice - avgPrice` or any subtraction/multiplication involving prices
- No `pos * price` or any quantity-times-price arithmetic
- No fallback to paper book values
- No secondary P&L computation of any kind

### MANDATORY IMPORT MAP — Every Consumer File Must Have This Import

**Every file that displays or logs P&L MUST begin with this exact import. No exceptions.**

| File | Required import line |
|------|----------------------|
| `dashboard/server.mjs` | `import { getIBKRPnL } from '../ibkr-pnl.mjs';` |
| `send-trading-report.mjs` | `import { getIBKRPnL } from './ibkr-pnl.mjs';` |
| `run-trading-chain.ts` | `import { getIBKRPnL } from './ibkr-pnl.mjs';` |

**`query-ibkr-positions.mjs` is RETIRED — it must be DELETED. Its functionality is fully replaced by `ibkr-pnl.mjs`. Any remaining reference to `query-ibkr-positions.mjs` in any file must be removed. Do not add it to this table; delete the file.**

**Any file not in this table MUST NOT reference any P&L field, formula, or variable.** If a new file needs P&L data, add it to this table before writing any P&L-related code in that file.

**What every consumer MUST do:**
- Import `getIBKRPnL` from `ibkr-pnl.mjs` using the line in the table above
- Use `result.totalUnrealizedPnL` for total P&L display
- Use `position.unrealizedPnL` for per-position P&L display
- If any field is `null` or `undefined`: display `"IBKR data incomplete"` — no fallback formula permitted

**Forbidden patterns** (grep for these; if found, delete immediately):
- `unrealizedPNL.*[-*]` or `[-*].*unrealizedPNL` (arithmetic on P&L fields)
- `livePrice.*avgPrice` or `avgPrice.*livePrice`
- `pos.*price` outside of ibkr-pnl.mjs
- Any P&L field access outside ibkr-pnl.mjs and its direct callers
- Any `require` or `import` of `query-ibkr-positions.mjs` (that file must not exist)

Verification: after implementation, `grep -r "unrealizedPNL\|UnrealizedPnL\|pnl\|PnL\|P&L" --include="*.ts" --include="*.mjs"` must return hits only inside `ibkr-pnl.mjs` and files that import from it. Zero standalone P&L expressions elsewhere.

## Execution Steps

### Step 0: MANDATORY AUDIT — Find and Delete All Existing P&L Logic (DO THIS FIRST)

**This step MUST be completed before touching any other file. Do not skip it.**

Run this audit command first:
```bash
grep -rn "unrealizedPNL\|UnrealizedPnL\|pnl\|PnL\|P&L\|livePrice.*avgPrice\|avgPrice.*livePrice\|pos.*price\|qty.*price" \
  --include="*.ts" --include="*.mjs" --include="*.js" \
  tunafish:~/.remote/@plans/mae-trading-paper-sprint/
```

For every match found **outside** `ibkr-pnl.mjs`:
1. Open the file
2. Delete the entire P&L expression, formula, or field access
3. Replace with: `// P&L removed — use getIBKRPnL() from ibkr-pnl.mjs`
4. Save the file

**Additionally, delete `query-ibkr-positions.mjs` entirely.** This file is retired. Its IBKR query functionality is replaced by `ibkr-pnl.mjs`. Run:
```bash
rm tunafish:~/.remote/@plans/mae-trading-paper-sprint/query-ibkr-positions.mjs
```
Also remove any `import` or `require` of `query-ibkr-positions.mjs` from every file — replace each such reference with `import { getIBKRPnL } from './ibkr-pnl.mjs';` if the file needs P&L data, or delete the line entirely if it does not.

**Do not proceed to Step 1 until the audit returns zero hits outside ibkr-pnl.mjs and its direct importers, and `query-ibkr-positions.mjs` no longer exists.**

Re-run the audit after each deletion to confirm. The audit MUST pass (zero standalone P&L expressions) before continuing.

### Step 1: Eliminate the paper book from the trading chain
- Modify `run-trading-chain.ts` to NOT reset or use the in-memory paper book
- Instead, read current IBKR positions as the starting state
- Use Plutus + QwQ analysis to RECOMMEND trades (not execute in paper book)
- Log recommendations with confidence scores
- If IBKR is connected: execute recommended trades on IBKR paper account
- If IBKR is not connected: log recommendations only, mark as "NOT EXECUTED"

### Step 2: Create ibkr-pnl.mjs using the INVIOLABLE CONSTRAINT template

**Use the exact code from the INVIOLABLE CONSTRAINT block above — copy it verbatim into `ibkr-pnl.mjs`. No modifications, no additions, no alternative implementation.**

- This file is the ONLY P&L access point in the entire codebase
- Every other file that previously had P&L logic was already deleted in Step 0
- Every consumer (dashboard server, email script, chain log) MUST import `getIBKRPnL` from this file using the exact import line in the MANDATORY IMPORT MAP table above
- If IBKR's `UnrealizedPnL` field is absent or null, the caller receives `undefined` and MUST display `"IBKR data incomplete"` — never fall back to a manual formula

### Step 3: Dashboard data flow
- Add `import { getIBKRPnL } from '../ibkr-pnl.mjs';` to `dashboard/server.mjs` (see MANDATORY IMPORT MAP)
- Dashboard server polls IBKR every 30 seconds via `pollIBKR()` which calls `getIBKRPnL()`
- MUST wait for BOTH `positionEnd` AND `accountSummaryEnd` before emitting
- Emit `ibkr:update` with { positions, account: {NetLiquidation, TotalCashValue, UnrealizedPnL, BuyingPower}, connected }
- Dashboard HTML reads `ibkrAccount.UnrealizedPnL` for hero P&L (sourced from `getIBKRPnL()`)
- Dashboard HTML reads `ibkrPositions[n].unrealizedPnL` for position table per-position P&L (sourced from `getIBKRPnL()`)
- Paper positions (BTC, ETH) are NOT shown when IBKR is connected

### Step 4: Email data flow
- Add `import { getIBKRPnL } from './ibkr-pnl.mjs';` to `send-trading-report.mjs` (see MANDATORY IMPORT MAP)
- Trading loop runs chain → chain script logs IBKR data via `getIBKRPnL()` (no separate query script)
- Email script calls `getIBKRPnL()` directly for live data; reads `IBKR_POS:` lines only as a fallback display source — no P&L computation from those lines
- Email script reads `[IBKR] Unrealized P&L:` for total P&L (sourced from `getIBKRPnL()`)
- Email header shows IBKR `UnrealizedPnL` (not paper P&L)
- Email positions section shows IBKR positions with native `unrealizedPnL` per position (not paper positions)
- Full Chain Log section shows the raw log (including the IBKR section)

### Step 5: Chain log integrity
- Add `import { getIBKRPnL } from './ibkr-pnl.mjs';` to `run-trading-chain.ts` (see MANDATORY IMPORT MAP)
- Sections [8], [9], and [10] MUST be rewritten to emit IBKR native fields only via `getIBKRPnL()` — **no paper book data is permitted in any log section**. Remove all paper book position logging from these sections entirely.
- Each position line logged in sections [8]-[10] MUST use IBKR's native `unrealizedPNL` field via `getIBKRPnL()`. Any line that would produce a $0.00 P&L from a paper book reset is forbidden.
- The log must have ONE consistent set of numbers from top to bottom. If IBKR data is unavailable at chain runtime, sections [8]-[10] must log "IBKR data unavailable — positions omitted" rather than falling back to paper book values.
- No "$0.00 P&L" appearing anywhere in the log if IBKR shows non-zero P&L.

### Step 6: QwQ reasoning freshness
- The QwQ-32B analysis currently produces the same output every run
- Add market-specific context to the prompt: current P&L, position performance, recent price changes
- The analysis should reference actual position performance, not generic market commentary

### Step 7: MANDATORY POST-IMPLEMENTATION AUDIT

After completing all steps, re-run the audit from Step 0:
```bash
grep -rn "unrealizedPNL\|UnrealizedPnL\|pnl\|PnL\|P&L\|livePrice.*avgPrice\|pos.*price\|qty.*price" \
  --include="*.ts" --include="*.mjs" --include="*.js" \
  tunafish:~/.remote/@plans/mae-trading-paper-sprint/
```

**The task is NOT complete until this audit returns zero hits outside ibkr-pnl.mjs and its direct importers.** If any standalone P&L expression remains, return to the file that contains it and delete it before marking done.

Also confirm `query-ibkr-positions.mjs` no longer exists:
```bash
ls tunafish:~/.remote/@plans/mae-trading-paper-sprint/query-ibkr-positions.mjs
# Must return "No such file or directory"
```

Also verify the MANDATORY IMPORT MAP: each file in the table must contain its required import line. Run:
```bash
grep -l "getIBKRPnL" dashboard/server.mjs send-trading-report.mjs run-trading-chain.ts
```
All three files must appear in the output.

## Output Format

### Dashboard (tunafish:3333)
- Hero: Portfolio Value (IBKR `NetLiquidation`), Unrealized P&L (IBKR `UnrealizedPnL`), Cash (IBKR `TotalCashValue`), Trades
- Positions table: Symbol, Qty, Avg, Live, P&L (IBKR `unrealizedPNL` per position), Signal, Source
- All numbers from IBKR native fields via `getIBKRPnL()`. Zero paper book data when IBKR is connected.
- TradingView Lightweight Chart for equity curve

### Email (Resend)
- Header: mae, date/time (America/Merida timezone)
- Stats row: Portfolio, P&L (IBKR `UnrealizedPnL` via `getIBKRPnL()`), Trades
- Signals: colored badges per asset
- Positions table: Symbol, Qty, Avg, P&L (IBKR `unrealizedPNL` per position via `getIBKRPnL()`)
- Plutus analysis excerpt
- Expandable full chain log
- Footer: mae · tunafish M4 Max · Plutus 8B + QwQ 32B

### Chain Log
- Consistent P&L throughout — no contradictory sections
- IBKR positions as the primary position display in ALL sections (all via `getIBKRPnL()`)
- Paper book removed entirely — not present in any log section, not marked as "SIMULATION ONLY", simply absent

## Quality Gates

1. **P&L Consistency:** Dashboard hero P&L === Email header P&L === IBKR `UnrealizedPnL` field value (tolerance: $0.01)
2. **No Zero P&L:** If IBKR has positions with real P&L, $0.00 must NOT appear in any formatted output
3. **Single Formula:** All P&L values flow through the one shared `getIBKRPnL()` function — IBKR native fields only (`UnrealizedPnL`, `unrealizedPNL`). No manual recomputation anywhere in the codebase. No other P&L logic exists outside this function. `query-ibkr-positions.mjs` does not exist (deleted). **The Step 0 and Step 7 audits must return zero hits outside ibkr-pnl.mjs. The MANDATORY IMPORT MAP verification must show all three consumer files importing getIBKRPnL.**
4. **Position Accuracy:** Dashboard positions match IBKR positions exactly (symbol, qty, avgPrice)
5. **Data Freshness:** IBKR data polled within last 60 seconds, prices within last 5 minutes
6. **No Paper Mixing:** When IBKR is connected, paper BTC/ETH do NOT appear in positions
7. **Log Integrity:** The chain log does not contain contradictory P&L numbers
8. **QwQ Freshness:** QwQ analysis references current position P&L, not generic text

## Integration Points

- `run-trading-chain.ts` — the hourly chain script (needs rewrite to remove paper book)
- `run-trading-loop.sh` — the cron wrapper
- `query-ibkr-positions.mjs` — **RETIRED AND DELETED — replaced entirely by `ibkr-pnl.mjs`. Remove this file and all imports of it.**
- `send-trading-report.mjs` — styled HTML email (reads IBKR from log)
- `dashboard/server.mjs` — Express + Socket.IO server (polls IBKR)
- `dashboard/public/index.html` — dashboard UI (renders IBKR data)
- `ibkr-pnl.mjs` — **the one shared module containing the one `getIBKRPnL()` function; replaces query-ibkr-positions.mjs entirely**
- `@stoqey/ib` — IBKR API client library

## Error Handling

- If IBKR Gateway is offline: show "IBKR OFFLINE" in dashboard, email shows "No IBKR data"
- If IBKR returns no positions: show "No positions" not fake data
- If IBKR `UnrealizedPnL` field is null or missing: show "IBKR data incomplete" — do NOT substitute a manual calculation or paper book value
- If account summary doesn't arrive: wait 3 seconds then use what we have
- If email send fails: log error, do NOT retry (Resend handles delivery)

## Key Files

- Dashboard: `tunafish:~/.remote/@plans/mae-trading-paper-sprint/dashboard/`
- Email: `tunafish:~/.remote/@plans/mae-trading-paper-sprint/send-trading-report.mjs`
- Chain: `tunafish:~/.remote/@plans/mae-trading-paper-sprint/run-trading-chain.ts`
- Loop: `tunafish:~/.remote/@plans/mae-trading-paper-sprint/run-trading-loop.sh`
- Shared P&L: `tunafish:~/.remote/@plans/mae-trading-paper-sprint/ibkr-pnl.mjs` (single formula law; replaces query-ibkr-positions.mjs)