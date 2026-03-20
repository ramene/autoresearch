# Autoresearch Changelog: failure-log-analyzer

## Genesis
- Created from want: want-022
- Hypothesis: The system lacks the ability to perform automated root cause analysis on skill failures, leading to a large backlog of unresolved issues and high manual debugging effort from users.
- Score: 1
- Criteria: 6
- Scenarios: 6

## Round 0
- **Score**: 30/36 (baseline)
- **Failures**: S6: Parse the structured log data, S6: Identify the specific tool call or code line that produced the error, S6: Does the hypothesis distinguish between transient (e.g., API timeout) and systemic (e.g., bad prompt) errors, S6: Does the analysis pinpoint the specific evaluation criterion that failed, S6: Is the output a concise summary of the likely cause, S6: Suggest a next step for debugging (e.g., 'rerun with verbose logging', 'examine prompt for ambiguity')
- **Per-criteria**: Parse the structured log data: 5/6, Identify the specific tool call or code line that produced the error: 5/6, Does the hypothesis distinguish between transient (e.g., API timeout) and systemic (e.g., bad prompt) errors: 5/6, Does the analysis pinpoint the specific evaluation criterion that failed: 5/6, Is the output a concise summary of the likely cause: 5/6, Suggest a next step for debugging (e.g., 'rerun with verbose logging', 'examine prompt for ambiguity'): 5/6

## Round 1 — Mutation Applied
- **Mutation**: Add fallback in Step 2 so if round-filtered grep returns no results, the full events.jsonl is loaded instead — preventing cascade failure of all downstream criteria when field name doesn't match exactly.

## Round 2 — Mutation Applied
- **Mutation**: Change Step 2 log ingestion to skip malformed JSON lines and continue with valid events, only aborting if zero lines parse successfully — prevents a single bad log line from cascading to all-criteria failure.

## Round 3 — Mutation Applied
- **Mutation**: Broaden Step 3 failure detection to also recognize tool_result events with error indicators (non-zero exit_code, status:"error", or populated "error" field) so the skill doesn't incorrectly exit via "No Failure Found" when logs use non-standard event_type conventions.

## Round 4 — Mutation Applied
- **Mutation**: Make eval.json optional in Step 1 validation — defer the existence check to Step 4 Case B where it's actually needed, so a missing eval.json no longer causes early abort when the failure is a tool error.

## Round 5 — Mutation Applied
- **Mutation**: In Step 4 Case A, add a preliminary causal chain check that inspects the context event's output before classifying the error — if the preceding tool_result succeeded (exit_code 0) but produced empty/null/error output, shift the root cause hypothesis upstream to that step instead of the crash site.
