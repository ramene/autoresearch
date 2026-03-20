# Autoresearch Changelog: system-status-reporter

## Genesis
- Created from want: want-024
- Hypothesis: The system cannot summarize its own complex state, hindering observability. High user demand for 'dashboards' indicates a need for a skill that can synthesize and report on key system metrics.
- Score: 0.81
- Criteria: 6
- Scenarios: 6

## Round 0
- **Score**: 26/36 (baseline)
- **Failures**: S2: Does the report correctly state the total number of skills, and their status (at target, stuck, untested), S2: Does the report list the top 3 skills with the most unresolved failures, S3: Does the report correctly state the total number of skills, and their status (at target, stuck, untested), S3: Does the report list the top 3 skills with the most unresolved failures, S3: Does the report include the number of open unmet demands, S3: Does the report highlight any skills that have recently become 'stuck' or 'plateauing', S6: Does the report correctly state the total number of skills, and their status (at target, stuck, untested), S6: Does the report list the top 3 skills with the most unresolved failures, S6: Does the report include the number of open unmet demands, S6: Does the report highlight any skills that have recently become 'stuck' or 'plateauing'
- **Per-criteria**: Does the report correctly state the total number of skills, and their status (at target, stuck, untested): 3/6, Does the report list the top 3 skills with the most unresolved failures: 3/6, Does the report include the number of open unmet demands: 4/6, Does the report highlight any skills that have recently become 'stuck' or 'plateauing': 4/6, Is the output formatted in clean, human-readable Markdown: 6/6, Complete its report generation in under 10 seconds: 6/6

## Round 1 — Mutation Applied
- **Mutation**: Fix Step 3c grep command to use the actual skill directory path variable instead of the literal placeholder "path/to/skill/events.jsonl", so failure counts are correctly read from each skill's events.jsonl.

## Round 2 — Mutation Applied
- **Mutation**: Replace the per-skill iteration in Steps 2-3 with a single comprehensive bash script that collects all skill names, eval scores, and failure counts in one pass — ensuring accurate total counts and complete failure data for ranking.

## Round 3 — Mutation Applied
- **Mutation**: Update the bash script in Step 2 to fall back to `rounds.json` when `eval.json` is missing, extracting score from the latest round entry — fixing the root cause of widespread null scores that corrupt skill counts and failure rankings.

## Round 3
- **Score**: 28/36 (kept)
- **Failures**: S2: Does the report correctly state the total number of skills, and their status (at target, stuck, untested), S2: Does the report list the top 3 skills with the most unresolved failures, S2: Does the report highlight any skills that have recently become 'stuck' or 'plateauing', S2: Is the output formatted in clean, human-readable Markdown, S3: Is the output formatted in clean, human-readable Markdown, S4: Does the report highlight any skills that have recently become 'stuck' or 'plateauing', S4: Is the output formatted in clean, human-readable Markdown, S6: Is the output formatted in clean, human-readable Markdown
- **Per-criteria**: Does the report correctly state the total number of skills, and their status (at target, stuck, untested): 5/6, Does the report list the top 3 skills with the most unresolved failures: 5/6, Does the report include the number of open unmet demands: 6/6, Does the report highlight any skills that have recently become 'stuck' or 'plateauing': 4/6, Is the output formatted in clean, human-readable Markdown: 2/6, Complete its report generation in under 10 seconds: 6/6

## Round 4 — Mutation Applied
- **Mutation**: Add explicit instruction in Step 2 that bash output must be captured into a variable (not printed), and in Step 7 that the formatted markdown report must be the ONLY thing output to the console.

## Round 5 — Mutation Applied
- **Mutation**: Add a top-level "NO EARLY OUTPUT" rule to Execution Steps and rewrite Step 1 to explicitly forbid any console output until Step 7 — fixing the root cause of markdown formatting failures where acknowledgment text or debug output precedes or contaminates the report.
