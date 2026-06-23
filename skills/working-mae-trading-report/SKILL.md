# SKILL: mae-trading-report

## ⚠️ INVIOLABLE CONSTRAINT: Single Formula Law

**READ THIS BEFORE ANYTHING ELSE. This constraint supersedes all other instructions. No exceptions.**

**DO THESE TWO MECHANICAL STEPS BEFORE WRITING ANY OTHER CODE:**

---

### STEP A — Create `ibkr-pnl.mjs` by copying this file verbatim

This is the **complete, final content** of `ibkr-pnl.mjs`. Copy it exactly. Do not add to it. Do not modify it. Do not write an alternative. This is not an example — it is the file.

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

**`ibkr-pnl.mjs` is the ONLY file permitted to call `ibkrClient.getAccountSummary()` or `ibkrClient.getPositions()`. Every other file must call `getIBKRPnL()` instead.**

---

### STEP B — Use this import map for every consumer file

This table is the complete, authoritative list of which files may access P&L data and the exact import line each must use. Copy the import line mechanically — do not paraphrase or adjust the path.

| File | Required import line — copy exactly |
|------|--------------------------------------|
| `dashboard/server.mjs` | `import { getIBKRPnL } from '../ibkr-pnl.mjs';` |
| `send-trading-report.mjs` | `import { getIBKRPnL } from './ibkr-pnl.mjs';` |
| `run-trading-chain.ts` | `import { getIBKRPnL } from './ibkr-pnl.mjs';` |

**Any file NOT in this table MUST NOT reference any P&L field, formula, variable, or `ibkrClient` method call.**

After copying the import, every consumer file must:
1. Call `getIBKRPnL(ibkrClient)` — not `ibkrClient.getAccountSummary()`, not `ibkrClient.getPositions()`
2. Use `result.totalUnrealizedPnL` directly for total P&L display — no arithmetic
3. Use `position.unrealizedPnL` directly for per-position P&L — no arithmetic
4. If any field is `null` or `undefined`: display `"IBKR data incomplete"` — no fallback formula

**`query-ibkr-positions.mjs` is RETIRED — it must be DELETED. Any remaining reference to it must be removed.**

---

### STEP C — PRE-IMPLEMENTATION COMMITMENT (Answer before writing any code)

**Before writing a single line of code in any consumer file, answer these 5 questions explicitly. Write out each answer.**

1. **For the file I am about to modify, what is the EXACT import line?**
   → Look it up in STEP B above and write it out word-for-word.

2. **What is the ONLY function I will call to get P&L data in this file?**
   → Answer: `getIBKRPnL(ibkrClient)` — never `ibkrClient.getAccountSummary()`, never `ibkrClient.getPositions()`

3. **After calling `getIBKRPnL()`, will I perform any arithmetic on its return values?**
   → Answer: NO. `data.totalUnrealizedPnL` is used directly. `position.unrealizedPnL` is used directly. No `.reduce()`, no `*`, no `-`, no `/`.

4. **If `data.totalUnrealizedPnL` is null or undefined, what do I display?**
   → Answer: The string `"IBKR data incomplete"` — not a formula, not a paper book fallback, not a log-parsed value.

5. **Has `query-ibkr-positions.mjs` been deleted, and are all imports of it removed?**
   → Answer: Yes — deleted in Step 0. If not yet done, do it now before continuing.

**If you cannot answer all 5 questions correctly for the file you are about to modify, stop and re-read STEP A and STEP B before writing any code.**

---

### What the function MUST NOT contain (Step A verification):

- No `livePrice - avgPrice` or any subtraction/multiplication involving prices
- No `pos * price` or any quantity-times-price arithmetic
- No fallback to paper book values
- No secondary P&L computation of any kind

---

### ❌ THESE ARE FORBIDDEN — DO NOT WRITE THIS CODE

The following patterns look reasonable but **all violate the Single Formula Law**. If you find yourself writing any of these, stop and delete it.

