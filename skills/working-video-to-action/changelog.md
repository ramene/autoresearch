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

## Round 6 — Mutation Applied
- **Mutation**: Fix Step 2's environment check to also inspect the actual shell env var (not just .env file), preventing false "MISSING" halts when the key is set in the environment rather than a .env file.

## Round 7 — Mutation Applied
- **Mutation**: Make Steps 5-7 explicit with concrete output format, required presentation structure, and specific next-action options Claude must offer, fixing Instructions Clarity and Completeness failures in scenarios 2, 3, and 5.

## Round 8 — Mutation Applied
- **Mutation**: Add conditional output format in Step 6 — when -q (question mode) was used, present the answer directly rather than forcing the step-extraction structure, fixing Output Quality and Instructions Clarity failures in question-based scenarios.

## Round 9 — Mutation Applied
- **Mutation**: Replace Step 4's 4-row table + separate "Additional flags" list with a single comprehensive 8-row table covering all quick/question/file-output combinations, eliminating the cognitive overhead of cross-referencing two separate instruction blocks.

## Round 10 — Mutation Applied
- **Mutation**: Make full-mode failure auto-retry with --quick (mirroring the existing quick→full auto-retry), removing the asymmetric "suggest" behavior that causes Claude to halt instead of recovering.

## Round 11 — Mutation Applied
- **Mutation**: Clarify the error retry chain to cover all quick-mode failure reasons (not just "no captions"), and add explicit stop conditions so Claude never retries more than once per direction, fixing cascading failures in Error Handling, Task Completion, Instructions Clarity, Output Quality, and Completeness.

## Round 12 — Mutation Applied
- **Mutation**: Clarify that after an auto-retry mode switch, the error handling "inform the user" message is fulfilled by the "Mode used" field in Step 6 (not as a separate message), eliminating the dual-output ambiguity that causes fragmented responses and Instructions Clarity/Completeness failures.

## Round 13 — Mutation Applied
- **Mutation**: Add explicit note in Step 1 that shortened YouTube URLs (youtu.be/...) and YouTube Shorts URLs (/shorts/...) are valid and should be passed as-is to the script, preventing Claude from hesitating or reformatting URLs unnecessarily.
