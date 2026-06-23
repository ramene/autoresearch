# failure-log-analyzer
Ingests skill execution logs from a failed run, identifies the likely point of failure, and hypothesizes the root cause.

## Purpose
This skill addresses `want-022`. The system currently lacks the ability to perform automated root cause analysis on skill failures. This leads to a significant backlog of unresolved issues and requires high manual debugging effort from users and developers. By automating the initial analysis of failure logs, this skill aims to accelerate the debugging cycle, reduce manual toil, and provide actionable insights for resolving skill execution errors.

## Trigger Conditions
This skill can be activated in the following ways:

1.  **Slash Command:**
    ```bash
    /analyze-failure <skill_name> <round_number>
    ```
    *   **Example:** `/analyze-failure content-strategy-optimizer 7`

2.  **Keywords:**
    *   "analyze failure log for [skill_name]"
    *   "debug the error in [skill_name] round [round_number]"
    *   "what went wrong with [skill_name]"
    *   "find the root cause for the failure of [skill_name]"

3.  **Automatic Detection:**
    *   This skill can be triggered automatically by the `autoresearch-runner` immediately after a skill evaluation results in a `failure` outcome.

## Prerequisites
Before this skill can run, the following must be true:
1.  The `skill_name` and `round_number` of the failed run must be provided.
2.  The target skill's working directory must exist at `~/.remote/@autoresearch/skills/working-{skill_name}/`.
3.  The skill execution log file, `events.jsonl`, must exist within the skill's directory.
4.  The skill's evaluation criteria file, `eval.json`, must exist for context on evaluation failures.

## Execution Steps

1.  **Initialization and Input Validation:**
    *   Accept `skill_name` and `round_number` as arguments.
    *   Construct the path to the skill's directory: `SKILL_DIR=~/.remote/@autoresearch/skills/working-$skill_name`.
    *   **[Bash]** Use `test -d "$SKILL_DIR"` to verify the directory exists. If not, exit with an error.
    *   Construct paths to essential files:
        *   `LOG_FILE="$SKILL_DIR/events.jsonl"`
        *   `EVAL_FILE="$SKILL_DIR/eval.json"`
    *   **[Bash]** Use `test -f` to verify that `LOG_FILE` and `EVAL_FILE` exist. If not, exit with an error.

2.  **Log Ingestion and Filtering:**
    *   **[Grep]** Filter the `LOG_FILE` to extract only the JSON log entries relevant to the specified `round_number`.
        ```bash
        grep "\"round_number\": $round_number" "$LOG_FILE" > /tmp/filtered_log.jsonl
        ```
    *   **[Read]** Load the contents of `/tmp/filtered_log.jsonl` into memory for analysis. Parse each line as a separate JSON object.

3.  **Identify the Point of Failure:**
    *   Iterate through the parsed log events in chronological order (using the `timestamp`).
    *   Search for the primary failure indicator event. Check in this order:
        1.  An event with `event_type: "tool_error"`. This is a direct indicator of a failed tool call.
        2.  An event with `event_type: "error"` containing a stack trace or exception message.
        3.  An event with `event_type: "evaluation_result"` and `"outcome": "failure"`. This indicates the skill ran to completion but produced an incorrect result.
    *   If none of the above are found, the run was likely successful. Proceed to the "No Failure Found" error handling path.
    *   Store the identified failure event and the event immediately preceding it (the "context event," which is usually a `thought` or `tool_call` event).

4.  **Analyze Failure Context and Hypothesize Cause:**
    *   **Case A: Tool Error or Exception:**
        *   Examine the context event (the `tool_call`). Note the tool name and parameters.
        *   Examine the `tool_error` event. Extract the error message and any traceback.
        *   **Hypothesize:**
            *   If the error is a `FileNotFoundError`, `KeyError`, or involves incorrect arguments, classify it as **Systemic (Bad Input)**. The agent likely passed incorrect parameters.
            *   If the error is a `TimeoutError`, `ConnectionError`, or an HTTP status code like 500, 503, or 429, classify it as **Transient (External Dependency)**.
            *   If the error is a `SyntaxError`, `NameError`, or other Python exception within a `Python` tool call, classify it as **Systemic (Code Bug)**.
    *   **Case B: Evaluation Failure:**
        *   **[Read]** Load the `EVAL_FILE`.
        *   From the `evaluation_result` event, identify the specific `criterion_id` where `passed: false`.
        *   Find the description of this criterion in the `EVAL_FILE` to understand what was expected.
        *   Examine the `actual_output` field in the evaluation event.
        *   Review the sequence of `thought` events leading up to the final output.
        *   **Hypothesize:**
            *   If the output format is wrong, classify as **Systemic (Output Mismatch)**. The agent may have misinterpreted the `SKILL.md` instructions.
            *   If the output is logically incorrect or incomplete, classify as **Systemic (Flawed Logic)**. The agent's reasoning process was flawed.

5.  **Formulate Report and Suggestions:**
    *   Synthesize the findings into a structured analysis.
    *   Based on the hypothesis, generate a concrete, actionable next step for debugging.
        *   For **Systemic (Bad Input)**: "Suggestion: Examine the `thought` process prior to the failed tool call to understand why incorrect parameters were generated. Verify file paths and variable states."
        *   For **Transient (External Dependency)**: "Suggestion: Rerun the skill. If the problem persists, consider implementing a retry mechanism with exponential backoff for the failing tool call."
        *   For **Systemic (Code Bug)**: "Suggestion: Debug the Python code executed by the tool. The traceback indicates the exact line of failure."
        *   For **Systemic (Output Mismatch/Flawed Logic)**: "Suggestion: Review the `SKILL.md` and `eval.json` to ensure a correct understanding of the requirements. The agent's reasoning deviated from the expected logic."

