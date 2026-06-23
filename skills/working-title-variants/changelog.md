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

## Round 6 — Mutation Applied
- **Mutation**: Replace the hardcoded `.tmp/outliers.json` path in Step 2b Mode B with an explicit reference to "the input file found in Step 1" to eliminate the path mismatch ambiguity.

## Round 7 — Mutation Applied
- **Mutation**: Move crash-recovery instructions inline with Step 2b (where crashes occur) rather than leaving them only in the bottom Error Handling section — the current structure requires the model to mentally connect a crash mid-execution back to a footer section, which likely causes it to skip fallback and fail Task Completion, Error Handling, and Completeness in scenarios 5 and 6.

## Round 8 — Mutation Applied
- **Mutation**: Split Step 3 into two explicit sub-paths — one for when the script ran (read the output file first, then print the table) and one for when variants were generated inline (write the file, then print the table) — eliminating the ambiguity about where variants come from when printing the summary.

## Round 9 — Mutation Applied
- **Mutation**: Apply the meta-analyst's recommended radical simplification — restructure into two mutually exclusive linear plans (Plan A: Script-Based, Plan B: Direct Generation) to eliminate the confusing interwoven Step 2a/2b/2c and Step 3 Path A/B logic.

## Round 10 — Mutation Applied
- **Mutation**: Add file-existence validation in Step A3 — if `.tmp/title-variants.json` is missing or empty after the script runs, treat it as a Plan A failure and switch to Plan B, closing the silent-failure gap that causes Task Completion/Error Handling/Completeness failures in scenarios 2 and 3.

## Round 11 — Mutation Applied
- **Mutation**: Add the expected JSON schema to Step A3 so the model knows which fields to extract from .tmp/title-variants.json when printing the terminal summary, fixing Output Quality and Completeness failures in scenario 3.

## Round 12 — Mutation Applied
- **Mutation**: Add explicit bash exit-code detection to Step A2 commands (using `||` fallback pattern) so the model can programmatically detect script failure rather than relying on ambiguous implicit error interpretation.

## Round 13 — Mutation Applied
- **Mutation**: Rewrite Plan B Step B1 to explicitly reuse the INPUT_FILE already found in Step A1 (if applicable) rather than re-searching, eliminating the ambiguous re-discovery loop that causes all five scenario-2 failures.

## Round 14 — Mutation Applied
- **Mutation**: Rewrite Plan B Step B2 with concrete template-driven examples replacing abstract creative concepts (Reframe Hook, Swap Structure) to make variant generation deterministic and reduce interpretation failures.

## Round 15 — Mutation Applied
- **Mutation**: Add an explicit `cat .tmp/title-variants.json` bash command in Step A3 so the model reads the actual file contents (not a cached/hallucinated value) before printing the terminal summary, fixing Output Quality and Completeness failures in scenario 3.
