# Autoresearch Changelog: create-proposal

## Round 0
- **Score**: 18/36 (baseline)
- **Failures**: S3: Task Completion, S3: Error Handling, S3: Output Quality, S3: Tool Usage, S3: Instructions Clarity, S3: Completeness, S4: Task Completion, S4: Error Handling, S4: Output Quality, S4: Tool Usage, S4: Instructions Clarity, S4: Completeness, S6: Task Completion, S6: Error Handling, S6: Output Quality, S6: Tool Usage, S6: Instructions Clarity, S6: Completeness
- **Per-criteria**: Task Completion: 3/6, Error Handling: 3/6, Output Quality: 3/6, Tool Usage: 3/6, Instructions Clarity: 3/6, Completeness: 3/6

## Round 1 — Mutation Applied
- **Mutation**: Replace the ambiguous dual-method script execution in Step 3 with a single, unambiguous heredoc pattern that explicitly instructs the model to substitute real JSON content — eliminating the `[JSON_CONTENT]` placeholder confusion that causes cascading failures across all criteria.

## Round 2 — Mutation Applied
- **Mutation**: Add WebFetch to allowed-tools and explicitly identify gmail.send_email as an MCP tool call (not a Bash command) to resolve Tool Usage failures caused by ambiguous tool invocation patterns across scenarios.

## Round 2
- **Score**: 30/36 (kept)
- **Failures**: S4: Task Completion, S4: Error Handling, S4: Output Quality, S4: Tool Usage, S4: Instructions Clarity, S4: Completeness
- **Per-criteria**: Task Completion: 5/6, Error Handling: 5/6, Output Quality: 5/6, Tool Usage: 5/6, Instructions Clarity: 5/6, Completeness: 5/6

## Round 3 — Mutation Applied
- **Mutation**: Replace the literal `{{USER_NAME}}` placeholder in the email signature with an instruction to resolve the sender name dynamically (via git config or by asking the user), preventing the placeholder from appearing verbatim in sent emails.

## Round 4 — Mutation Applied
- **Mutation**: Add explicit error handling for script execution failures in Step 4 — instructing the skill to capture non-zero exit codes, display the error to the user, skip the email step, and suggest remediation — fixing the undefined failure path that causes S4 to fail all criteria and S5 to fail Error Handling.

## Round 4
- **Score**: 36/36 (kept)
- **Failures**: none
- **Per-criteria**: Task Completion: 6/6, Error Handling: 6/6, Output Quality: 6/6, Tool Usage: 6/6, Instructions Clarity: 6/6, Completeness: 6/6

## Round 5 — Mutation Applied
- **Mutation**: All criteria show 0 failures — the skill is passing perfectly. No mutation needed; return the skill unchanged.

## Round 6 — Mutation Applied
- **Mutation**: All criteria show 0 failures — the skill is passing perfectly. No mutation needed; return the skill unchanged.

## Round 7 — Mutation Applied
- **Mutation**: All criteria show 1 failure each across 3 scenarios — this pattern suggests a subtle regression. Adding explicit HTML entity escaping guidance for ampersands in email content to prevent invalid HTML that could cause email sending failures.

## Round 8 — Mutation Applied
- **Mutation**: All criteria show 0 failures — the skill is passing perfectly. No mutation needed; return the skill unchanged.

## Round 9 — Mutation Applied
- **Mutation**: Add Step 0 for input normalization and pre-validation to handle messy/unstructured inputs and validate financial values before proceeding, following the meta-analyst's recommended strategy.

## Round 10 — Mutation Applied
- **Mutation**: All criteria show 0 failures — the skill is passing perfectly. No mutation needed; return the skill unchanged.

## Round 11 — Mutation Applied
- **Mutation**: All criteria show 0 failures — the skill is passing perfectly. No mutation needed; return the skill unchanged.

## Round 12 — Mutation Applied
- **Mutation**: All criteria show 0 failures — the skill is passing perfectly. No mutation needed; return the skill unchanged.

## Round 13 — Mutation Applied
- **Mutation**: All criteria show 0 failures — the skill is passing perfectly. No mutation needed; return the skill unchanged.

## Round 14 — Mutation Applied
- **Mutation**: Enhanced Step 5 email opening to require personalization based on Client Research Summary from Step 2, carrying research context forward into email generation.

## Round 15 — Mutation Applied
- **Mutation**: No failures detected — skill is passing perfectly; returning unchanged.
