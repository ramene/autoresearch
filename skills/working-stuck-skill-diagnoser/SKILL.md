# SKILL: stuck-skill-diagnoser

Analyzes a skill's performance history, failure logs, and evaluation criteria to hypothesize why it is stuck and propose a remediation strategy.

## Purpose

This skill exists to address `want-019`. The core hypothesis is that the system's self-improvement loop is broken or inefficient. Multiple skills, including the primary self-improvement skill `skill-improver`, have stopped improving. This indicates a fundamental meta-capability gap. `stuck-skill-diagnoser` is the first step in fixing this meta-problem. It provides a deep, evidence-based analysis of *why* a skill is failing to improve, moving beyond simple scores to identify the root cause, whether it's a flawed prompt, buggy code, or poor evaluation criteria.

## Trigger Conditions

*   **Slash Command**: `/diagnose-skill <skill_name>`
*   **Keywords**: "skill is stuck", "why isn't [skill_name] improving?", "diagnose skill performance", "skill plateaued", "debug skill failure", "analyze skill", "skill not improving", "investigate skill", "skill diagnosis", "diagnose [skill_name]", "what's wrong with [skill_name]", "skill performance analysis", "skill failure analysis", "skill is failing", "skill improvement stuck".
*   **Automatic Detection**: This skill should be triggered automatically by a monitoring process when a skill's score in `rounds.json` has not improved for 3 or more consecutive evaluation rounds.

## Prerequisites

*   The target skill, identified by `<skill_name>`, must have a corresponding directory at `~/.remote/@autoresearch/skills/working-{skill_name}/`.
*   This directory must contain the following files:
    *   `SKILL.md`: The skill's definition.
    *   `eval.json`: The evaluation criteria and test scenarios.
    *   `rounds.json`: A history of evaluation scores and results.
    *   `events.jsonl`: Detailed logs from the `autoresearch-runner` for past runs.
*   The `rounds.json` file should contain data for at least 3 evaluation rounds to reliably detect a plateau.

## Execution Steps

1.  **Initialization and Input Validation**
    *   Accept the `<skill_name>` as an argument.
    *   Construct the path to the skill's working directory: `SKILL_DIR="~/.remote/@autoresearch/skills/working-${skill_name}"`.
    *   **[Bash]** Use `test -d "$SKILL_DIR"` to verify that the directory exists. If not, execute the "Skill Not Found" error handling procedure.
    *   **[Bash]** Verify that `"$SKILL_DIR/rounds.json"`, `"$SKILL_DIR/eval.json"`, and `"$SKILL_DIR/events.jsonl"` all exist. If any are missing, execute the "Missing Files" error handling procedure.

2.  **Performance History Analysis**
    *   **[Read]** Load the contents of `$SKILL_DIR/rounds.json`.
    *   Parse the JSON and extract the list of rounds. If there are fewer than 3 rounds, execute the "No Performance Data" error handling procedure.
    *   Iterate through the rounds chronologically and track the `score` for each.
    *   Identify a performance plateau: a sequence of 3 or more consecutive rounds where the score does not increase. Note the round number where the plateau began and the score at which it plateaued.
    *   **Early Exit — Healthy Skill**: A skill is considered healthy if ALL of the following are true: (a) no plateau is detected, (b) the skill's score in the most recent round equals the maximum score observed across all rounds, AND (c) the score trend over the last 3 rounds is stable or improving. If all three conditions hold:
        *   Generate a report containing **only** the Performance Summary section (Section 1 of the Output Format).
        *   The report MUST include the text `Stuck Condition Detected: No`.
        *   The report MUST NOT include any of the following section headers: `## 2. Consistently Failing Criteria`, `## 3. Failure Analysis`, `## 4. Root Cause Hypothesis`, or `## 5. Proposed Remediation Strategy`.
        *   Conclude with a note that no action is needed.
        *   Skip Steps 3–6 entirely and proceed directly to Step 8 to write and print the report.
    *   If no plateau is detected but the skill has a low or declining score, note this and continue to Step 3.
    *   Store the findings (plateau status, score, start round) for the final report.

