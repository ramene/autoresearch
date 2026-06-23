# Autoresearch Changelog: skill-optimizer-v2

## Genesis
- Created from want: want-020
- Hypothesis: The system's core self-improvement loop is broken; the existing 'skill-improver' is stuck and fails to meet the extremely high user demand for automated skill optimization, representing the single largest bottleneck to system evolution.
- Score: 1
- Criteria: 6
- Scenarios: 6

## Round 0
- **Score**: 36/36 (baseline)
- **Failures**: none
- **Per-criteria**: Identify the weakest criterion from the target skill's logs: 6/6, Is the proposed modification a specific, concrete change to a prompt or code file: 6/6, Does the proposed modification directly address a documented failure mode: 6/6, Apply the change to the skill's definition files: 6/6, Trigger a new evaluation round for the modified skill: 6/6, Revert the change if the new score is not an improvement: 6/6

## Round 1 — Mutation Applied
- **Mutation**: Added empty-rounds guard in Step 1 to handle the case where rounds.json exists but contains no entries, preventing a silent crash on new skills with no evaluation history.

## Round 2 — Mutation Applied
- **Mutation**: Added tie-breaking logic in Step 3 for when multiple criteria share the lowest score, preventing ambiguous behavior by selecting the criterion with the most recent failure event in events.jsonl.

## Round 3 — Mutation Applied
- **Mutation**: Added explicit Step 8.5 to update world-model.json after outcome determination, closing the gap between the documented integration point and actual execution (the integration section promised this update but no step performed it).

## Round 4 — Mutation Applied
- **Mutation**: Added explicit fallback in Step 2 for when events.jsonl contains no relevant failure events, instructing the skill to proceed using rounds.json criterion scores alone rather than silently continuing with empty correlation data.

## Round 5 — Mutation Applied
- **Mutation**: Updated Step 6 to require the changelog entry to explicitly include the phrase "Weakest criterion: {WEAKEST_CRITERION}" so evaluator pattern-matching can reliably detect which criterion was targeted, regardless of whether failure events were present.