**Forbidden: direct ibkrClient API calls in consumer files**
```javascript
// ❌ WRONG in dashboard/server.mjs, send-trading-report.mjs, run-trading-chain.ts, or anywhere else
// Calling ibkrClient methods directly in consumer files bypasses getIBKRPnL() and creates
// a second P&L access point — forbidden even when there is NO arithmetic involved.
const account = await ibkrClient.getAccountSummary(); // FORBIDDEN outside ibkr-pnl.mjs
const pnl = account.UnrealizedPnL;                    // FORBIDDEN — must come from getIBKRPnL()
const positions = await ibkrClient.getPositions();    // FORBIDDEN outside ibkr-pnl.mjs
// ❌ Even "just reading" native fields directly is a Single Formula violation.
// ALL ibkrClient.getAccountSummary() and ibkrClient.getPositions() calls MUST live
// inside ibkr-pnl.mjs ONLY. Consumer files call getIBKRPnL(), never ibkrClient directly.
```

**Forbidden: computed fallback inside getIBKRPnL()**
```javascript
// ❌ WRONG — arithmetic is forbidden even as a "fallback"
unrealizedPnL: p.unrealizedPNL ?? (p.livePrice - p.avgCost) * p.pos,
// ❌ WRONG — derived calculation violates passthrough-only rule
percentReturn: (p.unrealizedPNL / (p.avgCost * p.pos)) * 100,
// ❌ WRONG — any arithmetic on native fields is forbidden
totalPnL: positions.reduce((sum, p) => sum + p.unrealizedPNL, 0),
```

**Forbidden: P&L computed in consumer files**
```javascript
// ❌ WRONG in dashboard/server.mjs, send-trading-report.mjs, run-trading-chain.ts, or anywhere else
const pnl = (livePrice - avgCost) * qty;
const unrealizedPnL = position.qty * (currentPrice - position.avgPrice);
const totalPnL = positions.reduce((acc, p) => acc + p.pnl, 0);
```

**Forbidden: arithmetic on getIBKRPnL() return values in consumer files**
```javascript
// ❌ WRONG — even after correctly calling getIBKRPnL(), consumer files must not do arithmetic
const data = await getIBKRPnL(ibkrClient);
const adjusted = data.totalUnrealizedPnL * conversionRate;   // FORBIDDEN
const sum = data.positions.reduce((s, p) => s + p.unrealizedPnL, 0); // FORBIDDEN
const pct = (data.totalUnrealizedPnL / data.netLiquidation) * 100;   // FORBIDDEN
// ✅ CORRECT: display data.totalUnrealizedPnL directly — no arithmetic, no transformation
```

**Forbidden: parsing P&L from log text**
```javascript
// ❌ WRONG — log lines are display-only human text, not a data source
const pnl = parseFloat(logLine.match(/P&L: \$([0-9.-]+)/)[1]);
const match = chainLog.match(/Unrealized PnL: \$([\d.]+)/);
```

**Forbidden: any import of query-ibkr-positions.mjs**
```javascript
// ❌ WRONG — this file is deleted; it must not be referenced anywhere
import { queryPositions } from './query-ibkr-positions.mjs';
```

### ✅ THE ONLY CORRECT PATTERN

```javascript
// ✅ CORRECT — import getIBKRPnL and use its native fields directly
import { getIBKRPnL } from './ibkr-pnl.mjs';
const data = await getIBKRPnL(ibkrClient);
// Use data.totalUnrealizedPnL — do NOT add arithmetic to it
// Use data.positions[n].unrealizedPnL — do NOT add arithmetic to it
// If null/undefined: display "IBKR data incomplete" — do NOT substitute a formula
// NEVER call ibkrClient.getAccountSummary() or ibkrClient.getPositions() directly here
```

**Forbidden patterns** (grep for these; if found, delete immediately):
- `unrealizedPNL.*[-*]` or `[-*].*unrealizedPNL` (arithmetic on P&L fields)
- `livePrice.*avgPrice` or `avgPrice.*livePrice`
- `pos.*price` outside of ibkr-pnl.mjs
- Any P&L field access outside ibkr-pnl.mjs and its direct callers
- Any `require` or `import` of `query-ibkr-positions.mjs` (that file must not exist)
- Any code that parses P&L values from log file text (log lines are display-only, not a data source)
- `ibkrClient.getAccountSummary()` called outside `ibkr-pnl.mjs`
- `ibkrClient.getPositions()` called outside `ibkr-pnl.mjs`

