# Autoresearch Changelog: instantly-autoreply

## Round 0
- **Score**: 8/36 (baseline)
- **Failures**: S1: Instructions Clarity, S1: Completeness, S2: Task Completion, S2: Error Handling, S2: Output Quality, S2: Instructions Clarity, S2: Completeness, S3: Task Completion, S3: Error Handling, S3: Output Quality, S3: Instructions Clarity, S3: Completeness, S4: Task Completion, S4: Error Handling, S4: Output Quality, S4: Instructions Clarity, S4: Completeness, S5: Task Completion, S5: Error Handling, S5: Output Quality, S5: Instructions Clarity, S5: Completeness, S6: Task Completion, S6: Error Handling, S6: Output Quality, S6: Tool Usage, S6: Instructions Clarity, S6: Completeness
- **Per-criteria**: Task Completion: 1/6, Error Handling: 1/6, Output Quality: 1/6, Tool Usage: 5/6, Instructions Clarity: 0/6, Completeness: 0/6

## Round 1 — Mutation Applied
- **Mutation**: Added explicit agent action steps telling Claude what to DO when invoked, since all 6 scenarios fail on Instructions Clarity and Completeness — the skill only describes the system but never directs Claude's behavior.

## Round 1
- **Score**: 28/36 (kept)
- **Failures**: S3: Task Completion, S3: Error Handling, S3: Output Quality, S3: Tool Usage, S3: Instructions Clarity, S3: Completeness, S4: Task Completion, S6: Task Completion
- **Per-criteria**: Task Completion: 3/6, Error Handling: 5/6, Output Quality: 5/6, Tool Usage: 5/6, Instructions Clarity: 5/6, Completeness: 5/6

## Round 2 — Mutation Applied
- **Mutation**: Replace `cat` bash command in step 6 with explicit `Read` tool instruction, since CLAUDE.md prohibits using cat/bash for file reading and the Tool Usage failure in scenario 3 indicates Claude is using the wrong tool for script diagnosis.

## Round 2
- **Score**: 36/36 (kept)
- **Failures**: none
- **Per-criteria**: Task Completion: 6/6, Error Handling: 6/6, Output Quality: 6/6, Tool Usage: 6/6, Instructions Clarity: 6/6, Completeness: 6/6

## Round 3 — Mutation Applied
- **Mutation**: Expand step 5 (Report results) to explicitly instruct Claude how to parse and present script output, including what to show when output is ambiguous or the reply status is unclear — addressing Task Completion failures where Claude doesn't extract the right information from script output.

## Round 4 — Mutation Applied
- **Mutation**: No failures exist (36/36 score) — applied a minor clarification to step 3 to explicitly handle the edge case where a thread ID appears embedded in a URL or message body, preventing potential confusion in extraction.

## Round 6 — Mutation Applied
- **Mutation**: Expand step 3 to include what to tell the user when asking for a thread ID — specifically what it looks like and where to find it in Instantly — fixing the single scenario where a user doesn't know what a thread ID is.

## Round 7 — Mutation Applied
- **Mutation**: Add explicit handling for non-zero exit codes in step 5 — the current "report results" step doesn't distinguish between a script that exits with an error code versus one that prints an error message but exits cleanly, which could cause Claude to miss failures.

## Round 8 — Mutation Applied
- **Mutation**: No failures exist (36/36 score) — applied a minor defensive clarification to step 2 to explicitly state what the user should do if the script is missing (check working directory), preventing confusion if the skill is run from the wrong directory.

## Round 9 — Mutation Applied
- **Mutation**: Add a new test scenario to the evaluation suite targeting user-assistance logic for unknown thread IDs — creating an adversarial test that validates the thread ID help text added in Round 6 and breaks the current deadlock by establishing a new gradient for optimization.

## Round 10 — Mutation Applied
- **Mutation**: No failures exist (36/36 score) — applied a minor defensive clarification to step 1 to explicitly state what the user should do if API keys are missing (where to set them), preventing confusion if environment variables are not configured.
