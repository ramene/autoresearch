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
4.  The skill's evaluation criteria file, `eval.json`, is used when available for context on evaluation failures, but is **not required** to start analysis.

## Execution Steps

1.  **Initialization and Input Validation:**
    *   Accept `skill_name` and `round_number` as arguments.
    *   Construct the path to the skill's directory: `SKILL_DIR=~/.remote/@autoresearch/skills/working-$skill_name`.
    *   **[Bash]** Use `test -d "$SKILL_DIR"` to verify the directory exists. If not, exit with an error.
    *   Construct paths to essential files:
        *   `LOG_FILE="$SKILL_DIR/events.jsonl"`
        *   `EVAL_FILE="$SKILL_DIR/eval.json"`
    *   **[Bash]** Use `test -f` to verify that `LOG_FILE` exists. If not, exit with an error: "Error: Could not find logs for skill '{skill_name}' at the specified path."
    *   **Note:** `EVAL_FILE` existence is checked later, only if needed. Do NOT abort here if `eval.json` is missing.

2.  **Log Ingestion and Filtering:**
    *   **[Read]** Read the full contents of `LOG_FILE` into memory. Each line is a separate JSON object.
    *   **Parse each line individually and fault-tolerantly:** attempt to parse each line as JSON. If a line fails to parse, skip it and continue — do NOT abort. Keep a count of skipped lines. Only if zero lines parse successfully should you abort with: "Error: Could not parse any log entries. The log file may be entirely corrupted."
    *   If any lines were skipped, note this in the report: "Note: {N} malformed line(s) were skipped during log ingestion."
    *   Attempt to filter events matching the target `round_number` by checking each parsed JSON object for any of these common field patterns: `"round_number"`, `"round"`, or `"round_id"` matching the provided value.
    *   **If matching events are found**, work with that filtered subset.
    *   **If NO matching events are found** (field name mismatch or round not present), fall back to using ALL successfully-parsed events in the file and note in the report that round filtering was not possible. Do not abort — continue analysis on the full log.
    *   The working set of events (filtered or full) is now available for analysis.

3.  **Identify the Point of Failure:**
    *   Iterate through the working set of log events in chronological order (using the `timestamp` field if present).
    *   Search for the primary failure indicator event. Check in this order:
        1.  An event with `event_type: "tool_error"`. This is a direct indicator of a failed tool call.
        2.  An event with `event_type: "error"` containing a stack trace or exception message.
        3.  An event with `event_type: "evaluation_result"` and `"outcome": "failure"`. This indicates the skill ran to completion but produced an incorrect result.
        4.  An event with `event_type: "tool_result"` (or similar result event) where ANY of the following error indicators are present:
            *   `"exit_code"` field is non-zero (e.g., `"exit_code": 1`)
            *   `"status"` field equals `"error"`, `"failed"`, or `"failure"`
            *   `"error"` field is present and non-empty
            *   `"success"` field is explicitly `false`
        5.  Any event where a top-level `"error"` field is non-null and non-empty, regardless of `event_type`.
    *   If none of the above are found, the run was likely successful. Proceed to the "No Failure Found" error handling path.
    *   Store the identified failure event and the event immediately preceding it (the "context event," which is usually a `thought` or `tool_call` event).