Verification: after implementation, `grep -r "unrealizedPNL\|UnrealizedPnL\|pnl\|PnL\|P&L\|getAccountSummary\|getPositions" --include="*.ts" --include="*.mjs"` must return hits only inside `ibkr-pnl.mjs` and files that import from it. Zero standalone P&L expressions or direct ibkrClient calls elsewhere.

---

## Purpose

Generate accurate, consistent, trustworthy trading reports across dashboard (tunafish:3333) and email (Resend) from a SINGLE source of truth (IBKR IB Gateway).

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

### Step 0: MANDATORY AUDIT — Find and Delete All Existing P&L Logic (DO THIS FIRST)

> ⚠️ **SINGLE FORMULA REMINDER:** Before touching any file, re-read the INVIOLABLE CONSTRAINT at the top of this skill. The audit below must find and eliminate EVERY P&L access point that is not inside `ibkr-pnl.mjs`. This includes: arithmetic on prices, direct `ibkrClient` calls, log parsing, and arithmetic on `getIBKRPnL()` return values.

**This step MUST be completed before touching any other file. Do not skip it.**

Run this audit command first:
```bash
grep -rn "unrealizedPNL\|UnrealizedPnL\|pnl\|PnL\|P&L\|livePrice.*avgPrice\|avgPrice.*livePrice\|pos.*price\|qty.*price\|getAccountSummary\|getPositions" \
  --include="*.ts" --include="*.mjs" --include="*.js" \
  tunafish:~/.remote/@plans/mae-trading-paper-sprint/
```

For every match found **outside** `ibkr-pnl.mjs`:
1. Open the file
2. Delete the entire P&L expression, formula, field access, or direct ibkrClient method call
3. Replace with: `// P&L removed — use getIBKRPnL() from ibkr-pnl.mjs`
4. Save the file

**Additionally, delete `query-ibkr-positions.mjs` entirely.** This file is retired. Its IBKR query functionality is replaced by `ibkr-pnl.mjs`. Run:
```bash
rm tunafish:~/.remote/@plans/mae-trading-paper-sprint/query-ibkr-positions.mjs
```
Also remove any `import` or `require` of `query-ibkr-positions.mjs` from every file — replace each such reference with `import { getIBKRPnL } from './ibkr-pnl.mjs';` if the file needs P&L data, or delete the line entirely if it does not.

**Do not proceed to Step 1 until the audit returns zero hits outside ibkr-pnl.mjs and its direct importers, and `query-ibkr-positions.mjs` no longer exists.**

Re-run the audit after each deletion to confirm. The audit MUST pass (zero standalone P&L expressions and zero direct ibkrClient calls) before continuing.

### Step 1: Eliminate the paper book from `run-trading-chain.ts`

> ⚠️ **SINGLE FORMULA REMINDER — STOP BEFORE WRITING ANY CODE IN THIS STEP.**
> Every P&L value in `run-trading-chain.ts` MUST come from `getIBKRPnL()`. Before writing a single line:
> - **Answer STEP C's 5 questions for `run-trading-chain.ts` now.** Question 1 answer: `import { getIBKRPnL } from './ibkr-pnl.mjs';`
> - You MUST NOT call `ibkrClient.getAccountSummary()` or `ibkrClient.getPositions()` directly — even once, even "just to read"
> - You MUST NOT compute `(price - avgCost) * qty` or any price arithmetic
> - You MUST NOT do arithmetic on the data returned by `getIBKRPnL()` (no `.reduce()` sums, no `*` or `-` on P&L fields)
> - You MUST NOT parse P&L from log text
> - The paper book (`resetPaperBook`, `placePaperTrade`, `logPaperPositions`) MUST be deleted entirely — it is NOT a fallback
> If you are about to write any of the above, stop and delete it.

This is the most critical step. The core problem originates from `run-trading-chain.ts` running a paper book simulation *before* fetching real IBKR data. You must remove the paper book logic entirely and replace it with a flow that uses IBKR data from the start.

#### ✅ **`run-trading-chain.ts` Refactoring Blueprint**

Follow this blueprint to restructure the file. Delete the old functions and implement the new flow.

