# Autoresearch Changelog: instantly-campaigns

## Round 0
- **Score**: 27/36 (baseline)
- **Failures**: S2: Instructions Clarity, S3: Error Handling, S3: Completeness, S4: Task Completion, S4: Output Quality, S4: Completeness, S5: Output Quality, S5: Completeness, S6: Completeness
- **Per-criteria**: Task Completion: 5/6, Error Handling: 5/6, Output Quality: 4/6, Tool Usage: 6/6, Instructions Clarity: 5/6, Completeness: 2/6

## Round 1 — Mutation Applied
- **Mutation**: Added Step 4 (Verify & Confirm) to the Process section with explicit completion criteria, so the agent knows what "done" looks like and doesn't stop prematurely after script execution.

## Round 2 — Mutation Applied
- **Mutation**: Replaced the passive "Edge Cases" section with an active "Error Recovery Protocol" that gives the agent step-by-step tool actions (not just script behavior descriptions) when errors occur, including how to diagnose failures and what to do next.

## Round 3 — Mutation Applied
- **Mutation**: Rewrote "Review Output" (Step 3) to explicitly capture script stdout into a variable, parse the JSON, and immediately trigger Error Recovery Protocol if status != "success" or campaigns_created != 3 — eliminating blind success reporting.

## Round 3
- **Score**: 29/36 (kept)
- **Failures**: S3: Completeness, S6: Task Completion, S6: Error Handling, S6: Output Quality, S6: Tool Usage, S6: Instructions Clarity, S6: Completeness
- **Per-criteria**: Task Completion: 5/6, Error Handling: 5/6, Output Quality: 5/6, Tool Usage: 5/6, Instructions Clarity: 5/6, Completeness: 4/6

## Round 4 — Mutation Applied
- **Mutation**: Moved offer generation from Error Recovery Step 5 into the main Process as Step 2 (pre-flight), so the agent always generates offers before running the script when none are provided — preventing incomplete runs from missing inputs.

## Round 5 — Mutation Applied
- **Mutation**: Merged Steps 3 and 4 into a single "Run & Capture Output" step that executes the script exactly once with stderr captured, eliminating the duplicate execution that caused confusion about which run's output to inspect.

## Round 6 — Mutation Applied
- **Mutation**: Added a pre-flight working directory check as Step 0 that verifies the scripts directory exists before proceeding, so relative path failures are caught immediately with a clear error message instead of cascading silently.

## Round 6
- **Score**: 34/36 (kept)
- **Failures**: S3: Error Handling, S3: Completeness
- **Per-criteria**: Task Completion: 6/6, Error Handling: 5/6, Output Quality: 6/6, Tool Usage: 6/6, Instructions Clarity: 6/6, Completeness: 5/6

## Round 7 — Mutation Applied
- **Mutation**: Added explicit total failure (0/3 campaigns) reporting template to Error Recovery Protocol Step 4, mirroring the partial success template so the agent has a clear output format for complete script failures instead of producing incomplete/inconsistent output.

## Round 8 — Mutation Applied
- **Mutation**: Made Step 3's script command explicitly reference the offers prepared in Step 2 by replacing the generic placeholder with a note that the EXACT offer text from Step 2 must be substituted — preventing the agent from passing literal "Offer 1|Offer 2|Offer 3" strings to the script.

## Round 9 — Mutation Applied
- **Mutation**: Fixed Error Recovery Step 3 to explicitly use the actual offer text from Step 2 (not placeholder strings), mirroring the same fix applied to the main Step 3 in Round 8.

## Round 10 — Mutation Applied
- **Mutation**: Rename Error Recovery Protocol numbered steps to lettered stages (A, B, C, D) to eliminate namespace collision with the main Process's Step 0–4 numbering, preventing agents from conflating "Step 2" in error recovery with "Step 2" in the main flow.

## Round 11 — Mutation Applied
- **Mutation**: Add an input validation step before Step 0 that stops and asks for the required client description if missing (fixes edge-empty) and truncates oversized description/offers to safe lengths (fixes edge-large), preventing the script from being called with empty or malformed arguments.

## Round 11
- **Score**: 36/36 (kept)
- **Failures**: none
- **Per-criteria**: Task Completion: 6/6, Error Handling: 6/6, Output Quality: 6/6, Tool Usage: 6/6, Instructions Clarity: 6/6, Completeness: 6/6

## Round 12 — Mutation Applied
- **Mutation**: Added a brief clarifying note to the Process section header distinguishing the two pre-flight steps (-1 and 0) from the main 3-step workflow, reducing any potential confusion about the unusual negative step numbering.

## Round 13 — Mutation Applied
- **Mutation**: Added explicit note to Step -1 header clarifying it involves no API calls or script execution — pure input validation only — to eliminate any ambiguity about what operations are permitted before environment checks pass.

## Round 14 — Mutation Applied
- **Mutation**: Added explicit guidance in Step 3 to derive --target_audience and --social_proof from the client description when the user hasn't provided them, preventing blank/empty arguments from reaching the script.

## Round 15 — Mutation Applied
- **Mutation**: All criteria scored 36/36 with zero failures — no mutation needed. Returning the skill unchanged to preserve its perfect score.
