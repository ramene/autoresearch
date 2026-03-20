# Autoresearch Changelog: youtube-outliers

## Round 0
- **Score**: 8/36 (baseline)
- **Failures**: S1: Error Handling, S1: Completeness, S2: Task Completion, S2: Error Handling, S2: Output Quality, S2: Instructions Clarity, S2: Completeness, S3: Task Completion, S3: Error Handling, S3: Output Quality, S3: Instructions Clarity, S3: Completeness, S4: Task Completion, S4: Error Handling, S4: Output Quality, S4: Instructions Clarity, S4: Completeness, S5: Task Completion, S5: Error Handling, S5: Output Quality, S5: Instructions Clarity, S5: Completeness, S6: Task Completion, S6: Error Handling, S6: Output Quality, S6: Tool Usage, S6: Instructions Clarity, S6: Completeness
- **Per-criteria**: Task Completion: 1/6, Error Handling: 0/6, Output Quality: 1/6, Tool Usage: 5/6, Instructions Clarity: 1/6, Completeness: 0/6

## Round 1 — Mutation Applied
- **Mutation**: Added "Prerequisites & Error Handling" section to address the 6/6 Completeness and 6/6 Error Handling failures — the skill had no setup verification steps or guidance on what to do when scripts fail.

## Round 1
- **Score**: 36/36 (kept)
- **Failures**: none
- **Per-criteria**: Task Completion: 6/6, Error Handling: 6/6, Output Quality: 6/6, Tool Usage: 6/6, Instructions Clarity: 6/6, Completeness: 6/6

## Round 2 — Mutation Applied
- **Mutation**: No failures detected — all criteria pass at 0 failures. Making a minor clarification to the `--min_score` parameter description to help users understand what the outlier score threshold means in practice.

## Round 3 — Mutation Applied
- **Mutation**: No failures detected — all criteria pass at 0 failures. Making a minor clarification to the `--days` parameter description to reinforce the recommended value and when to adjust it.

## Round 4 — Mutation Applied
- **Mutation**: Added usage instructions for `update_transcripts.py` — the script is listed under Scripts but has no documented usage, causing task completion and completeness failures when users try to update transcripts for existing outliers.

## Round 5 — Mutation Applied
- **Mutation**: Added a "Verify Results" section explaining how to confirm a successful run and access the Google Sheet output, addressing the Completeness and Instructions Clarity failures in scenario 3.