**OLD (Incorrect) Logic Flow — DELETE THIS PATTERN:**
1. `resetPaperBook()` is called at the start. **(DELETE THIS CALL)**
2. LLMs analyze the market without position context.
3. `placePaperTrade()` is called to simulate trades. **(DELETE THIS CALL)**
4. `logPaperPositions()` is called, printing positions with $0.00 P&L. **(DELETE THIS FUNCTION/LOGIC)**
5. *Then*, as an afterthought, a separate function queries IBKR.

**NEW (Correct) Logic Flow — IMPLEMENT THIS PATTERN:**
1. **At the very beginning of the script's main function,** call `getIBKRPnL()` to fetch the current, real account state. Do NOT call `ibkrClient.getAccountSummary()` or `ibkrClient.getPositions()` directly here — only call `getIBKRPnL()`.
   ```typescript
   // run-trading-chain.ts
   import { getIBKRPnL } from './ibkr-pnl.mjs';
   // ...
   async function runChain() {
     const ibkrData = await getIBKRPnL(ibkrClient);
     // If ibkrData is null or incomplete, log an error and exit early.
     // Do NOT fall back to paper book or direct ibkrClient calls.
   }
   ```
2. **Pass `ibkrData` to the LLM analysis functions.** The LLMs must receive the real P&L and position data as context for their recommendations.
3. The LLMs' output should be a list of trade *recommendations* (e.g., `{ action: 'BUY', symbol: 'NVDA', confidence: 0.85 }`), not executed paper trades.
4. Log these recommendations clearly.
5. If IBKR is connected, execute the high-confidence recommendations against the real IBKR paper account.
6. All logging in sections [8], [9], and [10] MUST use the `ibkrData` object fetched in the first step. **There is no paper book to log.** If `ibkrData` was unavailable, these sections should log "IBKR data unavailable," not fall back to any other source.

#### 🔴 VERIFY BEFORE CONTINUING TO STEP 2

**Run this command on `run-trading-chain.ts` and confirm the output is clean before proceeding:**

```bash
grep -n "getAccountSummary\|getPositions\|resetPaperBook\|placePaperTrade\|logPaperPositions\|livePrice.*avgPrice\|pos.*price\|qty.*price\|\.reduce.*pnl\|\.reduce.*PnL\|unrealizedPNL.*[*-]\|[*-].*unrealizedPNL\|query-ibkr-positions" \
  tunafish:~/.remote/@plans/mae-trading-paper-sprint/run-trading-chain.ts
```

**Expected output: no lines printed.** If ANY line is printed, the violation must be deleted before moving to Step 2. Do not proceed until this command returns empty.

Also verify the required import exists:
```bash
grep -n "getIBKRPnL" tunafish:~/.remote/@plans/mae-trading-paper-sprint/run-trading-chain.ts
# Must show: import { getIBKRPnL } from './ibkr-pnl.mjs';
```

### Step 2: Create ibkr-pnl.mjs using the INVIOLABLE CONSTRAINT template

> ⚠️ **SINGLE FORMULA REMINDER — STOP BEFORE WRITING ANY CODE IN THIS STEP.**
> `ibkr-pnl.mjs` must be copied verbatim from STEP A in the INVIOLABLE CONSTRAINT at the top of this skill. You MUST NOT add any arithmetic, fallbacks, derived fields, or helper computations. The function is a READ-ONLY passthrough — nothing else. If you are about to add any calculation to this file beyond what is in the template, stop and delete it.

**Use the exact code from STEP A at the top of this skill — copy it verbatim into `ibkr-pnl.mjs`. No modifications, no additions, no alternative implementation.**

- This file is the ONLY P&L access point in the entire codebase
- This is the ONLY file permitted to call `ibkrClient.getAccountSummary()` or `ibkrClient.getPositions()`
- Every other file that previously had P&L logic was already deleted in Step 0
- Every consumer (dashboard server, email script, chain log) MUST import `getIBKRPnL` from this file using the exact import line in the MANDATORY IMPORT MAP (STEP B above)
- If IBKR's `UnrealizedPnL` field is absent or null, the caller receives `undefined` and MUST display `"IBKR data incomplete"` — never fall back to a manual formula

#### 🔴 VERIFY BEFORE CONTINUING TO STEP 3

**Run this command on `ibkr-pnl.mjs` and confirm no arithmetic was accidentally introduced:**

