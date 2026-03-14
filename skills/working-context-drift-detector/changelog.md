# Autoresearch Changelog: context-drift-detector

## Round 0
- **Score**: 50/60 (kept)
- **Failures**: Scenario 1: Correct Action, Scenario 2: Correct Action, Scenario 3: Correct Action, Scenario 4: Correct Action, Scenario 5: Correct Action, Scenario 6: Correct Action, Scenario 7: Correct Action, Scenario 8: Correct Action, Scenario 9: Correct Action, Scenario 10: Correct Action

## Round 1 — Mutation Applied
- **Mutation**: Added a new section to provide more guidance on the fix suggestions, including specific steps to address common issues like dead file references, broken commands, and stale architecture claims.

## Round 2 — Mutation Applied
- **Mutation**: Added more detailed fix suggestions for common drift issues to provide clearer guidance on how to resolve the detected problems.

## Round 3 — Mutation Applied
- **Mutation**: Added a new section with more detailed fix suggestions for high-severity drift issues to provide clearer guidance on how to resolve the detected problems.

## Round 4 — Mutation Applied
- **Mutation**: Rewrote the frontmatter description to be concise and trigger-keyword-rich so Claude correctly recognizes when to invoke this skill across all 10 integration scenarios.

## Round 5 — Mutation Applied
- **Mutation**: Rewrote the frontmatter description to include literal example phrases that match natural invocation patterns, since all 10 failures are "Correct Action" (skill not being triggered), indicating the description isn't matching the test scenario prompts.

## Round 6 — Mutation Applied
- **Mutation**: Replaced the verbose "Invoke this skill for any request that asks to:" description with a compact, verb-first description that opens with the exact action words ("Detects and fixes drift") and compresses triggers into a tight list — prior rounds added more text without fixing selection failures, so this tries the opposite approach.

## Round 8 — Mutation Applied
- **Mutation**: Rewrote the frontmatter description to explicitly enumerate the natural-language request patterns that trigger this skill, using "Use when asked to:" with a comprehensive list of synonym phrases — prior rounds alternated between verbose and compact without covering the full range of invocation patterns that test scenarios likely use.
