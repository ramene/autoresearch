# skill-improver

Analyzes a skill's performance history and failures to propose and test improvements to its prompts, code, or evaluation criteria.

## Purpose

This skill addresses a critical meta-capability gap identified in `want-015`. The core hypothesis is that the system's performance plateaus because it cannot autonomously debug, analyze, and improve its own skills, leading to a reliance on manual intervention. Evidence from stuck skills (`context-drift-detector`), skills with no kept improvements (`scaffold`), and strategic goals for self-improvement necessitate this capability. This skill enables the system to perform targeted, data-driven experiments on itself, fostering continuous and autonomous optimization.

## Trigger Conditions

*   **Manual Command:** `/improve-skill <skill_name> [optional: --hypothesis "text"]`
    *   Example: `/improve-skill context-drift-detector`
    *   Example: `/improve-skill scaffold --hypothesis "The issue is in parameter gathering"`
*   **Keywords:** "improve skill", "debug skill", "fix {skill_name}", "why is {skill_name} failing", "optimize {skill_name}"
*   **Automatic Detection (Future Integration):** A `system-monitor` skill could trigger this skill automatically when it detects:
    *   A skill's evaluation score has plateaued for N consecutive rounds (e.g., 5).
    *   A skill's evaluation score has consistently decreased over N rounds.
    *   A skill has a high rate of "rejected" changes.

## Prerequisites

*   A target skill name must be provided.
*   The target skill's directory must exist at `~/.remote/@autoresearch/skills/working-{skill_name}/`.
*   The directory must contain `SKILL.md`, `eval.json`, and `rounds.json`. The presence of `events.jsonl` is highly recommended for detailed failure analysis.
*   The `autoresearch-runner` command-line tool must be available in the system's `PATH`.

## Execution Steps

The skill operates in five distinct phases: Triage, Hypothesis, Modification, Evaluation, and Decision.

### Phase 1: Triage & Data Gathering

1.  **Identify Target:** Parse the input to get the `<skill_name>`.
2.  **Locate Skill Directory:** Set the working directory path: `SKILL_DIR="~/.remote/@autoresearch/skills/working-{skill_name}"`. Verify this directory exists.
3.  **Synthesize Performance History:**
    *   **Tool: `Read`**: Read the contents of `$SKILL_DIR/rounds.json`. Analyze the `rounds` array. Look for trends:
        *   Are scores consistently low?
        *   Is the score stuck at a specific value (plateau)?
        *   What is the ratio of `kept` to `rejected` outcomes?
        *   Note the `round_id` of the last few failed or low-scoring rounds.
    *   **Tool: `Read`**: Read `$SKILL_DIR/SKILL.md` to understand the skill's intended purpose, triggers, and steps. This provides context for the failures.
    *   **Tool: `Read`**: Read `$SKILL_DIR/eval.json` to understand how the skill is currently being measured.
4.  **Analyze Failure Logs:**
    *   **Tool: `Grep`**: Search `$SKILL_DIR/events.jsonl` for specific error indicators from recent failed rounds.
    *   `grep '"event_type": "error"' $SKILL_DIR/events.jsonl`
    *   `grep -i "FAIL\|Exception\|Traceback" $SKILL_DIR/events.jsonl`
    *   Correlate the timestamps or `round_id` from the logs with the data from `rounds.json`. Pay close attention to the agent's thoughts (`"event_type": "thought"`) just before an error occurs.

### Phase 2: Hypothesis Formulation

5.  **Identify Failure Component:** Based on the evidence gathered in Phase 1, determine the most likely root cause. The goal is to classify the problem into one of these categories:
    *   **Prompt Issue:** The agent consistently misunderstands instructions, produces malformed output, or gets stuck in a loop. The error is logical, not a technical crash. The logs show confusion or incorrect reasoning.
    *   **Code/Tool Issue:** `events.jsonl` contains explicit stack traces, `bash` command errors (e.g., `command not found`, non-zero exit codes), or API errors.
    *   **Evaluation Issue:** The logs show the skill is performing its task reasonably well, but the score in `rounds.json` is low. This suggests the criteria in `eval.json` may not accurately reflect the skill's true utility or are too stringent.