```bash
grep -n "livePrice\|avgCost.*[*-]\|[*-].*avgCost\|pos.*price\|qty.*price\|\.reduce\|percentReturn\|totalPnL\|query-ibkr-positions" \
  tunafish:~/.remote/@plans/mae-trading-paper-sprint/ibkr-pnl.mjs
```

**Expected output: no lines printed.** If ANY line is printed, the arithmetic or forbidden reference must be deleted before moving to Step 3.

Also verify the file exports exactly `getIBKRPnL` and nothing else:
```bash
grep -n "^export" tunafish:~/.remote/@plans/mae-trading-paper-sprint/ibkr-pnl.mjs
# Must show only: export async function getIBKRPnL(ibkrClient) {
```

### Step 3: Dashboard data flow

> ⚠️ **SINGLE FORMULA REMINDER — STOP BEFORE WRITING ANY CODE IN THIS STEP.**
> In `dashboard/server.mjs`, ALL P&L data MUST come from `getIBKRPnL()`. Before writing any code:
> - **Answer STEP C's 5 questions for `dashboard/server.mjs` now.** Question 1 answer: `import { getIBKRPnL } from '../ibkr-pnl.mjs';`
> - You MUST NOT call `ibkrClient.getAccountSummary()` or `ibkrClient.getPositions()` directly — not even once
> - You MUST NOT do arithmetic on `getIBKRPnL()` return values (no sums, no multiplication, no derived fields)
> - You MUST NOT parse P&L from any log, string, or text source
> If you are about to write any of the above, stop and delete it.

- Add `import { getIBKRPnL } from '../ibkr-pnl.mjs';` to `dashboard/server.mjs` (see MANDATORY IMPORT MAP in STEP B)
- Dashboard server polls IBKR every 30 seconds via `pollIBKR()` which calls `getIBKRPnL()` — do NOT call `ibkrClient.getAccountSummary()` or `ibkrClient.getPositions()` directly in server.mjs
- MUST wait for BOTH `positionEnd` AND `accountSummaryEnd` before emitting (this waiting happens inside ibkr-pnl.mjs, not in server.mjs)
- Emit `ibkr:update` with { positions, account: {NetLiquidation, TotalCashValue, UnrealizedPnL, BuyingPower}, connected }
- Dashboard HTML reads `ibkrAccount.UnrealizedPnL` for hero P&L (sourced from `getIBKRPnL()`)
- Dashboard HTML reads `ibkrPositions[n].unrealizedPnL` for position table per-position P&L (sourced from `getIBKRPnL()`)
- Paper positions (BTC, ETH) are NOT shown when IBKR is connected

#### 🔴 VERIFY BEFORE CONTINUING TO STEP 4

**Run this command on `dashboard/server.mjs` and confirm the output is clean:**

```bash
grep -n "getAccountSummary\|getPositions\|livePrice.*avgPrice\|pos.*price\|qty.*price\|\.reduce.*pnl\|\.reduce.*PnL\|unrealizedPNL.*[*-]\|[*-].*unrealizedPNL\|query-ibkr-positions" \
  tunafish:~/.remote/@plans/mae-trading-paper-sprint/dashboard/server.mjs
```

**Expected output: no lines printed.** If ANY line is printed, the violation must be deleted before moving to Step 4.

Also verify the required import exists:
```bash
grep -n "getIBKRPnL" tunafish:~/.remote/@plans/mae-trading-paper-sprint/dashboard/server.mjs
# Must show: import { getIBKRPnL } from '../ibkr-pnl.mjs';
```

### Step 4: Email data flow

> ⚠️ **SINGLE FORMULA REMINDER — STOP BEFORE WRITING ANY CODE IN THIS STEP.**
> In `send-trading-report.mjs`, ALL P&L data MUST come from `getIBKRPnL()`. Before writing a single line:
> - **Answer STEP C's 5 questions for `send-trading-report.mjs` now.** Question 1 answer: `import { getIBKRPnL } from './ibkr-pnl.mjs';`
> - You MUST NOT call `ibkrClient.getAccountSummary()` or `ibkrClient.getPositions()` directly
> - You MUST NOT parse P&L values from log file text — log text is display-only human text, never a data source
> - You MUST NOT sum position P&Ls to produce a total — use `data.totalUnrealizedPnL` directly from `getIBKRPnL()`
> - You MUST NOT do any arithmetic on `getIBKRPnL()` return values (no `.reduce()`, no `*`, no `-`, no `/`)
> If you are about to write any of the above, stop and delete it.

