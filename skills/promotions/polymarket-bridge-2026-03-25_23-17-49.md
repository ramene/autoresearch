# Promotion Proposal: polymarket-bridge

## Scores
- **Baseline**: 19/25
- **Current**: 25/25
- **Improvement**: +6 points (100.0%)
- **Rounds**: 6

## Promotion Target
`/Users/ramene/Journal/.seed/base/skills/polymarket-bridge/SKILL.md`

## Key Mutations That Improved Score
1. Restructure Execution Steps to make checking /supported-assets and enforcing minimum deposit amounts explicit mandatory preconditions for the deposit flow (not just withdrawal), fixing scenarios 1 and 4 which fail both criteria simultaneously.
2. Make the withdrawal quote step explicitly require displaying specific fee fields (estimated output, fee amount, fee breakdown) to prevent vague "show fees" interpretations that caused S2/S5 failures.
3. No failures exist — all criteria pass 25/25. Apply a minor clarification to the withdrawal quote step to reinforce that user confirmation must be received before any withdrawal API call is made, preventing any edge case where the skill might proceed without explicit acknowledgment.
4. Remove the misleading "Withdrawals are instant and free" caveat that contradicts the mandatory quote step, replacing it with a note that quotes are still mandatory to display estimated output even when Polymarket subsidizes fees.
5. Add a polling timeout guidance note to the Status Check section to handle the edge case where a transaction never reaches a terminal state, preventing infinite polling loops.

## Unified Diff (baseline -> current)
```diff
--- /Users/ramene/.remote/@autoresearch/skills/working-polymarket-bridge/SKILL.md.baseline	2026-03-20 19:21:41.000000000 -0600
+++ /Users/ramene/.remote/@autoresearch/skills/working-polymarket-bridge/SKILL.md	2026-03-21 02:59:53.000000000 -0600
@@ -60,15 +60,33 @@
 
 ## Execution Steps
 
-1. **Deposit:** POST /deposit with wallet address -> get EVM/SVM/BTC/TVM addresses -> send funds -> poll /status
-2. **Withdraw:** Check /supported-assets -> POST /quote for fees -> POST /withdraw -> send USDC.e -> poll /status
-3. **Status:** Poll every 10-30 seconds until COMPLETED or FAILED
+### Deposit Flow (MANDATORY ORDER — do not skip steps)
+1. **Check supported assets first (REQUIRED):** GET /supported-assets and confirm the source chain and token are listed. If not supported, abort and inform the user. Do not proceed to any subsequent step if this check fails.
+2. **Enforce minimum deposit (REQUIRED):** Verify the deposit amount meets the chain's minimum (see table above). If below minimum, abort — deposits below minimum will not be processed. Do not generate a deposit address if this check fails.
+3. **Generate deposit address:** POST /deposit with wallet address → receive EVM/SVM/BTC/TVM addresses appropriate for the source chain type.
+4. **Instruct user to send funds** to the returned address.
+5. **Poll status:** GET /status/{address} every 10–30 seconds until COMPLETED or FAILED.
+
+### Withdrawal Flow (MANDATORY ORDER — do not skip steps)
+1. **Check supported assets first (REQUIRED):** GET /supported-assets to confirm destination chain and token are supported. If not supported, abort and inform the user. Do not proceed to any subsequent step if this check fails.
+2. **Preview quote (REQUIRED — user must explicitly confirm before proceeding):** POST /quote with amount, destination chain, and token. This step is mandatory regardless of whether fees are zero or subsidized. Display ALL of the following to the user before proceeding:
+   - **Estimated output amount** (what the recipient will receive)
+   - **Fee amount** (total fees deducted; display even if zero)
+   - **Fee breakdown** (bridge fee, gas fee, etc. if provided by API)
+   - **Destination chain and token**
+   After displaying this information, explicitly ask the user to confirm they want to proceed. **Do not call POST /withdraw until the user has responded with explicit confirmation.** If the user does not confirm, abort.
+3. **Execute withdrawal:** POST /withdraw → receive destination address → send USDC.e from Polymarket wallet.
+4. **Poll status:** GET /status/{address} every 10–30 seconds until COMPLETED or FAILED.
+
+### Status Check
+- Poll every 10–30 seconds until status is COMPLETED or FAILED (both are terminal).
+- **Timeout handling:** If the transaction has not reached a terminal state after 30 minutes, stop polling, report the last observed status to the user, and advise them to re-check manually using `--status=<address>`. Do not continue polling indefinitely.
 
 ## Caveats
 - Withdrawals >$50,000: break into smaller amounts
 - Deposits below minimum will not be processed
 - Always check /supported-assets before depositing (assets change)
-- Withdrawals are instant and free (Polymarket pays fees)
+- Always show the /quote output to the user before executing a withdrawal — even when Polymarket subsidizes fees, the estimated output amount must be confirmed by the user
 
 ## Output Format
 - **Console:** Deposit addresses or withdrawal status
@@ -76,12 +94,12 @@
 
 ## Quality Gates
 1. Deposit addresses generated for correct chain type
-2. Withdrawal quote previews accurate fees
+2. Withdrawal quote previews accurate fees — estimated output, fee amount, and fee breakdown all displayed before execution
 3. Status polling correctly identifies terminal states
-4. Supported assets checked before operations
-5. Minimum deposit amounts enforced
+4. Supported assets checked before operations (both deposit and withdrawal)
+5. Minimum deposit amounts enforced before generating deposit addresses
 
 ## Integration Points
 - **Upstream:** User needs to fund Polymarket account
 - **Downstream:** Funded account enables `polymarket-clob-trader` operations
-- **Cross-skill:** `polymarket-portfolio-tracker` reflects deposited/withdrawn amounts
+- **Cross-skill:** `polymarket-portfolio-tracker` reflects deposited/withdrawn amounts
\ No newline at end of file

```

## Generated
- **Timestamp**: 2026-03-25T23:17:49.169Z
- **Source**: `/Users/ramene/.remote/@autoresearch/skills/working-polymarket-bridge/SKILL.md`
- **Baseline**: `/Users/ramene/.remote/@autoresearch/skills/working-polymarket-bridge/SKILL.md.baseline`
