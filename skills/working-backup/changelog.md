# Autoresearch Changelog: system-self-correction-v2

## Round 0 — Baseline
- **Score**: 56/60 (baseline)
- **Mutation**: None — original SKILL.md
- **Weaknesses identified**:
  1. **Correct Action (2 failures)**: Quality gate decision logic has no "defer/skip" action. Three-tier matrix (all pass → apply, warnings → apply with caveats, critical → investigate) is too permissive — never says "don't persist this." Scenarios 9 (duplicate) and 10 (one-time event) both failed because an agent could still apply updates that should be skipped.
  2. **No severity classification**: Individual gate checks don't specify whether failure is "warning" or "critical". Agent must guess.
  3. **Minor — no duplication check procedure**: Gate asks "already documented?" but doesn't say HOW to check (e.g., Grep memory bank files).

## Round 1 — Quality Gate Decision Logic Fix
- **Score**: 60/60 (kept — **target reached**)
- **Mutation**: Replaced 3-tier decision matrix with 4-tier severity-classified system
- **Changes**:
  1. Added **Check Severity** section classifying each gate check as Critical / Hard filter / Soft
  2. Added **Defer** action for hard filter failures (non-generalizable, already documented)
  3. Added **Duplication Check Procedure** with explicit Grep-based search steps
- **Result**: Fixed both Scenario 9 (duplicate detection → Defer) and Scenario 10 (one-time event → Defer)
- **Regressions**: None — all 8 previously-passing scenarios still pass at 6/6

## Summary
- **Starting score**: 56/60 (93.3%)
- **Final score**: 60/60 (100%)
- **Rounds**: 1 mutation to reach target
- **Key insight**: The original skill had all the right checks but lacked decision granularity — it could detect problems but couldn't express "don't persist this." Adding severity levels and a Defer action was a surgical fix.