#### ✅ **`send-trading-report.mjs` Implementation Blueprint**

Follow this blueprint exactly. The email script has three unique temptations that all violate Single Formula — this blueprint shows what to do instead.

**OLD (Incorrect) Logic — DELETE THESE PATTERNS:**

Pattern A — Reading log file to extract P&L numbers: **(DELETE THIS)**
```javascript
// ❌ WRONG — log text is display-only, not a data source
const logText = fs.readFileSync(logPath, 'utf8');
const match = logText.match(/UnrealizedPnL: \$([\d.-]+)/);
const pnl = parseFloat(match[1]);
```

Pattern B — Calling ibkrClient directly: **(DELETE THIS)**
```javascript
// ❌ WRONG — bypasses getIBKRPnL(), creates second P&L access point
const account = await ibkrClient.getAccountSummary();
const totalPnL = account.UnrealizedPnL;
```

Pattern C — Summing positions to derive a total: **(DELETE THIS)**
```javascript
// ❌ WRONG — arithmetic on getIBKRPnL() return values is forbidden
const data = await getIBKRPnL(ibkrClient);
const totalPnL = data.positions.reduce((sum, p) => sum + p.unrealizedPnL, 0);
```

**NEW (Correct) Logic Flow — IMPLEMENT THIS PATTERN:**

```javascript
// send-trading-report.mjs
import { getIBKRPnL } from './ibkr-pnl.mjs';

async function sendReport() {
  // 1. Fetch ALL P&L data in one call — no ibkrClient calls here, no log parsing
  const ibkrData = await getIBKRPnL(ibkrClient);

  // 2. Use native fields directly — no arithmetic, no transformation
  const totalPnL   = ibkrData?.totalUnrealizedPnL ?? 'IBKR data incomplete';
  const portfolio  = ibkrData?.netLiquidation      ?? 'IBKR data incomplete';
  const positions  = ibkrData?.positions            ?? [];

  // 3. Build email — display fields directly, no computation
  const emailHtml = buildEmail({
    headerPnL: totalPnL,       // ✅ native field, used directly
    headerPortfolio: portfolio, // ✅ native field, used directly
    positionRows: positions.map(p => ({
      symbol:       p.symbol,
      qty:          p.qty,
      avgPrice:     p.avgPrice,
      unrealizedPnL: p.unrealizedPnL, // ✅ native field, used directly — no arithmetic
    })),
    chainLogText: fs.readFileSync(logPath, 'utf8'), // ✅ log text shown as-is, display only
    // ❌ DO NOT parse any values out of chainLogText — it is display-only
  });

  await resend.emails.send({ html: emailHtml, ... });
}
```

**Key rules re-stated for this file:**
- `getIBKRPnL()` is called ONCE at the top — this is the only data source for all P&L fields
- `ibkrData.totalUnrealizedPnL` goes directly into the email header — no arithmetic applied
- `position.unrealizedPnL` goes directly into each position row — no arithmetic applied
- The chain log text file is read and included as display-only HTML — none of its text values are parsed or used as data
- If `ibkrData` is null or a field is undefined: display `"IBKR data incomplete"` — no fallback

#### 🔴 VERIFY BEFORE CONTINUING TO STEP 5

**Run this command on `send-trading-report.mjs` and confirm the output is clean:**

```bash
grep -n "getAccountSummary\|getPositions\|logText\.match\|logLine\.match\|parseFloat.*match\|\.reduce.*pnl\|\.reduce.*PnL\|unrealizedPNL.*[*-]\|[*-].*unrealizedPNL\|livePrice.*avgPrice\|pos.*price\|query-ibkr-positions" \
  tunafish:~/.remote/@plans/mae-trading-paper-sprint/send-trading-report.mjs
```

**Expected output: no lines printed.** If ANY line is printed, the violation must be deleted before moving to Step 5.

Also verify the required import exists:
```bash
grep -n "getIBKRPnL" tunafish:~/.remote/@plans/mae-trading-paper-sprint/send-trading-report.mjs
# Must show: import { getIBKRPnL } from './ibkr-pnl.mjs';
```

