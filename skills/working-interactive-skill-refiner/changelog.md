# Autoresearch Changelog: interactive-skill-refiner

## Genesis
- Created from want: want-018
- Hypothesis: Users are frequently trying to improve skills, but the system lacks a high-level, interactive workflow to facilitate this. An orchestrator skill is needed to guide users through diagnosing, modifying, and testing skills.
- Score: 1
- Criteria: 6
- Scenarios: 8

## Round 0
- **Score**: 42/48 (baseline)
- **Failures**: S3: Invoke `stuck-skill-diagnoser` or `failure-log-analyzer` to find root causes, S7: Invoke `stuck-skill-diagnoser` or `failure-log-analyzer` to find root causes, S7: Propose a specific, actionable modification based on the diagnosis, S7: Generate new, relevant tests using `skill-test-generator` to verify the fix, S7: Apply the user-approved modification to the skill's definition, S7: Run the new tests using `skill-test-runner` and report the before/after scores
- **Per-criteria**: Identify the target skill from user input: 8/8, Invoke `stuck-skill-diagnoser` or `failure-log-analyzer` to find root causes: 6/8, Propose a specific, actionable modification based on the diagnosis: 7/8, Generate new, relevant tests using `skill-test-generator` to verify the fix: 7/8, Apply the user-approved modification to the skill's definition: 7/8, Run the new tests using `skill-test-runner` and report the before/after scores: 7/8

## Round 1 — Mutation Applied
- **Mutation**: Modified Step 2d to always invoke `stuck-skill-diagnoser` before proceeding, even for feature requests, ensuring the diagnostic quality gate is never bypassed.

## Round 0
- **Score**: 44/48 (baseline)
- **Failures**: S7: Propose a specific, actionable modification based on the diagnosis, S7: Generate new, relevant tests using `skill-test-generator` to verify the fix, S7: Apply the user-approved modification to the skill's definition, S7: Run the new tests using `skill-test-runner` and report the before/after scores
- **Per-criteria**: Identify the target skill from user input: 8/8, Invoke `stuck-skill-diagnoser` or `failure-log-analyzer` to find root causes: 8/8, Propose a specific, actionable modification based on the diagnosis: 7/8, Generate new, relevant tests using `skill-test-generator` to verify the fix: 7/8, Apply the user-approved modification to the skill's definition: 7/8, Run the new tests using `skill-test-runner` and report the before/after scores: 7/8

## Round 1 — Mutation Applied
- **Mutation**: Remove the conditional in Step 5 so `skill-test-generator` is always invoked for every modification, eliminating the path that skips test generation (and cascades into skipping baseline runs, application, and post-test reporting).

## Round 2 — Mutation Applied
- **Mutation**: Replace `~` with `$HOME` in path construction (Step 1d and Prerequisites) so tilde expansion works correctly inside double-quoted bash strings, fixing the cascade failure in S7.

## Round 3 — Mutation Applied
- **Mutation**: Add a check at the start of Step 2 to skip the user-prompt sub-step (2a) when the initial trigger already contains a problem description or log, so diagnosis proceeds immediately without blocking on a redundant question.
