# Autoresearch Changelog: onboarding-kickoff

## Round 0
- **Score**: 9/36 (baseline)
- **Failures**: S1: Task Completion, S1: Tool Usage, S1: Instructions Clarity, S1: Completeness, S2: Task Completion, S2: Error Handling, S2: Output Quality, S2: Instructions Clarity, S2: Completeness, S3: Task Completion, S3: Error Handling, S3: Tool Usage, S3: Instructions Clarity, S3: Completeness, S4: Task Completion, S4: Error Handling, S4: Output Quality, S4: Instructions Clarity, S4: Completeness, S5: Task Completion, S5: Tool Usage, S5: Instructions Clarity, S5: Completeness, S6: Task Completion, S6: Tool Usage, S6: Instructions Clarity, S6: Completeness
- **Per-criteria**: Task Completion: 0/6, Error Handling: 3/6, Output Quality: 4/6, Tool Usage: 2/6, Instructions Clarity: 0/6, Completeness: 0/6

## Round 1 — Mutation Applied
- **Mutation**: Add an explicit "When Invoked" execution section that tells Claude exactly what actions to take step-by-step, fixing the widespread Instructions Clarity and Completeness failures caused by the skill describing scripts but not directing Claude's actual behavior.

## Round 2 — Mutation Applied
- **Mutation**: Add concrete Bash commands for Steps 5, 6, and 7 (which currently have none), and wire the full orchestration script to handle the complete workflow so Claude has explicit tool calls for every step.

## Round 2
- **Score**: 14/36 (kept)
- **Failures**: S1: Task Completion, S1: Tool Usage, S1: Instructions Clarity, S1: Completeness, S3: Task Completion, S3: Tool Usage, S3: Instructions Clarity, S3: Completeness, S4: Task Completion, S4: Error Handling, S4: Tool Usage, S4: Instructions Clarity, S4: Completeness, S5: Task Completion, S5: Tool Usage, S5: Instructions Clarity, S5: Completeness, S6: Task Completion, S6: Output Quality, S6: Tool Usage, S6: Instructions Clarity, S6: Completeness
- **Per-criteria**: Task Completion: 1/6, Error Handling: 5/6, Output Quality: 5/6, Tool Usage: 1/6, Instructions Clarity: 1/6, Completeness: 1/6

## Round 3 — Mutation Applied
- **Mutation**: Replace `{placeholder}` syntax with explicit `$VARIABLE` style and add a bold imperative "RUN THIS NOW" framing to each step, making it unambiguous that Claude must substitute real values and execute via Bash tool immediately.

## Round 3
- **Score**: 21/36 (kept)
- **Failures**: S1: Output Quality, S1: Instructions Clarity, S1: Completeness, S2: Task Completion, S2: Output Quality, S2: Completeness, S3: Error Handling, S3: Completeness, S4: Task Completion, S4: Output Quality, S4: Instructions Clarity, S4: Completeness, S5: Output Quality, S5: Instructions Clarity, S5: Completeness
- **Per-criteria**: Task Completion: 4/6, Error Handling: 5/6, Output Quality: 2/6, Tool Usage: 6/6, Instructions Clarity: 3/6, Completeness: 1/6

## Round 4 — Mutation Applied
- **Mutation**: Add a prominent "EXECUTE ALL 7 STEPS WITHOUT PAUSING" directive at the top and restructure the process section into an explicit numbered execution checklist that requires Claude to confirm each step ran before moving to the next, preventing premature completion.

## Round 4
- **Score**: 34/36 (kept)
- **Failures**: S5: Output Quality, S5: Instructions Clarity
- **Per-criteria**: Task Completion: 6/6, Error Handling: 6/6, Output Quality: 5/6, Tool Usage: 6/6, Instructions Clarity: 5/6, Completeness: 6/6

## Round 5 — Mutation Applied
- **Mutation**: Annotate the JSON output template with explicit source comments for each field so Claude substitutes actual runtime values instead of the example placeholders.

## Round 6 — Mutation Applied
- **Mutation**: Replace "Confirm the query string to the user" in Step 1 with "Display the query string as an informational note" — the word "confirm" creates an ambiguous pause point that contradicts the no-confirmation directive, likely causing Task Completion/Completeness failures in scenarios where Claude waits for acknowledgment before proceeding.

## Round 7 — Mutation Applied
- **Mutation**: Clarify that the "0 leads found" fatal stop condition still requires outputting the JSON summary with error details before stopping — "Stop and report error" is ambiguous and likely causes Claude to skip the required JSON output.

## Round 7
- **Score**: 36/36 (kept)
- **Failures**: none
- **Per-criteria**: Task Completion: 6/6, Error Handling: 6/6, Output Quality: 6/6, Tool Usage: 6/6, Instructions Clarity: 6/6, Completeness: 6/6

## Round 8 — Mutation Applied
- **Mutation**: Add explicit reminder in the JSON output section that `lead_count` must be parsed from Step 2 stdout (not assumed/defaulted), since Output Quality and Instructions Clarity failures in S5 likely stem from Claude using placeholder or estimated values rather than actual stdout-extracted numbers.

## Round 9 — Mutation Applied
- **Mutation**: Add explicit fallback instruction for missing VALUE_PROPOSITION in Step 4 — when omitted, Claude should derive it from SERVICE_TYPE + TARGET_AUDIENCE instead of pausing to ask the user, preventing Task Completion failures when optional inputs aren't provided.

## Round 10 — Mutation Applied
- **Mutation**: No failures detected (36/36 score) — apply a minor defensive clarification to Step 3 to explicitly state the SHEET_URL substitution pattern matches Step 5/7, preventing any future ambiguity about which URL value to use.
