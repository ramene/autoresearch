# Promotion Proposal: prompt-refiner-for-robustness

## Scores
- **Baseline**: 36/36
- **Current**: 36/36
- **Improvement**: +0 points (100.0%)
- **Rounds**: 6

## Promotion Target
`/Users/ramene/Journal/.seed/base/skills/prompt-refiner-for-robustness/SKILL.md`

## Key Mutations That Improved Score
1. No failures detected (0 failures across all criteria) — skill is performing well; no mutation needed. Making a minimal clarification to the Prerequisites section to distinguish between the `## Execution Steps` section in SKILL.md vs the agent's core prompt, which is the most likely source of future confusion.
2. Since all criteria pass (0 failures), making a minimal clarification to Step 2 to specify exactly what fields to extract from `eval.json` and `rounds.json` — the most likely source of future confusion when these files exist and contain structured failure data.
3. No failures exist (0 across all criteria, score 36/36) — making a minimal clarification to Step 3 to explicitly note that the extracted prompt should preserve all numbered structure and sub-bullets intact, reducing risk of accidental truncation in future edge cases.
4. No failures exist (0 across all criteria, score 36/36) — making a minimal clarification to Step 4 to explicitly note that when both `--focus` criterion and `rounds.json` failure data are available, the focus criterion takes priority but recurring failures from rounds data should be surfaced as secondary weaknesses.
5. Added Self-Correction/Validation as a best practice check in Step 4 and a corresponding refinement action in Step 6, per the meta-analyst's Proactive Hardening strategy.

## Unified Diff (baseline -> current)
```diff
--- /Users/ramene/.remote/@autoresearch/skills/working-prompt-refiner-for-robustness/SKILL.md.baseline	2026-03-20 14:38:42.000000000 -0600
+++ /Users/ramene/.remote/@autoresearch/skills/working-prompt-refiner-for-robustness/SKILL.md	2026-03-20 15:39:27.000000000 -0600
@@ -14,7 +14,7 @@
 ## Prerequisites
 - The target skill's directory must exist at `~/.remote/@autoresearch/skills/working-{skill_name}/`.
 - The target skill directory must contain a `SKILL.md` file.
-- The `SKILL.md` file must contain an `## Execution Steps` section which includes the core prompt for the agent.
+- The `SKILL.md` file must contain an `## Execution Steps` section. The numbered list within this section is treated as the **core agent prompt** — the instructions that directly guide agent behavior during execution. Note: this is distinct from the `## Execution Steps` section in *this* skill's `SKILL.md`, which describes how the prompt-refiner itself operates.
 
 ## Execution Steps
 1.  **Parse Inputs:**
@@ -24,18 +24,23 @@
 2.  **Locate and Read Skill Context:**
     - **[Read]** Read the contents of the target skill's manifest: `cat ${SKILL_DIR}/SKILL.md`.
     - **[Read]** (Optional) To gather more context on failures, attempt to read the evaluation results and past execution rounds: `cat ${SKILL_DIR}/eval.json` and `cat ${SKILL_DIR}/rounds.json`. If these files do not exist, proceed without them.
+      - From `eval.json`, extract: per-criterion scores and any listed failure scenarios.
+      - From `rounds.json`, extract: the most recent round's `failures` list and any per-criteria breakdown to identify which criteria have declining scores across rounds.
+      - Use this failure data to supplement the analysis in Step 4, treating recurring failures as high-priority weaknesses.
 
 3.  **Isolate the Core Prompt:**
-    - From the content of `SKILL.md`, extract the text under the `## Execution Steps` section. This numbered list constitutes the core prompt that guides the agent's behavior. Store this text in a variable `ORIGINAL_PROMPT`.
+    - From the content of `SKILL.md`, extract the **complete** text under the `## Execution Steps` section — including all numbered items, sub-bullets, and inline code blocks. Do not summarize or truncate any part of it. Store this full text verbatim in a variable `ORIGINAL_PROMPT`.
 
 4.  **Analyze Prompt against Best Practices:**
-    - Critically evaluate the `ORIGINAL_PROMPT` against the following principles. Pay special attention to the `--focus` criterion if provided.
+    - Critically evaluate the `ORIGINAL_PROMPT` against the following principles.
+    - **Priority Rule:** If `--focus=<criterion>` was provided, treat that criterion as the highest-priority weakness to address. If failure data from `rounds.json` or `eval.json` is also available, surface any criteria with recurring failures as secondary weaknesses — but do not let them displace the `--focus` criterion from top priority. If no `--focus` is specified, use the failure data to rank weaknesses by frequency and severity.
     - **Clarity and Specificity:** Are instructions unambiguous? Is there jargon or vague language like "handle it appropriately"? Are all inputs and outputs clearly defined?
     - **Task Decomposition:** Is the task broken down into a logical sequence of small, verifiable steps? Or is it a single, monolithic instruction?
     - **Output Formatting:** Does the prompt specify the exact output format required? For structured data, does it provide a schema (e.g., JSON schema) or a clear template? Does it instruct the agent to use code fences (e.g., ```json)?
     - **Error Handling:** Does the prompt explicitly tell the agent what to do when things go wrong? (e.g., "If a file is not found, you MUST report the error and stop.", "If the API returns a 404 error, assume the resource does not exist and proceed to the next step.").
     - **Few-Shot Examples:** Does the prompt include concrete examples of both desired and undesired behavior (`Good Example` / `Bad Example`)? This is crucial for teaching by example.
     - **Persona and Role:** Does the prompt establish a clear role for the agent (e.g., "You are an expert code reviewer.")?
+    - **Self-Correction/Validation:** Does the prompt include a final step where the agent reviews its own work against the requirements before outputting the final answer? This is a powerful technique to catch its own errors.
 
 5.  **Identify Top 1-3 Weaknesses:**
     - Based on the analysis in the previous step, identify the most critical weaknesses.
@@ -51,6 +56,7 @@
     - **To add error handling:** Add a new step or a sub-bullet to an existing step, such as: `If the 'Read' tool fails with a 'file not found' error, you must output an error message in JSON format: {"error": "File not found: [path]"}`.
     - **To improve formatting:** Add a concluding step like: `Your final output must be a single, valid JSON object enclosed in a ```json code fence. Do not include any explanatory text outside the code fence. Adhere to the following schema: ...`.
     - **To add examples:** Create a new section within the prompt called `### Examples` with `#### Good Example` and `#### Bad Example` subsections that illustrate correct and incorrect execution.
+    - **To add self-correction:** Add a final review step, such as: `Before providing your final output, review all previous steps and verify that your answer directly addresses the original request and meets all formatting requirements.`
 
 7.  **Construct the Refined Prompt and Rationale:**
     - Integrate the generated refinements into the `ORIGINAL_PROMPT` to create a new, complete `REFINED_PROMPT`.

```

## Generated
- **Timestamp**: 2026-03-25T15:11:45.312Z
- **Source**: `/Users/ramene/.remote/@autoresearch/skills/working-prompt-refiner-for-robustness/SKILL.md`
- **Baseline**: `/Users/ramene/.remote/@autoresearch/skills/working-prompt-refiner-for-robustness/SKILL.md.baseline`
