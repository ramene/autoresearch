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