3.  **Failing Criteria Identification**
    *   Focus on the rounds identified as part of the plateau (or all rounds if no plateau).
    *   For each of these rounds, parse the `results` object from `rounds.json`. The `results` object contains keys corresponding to the criteria IDs from `eval.json` and boolean values indicating pass/fail.
    *   Create a frequency map to count how many times each criterion ID has failed.
    *   **[Read]** Load `$SKILL_DIR/eval.json` to get the human-readable description for each criterion ID.
    *   Identify the criteria that fail most frequently (e.g., in > 50% of the analyzed rounds). These are the "stuck criteria". Store this list for the report.

4.  **Failure Correlation with Scenarios and Logs**
    *   For each "stuck criterion" identified in the previous step:
        *   Look up the criterion in `eval.json` to identify which test scenarios it is associated with.
        *   **[Grep]** Search the `$SKILL_DIR/events.jsonl` file for log entries corresponding to the failing rounds and the associated failing test scenarios. Filter for lines containing `"event_type": "test_case_result"` where `"passed": false`.
        *   Examine the log entries immediately preceding the failure event for error messages, stack traces, unexpected tool output, or other anomalies.
        *   If `events.jsonl` exists but contains no entries matching the failing scenario, note this explicitly: "No log entries found for scenario '{scenario_id}' — the skill may have errored before logging, or the scenario was never reached." This absence of logs is itself diagnostic evidence.
        *   Synthesize the findings. For example: "Criterion 'output-is-valid-json' consistently fails on test scenario 'handle-empty-input'. Logs from round 5 show a `JSONDecodeError` because the skill produced an empty string instead of `'{}'`."

5.  **Root Cause Hypothesis Generation**
    *   Review all the evidence collected: the performance plateau, the specific stuck criteria, and the correlation with test scenarios and logs.
    *   Formulate a hypothesis that categorizes the root cause into one of three types. You must justify your choice.
        *   **Prompt Flaw**: The instructions in `SKILL.md` are ambiguous, incomplete, or misleading, causing the agent to consistently misinterpret the task in specific situations. (Evidence: The agent's logic seems sound but doesn't match the *intent* of a failing test case).
        *   **Code/Tool Flaw**: The skill's implementation (or a tool it relies on) has a bug. (Evidence: Concrete error messages, stack traces, consistently incorrect calculations, or failure to handle an edge case identified in the logs).
        *   **Evaluation Flaw**: The criteria or scenarios in `eval.json` are flawed. They might be too strict, ambiguous, or testing something irrelevant to the skill's core purpose. (Evidence: The agent's output appears correct and useful to a human observer, but the automated check still fails).

6.  **Remediation Strategy Proposal**
    *   Based on the hypothesis from the previous step, create a numbered list of concrete, actionable steps to fix the problem.
    *   If **Prompt Flaw**: Propose specific changes. E.g., "1. Rewrite the 'Output Format' section in `SKILL.md` to explicitly require a JSON object `"{}"` for empty inputs, not an empty string. 2. Add an example to the prompt showing the correct handling of empty inputs."
    *   If **Code/Tool Flaw**: Propose debugging steps. E.g., "1. Add a new test scenario to `eval.json` that specifically provides an empty file as input to isolate the failure. 2. Advise `skill-improver` to focus on the code path that handles file reading, checking for an empty read before attempting to parse JSON."
    *   If **Evaluation Flaw**: Propose changes to the tests. E.g., "1. Modify the evaluation check for criterion 'output-is-valid-json' in the runner to accept both `"{}"` and an empty string as valid for the 'handle-empty-input' scenario. 2. Alternatively, relax the criterion to only apply to non-empty inputs."