4.  **Analyze Failure Context and Hypothesize Cause:**
    *   **Case A: Tool Error or Exception:**
        *   **[Causal Chain Check — perform this FIRST, before any other classification:]**
            *   Examine the context event (the event immediately preceding the failure).
            *   If the context event is a `tool_result` event that appears successful on the surface (e.g., `exit_code: 0`, or no `error` field, or `status: "success"`), **critically examine its `output` field**:
                *   Is the `output` field empty (empty string `""`, empty array `[]`, empty object `{}`, or null/missing)?
                *   Does the `output` field contain an error message or warning despite the successful exit code?
            *   **If yes to either:** The root cause is upstream — shift the hypothesis to this preceding step. Classify as **Systemic (Flawed Logic)** and frame the hypothesis as: "The preceding `[tool_name]` command succeeded (exit code 0) but returned empty or invalid output, causing the downstream `[failing_tool_name]` to fail when it received this unusable input. The root cause is the logic that produced the empty result, not the step that crashed." Use this as the root cause hypothesis and skip the remaining classification steps below.
        *   If the causal chain check does not apply, proceed with standard classification:
        *   Examine the context event (the `tool_call`). Note the tool name and parameters.
        *   Examine the failure event. Extract the error message and any traceback.
        *   **Hypothesize:**
            *   If the error is a `FileNotFoundError`, `KeyError`, or involves incorrect arguments, classify it as **Systemic (Bad Input)**. The agent likely passed incorrect parameters.
            *   If the error is a `TimeoutError`, `ConnectionError`, or an HTTP status code like 500, 503, or 429, classify it as **Transient (External Dependency)**.
            *   If the error is a `SyntaxError`, `NameError`, or other Python exception within a `Python` tool call, classify it as **Systemic (Code Bug)**.
            *   If the error is indicated by a non-zero exit code or `status: "error"` without a detailed message, classify it as **Systemic (Bad Input)** unless context suggests otherwise.
    *   **Case B: Evaluation Failure:**
        *   **[Bash]** Check if `EVAL_FILE` exists using `test -f "$EVAL_FILE"`.
        *   **If `EVAL_FILE` exists:** **[Read]** Load the `EVAL_FILE`. From the `evaluation_result` event, identify the specific `criterion_id` where `passed: false`. Find the description of this criterion in the `EVAL_FILE` to understand what was expected.
        *   **If `EVAL_FILE` does not exist:** Note in the report "eval.json not found — criterion descriptions unavailable." Identify the failed `criterion_id` directly from the `evaluation_result` event's `failed_criteria` array without cross-referencing the eval file.
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
        *   For **Systemic (Flawed Logic)** triggered by causal chain check: "Suggestion: Trace back to the `[preceding_tool_name]` step that produced empty/invalid output despite succeeding. Inspect the logic, query, or command that generated that result — add output validation or a guard before passing results to downstream steps."
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
*Example: The preceding `find` command succeeded (exit code 0) but returned no file paths, causing the downstream `grep` command to fail when it received empty input. The root cause is the `find` logic, not the `grep` step.*

**Error Type:**
`Systemic (Bad Input | Code Bug | Flawed Logic)` OR `Transient (External Dependency)` OR `Evaluation`

**Supporting Evidence:**
A snippet of the relevant log entry or error message, AND (when causal chain applies) the preceding successful-but-empty tool_result that caused it.
```json
{
  "event_type": "tool_result",
  "tool_name": "Bash",
  "exit_code": 0,
  "output": ""
}
```

**Suggested Next Step:**
An actionable recommendation for debugging.
*Example: Rerun with verbose logging to trace the variable's value, or add a check to ensure the file exists before calling `grep`.*
```

## Quality Gates
Before completing, the skill must verify:
1.  **[QG1] Log Parsed:** The internal log data structure is populated and contains events from the target round (or the full log if round filtering was not possible).
2.  **[QG2] Failure Point Identified:** The final report specifies a concrete tool call, code line, or evaluation criterion.
3.  **[QG3] Error Type Classified:** The report's 'Error Type' field is one of the predefined categories.
4.  **[QG4] Criterion Pinpointed:** For evaluation failures, the report must name the specific `criterion_id` that failed.
5.  **[QG5] Concise Summary:** The 'Root Cause Hypothesis' section is under 3 sentences.
6.  **[QG6] Actionable Suggestion:** The 'Suggested Next Step' provides a clear, executable action.
7.  **[QG7] Causal Chain Checked:** For any Case A (tool error) failure, the skill must confirm it examined the preceding context event's output field before settling on a root cause classification.

## Integration Points
-   **`autoresearch-runner`:** This skill is the primary consumer of failed run data from the runner. The runner can trigger this skill automatically and log its output for later review.
-   **`skill-developer`:** The analysis report from this skill can serve as the primary input for a future `skill-developer` agent, which could attempt to automatically patch the failing skill based on the suggestions.
-   **`issue-tracker`:** The markdown output can be piped to a skill that creates issues in a tracking system (e.g., GitHub Issues, Jira), automatically filing a bug report with pre-populated analysis.

## Error Handling
-   **Log/Skill Not Found:** If the specified `skill_name` directory or `events.jsonl` file does not exist, the skill will terminate with a clear error message: "Error: Could not find logs for skill '{skill_name}' at the specified path."
-   **No Failure Found:** If the skill scans the logs for the specified round and finds a successful `evaluation_result` event (or no failure events at all), it will output a success message: "No failure detected in the logs for {skill_name} round {round_number}. The run appears to have been successful."
-   **Unparsable Log:** If ALL lines in the `events.jsonl` file fail to parse as JSON, the skill will report: "Error: Could not parse any log entries. The log file may be entirely corrupted." If only SOME lines are malformed, those lines are skipped and analysis proceeds on the valid entries, with a note in the report.
-   **Missing eval.json:** If `eval.json` does not exist and the failure is an evaluation failure, proceed with criterion identification from the `evaluation_result` event alone and note the missing file in the report. Do not abort.

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

### Example 4: Partially Malformed Log
**Command:** `/analyze-failure data-importer 4`

**Output:**
```markdown
### Failure Analysis Report

