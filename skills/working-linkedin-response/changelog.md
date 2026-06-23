# Autoresearch Changelog: linkedin-response

## Round 0
- **Score**: 28/36 (baseline)
- **Failures**: S2: Error Handling, S2: Instructions Clarity, S2: Completeness, S4: Task Completion, S4: Error Handling, S4: Output Quality, S4: Tool Usage, S4: Completeness
- **Per-criteria**: Task Completion: 5/6, Error Handling: 4/6, Output Quality: 5/6, Tool Usage: 5/6, Instructions Clarity: 5/6, Completeness: 4/6

## Round 1 — Mutation Applied
- **Mutation**: Added explicit DOM error recovery procedures for failed evaluate_script calls (no editor, no send button, no reaction toolbar) to fix Error Handling and Completeness failures in scenarios 2 and 4.

## Round 1
- **Score**: 32/36 (kept)
- **Failures**: S2: Task Completion, S2: Error Handling, S2: Instructions Clarity, S2: Completeness
- **Per-criteria**: Task Completion: 5/6, Error Handling: 5/6, Output Quality: 6/6, Tool Usage: 6/6, Instructions Clarity: 5/6, Completeness: 5/6

## Round 2 — Mutation Applied
- **Mutation**: Replace vague "find profile link" last-sender detection with a concrete evaluate_script snippet that returns the last sender's name, plus a fallback procedure when it can't be determined — fixing Instructions Clarity, Task Completion, Error Handling, and Completeness for scenario 2.

## Round 2
- **Score**: 36/36 (kept)
- **Failures**: none
- **Per-criteria**: Task Completion: 6/6, Error Handling: 6/6, Output Quality: 6/6, Tool Usage: 6/6, Instructions Clarity: 6/6, Completeness: 6/6

## Round 3 — Mutation Applied
- **Mutation**: Harmonized the "unknown" last-sender fallback report message in Selection Logic to exactly match the DOM Error Recovery section's wording, ensuring consistent operator-facing language and reducing ambiguity for edge cases.

## Round 4 — Mutation Applied
- **Mutation**: Clarify the "Mark as unread" DOM section to handle both cases: marking from the conversation list (when you haven't opened it yet) and from within an already-open thread (add the thread-header options path as a fallback), fixing the Instructions Clarity and Completeness gaps for Cat 3 execution.

## Round 5 — Mutation Applied
- **Mutation**: Clarify Cat 2 hover step to explicitly identify the other person's last message UID in the snapshot (not {{USER_NAME}}'s), reducing ambiguity when multiple messages appear in the thread.