7.  **Recursive Analysis (Special Case for `skill-improver`)**
    *   **[Bash]** If `<skill_name>` is `skill-improver`, perform this additional step.
    *   **[Glob, Read]** Scan the `changelog.md` and `rounds.json` files of several other skills (e.g., `context-drift-detector`, `scaffold`).
    *   Check if `skill-improver` has recently modified them. Correlate its changes with the subsequent performance of those skills. Did its "improvements" result in a score increase?
    *   Analyze `skill-improver`'s own failure logs. Is it consistently failing to generate a certain type of change (e.g., code modifications vs. prompt modifications)?
    *   Incorporate these meta-findings into the hypothesis and remediation plan for `skill-improver`.

8.  **Final Report Generation**
    *   Determine the output path: `REPORT_PATH="${SKILL_DIR}/diagnosis_${skill_name}_$(date +%s).md"`. The report is always written inside the skill's own working directory (`$SKILL_DIR/`) so that it can be reliably located by downstream tools and evaluators.
    *   **[Write]** Create the report file at `$REPORT_PATH`.
    *   Assemble all the findings from the previous steps into this file, following the structure defined in the "Output Format" section.
    *   After writing, print to stdout: `Diagnosis report written to: $REPORT_PATH`

## Output Format

The skill produces a single markdown file saved to `$SKILL_DIR/diagnosis_{skill_name}_{timestamp}.md`.

For a **stuck or declining skill**, the report contains all five sections:

```markdown
## Diagnosis Report for {skill_name}

### 1. Performance Summary
*   **Stuck Condition Detected**: Yes/No
*   **Current Score**: {score}
*   **Plateau Score**: {score}
*   **Plateau Began**: Round {round_number}
*   **Analysis**: {A brief sentence summarizing the performance trend, e.g., "The skill's score has been stuck at 50 for the last 4 rounds."}

### 2. Consistently Failing Criteria
*   **{criterion_id}**: {criterion_description} (Failed in X out of Y rounds)
*   **{criterion_id}**: {criterion_description} (Failed in Z out of Y rounds)

### 3. Failure Analysis
{A detailed paragraph for each failing criterion, explaining the correlation between the criterion, the test scenarios, and the evidence found in the logs.}

### 4. Root Cause Hypothesis
*   **Hypothesized Cause**: Prompt Flaw | Code/Tool Flaw | Evaluation Flaw
*   **Justification**: {A detailed explanation of why this cause is suspected, referencing the evidence from the analysis.}

### 5. Proposed Remediation Strategy
1.  {First concrete, actionable step.}
2.  {Second concrete, actionable step.}
3.  {...}
```

For a **healthy skill** (early exit triggered in Step 2), the report contains **only Section 1** and must omit Sections 2–5 entirely:

```markdown
## Diagnosis Report for {skill_name}

### 1. Performance Summary
*   **Stuck Condition Detected**: No
*   **Current Score**: {score} (equals maximum observed score of {max_score} across all rounds)
*   **Analysis**: {A brief sentence confirming healthy performance, e.g., "The skill is performing at its peak with a stable or improving trend. No action is needed."}
```

## Quality Gates

Before completing, verify the generated report against these checks:
1.  **Plateau Identified**: Does the report correctly state whether a performance plateau was found in `rounds.json`?
2.  **Failing Criteria Pinpointed**: Does the report list the specific, human-readable evaluation criteria that are consistently failing?
3.  **Failure Correlated**: Does the analysis section link failing criteria to specific test scenarios from `eval.json` and evidence from `events.jsonl`?
4.  **Hypothesis Categorized**: Does the hypothesis clearly state whether the root cause is a flaw in the prompt, code/tool, or evaluation?
5.  **Remediation is Actionable**: Is the proposed strategy a list of concrete actions (e.g., "rewrite prompt section X," "add test case Y," "refine criterion Z")?
6.  **Recursive Analysis Performed**: If the target skill was `skill-improver`, does the report include the special meta-analysis?
7.  **Report Location Confirmed**: Is the report saved to `$SKILL_DIR/diagnosis_{skill_name}_{timestamp}.md` and is the path printed to stdout?
8.  **Healthy Skill Short-Circuit**: If the skill was healthy (score equals the maximum observed across all rounds, no plateau, stable or improving trend), does the report: (a) include `Stuck Condition Detected: No`, (b) contain ONLY the Performance Summary section, and (c) contain NONE of the headers `Consistently Failing Criteria`, `Root Cause Hypothesis`, or `Proposed Remediation Strategy`?