6.  **Formulate Hypothesis:** State a clear, testable hypothesis.
    *   *Good Hypothesis (Prompt):* "The `scaffold` skill fails because the prompt in step 3 is ambiguous about handling missing parameters. Clarifying the instruction to 'prompt the user for any missing required parameters' should fix it."
    *   *Good Hypothesis (Code):* "The `api-caller` skill is failing with a `401 Unauthorized` error because the authentication token is expired. The code that refreshes the token needs to be fixed."
    *   *Good Hypothesis (Eval):* "The `context-drift-detector` score is plateaued at 0.75 because the `eval.json` only rewards identifying the drift, but not quantifying its magnitude. Adding a criterion for 'magnitude_accuracy' will provide a better performance signal."

### Phase 3: Proposing and Applying a Change

7.  **Backup Original File:** Before editing, create a backup of the file you intend to modify.
    *   **Tool: `Bash`**: `cp $SKILL_DIR/SKILL.md $SKILL_DIR/SKILL.md.bak`
8.  **Apply Modification:**
    *   **Tool: `Edit`**: Use the `Edit` tool to apply the precise change to the target file (`SKILL.md`, a script file, or `eval.json`). The change should be minimal and directly address the hypothesis.
9.  **Update Changelog:** Document the experiment.
    *   **Tool: `Edit`**: Append a new entry to `$SKILL_DIR/changelog.md`.
    ```markdown
    ### YYYY-MM-DD - Improvement Experiment
    *   **Hypothesis:** {Your formulated hypothesis}
    *   **Change:** {A brief description of the change made}
    *   **Result:** PENDING
    ```

### Phase 4: Re-evaluation and Analysis

10. **Trigger New Evaluation:** Run the system's evaluation tool on the modified skill.
    *   **Tool: `Bash`**: `autoresearch-runner --skill {skill_name} --eval`
11. **Monitor and Parse Results:** Wait for the runner to complete. It will add a new entry to `$SKILL_DIR/rounds.json`.
    *   **Tool: `Read`**: Read `$SKILL_DIR/rounds.json` again and parse the JSON to get the last (most recent) round's data.
    *   Compare the `score` and `outcome` of the new round with the previous one.

### Phase 5: Decision and Cleanup

12. **Analyze Outcome:**
    *   **If `outcome` is `kept` and `score` has improved:** The hypothesis was correct. The experiment was a success.
        *   Update the `changelog.md` entry's `Result` to "SUCCESS - Score improved to {new_score}. Change kept."
        *   **Tool: `Bash`**: `rm $SKILL_DIR/SKILL.md.bak` (or the relevant backup file).
        *   Report success.
    *   **If `outcome` is `rejected` or `score` has decreased/stagnated:** The hypothesis was incorrect or the change was implemented poorly.
        *   Update the `changelog.md` entry's `Result` to "FAILURE - Score became {new_score}. Reverting change."
        *   **Revert Change:** Restore the original file from the backup.
        *   **Tool: `Bash`**: `mv $SKILL_DIR/SKILL.md.bak $SKILL_DIR/SKILL.md`
        *   Report failure and the reversion. If possible, suggest a new hypothesis based on the new failure mode.

## Output Format

*   **File Modifications:** The primary output is the modification (or reversion) of files within the target skill's directory (e.g., `SKILL.md`, `eval.json`, `changelog.md`).
*   **Console Output:** A final summary report in markdown format:
    ```markdown
    # Skill Improvement Report: `{skill_name}`

    **Status:** SUCCESS / FAILURE

    **Analysis Summary:**
    - The skill was failing due to {brief summary of the problem}.
    - Evidence was found in `events.jsonl` showing {specific error or behavior}.

    **Hypothesis:**
    - {The formulated hypothesis}.

    **Modification:**
    - Applied the following change to `{file_name}`:
    - {Brief description or diff of the change}.

    **Evaluation Result:**
    - Previous Score: {old_score}
    - New Score: {new_score}
    - Outcome: {kept/rejected}

    **Conclusion:**
    - The change was an improvement and has been **kept**.
    - OR
    - The change was not an improvement and has been **reverted**.
    ```