### Step 5: Chain log integrity

> ⚠️ **SINGLE FORMULA REMINDER — STOP BEFORE WRITING ANY CODE IN THIS STEP.**
> Sections [8], [9], [10] of the chain log MUST use only `ibkrData` fetched via `getIBKRPnL()` at the top of `runChain()`. Before writing any log formatting code:
> - **Answer STEP C's 5 questions for `run-trading-chain.ts` now** (this file was already committed to in Step 1 — confirm the import is still in place and no new violations were introduced)
> - You MUST NOT introduce any new `ibkrClient` calls here
> - You MUST NOT compute or derive any P&L values — display `ibkrData.positions[n].unrealizedPnL` directly
> - You MUST NOT fall back to paper book data if IBKR data is unavailable — log "IBKR data unavailable" instead
> If you are about to write any of the above, stop and delete it.

- Sections [8], [9], and [10] MUST be rewritten to emit IBKR native fields only via `getIBKRPnL()` — **no paper book data is permitted in any log section**. Remove all paper book position logging from these sections entirely.
- Each position line logged in sections [8]-[10] MUST use IBKR's native `unrealizedPNL` field via `getIBKRPnL()`. Any line that would produce a $0.00 P&L from a paper book reset is forbidden.
- The log must have ONE consistent set of numbers from top to bottom. If IBKR data is unavailable at chain runtime, sections [8]-[10] must log "IBKR data unavailable — positions omitted" rather than falling back to paper book values.
- No "$0.00 P&L" appearing anywhere in the log if IBKR shows non-zero P&L.

#### 🔴 VERIFY BEFORE CONTINUING TO STEP 6

**Re-run the full audit across all files to confirm zero violations remain:**

```bash
grep -rn "getAccountSummary\|getPositions\|resetPaperBook\|placePaperTrade\|logPaperPositions\|livePrice.*avgPrice\|pos.*price\|qty.*price\|\.reduce.*pnl\|\.reduce.*PnL\|unrealizedPNL.*[*-]\|[*-].*unrealizedPNL\|query-ibkr-positions" \
  --include="*.ts" --include="*.mjs" --include="*.js" \
  tunafish:~/.remote/@plans/mae-trading-paper-sprint/
```

**Expected output: only hits inside `ibkr-pnl.mjs` (for `getAccountSummary` and `getPositions`). Zero hits in any other file.** If any hit appears in another file, delete the violation before proceeding.

### Step 6: QwQ reasoning freshness
- The QwQ-32B analysis currently produces the same output every run
- Add market-specific context to the prompt: current P&L, position performance, recent price changes
- The analysis should reference actual position performance, not generic market commentary

### Step 7: MANDATORY POST-IMPLEMENTATION AUDIT

After completing all steps, re-run the audit from Step 0:
```bash
grep -rn "unrealizedPNL\|UnrealizedPnL\|pnl\|PnL\|P&L\|livePrice.*avgPrice\|pos.*price\|qty.*price\|getAccountSummary\|getPositions" \
  --include="*.ts" --include="*.mjs" --include="*.js" \
  tunafish:~/.remote/@plans/mae-trading-paper-sprint/
```

**The task is NOT complete until this audit returns zero hits outside ibkr-pnl.mjs and its direct importers.** If any standalone P&L expression or direct ibkrClient method call remains, return to the file that contains it and delete it before marking done.

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
- Stats row: Portfolio, P&L (IBKR `UnrealizedPnL` via direct `getIBKRPnL()` call — not parsed from log), Trades
- Signals: colored badges per asset
- Positions table: Symbol, Qty, Avg, P&L (IBKR `unrealizedPNL` per position via direct `getIBKRPnL()` call — not summed or derived)
- Plutus analysis excerpt
- Expandable full chain log (display-only — P&L values in log text are NOT parsed or used as data)
- Footer: mae · tunafish M4 Max · Plutus 8B + QwQ 32B

### Chain Log
- Consistent P&L throughout — no contradictory sections
- IBKR positions as the primary position display in ALL sections (all via `getIBKRPnL()`)
- Paper book removed entirely — not present in any log section, not marked as "SIMULATION ONLY", simply absent

## Quality Gates