6.  **Generate Output:**
    *   **[Bash]** Create an analysis directory if it doesn't exist: `mkdir -p "$SKILL_DIR/analysis"`.
    *   **[Write]** Format the complete analysis into a markdown report and save it to `$SKILL_DIR/analysis/failure-round-$round_number.md`.
    *   Print the same markdown report to the console.

## Output Format
The skill produces a markdown-formatted report both as a file and to standard output.

**File Location:** `~/.remote/@autoresearch/skills/working-{skill_name}/analysis/failure-round-{round_number}.md`

**Content Structure:**
```markdown
### Failure Analysis Report

- **Skill:** `[skill_name]`
- **Round:** `[round_number]`

---

**Point of Failure:**
A clear description of the event that failed.
*Example: Tool call `Bash` failed with a non-zero exit code.*
*Example: Evaluation failed on criterion `output_is_valid_json`.*

**Root Cause Hypothesis:**
A concise, 1-2 sentence hypothesis for the failure.
*Example: The `grep` command was passed a non-existent file path because the variable was not correctly initialized in the preceding step.*

**Error Type:**
`Systemic (Bad Input | Code Bug | Flawed Logic)` OR `Transient (External Dependency)` OR `Evaluation`

**Supporting Evidence:**
A snippet of the relevant log entry or error message.
```json
{
  "event_type": "tool_error",
  "tool_name": "Bash",
  "error_message": "grep: /tmp/nonexistent_file.txt: No such file or directory",
  ...
}
```

**Suggested Next Step:**
An actionable recommendation for debugging.
*Example: Rerun with verbose logging to trace the variable's value, or add a check to ensure the file exists before calling `grep`.*
```

## Quality Gates
Before completing, the skill must verify:
1.  **[QG1] Log Parsed:** The internal log data structure is populated and contains events from the target round.
2.  **[QG2] Failure Point Identified:** The final report specifies a concrete tool call, code line, or evaluation criterion.
3.  **[QG3] Error Type Classified:** The report's 'Error Type' field is one of the predefined categories.
4.  **[QG4] Criterion Pinpointed:** For evaluation failures, the report must name the specific `criterion_id` that failed.
5.  **[QG5] Concise Summary:** The 'Root Cause Hypothesis' section is under 3 sentences.
6.  **[QG6] Actionable Suggestion:** The 'Suggested Next Step' provides a clear, executable action.

## Integration Points
-   **`autoresearch-runner`:** This skill is the primary consumer of failed run data from the runner. The runner can trigger this skill automatically and log its output for later review.
-   **`skill-developer`:** The analysis report from this skill can serve as the primary input for a future `skill-developer` agent, which could attempt to automatically patch the failing skill based on the suggestions.
-   **`issue-tracker`:** The markdown output can be piped to a skill that creates issues in a tracking system (e.g., GitHub Issues, Jira), automatically filing a bug report with pre-populated analysis.

## Error Handling
-   **Log/Skill Not Found:** If the specified `skill_name` directory or `events.jsonl` file does not exist, the skill will terminate with a clear error message: "Error: Could not find logs for skill '{skill_name}' at the specified path."
-   **No Failure Found:** If the skill scans the logs for the specified round and finds a successful `evaluation_result` event (or no failure events at all), it will output a success message: "No failure detected in the logs for {skill_name} round {round_number}. The run appears to have been successful."
-   **Unparsable Log:** If the `events.jsonl` file contains malformed JSON for the target round, the skill will report: "Error: Could not parse log entries for round {round_number}. The log file may be corrupted."

## Examples

### Example 1: Python Exception Failure
**Command:** `/analyze-failure data-importer 3`

**Output:**
```markdown
### Failure Analysis Report

- **Skill:** `data-importer`
- **Round:** `3`

---

**Point of Failure:**
Tool call `Python` failed with an unhandled `KeyError`.

**Root Cause Hypothesis:**
The script attempted to access a dictionary key ('user_id') that did not exist in the JSON object returned from the API call. This is likely due to an unexpected change in the API's response schema.

**Error Type:**
`Systemic (Code Bug)`

**Supporting Evidence:**
```json
{
  "event_type": "tool_error",
  "tool_name": "Python",
  "error_message": "Traceback (most recent call last):\n  File \"<stdin>\", line 5, in <module>\nKeyError: 'user_id'"
}
```

**Suggested Next Step:**
Add defensive coding to the Python script. Check if the 'user_id' key exists before attempting to access it, and handle the case where it is missing.
```

### Example 2: Evaluation Criteria Failure
**Command:** `/analyze-failure report-generator 5`

**Output:**
```markdown
### Failure Analysis Report

- **Skill:** `report-generator`
- **Round:** `5`

---

**Point of Failure:**
Evaluation failed on criterion `output_is_valid_json`.

**Root Cause Hypothesis:**
The skill generated a text report that was missing a closing curly brace `}`, resulting in malformed JSON. The agent's final formatting step appears to be flawed.

**Error Type:**
`Evaluation`

**Supporting Evidence:**
```json
{
  "event_type": "evaluation_result",
  "outcome": "failure",
  "failed_criteria": [
    {
      "criterion_id": "output_is_valid_json",
      "passed": false,
      "reason": "Failed to parse JSON: unexpected end of data"
    }
  ],
  "actual_output": "{\n  \"title\": \"Weekly Summary\",\n  \"data\": [1, 2, 3]\n"
}
```

**Suggested Next Step:**
Review the final step in the `SKILL.md` for `report-generator`. Ensure the logic for constructing the final JSON string is robust and correctly terminates the structure.
```

### Example 3: Successful Run Analysis
**Command:** `/analyze-failure classify-leads 2`

**Output:**
```
No failure detected in the logs for classify-leads round 2. The run appears to have been successful.
```