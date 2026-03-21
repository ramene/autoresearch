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
