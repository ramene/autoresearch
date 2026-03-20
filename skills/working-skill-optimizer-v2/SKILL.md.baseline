# skill-optimizer-v2
Analyzes a target skill's failure logs, proposes a specific modification to its prompt or code, applies it, and validates the improvement.

## Purpose
This skill addresses the core strategic goal of system self-improvement (`want-020`). The existing `skill-improver` has plateaued, creating a significant bottleneck in the system's evolution. This skill implements a more robust, data-driven optimization loop to analyze specific failure modes from evaluation logs, propose targeted fixes, and empirically validate their effectiveness. Its purpose is to break the current improvement stalemate and enable a continuous, automated skill enhancement cycle.

## Trigger Conditions
- **Manual Command:** `/optimize-skill {skill_name}`
- **Automatic Detection:** This skill is triggered by the main autoresearch loop when the `world-model.json` indicates a skill is a candidate for optimization. Conditions for candidacy include:
    - `stuck_count >= 3` (the skill's score has not improved in 3 consecutive evaluation rounds).
    - `score < 0.9` and `trajectory == 'flat' or trajectory == 'negative'`.
    - A new skill fails its initial evaluation round (`score < 0.8`).

## Prerequisites
- The target skill must have a working directory at `~/.remote/@autoresearch/skills/working-{skill_name}/`.
- The directory must contain:
    - `SKILL.md` (the skill's definition).
    - `eval.json` (the evaluation criteria).
    - `rounds.json` (a history of evaluation scores).
    - `events.jsonl` (detailed logs from previous evaluation runs).
- The `autoresearch-runner` command-line tool must be available in the system's PATH.
- The `world-model.json` file must be readable to identify optimization candidates.

## Execution Steps

1.  **Target Identification & State Capture:**
    - Identify the target skill name from the trigger command or the world model analysis. Let's call it `TARGET_SKILL`.
    - Define the skill's directory path: `SKILL_DIR="~/.remote/@autoresearch/skills/working-${TARGET_SKILL}"`.
    - **(Tool: Read)** Read `${SKILL_DIR}/rounds.json`. Parse the JSON and extract the most recent evaluation round's data. Store the `overall_score` and the scores for each individual `criterion` in memory as `original_score` and `original_criterion_scores`.
    - If `original_score` is `1.0`, the skill is already perfect. Report this and terminate successfully. There is nothing to optimize.

2.  **Failure Analysis:**
    - **(Tool: Read)** Read `${SKILL_DIR}/eval.json` to understand the definitions of the evaluation criteria.
    - **(Tool: Read, Grep)** Read `${SKILL_DIR}/events.jsonl`. This file contains a log of events from past runs. Filter for events where `event_type` is `step_error`, `quality_gate_failed`, or `evaluation_failed`. Pay close attention to the `criterion_id`, `reason`, and `error_message` fields.
    - Correlate the failures in `events.jsonl` with the low scores in `original_criterion_scores`. For example, if `criterion_scores['completeness']` is low, search `events.jsonl` for logs related to that criterion.

3.  **Identify Weakest Criterion & Root Cause:**
    - Synthesize the analysis from the previous step. Identify the single criterion with the consistently lowest score across recent rounds. This is the `WEAKEST_CRITERION`.
    - Based on the error messages and failure reasons associated with the `WEAKEST_CRITERION` in `events.jsonl`, determine the most likely root cause. Is it an ambiguous instruction in `SKILL.md`? A faulty regular expression in a helper script? A flawed logical step?

4.  **Formulate Hypothesis & Propose Change:**
    - State a clear, concise hypothesis. Example: "Hypothesis: The skill fails on 'Task Completion' because Step 4's instruction to 'parse the JSON' is ambiguous. Clarifying the expected JSON structure will improve parsing reliability."
    - Formulate a specific, concrete change to address the root cause. This change should be represented as a diff or a set of precise instructions for the `Edit` tool.
        - **For a prompt change:** "In `SKILL.md`, replace the sentence in Step 4, 'Parse the JSON output,' with 'Parse the JSON output, which will have the format `{"key": "value", "items": []}`. Use the `jq` tool to extract the `items` array.'"
        - **For a code change:** "In `helper.py`, line 23, change `regex = r'\d+'` to `regex = r'[0-9]+'` to fix the syntax error reported in the logs."

5.  **Apply Modification:**
    - **(Tool: Bash)** Create a backup of the file to be modified. `cp ${SKILL_DIR}/SKILL.md ${SKILL_DIR}/SKILL.md.bak`
    - **(Tool: Edit)** Apply the proposed change to the target file (e.g., `SKILL.md` or a code file).

6.  **Document the Change Attempt:**
    - **(Tool: Edit)** Open `${SKILL_DIR}/changelog.md`. Append a new entry for the current optimization attempt.
    - The entry should include the current timestamp, the hypothesis, the specific change made (the diff), and the expected outcome. Mark the status as "IN_PROGRESS".

7.  **Trigger Re-evaluation:**
    - **(Tool: Bash)** Execute the evaluation runner for the target skill. Run the command: `autoresearch-runner --skill ${TARGET_SKILL}`.
    - Wait for the command to complete. Capture its exit code and output. If the runner itself fails, proceed to Error Handling.

8.  **Evaluate Outcome & Decide:**
    - **(Tool: Read)** Read the updated `${SKILL_DIR}/rounds.json`. Extract the `new_score` and `new_criterion_scores` from the most recent round.
    - **Compare:** Is `new_score > original_score`?
        - **SUCCESS:** If the new score is higher, the optimization was successful. Update the `changelog.md` entry status to "SUCCESS" and add the new score. Delete the backup file: `rm ${SKILL_DIR}/SKILL.md.bak`.
        - **FAILURE:** If `new_score <= original_score`, the optimization failed or had no effect. The change must be reverted.
            - **(Tool: Bash)** Revert the file from backup: `mv ${SKILL_DIR}/SKILL.md.bak ${SKILL_DIR}/SKILL.md`.
            - Update the `changelog.md` entry status to "FAILED_REVERTED" and add the new score, noting that the hypothesis was incorrect.

9.  **Final Report:**
    - Output a summary of the operation to the console: Target skill, original score, weakest criterion, hypothesis, change applied, new score, and final decision (kept or reverted).

## Output Format
- **Primary:** Modified files within the target skill's directory (`SKILL.md`, `changelog.md`, `rounds.json`, etc.).
- **Console:** A structured summary message, e.g.:
  ```json
  {
    "skill_optimized": "classify-leads",
    "status": "SUCCESS",
    "original_score": 0.85,
    "new_score": 0.92,
    "weakest_criterion": "Task Completion",
    "hypothesis": "Clarifying the lead scoring rubric in Step 3 will reduce ambiguity.",
    "action": "Change applied and kept."
  }
  ```
  or
  ```json
  {
    "skill_optimized": "context-drift-detector",
    "status": "FAILURE",
    "original_score": 0.75,
    "new_score": 0.70,
    "weakest_criterion": "Skill Integration",
    "hypothesis": "Changing the API endpoint would improve integration.",
    "action": "Change resulted in a lower score and was reverted."
  }
  ```

## Quality Gates
Before marking the task as complete, verify the following:
1.  Was the weakest criterion correctly identified from `rounds.json` and `events.jsonl`? (Yes/No)
2.  Was the proposed modification a specific, concrete change to a file? (Yes/No)
3.  Did the proposed modification directly address a failure mode documented in `events.jsonl`? (Yes/No)
4.  Was the change successfully applied to the skill's definition file(s)? (Yes/No)
5.  Was the `autoresearch-runner` successfully triggered for the modified skill? (Yes/No)
6.  If the new score was not an improvement, was the original file correctly restored from backup? (Yes/No)

## Integration Points
- **World Model (`world-model.json`):** Reads the list of skills and their statuses to identify optimization targets. Updates the target skill's `stuck_count`, `score`, and `trajectory` after an optimization attempt.
- **Autoresearch Runner:** This skill's primary validation tool. It executes `autoresearch-runner` to score the modified skill.
- **Changelog System:** Appends structured entries to each skill's `changelog.md`, creating an auditable history of all optimization attempts.

## Error Handling
- **Target Skill Not Found:** If the directory `~/.remote/@autoresearch/skills/working-{skill_name}/` does not exist, report an error and terminate.
- **Missing Files:** If `rounds.json` or `events.jsonl` are missing or empty, report that there is insufficient data to perform an analysis and terminate.
- **Runner Failure:** If the `autoresearch-runner` command returns a non-zero exit code, assume the modification introduced a critical error (e.g., syntax error). Treat this as a failed optimization, revert the changes immediately, and document the runner's error output in the changelog.
- **No Improvement:** This is handled by the main logic in Step 8 (reverting the change). It is not an error, but a standard outcome.

## Examples

### Example 1: Optimizing a skill with an ambiguous prompt
- **Trigger:** `/optimize-skill classify-leads`
- **Analysis:** `rounds.json` shows a low score (0.7) for the `accuracy` criterion. `events.jsonl` contains multiple entries where the agent failed to classify "warm" leads correctly, with the reason "Lead temperature criteria unclear."
- **Hypothesis:** The definition of a "warm lead" in `SKILL.md` is ambiguous.
- **Proposed Change:** In `classify-leads/SKILL.md`, change Step 2 from "Categorize leads as hot, warm, or cold" to "Categorize leads using these strict criteria: hot (contacted in last 7 days), warm (contacted in last 30 days), cold (otherwise)."
- **Action:** The change is applied. The `autoresearch-runner` is triggered.
- **Outcome:** The new score is 0.95. The change is kept. The changelog is updated to "SUCCESS".

### Example 2: Optimizing a skill with a code error
- **Trigger:** Automatic detection for `context-drift-detector` (stuck_count=4).
- **Analysis:** `rounds.json` shows a score of 0.0 for the `Task Completion` criterion. `events.jsonl` shows a consistent `step_error` with a Python traceback: `SyntaxError: invalid syntax` in `scripts/parse_context.py` on line 15.
- **Hypothesis:** A syntax error in the helper script `parse_context.py` is preventing the skill from running at all.
- **Proposed Change:** In `scripts/parse_context.py`, fix the syntax error on line 15 (e.g., changing `print "Debug"` to `print("Debug")`).
- **Action:** The change is applied to the Python file. The `autoresearch-runner` is triggered.
- **Outcome:** The new score is 0.80. The skill now runs successfully. The change is kept.

### Example 3: Attempting to optimize a perfect skill
- **Trigger:** `/optimize-skill file-lister`
- **Analysis:** **(Tool: Read)** `file-lister/rounds.json`. The latest entry shows `overall_score: 1.0`.
- **Action:** The skill immediately proceeds to Step 9.
- **Outcome:** A message is printed to the console: `{"skill_optimized": "file-lister", "status": "NO_OP", "original_score": 1.0, "message": "Skill already has a perfect score. No optimization needed."}`. The skill terminates successfully.