## Quality Gates

Before completing, verify the following checks have passed:
1.  [ ] **Correct Component Identified:** The analysis correctly pinpointed the failing component (prompt, code, or eval) based on log evidence.
2.  [ ] **Targeted Modification:** The proposed change directly addresses a specific failure mode observed in the logs (e.g., an error message, a logical fallacy).
3.  [ ] **Successful Application:** The modification was successfully applied to the target skill's definition file(s) using the `Edit` tool.
4.  [ ] **Evaluation Triggered:** A new evaluation run for the modified skill was successfully initiated via `autoresearch-runner`.
5.  [ ] **Result Parsed:** The new evaluation results were correctly parsed from `rounds.json` and compared against the baseline performance.
6.  [ ] **Reversion on Failure:** If the change did not result in an improvement, the modified files were successfully reverted to their original state.

## Integration Points

*   **Upstream:** Can be triggered by a `system-monitor` skill that detects performance degradation or plateaus.
*   **Downstream:** Triggers the `autoresearch-runner` to evaluate the modified skill.
*   **System State:** Reads and writes to skill definition directories in `~/.remote/@autoresearch/skills/`. Updates to a skill's `changelog.md` provide a persistent record of self-improvement attempts.

## Error Handling

*   **Skill Not Found:** If the directory `~/.remote/@autoresearch/skills/working-{skill_name}/` does not exist, terminate with an error message.
*   **Missing Data:** If `rounds.json` or `events.jsonl` are missing, terminate with a message stating that there is insufficient data for analysis.
*   **Evaluation Runner Failure:** If the `autoresearch-runner` command fails, log the error output, revert any changes made to the skill files, and terminate.
*   **File I/O Errors:** If unable to read, write, or backup files, terminate and report the I/O error. Ensure no partial changes are left behind.

## Examples

### Example 1: Fixing a Prompt in `context-drift-detector`

*   **Trigger:** `/improve-skill context-drift-detector`
*   **Analysis:** `rounds.json` shows the score is stuck at 0.5. `events.jsonl` reveals the skill correctly identifies drift but often fails to output the result in the required JSON format, causing the evaluation to fail.
*   **Hypothesis:** The `SKILL.md` prompt's output format instructions are unclear.
*   **Modification:** `Edit` the `SKILL.md` to add a clear, explicit example of the required JSON output format in the final step.
*   **Evaluation:** Run `autoresearch-runner`. The new score is 0.9 and the outcome is `kept`.
*   **Output:** A success report is generated, and the change to `SKILL.md` is made permanent.

### Example 2: Fixing a Bug in a Skill's Tool

*   **Trigger:** `/improve-skill citation-generator`
*   **Analysis:** `events.jsonl` shows a consistent Python `KeyError` traceback originating from a helper script `scripts/format_citation.py`. `rounds.json` shows a score of 0.0 for the last 3 rounds.
*   **Hypothesis:** The script `scripts/format_citation.py` does not correctly handle entries missing an 'author' key.
*   **Modification:** `Edit` the script to use `.get('author', 'N/A')` instead of `['author']` to provide a default value and prevent the `KeyError`.
*   **Evaluation:** Run `autoresearch-runner`. The script no longer crashes, and the score improves to 0.85.
*   **Output:** A success report is generated, and the change to the Python script is kept.

### Example 3: Reverting a Failed Experiment

*   **Trigger:** `/improve-skill code-optimizer`
*   **Analysis:** The skill is slow. `rounds.json` shows it often times out.
*   **Hypothesis:** Replacing a file-based cache with an in-memory dictionary will speed it up.
*   **Modification:** `Edit` the skill's main script to change the caching mechanism.
*   **Evaluation:** Run `autoresearch-runner`. The skill now fails with an `OutOfMemoryError`. The new score is 0.0 and the outcome is `rejected`.
*   **Output:** A failure report is generated. The skill's script is automatically reverted from the backup to its previous, slower-but-functional state. The `changelog.md` is updated to document the failed experiment.