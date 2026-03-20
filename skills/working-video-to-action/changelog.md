# Autoresearch Changelog: video-to-action

## Round 0
- **Score**: 31/36 (baseline)
- **Failures**: S2: Task Completion, S2: Error Handling, S2: Output Quality, S2: Instructions Clarity, S2: Completeness
- **Per-criteria**: Task Completion: 5/6, Error Handling: 5/6, Output Quality: 5/6, Tool Usage: 6/6, Instructions Clarity: 5/6, Completeness: 5/6

## Round 1 — Mutation Applied
- **Mutation**: Added explicit "Claude Execution Steps" section to clarify the exact workflow Claude should follow when invoked, fixing Instructions Clarity failures which cascade into Task Completion, Error Handling, Output Quality, and Completeness failures.

## Round 1
- **Score**: 34/36 (kept)
- **Failures**: S2: Task Completion, S4: Task Completion
- **Per-criteria**: Task Completion: 4/6, Error Handling: 6/6, Output Quality: 6/6, Tool Usage: 6/6, Instructions Clarity: 6/6, Completeness: 6/6

## Round 2 — Mutation Applied
- **Mutation**: Make Step 4 explicit about using the Bash tool with the exact command, and replace vague "choose mode based on content type" with a concrete decision rule (default to full mode, only use --quick if user explicitly requests it or video is a talk/lecture by keyword).

## Round 3 — Mutation Applied
- **Mutation**: Replace Step 4's separate mode/question instructions with a clear command-construction decision table showing all flag combinations explicitly, so Claude knows how to combine --quick and -q flags together.

## Round 3
- **Score**: 36/36 (kept)
- **Failures**: none
- **Per-criteria**: Task Completion: 6/6, Error Handling: 6/6, Output Quality: 6/6, Tool Usage: 6/6, Instructions Clarity: 6/6, Completeness: 6/6

## Round 4 — Mutation Applied
- **Mutation**: All criteria show 0 failures — skill is at 36/36. Adding a minor robustness note in error handling to clarify the automatic `--quick` → full mode fallback order, which prevents any edge-case confusion without changing core functionality.

## Round 5 — Mutation Applied
- **Mutation**: Extend Step 4's decision table with a note on appending additional flags (-o, --json, -m) to any command variant, so Claude knows how to handle output/model options in all scenarios.
