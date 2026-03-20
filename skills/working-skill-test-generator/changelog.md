# Autoresearch Changelog: skill-test-generator

## Genesis
- Created from want: want-021
- Hypothesis: The system cannot create or execute tests for its own skills, resulting in 15/27 skills being completely untested and leaving the system blind to their actual performance.
- Score: 0.756
- Criteria: 6
- Scenarios: 6

## Round 0
- **Score**: 30/36 (baseline)
- **Failures**: S6: Generate a list of 6-8 relevant test scenarios, S6: Generate a list of 4-6 binary (yes/no) evaluation criteria, S6: Are the generated criteria specific and unambiguous, S6: Are the generated scenarios diverse, covering both success and failure cases, S6: Does the output conform to the system's skill definition schema, S6: Analyze the skill's code to suggest tests for specific functions or parameters
- **Per-criteria**: Generate a list of 6-8 relevant test scenarios: 5/6, Generate a list of 4-6 binary (yes/no) evaluation criteria: 5/6, Are the generated criteria specific and unambiguous: 5/6, Are the generated scenarios diverse, covering both success and failure cases: 5/6, Does the output conform to the system's skill definition schema: 5/6, Analyze the skill's code to suggest tests for specific functions or parameters: 5/6

## Round 1 — Mutation Applied
- **Mutation**: Added an explicit Step 7a "Validate Counts Before Writing" that checks generated quantities meet minimums and generates additional items if short — directly fixing the quantity/schema failures that cascade into all other criteria failing.

## Round 1
- **Score**: 36/36 (kept)
- **Failures**: none
- **Per-criteria**: Generate a list of 6-8 relevant test scenarios: 6/6, Generate a list of 4-6 binary (yes/no) evaluation criteria: 6/6, Are the generated criteria specific and unambiguous: 6/6, Are the generated scenarios diverse, covering both success and failure cases: 6/6, Does the output conform to the system's skill definition schema: 6/6, Analyze the skill's code to suggest tests for specific functions or parameters: 6/6

## Round 2 — Mutation Applied
- **Mutation**: Replace hard "Do not proceed" blocking gates in Step 7 with a write-then-report pattern so the skill always produces eval.json output (even if counts are short), preventing infinite loops that cause zero scenarios to be evaluated.

## Round 3 — Mutation Applied
- **Mutation**: Restore the "generate additional items to meet minimums" instruction in Step 7 (lost in Round 2's mutation) so the skill actively fills gaps before writing, rather than just logging warnings about them.

## Round 4 — Mutation Applied
- **Mutation**: Consolidate Step 7 to clearly require generating additional items to meet minimums AND always writing output, removing any ambiguity about whether to block or proceed.

## Round 5 — Mutation Applied
- **Mutation**: Add an explicit JSON validation substep in Step 8 that verifies the constructed object has both `scenarios` and `criteria` arrays before writing, preventing silent schema violations if a future mutation drops a field.
