# Autoresearch Changelog: context-loader

## Round 13 — Mutation Applied
- **Mutation**: Consolidate the --refresh description to remove contradictory "skipped entirely" phrasing from Argument Combination Rules (Step 0 already handles it via condition 3), and elevate the default-depth statement to the top of the Arguments section to fix both scenario 7 and 16 Argument Clarity failures.

## Round 0
- **Score**: 191/192 (baseline)
- **Failures**: S7: Argument Clarity
- **Per-criteria**: Default Behavior: 16/16, Depth Differentiation: 16/16, Refresh Logic: 16/16, Targeted Scans: 16/16, Output Specification: 16/16, Implicit No-Op: 16/16, Tool Requirements: 16/16, Scope Definition: 16/16, Error Handling (Permissions): 16/16, Error Handling (Invalid Target): 16/16, Argument Clarity: 15/16, Conditional Execution: 16/16

## Round 1 — Mutation Applied
- **Mutation**: Clarify the --refresh argument description to explicitly state that default depth (deep) applies when --refresh is used alone, removing ambiguity in scenario 7 of Argument Clarity.

## Round 3 — Mutation Applied
- **Mutation**: Add --target as a fourth bypass condition in the no-op gate — if --target is explicitly provided, the gate never fires (the existing file may have been scanned from a different workspace, so freshness is irrelevant).

## Round 3
- **Score**: 224/224 (kept)
- **Failures**: none
- **Per-criteria**: Default Behavior: 16/16, Depth Differentiation: 16/16, Refresh Logic: 16/16, Targeted Scans: 16/16, Output Specification: 16/16, Implicit No-Op: 16/16, Tool Requirements: 16/16, Scope Definition: 16/16, Error Handling (Permissions): 16/16, Error Handling (Invalid Target): 16/16, Argument Clarity: 16/16, Conditional Execution: 16/16, No-Op Gate Precedence: 16/16, Input/Output Path Separation: 16/16
