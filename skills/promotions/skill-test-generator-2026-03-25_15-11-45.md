# Promotion Proposal: skill-test-generator

## Scores
- **Baseline**: 30/36
- **Current**: 36/36
- **Improvement**: +6 points (100.0%)
- **Rounds**: 6

## Promotion Target
`/Users/ramene/Journal/.seed/base/skills/skill-test-generator/SKILL.md`

## Key Mutations That Improved Score
1. Added an explicit Step 7a "Validate Counts Before Writing" that checks generated quantities meet minimums and generates additional items if short — directly fixing the quantity/schema failures that cascade into all other criteria failing.
2. Replace hard "Do not proceed" blocking gates in Step 7 with a write-then-report pattern so the skill always produces eval.json output (even if counts are short), preventing infinite loops that cause zero scenarios to be evaluated.
3. Restore the "generate additional items to meet minimums" instruction in Step 7 (lost in Round 2's mutation) so the skill actively fills gaps before writing, rather than just logging warnings about them.
4. Consolidate Step 7 to clearly require generating additional items to meet minimums AND always writing output, removing any ambiguity about whether to block or proceed.
5. Add an explicit JSON validation substep in Step 8 that verifies the constructed object has both `scenarios` and `criteria` arrays before writing, preventing silent schema violations if a future mutation drops a field.

## Unified Diff (baseline -> current)
```diff
--- /Users/ramene/.remote/@autoresearch/skills/working-skill-test-generator/SKILL.md.baseline	2026-03-20 11:29:04.000000000 -0600
+++ /Users/ramene/.remote/@autoresearch/skills/working-skill-test-generator/SKILL.md	2026-03-20 16:04:47.000000000 -0600
@@ -52,8 +52,15 @@
     -   **Error Reporting:** Does the skill handle failure gracefully and informatively? *Example: "Does the skill exit with a non-zero status code when the input file is not found?"*
     -   **Idempotency:** If applicable, does running the skill multiple times with the same input yield the same result without causing errors? *Example: "Does running the skill a second time on the same email result in only one label being applied?"*
 
-7.  **Construct and Write `eval.json`:**
-    -   Format the generated scenarios and criteria into a JSON object matching the system's schema:
+7.  **Fill Gaps, Then Write `eval.json` Immediately:**
+    -   Count the scenarios from Step 5 and the criteria from Step 6.
+    -   **If scenarios < 6:** Generate additional scenarios right now (prioritize edge cases, then failure cases) until you have at least 6. Do not move on until count ≥ 6.
+    -   **If criteria < 4:** Generate additional binary yes/no criteria right now (focus on output correctness and error handling) until you have at least 4. Do not move on until count ≥ 4.
+    -   Verify every criterion's `question` ends with `?` and is answerable with yes/no. Rewrite any that fail this check.
+    -   **After meeting minimums, immediately proceed to write the file.** Do not loop back or re-evaluate. If counts are between the minimum and maximum targets (e.g., 6 scenarios when 8 is ideal), that is acceptable — write what you have and note any shortfall in the console report.
+
+8.  **Construct and Write `eval.json`:**
+    -   Format the validated scenarios and criteria into a JSON object matching the system's schema exactly:
         ```json
         {
           "scenarios": [
@@ -64,22 +71,27 @@
           ]
         }
         ```
+    -   **Pre-write schema check:** Before writing, confirm the JSON object you have constructed contains:
+        -   A top-level `scenarios` key whose value is a non-empty array of objects each with a `description` string.
+        -   A top-level `criteria` key whose value is a non-empty array of objects each with a `question` string ending in `?`.
+        -   No extra top-level keys beyond `scenarios` and `criteria`.
+        If any of these checks fail, fix the structure now before proceeding.
     -   Check if `${SKILL_DIR}/eval.json` already exists.
     -   If it exists, use `Edit` to merge the new scenarios and criteria. Be careful not to create duplicates. Inform the user that you are adding to the existing test suite.
     -   If it does not exist, use `Write` to create a new file at `${SKILL_DIR}/eval.json` with the JSON content.
-    -   Report success to the user, stating the number of scenarios and criteria generated for the specified skill.
+    -   Report success to the user, stating the number of scenarios and criteria generated for the specified skill, plus any quality notes from Step 7.
 
 ## Output Format
 - **Primary:** A file named `eval.json` is created or updated in the target skill's directory (`~/.remote/@autoresearch/skills/working-<skill_name>/eval.json`).
-- **Console:** A confirmation message, e.g., "Successfully generated 7 scenarios and 5 evaluation criteria for skill `<skill_name>` in `eval.json`."
+- **Console:** A confirmation message, e.g., "Successfully generated 7 scenarios and 5 evaluation criteria for skill `<skill_name>` in `eval.json`." Include any count notes if targets were not fully met.
 
 ## Quality Gates
 Before marking the task as complete, verify the following:
-- [ ] Generated 6-8 relevant test scenarios.
-- [ ] Generated 4-6 binary (yes/no) evaluation criteria.
+- [ ] Generated 6-8 relevant test scenarios (generate additional items if fewer than 6 — do not accept shortfall).
+- [ ] Generated 4-6 binary (yes/no) evaluation criteria (generate additional items if fewer than 4 — do not accept shortfall).
 - [ ] All generated criteria are specific and unambiguous (e.g., "Does it create a file named `output.csv`?" is good; "Does it work?" is bad).
 - [ ] The scenarios cover a mix of success, edge, and failure cases.
-- [ ] The output is a valid JSON file named `eval.json` conforming to the system schema.
+- [ ] The output is a valid JSON file named `eval.json` conforming to the system schema (top-level keys: `scenarios` and `criteria` only).
 - [ ] The generation process included analysis of the skill's source code, not just its `SKILL.md`.
 
 ## Integration Points
@@ -100,8 +112,8 @@
 - **Agent Action:**
     1. Reads `skills/working-file-counter/SKILL.md` and `skills/working-file-counter/main.py`.
     2. The code shows it counts lines in a text file.
-    3. Generates `eval.json` with scenarios: "Count lines in a 10-line file", "Count lines in an empty file", "Attempt to count lines in a binary file", "Attempt to count lines in a non-existent file".
-    4. Criteria include: "Does the output number match the actual line count?", "Does it output '0' for an empty file?", "Does it exit with a non-zero status code for a non-existent file?".
+    3. Generates `eval.json` with scenarios: "Count lines in a 10-line file", "Count lines in an empty file", "Attempt to count lines in a binary file", "Attempt to count lines in a non-existent file", "Count lines in a file with only whitespace", "Count lines in a very large file (10,000+ lines)".
+    4. Criteria include: "Does the output number match the actual line count?", "Does it output '0' for an empty file?", "Does it exit with a non-zero status code for a non-existent file?", "Does it handle binary files without crashing?".
 - **Agent Output:** "Successfully generated 6 scenarios and 4 evaluation criteria for skill `file-counter` in `eval.json`."
 
 **Example 2: Generating tests for a skill that interacts with an API**
@@ -109,6 +121,6 @@
 - **Agent Action:**
     1. Reads `skills/working-github-issue-fetcher/SKILL.md` and its Python code.
     2. Identifies `requests` calls to the GitHub API.
-    3. Generates `eval.json` with scenarios: "Fetch issues from a public repo", "Fetch issues from a repo with no issues", "Attempt to fetch from a private repo without credentials", "Handle a 404 error for a non-existent repo".
-    4. Criteria include: "Is the output JSON file created with the correct issue data?", "Is the output file an empty list for a repo with no issues?", "Does the skill log an authentication error for a private repo?".
+    3. Generates `eval.json` with scenarios: "Fetch issues from a public repo", "Fetch issues from a repo with no issues", "Attempt to fetch from a private repo without credentials", "Handle a 404 error for a non-existent repo", "Fetch issues when API rate limit is exceeded", "Fetch issues with pagination (>100 issues)", "Run fetch twice on same repo to verify idempotency".
+    4. Criteria include: "Is the output JSON file created with the correct issue data?", "Is the output file an empty list for a repo with no issues?", "Does the skill log an authentication error for a private repo?", "Does the skill exit with a non-zero status code on a 404 response?", "Does repeated execution produce identical output files?"
 - **Agent Output:** "Created `eval.json` for `github-issue-fetcher` with 7 scenarios and 5 criteria."
\ No newline at end of file

```

## Generated
- **Timestamp**: 2026-03-25T15:11:45.344Z
- **Source**: `/Users/ramene/.remote/@autoresearch/skills/working-skill-test-generator/SKILL.md`
- **Baseline**: `/Users/ramene/.remote/@autoresearch/skills/working-skill-test-generator/SKILL.md.baseline`
