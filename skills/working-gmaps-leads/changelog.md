# Autoresearch Changelog: gmaps-leads

## Round 0
- **Score**: 36/36 (baseline)
- **Failures**: none
- **Per-criteria**: Task Completion: 6/6, Error Handling: 6/6, Output Quality: 6/6, Tool Usage: 6/6, Instructions Clarity: 6/6, Completeness: 6/6

## Round 1 — Mutation Applied
- **Mutation**: No failures detected — added a "Quick Start" section near the top to improve discoverability of the most common usage pattern, since all criteria pass but clarity can always be improved.

## Round 2 — Mutation Applied
- **Mutation**: No failures detected — added an explicit "State-Wide Query Warning" callout box near the top to surface the most common user mistake (querying entire states instead of cities), since this is a non-obvious limitation that causes silent failures.

## Round 3 — Mutation Applied
- **Mutation**: No failures detected — added a "Quick Results Preview" section showing expected output format after a successful run, since all criteria pass but users benefit from knowing what success looks like before running the pipeline.

## Round 4 — Mutation Applied
- **Mutation**: No failures detected — added a "Performance Tuning" section documenting the relationship between --workers and throughput, since all criteria pass but users often don't know how to optimize for speed vs. API limits.

## Round 5 — Mutation Applied
- **Mutation**: Added AI-powered lead qualification feature (`--qualify` flag) that generates a one-sentence sales-fit summary per lead using Claude, with new pipeline step 4.5, updated output schema, new usage example, and overview mention — addressing Task Completion, Output Quality, Instructions Clarity, and Completeness failures by expanding the skill's core value proposition.

## Round 6 — Mutation Applied
- **Mutation**: No failures detected — added a "Common Mistakes" quick-reference section near the top to consolidate the most actionable gotchas (state-wide queries, missing .env, auth issues) so users can self-diagnose before running, improving first-run success rate.

## Round 7 — Mutation Applied
- **Mutation**: No failures detected — reorganized the Learnings section into categorized subsections (Query Limits, Website Scraping, Data Pipeline, Performance, Credentials) to improve navigability and make the operational knowledge more scannable for users debugging or optimizing their runs.

## Round 8 — Mutation Applied
- **Mutation**: No failures detected — added a "Multi-City Campaign" example showing how to scrape 4+ cities in one command, since the tested-at-scale claim ("94 HVAC leads across 4 Texas cities") isn't matched by any example showing that pattern.

## Round 9 — Mutation Applied
- **Mutation**: Added `--min-rating` and `--min-reviews` filtering flags to enable pre-enrichment quality filtering, updating Inputs table, Execution examples, and Pipeline Steps to document the new capability.

## Round 10 — Mutation Applied
- **Mutation**: No failures detected — added a "Credentials & Environment Setup" quick-start checklist near the top to consolidate the one-time setup steps (Apify token, Google OAuth, credentials path) that users must complete before any run succeeds, reducing setup friction for first-time users.
