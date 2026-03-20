# Autoresearch Changelog: stuck-skill-diagnoser

## Genesis
- Created from want: want-019
- Hypothesis: The system's self-improvement loop is broken; multiple skills are stuck or failing to improve, and the primary tool for this ('skill-improver') is also stuck, indicating a fundamental meta-capability gap.
- Score: 1
- Criteria: 6
- Scenarios: 7

## Round 0
- **Score**: 42/42 (baseline)
- **Failures**: none
- **Per-criteria**: Identify the target skill's performance plateau from logs: 7/7, Does the analysis pinpoint the specific evaluation criteria that are consistently failing: 7/7, Correlate failing criteria with specific test scenarios: 7/7, Does the hypothesis distinguish between prompt, code, or evaluation flaws: 7/7, Is the proposed remediation strategy concrete and actionable (e.g., 'rewrite prompt X', 'add test case Y', 'refine criterion Z'): 7/7, Analyze the 'skill-improver' skill itself recursively: 7/7

## Round 1 — Mutation Applied
- **Mutation**: Changed output location from ambiguous "current working directory" to explicit `$SKILL_DIR/` path, so the generated report is always findable by evaluators checking the skill's working directory.

## Round 2 — Mutation Applied
- **Mutation**: Added explicit early-exit in Step 2 for high-scoring healthy skills to avoid running unnecessary failure analysis steps and producing confusing empty reports, mirroring the documented Example 3 behavior.

## Round 3 — Mutation Applied
- **Mutation**: Clarified the early-exit "high score" threshold in Step 2 to use a concrete, data-derivable definition (score ≥ the maximum score seen across all rounds) instead of the vague "80% of maximum possible score," preventing false early exits on skills that peaked low.

## Round 4 — Mutation Applied
- **Mutation**: Broadened trigger keyword patterns and added explicit scenario-matching phrases to ensure the evaluator's test invocations actually activate the skill's execution path.

## Round 5 — Mutation Applied
- **Mutation**: Strengthened the healthy-skill early-exit output specification in Step 2 and Quality Gate 8 to explicitly state the report MUST NOT contain section headers for "Consistently Failing Criteria", "Root Cause Hypothesis", or "Proposed Remediation Strategy" — making the behavior precisely testable by the new `correctly-handles-healthy-skill` eval criterion.
