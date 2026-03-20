# Autoresearch Changelog: title-variants

## Round 1 — Mutation Applied
- **Mutation**: Added a direct fallback generation path so Claude generates title variants itself when scripts are missing/failing — this fixes Task Completion, Error Handling, and Tool Usage all at once since all scenarios likely fail due to missing script files.

## Round 1
- **Score**: 33/36 (kept)
- **Failures**: S1: Instructions Clarity, S5: Instructions Clarity, S6: Instructions Clarity
- **Per-criteria**: Task Completion: 6/6, Error Handling: 6/6, Output Quality: 6/6, Tool Usage: 6/6, Instructions Clarity: 3/6, Completeness: 6/6

## Round 2 — Mutation Applied
- **Mutation**: Restructure Step 2 as an explicit decision tree with numbered sub-steps to eliminate ambiguity about when to use scripts vs. direct generation — the current "if/if" parallel blocks require inference about execution order, which is causing clarity failures.

## Round 3 — Mutation Applied
- **Mutation**: Make Step 1's post-check decision logic explicit — currently the bash check runs but the skill never states what to DO based on the result (use the file vs. ask user), causing Instructions Clarity failures in scenarios 1 and 6.

## Round 3
- **Score**: 35/36 (kept)
- **Failures**: S1: Instructions Clarity
- **Per-criteria**: Task Completion: 6/6, Error Handling: 6/6, Output Quality: 6/6, Tool Usage: 6/6, Instructions Clarity: 5/6, Completeness: 6/6

## Round 4 — Mutation Applied
- **Mutation**: Clarify Step 2b's Mode A vs Mode B selection — the skill lists both modes but never specifies which to choose, leaving an ambiguous decision point that causes Instructions Clarity failures.

## Round 5 — Mutation Applied
- **Mutation**: Add explicit "then proceed to Step 3" instruction after Step 2c and clarify the terminal summary table format — scenarios 2 and 3 share Instructions Clarity and Completeness failures, likely because the direct generation path in 2c doesn't state it must still write the JSON file and print the table.
