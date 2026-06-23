# Autoresearch Changelog: gmail

## Round 0
- **Score**: 36/36 (baseline)
- **Failures**: none
- **Per-criteria**: Task Completion: 6/6, Error Handling: 6/6, Output Quality: 6/6, Tool Usage: 6/6, Instructions Clarity: 6/6, Completeness: 6/6

## Round 1 — Mutation Applied
- **Mutation**: No failures detected — replaced placeholder email in "Forward to sponsorships" quick action with a clearer placeholder marker to make the demo library nature more obvious and consistent.

## Round 2 — Mutation Applied
- **Mutation**: Add explicit "Account Selection" guidance explaining how to infer or choose the right account when the user doesn't specify one, including a designated default account and context-inference rules.

## Round 3 — Mutation Applied
- **Mutation**: Add a `--forward` command example to the Quick Reference section, since the "Forward to sponsorships" action describes the intent but the script usage for forwarding is never demonstrated anywhere in the skill.

## Round 4 — Mutation Applied
- **Mutation**: Add fallback handling to the "Forward to sponsorships" quick action — if {{SPONSORSHIPS_EMAIL}} is still a placeholder, prompt the user for the address rather than attempting to forward to an unresolved value.

## Round 5 — Mutation Applied
- **Mutation**: Restructure skill to lead with a consolidated Core Command Reference table and usage patterns (Structure over Prose strategy), moving Tone of Voice to the bottom as secondary guidance.

## Round 5
- **Score**: 36/36 (kept)
- **Failures**: none
- **Per-criteria**: Task Completion: 6/6, Error Handling: 6/6, Output Quality: 6/6, Tool Usage: 6/6, Instructions Clarity: 6/6, Completeness: 6/6

## Round 6 — Mutation Applied
- **Mutation**: No failures detected — replaced placeholder `{{USER_NAME}}` in Tone of Voice section with a clearer placeholder marker to maintain consistency with the demo library pattern.

## Round 7 — Mutation Applied
- **Mutation**: No failures detected — added a `--json` flag example to the Common Usage Patterns section to demonstrate its utility for programmatic parsing, making the skill more complete for advanced users.

## Round 8 — Mutation Applied
- **Mutation**: Remove the "Demo Library Skill" warning banner that signals the skill is broken/unready, replacing it with a concise inline note in the Account Registry where placeholders actually appear, so the skill reads as operational by default.

## Round 9 — Mutation Applied
- **Mutation**: Replace all `{{USER_NAME}}` placeholder references in Tone of Voice with "the user" and remove the meta-note instructing replacement, so the skill is operational as-written without requiring pre-deployment edits.

## Round 10 — Mutation Applied
- **Mutation**: Consolidate Account Registry and Account Selection Logic into a single unified Account Reference table per the meta-analyst's recommendation, reducing redundancy and improving decision clarity.
