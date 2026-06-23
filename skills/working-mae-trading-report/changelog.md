# Autoresearch Changelog: mae-trading-report

## Genesis
- Created from critical production issue: dashboard shows -$240 (paper) while email shows +$2,247 (IBKR)
- Root cause: two data sources mixed without clear separation
- 8 eval criteria covering consistency, accuracy, integrity, freshness, error handling

## Round 0
- **Score**: 42/48 (baseline)
- **Failures**: S6: P&L Consistency, S6: No Paper Mixing, S6: Log Integrity, S6: Single Formula, S6: Error Handling, S8: Single Formula
- **Per-criteria**: P&L Consistency: 7/8, No Paper Mixing: 7/8, Log Integrity: 7/8, Single Formula: 6/8, Data Freshness: 8/8, Error Handling: 7/8

## Round 1 — Mutation Applied
- **Mutation**: Replace the manual P&L formula in Step 2 with IBKR's native UnrealizedPnL field as the single source, removing the custom computation that diverges from IBKR's own calculation and causes multi-criterion failures in scenario 6.

## Round 0
- **Score**: 46/48 (baseline)
- **Failures**: S4: Single Formula, S8: P&L Consistency
- **Per-criteria**: P&L Consistency: 7/8, No Paper Mixing: 8/8, Log Integrity: 8/8, Single Formula: 7/8, Data Freshness: 8/8, Error Handling: 8/8

## Round 1 — Mutation Applied
- **Mutation**: Replace the ambiguous "Or:" option in Step 5 with a hard mandate that sections [8]-[10] MUST emit IBKR native fields only — removing the paper-book fallback path that causes Single Formula and P&L Consistency failures in scenarios 4 and 8.

## Round 2 — Mutation Applied
- **Mutation**: Add a prominent "INVIOLABLE CONSTRAINT" block at the top of the skill (before Execution Steps) that explicitly mandates getIBKRPnL() as the one and only P&L access point across the entire codebase, with a hard ban on any other P&L logic — making the single-formula rule unambiguous to any evaluator reading the skill.

## Round 3 — Mutation Applied
- **Mutation**: Add a concrete code template for getIBKRPnL() inside the INVIOLABLE CONSTRAINT block showing the exact read-only passthrough implementation — eliminating ambiguity about what "zero arithmetic" means and making it impossible to accidentally introduce a secondary formula.

## Round 4 — Mutation Applied
- **Mutation**: Add a mandatory Step 0 "Audit & Purge" that requires running the grep audit command first and explicitly deleting every P&L expression found outside ibkr-pnl.mjs — making the Single Formula constraint an active enforcement action rather than a passive guideline.

## Round 5 — Mutation Applied
- **Mutation**: Replace Step 2's independent re-description of getIBKRPnL() with a hard pointer to the INVIOLABLE CONSTRAINT template, eliminating the second authoritative-sounding definition that gives evaluators ambiguity about whether variation is permitted.

## Round 6 — Mutation Applied
- **Mutation**: Add a MANDATORY IMPORT MAP table inside the INVIOLABLE CONSTRAINT block listing each consumer file and the exact import line it must contain, closing the gap where Steps 3–5 describe data flow without mandating the import — the most likely cause of Single Formula failures across 7 scenarios.

## Round 7 — Mutation Applied
- **Mutation**: Explicitly retire query-ibkr-positions.mjs by marking it for deletion in Step 0 (ibkr-pnl.mjs replaces its functionality), updating Integration Points to show it as deprecated, and adding it to the audit/purge list — closing the last "WORKS CORRECTLY" escape hatch that permits P&L logic outside ibkr-pnl.mjs.

## Round 8 — Mutation Applied
- **Mutation**: Move the INVIOLABLE CONSTRAINT block to the very top of the skill (immediately after the title, before Purpose) so it is the first content any model reads — preventing implementation plans from forming before the single-formula rule is established.

## Round 9 — Mutation Applied
- **Mutation**: Fix the contradictory Integration Points entry for send-trading-report.mjs which says "reads IBKR from log" — contradicting Step 4's mandate to call getIBKRPnL() directly — eliminating the ambiguity that allows log-parsing as a second P&L source.

## Round 10 — Mutation Applied
- **Mutation**: Add a "THESE ARE FORBIDDEN — DO NOT WRITE THIS CODE" subsection inside the INVIOLABLE CONSTRAINT block with concrete wrong-implementation examples (computed fallbacks, derived fields, log parsing) contrasted against the correct passthrough pattern, making the abstract "zero arithmetic" rule concrete and impossible to misinterpret.

## Round 11 — Mutation Applied
- **Mutation**: Restructure Step 1 to replace high-level bullet points with a concrete "OLD vs NEW logic flow" blueprint for `run-trading-chain.ts`, giving the AI a positive implementation template instead of abstract constraints — directly targeting the 8 Single Formula failures caused by the chain script continuing to use paper book logic.

## Round 12 — Mutation Applied
- **Mutation**: Add an explicit "FORBIDDEN: direct ibkrClient API calls in consumer files" example to the INVIOLABLE CONSTRAINT block — closing the gap where a model correctly avoids arithmetic but still bypasses getIBKRPnL() by calling ibkrClient.getAccountSummary() or ibkrClient.getPositions() directly in dashboard/server.mjs, send-trading-report.mjs, or run-trading-chain.ts, which creates a second P&L access point outside ibkr-pnl.mjs and violates Single Formula.

## Round 13 — Mutation Applied
- **Mutation**: Add a "⚠️ SINGLE FORMULA REMINDER" callout at the start of each implementation step (Steps 1–5) that fires at the moment code is being written, preventing the model from "forgetting" the constraint during multi-step execution.

## Round 14 — Mutation Applied
- **Mutation**: Add a concrete "OLD vs NEW logic flow" implementation blueprint to Step 4 for send-trading-report.mjs, matching Step 1's blueprint format — giving a positive implementation template instead of abstract bullet points, targeting the email script's unique temptations (log parsing, position summing, direct ibkrClient calls).

## Round 15 — Mutation Applied
- **Mutation**: Add a "VERIFY BEFORE CONTINUING" grep command at the end of Steps 1–5 that must return clean output before the model may proceed to the next step — turning the abstract Single Formula rule into a hard checkpoint that surfaces violations file-by-file rather than only at the final Step 7 audit.

## Round 16 — Mutation Applied
- **Mutation**: Restructure the INVIOLABLE CONSTRAINT to lead with "STEP A: Copy ibkr-pnl.mjs verbatim" and "STEP B: Use the import map" as numbered mechanical actions before forbidden patterns, making the correct path a concrete copy-paste procedure rather than a rule to reason about.

## Round 17 — Mutation Applied
- **Mutation**: Add a mandatory 5-question PRE-IMPLEMENTATION COMMITMENT block after STEP B that forces the model to explicitly state the correct import line, function call, and null-handling for each consumer file before writing any code — converting the constraint from a rule to read into a commitment to make.
