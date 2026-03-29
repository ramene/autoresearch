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
