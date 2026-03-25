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

## Round 6 — Mutation Applied
- **Mutation**: Remove the bash variable-capture instruction from Step 2 — let the script print normally so the agent can read its output from the tool result; add a clarifying note that bash tool output is only visible to the agent, not the user.

## Round 7 — Mutation Applied
- **Mutation**: Move the "no code fences" prohibition into the top-level CRITICAL OUTPUT RULE block (alongside the "no early output" rule) so it is encountered before execution begins, rather than buried in Step 6's formatting notes.

## Round 8 — Mutation Applied
- **Mutation**: Add explicit zero-result fallback in Step 3 — if the bash script returns no SKILL lines (empty glob, script error, etc.), the agent must still generate the report with zeroed counts rather than aborting or outputting error prose.

## Round 9 — Mutation Applied
- **Mutation**: Replace the monolithic bash script in Steps 2–3 with a decomposed multi-step loop (list directories, then read/parse each skill's files individually using native tools) to reduce fragility and cognitive load, directly addressing the root cause of data collection failures.

## Round 10 — Mutation Applied
- **Mutation**: Replace the decomposed per-skill native-tool loop (Round 9) with a single fast bash script that collects all skill names, scores, and failure counts in one pass — fixing timeout failures in scenarios 3 and 6 and the cascading data collection failures in scenarios 2, 3, 6.

## Round 11 — Mutation Applied
- **Mutation**: Move stuck detection into the bash script (compare last 3 scores numerically, output a 0/1 flag) instead of embedding a JSON history array in the pipe-delimited output — eliminates fragile JSON-within-pipe parsing that causes status classification failures in scenarios 2, 3, 6.

## Round 12 — Mutation Applied
- **Mutation**: Merge wants.json parsing into the Step 2 bash script (outputting a WANTS|count line), eliminating the separate Read tool call in Step 4 — reducing tool calls from 2 to 1, cutting latency, and giving the agent all data in one atomic result to synthesize in Step 5.

## Round 12
- **Score**: 33/36 (kept)
- **Failures**: S2: Does the report correctly state the total number of skills, and their status (at target, stuck, untested), S2: Does the report list the top 3 skills with the most unresolved failures, S2: Does the report highlight any skills that have recently become 'stuck' or 'plateauing'
- **Per-criteria**: Does the report correctly state the total number of skills, and their status (at target, stuck, untested): 5/6, Does the report list the top 3 skills with the most unresolved failures: 5/6, Does the report include the number of open unmet demands: 6/6, Does the report highlight any skills that have recently become 'stuck' or 'plateauing': 5/6, Is the output formatted in clean, human-readable Markdown: 6/6, Complete its report generation in under 10 seconds: 6/6

## Round 13 — Mutation Applied
- **Mutation**: Swap status classification order in Step 3 so `stuck == 1` is checked before `score >= 0.9`, ensuring skills plateaued at a high score are correctly classified as "Stuck" rather than "At Target".
