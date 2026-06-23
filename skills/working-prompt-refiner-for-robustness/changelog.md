# Autoresearch Changelog: prompt-refiner-for-robustness

## Genesis
- Created from want: want-022
- Hypothesis: Fundamental reasoning capabilities like following instructions, ensuring task completion, and handling errors are weak across multiple skills, suggesting a systemic issue with prompt engineering that requires a targeted solution.
- Score: 0.81
- Criteria: 6
- Scenarios: 6

## Round 0
- **Score**: 36/36 (baseline)
- **Failures**: none
- **Per-criteria**: Identify the weakest part of the input prompt: 6/6, Does the proposed rewrite explicitly address a known failure mode (e.g., ambiguity): 6/6, Add or improve few-shot examples for better guidance: 6/6, Suggest adding explicit instructions for error handling and output formatting: 6/6, Is the refined prompt syntactically correct and ready to be used: 6/6, Can the skill explain why its proposed change should improve performance: 6/6

## Round 1 — Mutation Applied
- **Mutation**: No failures detected (0 failures across all criteria) — skill is performing well; no mutation needed. Making a minimal clarification to the Prerequisites section to distinguish between the `## Execution Steps` section in SKILL.md vs the agent's core prompt, which is the most likely source of future confusion.

## Round 2 — Mutation Applied
- **Mutation**: Since all criteria pass (0 failures), making a minimal clarification to Step 2 to specify exactly what fields to extract from `eval.json` and `rounds.json` — the most likely source of future confusion when these files exist and contain structured failure data.

## Round 3 — Mutation Applied
- **Mutation**: No failures exist (0 across all criteria, score 36/36) — making a minimal clarification to Step 3 to explicitly note that the extracted prompt should preserve all numbered structure and sub-bullets intact, reducing risk of accidental truncation in future edge cases.

## Round 4 — Mutation Applied
- **Mutation**: No failures exist (0 across all criteria, score 36/36) — making a minimal clarification to Step 4 to explicitly note that when both `--focus` criterion and `rounds.json` failure data are available, the focus criterion takes priority but recurring failures from rounds data should be surfaced as secondary weaknesses.

## Round 5 — Mutation Applied
- **Mutation**: Added Self-Correction/Validation as a best practice check in Step 4 and a corresponding refinement action in Step 6, per the meta-analyst's Proactive Hardening strategy.
