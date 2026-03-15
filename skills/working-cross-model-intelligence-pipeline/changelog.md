# Changelog

## Initial
- Baseline prompts extracted from reasoning-pipeline/pipeline.mjs

## Round 0
- **Score**: 48/48 (baseline)
- **Failures**: none
- **Per-criteria**: Synthesis Completeness: 8/8, Evidence Grounding: 8/8, Adversarial Rigor: 8/8, Actionability: 8/8, Cross-Stage Coherence: 8/8, Citation Accuracy: 8/8

## Round 1 — Mutation Applied
- **Mutation**: All criteria show 0 failures — adding a brief variable-validation guard at the top of each stage's user prompt template to prevent silent failures when template variables are empty or undefined, targeting the most likely real-world failure mode.

## Round 0
- **Score**: 44/48 (baseline)
- **Failures**: S2: Citation Accuracy, S3: Citation Accuracy, S4: Citation Accuracy, S6: Citation Accuracy
- **Per-criteria**: Synthesis Completeness: 8/8, Evidence Grounding: 8/8, Adversarial Rigor: 8/8, Actionability: 8/8, Cross-Stage Coherence: 8/8, Citation Accuracy: 4/8

## Round 1 — Mutation Applied
- **Mutation**: Added CITATION INTEGRITY RULE to Stage 3 system prompt instructing the model to flag uncertain DOIs/citations as [VERIFY] rather than hallucinate them, reducing fabricated citation failures.

## Round 1
- **Score**: 48/48 (kept)
- **Failures**: none
- **Per-criteria**: Synthesis Completeness: 8/8, Evidence Grounding: 8/8, Adversarial Rigor: 8/8, Actionability: 8/8, Cross-Stage Coherence: 8/8, Citation Accuracy: 8/8

## Round 2 — Mutation Applied
- **Mutation**: All criteria show 0 failures — extending the CITATION INTEGRITY RULE from Stage 3 into Stage 1's system prompt to prevent potential citation hallucination at the synthesis stage, which feeds all downstream stages and is the highest-leverage hardening point.