- **Skill:** `data-importer`
- **Round:** `4`

> Note: 2 malformed line(s) were skipped during log ingestion. Analysis is based on the remaining valid entries.

---

**Point of Failure:**
Tool call `Bash` failed with exit code 1.

...
```

### Example 5: Non-Standard Error Format (exit_code / status field)
**Command:** `/analyze-failure api-fetcher 2`

**Output:**
```markdown
### Failure Analysis Report

- **Skill:** `api-fetcher`
- **Round:** `2`

---

**Point of Failure:**
Tool call `Bash` produced a result event with `exit_code: 1`, indicating a non-zero exit status.

**Root Cause Hypothesis:**
The Bash command exited with a failure code, suggesting the underlying shell command encountered an error. The preceding tool_call event shows the command and parameters that triggered this failure.

**Error Type:**
`Systemic (Bad Input)`

**Supporting Evidence:**
```json
{
  "event_type": "tool_result",
  "tool_name": "Bash",
  "exit_code": 1,
  "output": "curl: (6) Could not resolve host: api.example.com"
}
```

**Suggested Next Step:**
Examine the `thought` process prior to the failed tool call to understand why incorrect parameters were generated. Verify file paths and variable states.
```

### Example 6: Tool Error Without eval.json Present
**Command:** `/analyze-failure new-skill 1`

**Output:**
```markdown
### Failure Analysis Report

- **Skill:** `new-skill`
- **Round:** `1`

---

**Point of Failure:**
Tool call `Bash` failed with a non-zero exit code.

**Root Cause Hypothesis:**
The Bash command returned exit code 127 (command not found), indicating the required tool or binary was not available in the execution environment.

**Error Type:**
`Systemic (Bad Input)`

**Supporting Evidence:**
```json
{
  "event_type": "tool_result",
  "tool_name": "Bash",
  "exit_code": 127,
  "output": "jq: command not found"
}
```

**Suggested Next Step:**
Examine the `thought` process prior to the failed tool call to understand why incorrect parameters were generated. Verify file paths and variable states.
```

### Example 7: Causal Chain — Upstream Empty Output
**Command:** `/analyze-failure file-processor 3`

**Output:**
```markdown
### Failure Analysis Report

- **Skill:** `file-processor`
- **Round:** `3`

---

**Point of Failure:**
Tool call `Bash` (`grep`) failed with exit code 1 (no matches / no input).

**Root Cause Hypothesis:**
The preceding `find` command succeeded (exit code 0) but returned empty output — no file paths were found. The downstream `grep` command then failed because it received no files to search. The root cause is the `find` logic that produced no results, not the `grep` step that crashed.

**Error Type:**
`Systemic (Flawed Logic)`

**Supporting Evidence:**
```json
[
  {
    "event_type": "tool_result",
    "tool_name": "Bash",
    "exit_code": 0,
    "output": "",
    "note": "Preceding find command — succeeded but returned no paths"
  },
  {
    "event_type": "tool_error",
    "tool_name": "Bash",
    "error_message": "grep: no input files specified"
  }
]
```

**Suggested Next Step:**
Trace back to the `find` step that produced empty output despite succeeding. Inspect the search path, file pattern, or filters used — add a guard that checks whether `find` returned results before passing its output to downstream commands.
```