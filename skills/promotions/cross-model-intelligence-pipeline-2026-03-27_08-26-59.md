# Promotion Proposal: cross-model-intelligence-pipeline

## Scores
- **Baseline**: 48/48
- **Current**: 48/48
- **Improvement**: +0 points (100.0%)
- **Rounds**: 3

## Promotion Target
`/Users/ramene/Journal/.seed/base/skills/cross-model-intelligence-pipeline/SKILL.md`

## Key Mutations That Improved Score
1. All criteria show 0 failures — adding a brief variable-validation guard at the top of each stage's user prompt template to prevent silent failures when template variables are empty or undefined, targeting the most likely real-world failure mode.
2. Added CITATION INTEGRITY RULE to Stage 3 system prompt instructing the model to flag uncertain DOIs/citations as [VERIFY] rather than hallucinate them, reducing fabricated citation failures.
3. All criteria show 0 failures — extending the CITATION INTEGRITY RULE from Stage 3 into Stage 1's system prompt to prevent potential citation hallucination at the synthesis stage, which feeds all downstream stages and is the highest-leverage hardening point.

## Unified Diff (baseline -> current)
```diff
--- /Users/ramene/.remote/@autoresearch/skills/working-cross-model-intelligence-pipeline/SKILL.md.baseline	2026-03-15 11:25:35.000000000 -0600
+++ /Users/ramene/.remote/@autoresearch/skills/working-cross-model-intelligence-pipeline/SKILL.md	2026-03-15 16:13:54.000000000 -0600
@@ -1,7 +1,7 @@
 ---
 name: cross-model-intelligence-pipeline
 description: Cross-model reasoning pipeline prompts (Claude→Gemini→Claude) for research analysis
-version: 1.0.0
+version: 1.0.1
 allowed-tools: []
 ---
 
@@ -24,6 +24,13 @@
 - Use structured markdown with exact section headers as specified.
 - Every claim must cite evidence (transcript quote, file path, or project reference).
 - Your output is the INPUT for Stage 2 — incomplete output breaks the pipeline.
+
+CITATION INTEGRITY RULE (mandatory when referencing papers, studies, or external sources):
+- Only include citations you have high confidence are real (author, title, journal, year all consistent with your training knowledge).
+- If you are uncertain whether a specific paper exists or its exact DOI, append [VERIFY] after the citation rather than fabricating details.
+- Do NOT invent DOIs. If you cannot confirm a DOI, write "DOI: [VERIFY]" instead.
+- It is better to cite fewer real papers with [VERIFY] flags than to produce plausible-sounding but fabricated citations.
+- Papers mentioned in the provided transcripts or context may be cited with higher confidence; papers you generate from general knowledge should be treated with extra scrutiny.
 ```
 
 ### User Prompt Template
@@ -33,6 +40,11 @@
 ```
 # STAGE 1: Transcript Synthesis + Platform Gap Analysis
 
+> VARIABLE CHECK: If any of the following are empty or missing, state "MISSING: <variable name>" and halt rather than proceeding with incomplete input.
+> - context: ${context ? "provided" : "MISSING"}
+> - transcripts: ${transcripts ? "provided" : "MISSING"}
+> - debatePrompt: ${debatePrompt ? "provided" : "MISSING"}
+
 You are the first stage of a 3-stage cross-model reasoning pipeline.
 Your job: synthesize raw transcripts against the platform's current state, identify gaps, and produce a structured brief for Gemini 3.1 Pro to reason about.
 
@@ -126,6 +138,9 @@
 ```
 # STAGE 2: Validate, Debate & Reason
 
+> VARIABLE CHECK: If stage1Output is empty or missing, state "MISSING: stage1Output" and halt.
+> - stage1Output: ${stage1Output ? "provided" : "MISSING"}
+
 ## CLAUDE'S STAGE 1 OUTPUT
 
 ${stage1Output}
@@ -206,6 +221,13 @@
 - Section 9 (Test Gates) is MANDATORY for any code-related action items.
 - Every action item must have: concrete action, impact rating, effort estimate, and dependencies.
 - This document IS the deliverable — incomplete output means the entire pipeline failed.
+
+CITATION INTEGRITY RULE (mandatory for sections 3, 4, 7, 8):
+- Only include citations you have high confidence are real (author, title, journal, year all consistent with your training knowledge).
+- If you are uncertain whether a specific paper exists or its exact DOI, append [VERIFY] after the citation rather than fabricating details.
+- Do NOT invent DOIs. If you cannot confirm a DOI, write "DOI: [VERIFY]" instead.
+- It is better to cite fewer real papers with [VERIFY] flags than to produce plausible-sounding but fabricated citations.
+- Papers mentioned in the provided Stage 1/Stage 2 inputs or the original transcript may be cited with higher confidence; papers you are generating from general knowledge should be treated with extra scrutiny.
 ```
 
 ### User Prompt Template
@@ -215,6 +237,12 @@
 ```
 # STAGE 3: Execution Plan — Cross-Model Validated
 
+> VARIABLE CHECK: If any required variable is empty or missing, state "MISSING: <variable name>" before proceeding. Required variables: stage1Output, stage2Output, context, transcript.
+> - stage1Output: ${stage1Output ? "provided" : "MISSING"}
+> - stage2Output: ${stage2Output ? "provided" : "MISSING"}
+> - context: ${context ? "provided" : "MISSING"}
+> - transcript: ${transcript ? "provided" : "MISSING"}
+
 You are Claude Opus, the "Equipped Reasoner." You've completed a 3-stage cross-model reasoning pipeline:
 
 1. **Stage 1** (You): Synthesized research transcript against project context, identified frameworks, gaps, priorities, debate positions, and reasoning questions
@@ -256,11 +284,11 @@
 - The anchor paper to the 2024-2026 literature
 - Priority researchers to each other
 - Cross-disciplinary bridge papers between neuroscience and architecture/phenomenology
-Format: Source → Connection Type → Target (with DOIs where available)
+Format: Source → Connection Type → Target (with DOIs where available — use [VERIFY] if uncertain)
 
 ### 4. TOP 5 PAPERS
 Identify the 5 papers (2024-2026) that most directly extend or connect to the anchor paper's work. For each:
-- Full citation with DOI
+- Full citation with DOI (use "DOI: [VERIFY]" if you cannot confirm the exact DOI)
 - Why it's critical (1-2 sentences)
 - Which research thread it advances
 - What it adds to the three-stage sensorium model
@@ -282,7 +310,7 @@
 
 ### 7. ANNOTATED BIBLIOGRAPHY (20 papers, 2020-2026)
 For each paper:
-- Full citation (authors, title, journal, year, DOI)
+- Full citation (authors, title, journal, year, DOI — use "DOI: [VERIFY]" if uncertain)
 - 2-3 sentence annotation explaining relevance
 - Connection to anchor paper and priority researchers
 - Evidence strength rating (strong/moderate/emerging)
@@ -317,5 +345,5 @@
 - Output storage conventions
 - Example invocation command
 
-Be thorough. Be specific. Cite sources with DOIs. This document is the primary research deliverable.
-```
+Be thorough. Be specific. Cite sources with DOIs where confirmed. This document is the primary research deliverable.
+```
\ No newline at end of file

```

## Generated
- **Timestamp**: 2026-03-27T08:26:59.000Z
- **Source**: `/Users/ramene/.remote/@autoresearch/skills/working-cross-model-intelligence-pipeline/SKILL.md`
- **Baseline**: `/Users/ramene/.remote/@autoresearch/skills/working-cross-model-intelligence-pipeline/SKILL.md.baseline`