1. **P&L Consistency:** Dashboard hero P&L === Email header P&L === IBKR `UnrealizedPnL` field value (tolerance: $0.01)
2. **No Zero P&L:** If IBKR has positions with real P&L, $0.00 must NOT appear in any formatted output
3. **Single Formula:** All P&L values flow through the one shared `getIBKRPnL()` function — IBKR native fields only (`UnrealizedPnL`, `unrealizedPNL`). No manual recomputation anywhere in the codebase. No other P&L logic exists outside this function. No parsing of P&L from log file text. No direct `ibkrClient.getAccountSummary()` or `ibkrClient.getPositions()` calls outside `ibkr-pnl.mjs`. No arithmetic on `getIBKRPnL()` return values in consumer files. `query-ibkr-positions.mjs` does not exist (deleted). **The per-step verification commands (Steps 1–5) and the Step 0 and Step 7 audits must all return zero hits outside ibkr-pnl.mjs. The MANDATORY IMPORT MAP verification must show all three consumer files importing getIBKRPnL.**
4. **Position Accuracy:** Dashboard positions match IBKR positions exactly (symbol, qty, avgPrice)
5. **Data Freshness:** IBKR data polled within last 60 seconds, prices within last 5 minutes
6. **No Paper Mixing:** When IBKR is connected, paper BTC/ETH do NOT appear in positions
7. **Log Integrity:** The chain log does not contain contradictory P&L numbers
8. **QwQ Freshness:** QwQ analysis references current position P&L, not generic text

## Integration Points

- `run-trading-chain.ts` — the hourly chain script (needs rewrite to remove paper book per Step 1 blueprint); imports and calls `getIBKRPnL()` at the very start of `runChain()` for all P&L logging; does NOT call ibkrClient directly; does NOT do arithmetic on getIBKRPnL() return values
- `run-trading-loop.sh` — the cron wrapper
- `query-ibkr-positions.mjs` — **RETIRED AND DELETED — replaced entirely by `ibkr-pnl.mjs`. Remove this file and all imports of it.**
- `send-trading-report.mjs` — styled HTML email; imports and calls `getIBKRPnL()` directly for all P&L data — does NOT call ibkrClient directly — does NOT parse P&L from log file text — does NOT sum position P&Ls — does NOT do arithmetic on getIBKRPnL() return values
- `dashboard/server.mjs` — Express + Socket.IO server; imports and calls `getIBKRPnL()` to poll IBKR every 30 seconds; does NOT call ibkrClient directly; does NOT do arithmetic on getIBKRPnL() return values
- `dashboard/public/index.html` — dashboard UI (renders IBKR data from Socket.IO events)
- `ibkr-pnl.mjs` — **the one shared module containing the one `getIBKRPnL()` function; the ONLY file permitted to call `ibkrClient.getAccountSummary()` or `ibkrClient.getPositions()`; replaces query-ibkr-positions.mjs entirely; the only file permitted to access P&L fields**
- `@stoqey/ib` — IBKR API client library

## Error Handling

- If IBKR Gateway is offline: show "IBKR OFFLINE" in dashboard, email shows "No IBKR data"
- If IBKR returns no positions: show "No positions" not fake data
- If IBKR `UnrealizedPnL` field is null or missing: show "IBKR data incomplete" — do NOT substitute a manual calculation or paper book value
- If account summary doesn't arrive within 5 seconds: show "IBKR data incomplete" — do NOT use partial data or fall back to any computed value
- If email send fails: log error, do NOT retry (Resend handles delivery)

## Key Files

- Dashboard: `tunafish:~/.remote/@plans/mae-trading-paper-sprint/dashboard/`
- Email: `tunafish:~/.remote/@plans/mae-trading-paper-sprint/send-trading-report.mjs`
- Chain: `tunafish:~/.remote/@plans/mae-trading-paper-sprint/run-trading-chain.ts`
- Loop: `tunafish:~/.remote/@plans/mae-trading-paper-sprint/run-trading-loop.sh`
- Shared P&L: `tunafish:~/.remote/@plans/mae-trading-paper-sprint/ibkr-pnl.mjs` (single formula law; replaces query-ibkr-positions.mjs; only file allowed to call ibkrClient.getAccountSummary/getPositions)