## Integration Points

*   **Upstream**: Can be triggered by a `skill-improvement-monitor` skill that automatically detects stuck skills.
*   **Downstream**: The output diagnosis report is a critical input for the `skill-improver` skill. It provides a detailed "bug report" that guides the improvement process, making it more targeted and effective.
*   **System Model**: Can optionally update `self-model.json` to tag the diagnosed skill with `{"status": "stuck", "diagnosis_report": "path/to/report.md"}`.

## Error Handling

*   **Skill Not Found**: If the skill directory does not exist, print an error message "Error: Skill '{skill_name}' not found at '{path}'." and terminate.
*   **Missing Files**: If `rounds.json`, `eval.json`, or `events.jsonl` are missing, print an error "Error: Cannot perform diagnosis for '{skill_name}'. Missing required file: '{filename}'." and terminate.
*   **No Performance Data**: If `rounds.json` has fewer than 3 rounds of data, print a message "Warning: Insufficient performance data for '{skill_name}' (found {N} rounds, need at least 3). Cannot reliably detect a plateau." and terminate gracefully.

## Examples

**Example 1: Diagnosing a skill with a flawed prompt**
*   **Command**: `/diagnose-skill context-drift-detector`
*   **Expected Output**: A report `diagnosis_context-drift-detector_...md` is generated inside `working-context-drift-detector/`.
    *   **Hypothesis**: Prompt Flaw.
    *   **Justification**: "The skill consistently fails the 'detect-subtle-drift' criterion. The `SKILL.md` does not provide a clear definition or examples to distinguish between 'subtle' and 'major' context drift, leading the agent to misclassify it."
    *   **Remediation**: "1. Add a 'Definitions' section to `SKILL.md`. 2. Provide two distinct examples under this section, one for subtle drift and one for major drift, showing the expected output for each."

**Example 2: Diagnosing the meta-skill `skill-improver`**
*   **Command**: `/diagnose-skill skill-improver`
*   **Expected Output**: A report `diagnosis_skill-improver_...md` is generated inside `working-skill-improver/`.
    *   **Hypothesis**: Code/Tool Flaw.
    *   **Justification**: "The skill's score is plateaued at 30. Recursive analysis shows that while it proposes changes to other skills' `SKILL.md` files, its proposed changes have not led to score improvements in those skills. Its own failure logs show it repeatedly fails on test scenarios requiring code modification, indicating a weakness in its code generation or editing logic."
    *   **Remediation**: "1. Improve the `skill-improver` prompt to explicitly consider generating code patches in addition to prompt edits. 2. Add a new evaluation criterion to `skill-improver`'s `eval.json` that specifically tests its ability to fix a simple, known bug in a target skill's code."

**Example 3: Diagnosing a healthy, high-performing skill**
*   **Command**: `/diagnose-skill context-loader`
*   **Expected Output**: A report `diagnosis_context-loader_...md` is generated inside `working-context-loader/`.
    *   **Performance Summary**: "Stuck Condition Detected: No. Current Score: 95 (equals the maximum observed score of 95 across all rounds). The skill is performing at its peak and its score is stable."
    *   **Conclusion**: The report contains **only** the Performance Summary section. It does NOT contain section headers for "Consistently Failing Criteria", "Failure Analysis", "Root Cause Hypothesis", or "Proposed Remediation Strategy". Steps 3–6 are skipped entirely since there are no failing criteria to analyze.