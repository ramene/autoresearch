# Autoresearch Changelog: classify-leads

## Round 0
- **Score**: 14/36 (baseline)
- **Failures**: S2: Error Handling, S2: Output Quality, S2: Instructions Clarity, S2: Completeness, S3: Error Handling, S3: Instructions Clarity, S3: Completeness, S4: Task Completion, S4: Error Handling, S4: Output Quality, S4: Tool Usage, S4: Instructions Clarity, S4: Completeness, S5: Tool Usage, S5: Instructions Clarity, S5: Completeness, S6: Task Completion, S6: Error Handling, S6: Output Quality, S6: Tool Usage, S6: Instructions Clarity, S6: Completeness
- **Per-criteria**: Task Completion: 4/6, Error Handling: 2/6, Output Quality: 3/6, Tool Usage: 3/6, Instructions Clarity: 1/6, Completeness: 1/6

## Round 1
- **Score**: 17/36 (kept)
- **Failures**: S2: Error Handling, S2: Output Quality, S2: Instructions Clarity, S2: Completeness, S3: Error Handling, S3: Instructions Clarity, S3: Completeness, S4: Task Completion, S4: Error Handling, S4: Output Quality, S4: Tool Usage, S4: Instructions Clarity, S4: Completeness, S6: Task Completion, S6: Error Handling, S6: Output Quality, S6: Tool Usage, S6: Instructions Clarity, S6: Completeness
- **Per-criteria**: Task Completion: 4/6, Error Handling: 2/6, Output Quality: 3/6, Tool Usage: 4/6, Instructions Clarity: 2/6, Completeness: 2/6

## Round 2
- **Score**: 19/36 (kept)
- **Failures**: S2: Error Handling, S2: Output Quality, S2: Instructions Clarity, S2: Completeness, S3: Error Handling, S4: Task Completion, S4: Error Handling, S4: Output Quality, S4: Tool Usage, S4: Instructions Clarity, S4: Completeness, S6: Task Completion, S6: Error Handling, S6: Output Quality, S6: Tool Usage, S6: Instructions Clarity, S6: Completeness
- **Per-criteria**: Task Completion: 4/6, Error Handling: 2/6, Output Quality: 3/6, Tool Usage: 4/6, Instructions Clarity: 3/6, Completeness: 3/6

## Round 6 — Mutation Applied
- **Mutation**: Added Error Handling section with explicit failure modes and recovery steps — the skill had no error handling guidance, causing 5/6 scenario failures on that criterion.

## Round 6
- **Score**: 30/36 (kept)
- **Failures**: S6: Task Completion, S6: Error Handling, S6: Output Quality, S6: Tool Usage, S6: Instructions Clarity, S6: Completeness
- **Per-criteria**: Task Completion: 5/6, Error Handling: 5/6, Output Quality: 5/6, Tool Usage: 5/6, Instructions Clarity: 5/6, Completeness: 5/6

## Round 7 — Mutation Applied
- **Mutation**: Added explicit Step-by-Step Workflow section showing the complete end-to-end process (export → verify → classify → review → update sheet), fixing Instructions Clarity and Completeness failures caused by agents not knowing the full prerequisite chain.

## Round 8 — Mutation Applied
- **Mutation**: Clarified that Step 1 (read_sheet.py) is optional when leads are already in a local JSON file, and added a "Direct File Classification" shortcut path — fixing scenario 6's complete failure where agents couldn't handle non-sheet input sources.

## Round 8
- **Score**: 31/36 (kept)
- **Failures**: S3: Instructions Clarity, S3: Completeness, S5: Error Handling, S5: Instructions Clarity, S5: Completeness
- **Per-criteria**: Task Completion: 6/6, Error Handling: 5/6, Output Quality: 6/6, Tool Usage: 6/6, Instructions Clarity: 4/6, Completeness: 4/6

## Round 9 — Mutation Applied
- **Mutation**: Expanded Classification Types section with concrete `--classification_type` values and validation steps for each use case listed in "When to Use", so agents have explicit strings to pass for high-ticket and subscription scenarios instead of guessing.

## Round 9
- **Score**: 36/36 (kept)
- **Failures**: none
- **Per-criteria**: Task Completion: 6/6, Error Handling: 6/6, Output Quality: 6/6, Tool Usage: 6/6, Instructions Clarity: 6/6, Completeness: 6/6

## Round 10 — Mutation Applied
- **Mutation**: Added `mkdir -p .tmp` as an explicit prerequisite before Steps 1/2b to prevent silent FileNotFoundError failures when the `.tmp/` directory doesn't yet exist — a common edge case that produces confusing errors not covered by current error handling.

## Round 11 — Mutation Applied
- **Mutation**: No failures detected (36/36 score) — keeping the skill as-is since all criteria pass perfectly.

## Round 12 — Mutation Applied
- **Mutation**: Added explicit decision criteria to Step 5 clarifying when to run update_sheet.py (Sheet input path only) vs skip it (local file path), preventing agents from either skipping it when needed or running it inappropriately.

## Round 13 — Mutation Applied
- **Mutation**: No failures detected (36/36 score) — keeping the skill as-is since all criteria pass perfectly.

## Round 14 — Mutation Applied
- **Mutation**: Added an explicit "Option B Quick Reference" checklist at the top of the workflow section summarizing all steps for local file input in order, so agents following the non-sheet path have a complete, scannable workflow without having to parse conditional logic throughout.

## Round 15 — Mutation Applied
- **Mutation**: Added an explicit "choose your classification_type" decision block inside Step 3 that maps user intent phrases directly to the correct flag value, so agents don't default to product_saas when the user asked for high-ticket or subscription classification.

## Round 16 — Mutation Applied
- **Mutation**: Replaced the conditional `## Input Options` and `## Step-by-Step Workflow` sections with two distinct, self-contained Path A and Path B workflows to eliminate conditional logic parsing and reduce procedural errors.

## Round 17 — Mutation Applied
- **Mutation**: Added an explicit "Path Selection Decision Block" at the top of Core Workflows with clear, deterministic criteria for choosing Path A vs Path B before any steps execute, eliminating ambiguous path detection that causes cascading failures across Task Completion, Output Quality, Tool Usage, Instructions Clarity, and Completeness.

## Round 18 — Mutation Applied
- **Mutation**: Added explicit "then proceed with Path A/B" directives to the two clarification rows in the Step 0 decision table, so agents don't stall after gathering the user's answer.

## Round 19 — Mutation Applied
- **Mutation**: All criteria pass with 0 failures — keeping the skill as-is since no mutations are needed.
