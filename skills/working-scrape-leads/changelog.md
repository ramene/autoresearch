# Autoresearch Changelog: scrape-leads

## Round 0
- **Score**: 36/36 (baseline)
- **Failures**: none
- **Per-criteria**: Task Completion: 6/6, Error Handling: 6/6, Output Quality: 6/6, Tool Usage: 6/6, Instructions Clarity: 6/6, Completeness: 6/6

## Round 1 — Mutation Applied
- **Mutation**: Fix missing space between `--output_prefix` flag and its value in all bash command examples (currently `--output_prefixactive/...` which would fail at runtime).

## Round 2 — Mutation Applied
- **Mutation**: No failures to fix — all criteria at 100%. Applied a minor clarity improvement to the Self-Annealing Notes section to explicitly call out the `--no-email-filter` flag as required for test and full scrapes to avoid runtime errors from missing email filter configuration.

## Round 3 — Mutation Applied
- **Mutation**: No failures to fix — all criteria at 100%. Applied a minor clarity improvement to the Edge Cases section to explicitly document the `--location` format requirement inline where location is discussed (Step 2 and Step 5), rather than only in Self-Annealing Notes, reducing the chance of location format errors during scraping.

## Round 4 — Mutation Applied
- **Mutation**: Fix Step 7 to explicitly handle both cases — use `classified_leads.json` when Step 6 was run, or `leads_final.json` when Step 6 was skipped — preventing upload failures when LLM classification is not performed.

## Round 5 — Mutation Applied
- **Mutation**: Restructure instructions by adding a "Critical Command Parameters" table after the Inputs section and removing redundant Note blocks from Steps 2 and 5 to reduce cognitive load and consolidate authoritative parameter references.
