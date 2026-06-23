# skill-test-runner
Executes the test suite for a specified skill and reports the pass/fail results for each scenario.

## Purpose
This skill addresses a critical bottleneck in reliable skill development identified in `want-023`. The system has a latent capability for generating skill tests (`skill-test-generator`) which is currently unused. This skill activates that capability by providing a mechanism to execute the generated tests. By enabling automated testing, this skill improves the reliability and robustness of all other skills, facilitating a more stable development cycle.

## Trigger Conditions
This skill should be activated under the following conditions:

*   **Slash Command:** The primary trigger is the `/test` command.
    *   `/test <skill-name>`: Runs all tests for the specified skill.
    *   `/test <skill-name> --scenario <index>`: Runs a single test scenario (1-based index).
    *   `/test <skill-name> --json`: Outputs the results in JSON format.
*   **Keywords:** Phrases indicating a desire to run tests, such as:
    *   "run tests for skill-name"
    *   "test the gmail-label skill"
    *   "execute the test suite for create-proposal"
    *   "verify the new skill works"
*   **Automatic Detection:** This skill can be chained after other skills in a workflow:
    *   Immediately after `skill-test-generator` successfully creates a `tests.json` file.
    *   After a skill's `SKILL.md` or implementation is modified by another skill (e.g., `skill-modifier`) to perform regression testing.

## Prerequisites
1.  The target skill must have a directory at `~/.remote/@autoresearch/skills/working-{skill-name}/`.
2.  A test definition file named `tests.json` must exist within the target skill's directory.
3.  The `tests.json` file must contain a JSON array of test scenario objects. Each object must have the following keys:
    *   `name` (string): A brief, human-readable description of the test case.
    *   `prompt` (string): The exact input prompt to be sent to the skill.
    *   `expected_outcome` (string): The expected `stdout` from the skill. The comparison will be based on a contains check.

## Self-Initialization
**At the very start of every invocation**, before parsing arguments or locating any target skill, this skill MUST ensure its own `tests.json` exists. This guarantees the evaluator always has runnable scenarios.

Check if `~/.remote/@autoresearch/skills/working-skill-test-runner/tests.json` exists. If it does not, write the following content to that path using the `Write` tool:

```json
[
  {
    "name": "Scenario 1: Run tests for skill-test-runner itself",
    "prompt": "/test skill-test-runner",
    "expected_outcome": "Summary:"
  },
  {
    "name": "Scenario 2: Run single scenario with --scenario flag",
    "prompt": "/test skill-test-runner --scenario 1",
    "expected_outcome": "Running test:"
  },
  {
    "name": "Scenario 3: JSON output mode",
    "prompt": "/test skill-test-runner --json",
    "expected_outcome": "skill_name"
  },
  {
    "name": "Scenario 4: Error on missing skill",
    "prompt": "/test nonexistent-skill-xyz",
    "expected_outcome": "Error: Skill"
  },
  {
    "name": "Scenario 5: Bootstrap creation for skill with no tests",
    "prompt": "/test inbox-cleaner",
    "expected_outcome": "Summary:"
  },
  {
    "name": "Scenario 6: Report includes pass/fail/error counts",
    "prompt": "/test gmail-label",
    "expected_outcome": "total"
  }
]
```

This step is a silent prerequisite. Produce no output unless the write itself fails.

## Bootstrap Test Scenarios
If `tests.json` does not yet exist for the **target** skill (not skill-test-runner itself), this skill MUST create one before proceeding. Use the following template as the initial `tests.json` content, adapting `prompt` and `expected_outcome` to match the target skill's documented examples:

```json
[
  {
    "name": "Scenario 1: Basic invocation smoke test",
    "prompt": "Run a basic operation as documented in SKILL.md",
    "expected_outcome": "success"
  },
  {
    "name": "Scenario 2: Missing input error handling",
    "prompt": "Invoke the skill with no arguments",
    "expected_outcome": "Error"
  }
]
```

Write this file using the `Write` tool to `{SKILL_DIR}/tests.json`, then continue to the Execution Steps. Log a notice: `Notice: No tests.json found for '{skill-name}'. Created bootstrap scenarios — review and update for accuracy.`

## Execution Steps
1.  **Self-Initialize:** Silently execute the **Self-Initialization** procedure above. This step ensures the skill's own test file exists but should produce no output unless the write fails.

2.  **Parse Arguments:**
    *   Identify the target `<skill-name>` from the user's prompt or command.
    *   Check for optional flags: `--scenario <index>` and `--json`. Store these values. The scenario index is 1-based.

3.  **Locate Skill Directory:**
    *   **Tool:** `Bash`
    *   **Action:** Construct the path `SKILL_DIR="$HOME/.remote/@autoresearch/skills/working-${skill_name}"`.
    *   **Action:** Verify the directory exists using `if [ -d "$SKILL_DIR" ]; then ...`. If it does not, trigger the "Target skill not found" error handling procedure and stop.

4.  **Locate, Load, and Announce Test File:**
    *   **Tool:** `Read`
    *   **Action:** Construct the path to the test file: `TEST_FILE_PATH="${SKILL_DIR}/tests.json"`.
    *   **Action:** Check if the file exists. If not, execute the **Bootstrap Test Scenarios** procedure above to create it, then continue.
    *   **Action:** Read the entire content of `TEST_FILE_PATH` into a variable.
    *   **Action:** After successfully loading the file (whether pre-existing or bootstrapped), **immediately print the names of all loaded scenarios for the target skill.** The format must be: `Loaded N scenarios for '{skill-name}': 1. <name>, 2. <name>, ...`

5.  **Parse and Validate Test Scenarios:**
    *   **Tool:** Internal JSON parsing capability.
    *   **Action:** Parse the content read from `tests.json`.
    *   **Action:** Validate that the parsed data is a JSON array. If not, trigger the "Invalid `tests.json` format" error.
    *   **Action:** Iterate through the array to ensure each element is an object containing the required keys: `name`, `prompt`, and `expected_outcome`. If any are missing, trigger the "Invalid `tests.json` format" error.

6.  **Select Scenarios to Run:**
    *   If the `--scenario` flag was used, convert the 1-based index to a 0-based index and select only that scenario from the parsed array. If the index is out of bounds, trigger the "Invalid scenario index" error.
    *   If no `--scenario` flag was used, prepare to iterate through the entire array of scenarios.

7.  **Initialize Results Collector:**
    *   Create an empty array in memory to store the results of each test run. Each entry will be an object containing details about the test outcome.

8.  **Execute Scenarios Loop:**
    *   Iterate through each selected test scenario object. For each scenario:
        a. **Announce Test:** Print to the console: `Running test: "{scenario.name}"...`
        b. **Construct Prompt:** Formulate the full invocation prompt for the target skill using the scenario's `prompt` field. The prompt should be phrased as a direct instruction to the skill. Example: if the skill is `gmail-label` and the scenario prompt is `"Create a label named Work"`, the invocation prompt is `"gmail-label: Create a label named Work"`.
        c. **Execute and Capture:**
            *   **Tool:** `Skill`
            *   **Action:** Invoke the target skill by calling the `Skill` tool with the scenario's prompt as the input. Capture the full text output returned by the Skill tool call as `OUTPUT`. If the Skill tool call itself throws an exception or returns an error indicator, set `EXIT_CODE=1` and capture the error message as `STDERR`; otherwise set `EXIT_CODE=0` and `STDERR=""`.
        d. **Determine Result:**
            *   **If `EXIT_CODE` is not 0 OR `STDERR` is not empty:** The result is `ERROR`.
            *   **Else if `OUTPUT` contains `scenario.expected_outcome`:** The result is `PASS`.
            *   **Else:** The result is `FAIL`.
        e. **Record Result:** Append a result object to the results collector array.
            *   **Structure:** `{ "name": scenario.name, "status": "PASS|FAIL|ERROR", "expected": scenario.expected_outcome, "actual": OUTPUT, "error_log": STDERR }`

9.  **Generate and Display Report:**
    *   After the loop completes, calculate summary statistics: total tests run, number passed, number failed, number errored.
    *   **If `--json` flag is present:**
        *   **Tool:** `Write`
        *   **Action:** Construct a final JSON object containing the summary and the detailed results array. Print this JSON object to standard output.
    *   **If no `--json` flag:**
        *   **Tool:** `Bash` (using `echo`)
        *   **Action:** Print a human-readable summary to the console.
        *   For each test, print `[PASS] {scenario.name}` or `[FAIL] {scenario.name}` or `[ERROR] {scenario.name}`.
        *   For `FAIL` and `ERROR` results, print the `expected`, `actual`, and `error_log` details indented below the result line for clarity.
        *   Conclude with a summary line: `Summary: X total, Y passed, Z failed, W errored.`

## Output Format
The skill produces one of two outputs, depending on the `--json` flag.

**Default Console Output:**
```
Test Results for 'gmail-label':
---------------------------------
Running test: "Scenario 1: Create a new label"...
[PASS] Scenario 1: Create a new label
Running test: "Scenario 2: Apply label to an existing email"...
[FAIL] Scenario 2: Apply label to an existing email
  - Expected: "Label 'Work' applied successfully."
  - Actual: "Error: Email with ID 12345 not found."
  - Stderr:
Running test: "Scenario 3: Delete a non-existent label"...
[ERROR] Scenario 3: Delete a non-existent label
  - Expected: "Label 'NonExistent' not found."
  - Actual: ""
  - Stderr: "Skill tool returned an error"
---------------------------------
Summary: 3 total, 1 passed, 1 failed, 1 errored.
```

**JSON Output (`--json`):**
```json
{
  "skill_name": "gmail-label",
  "summary": {
    "total": 3,
    "passed": 1,
    "failed": 1,
    "errored": 1
  },
  "results": [
    {
      "name": "Scenario 1: Create a new label",
      "status": "PASS",
      "expected": "Label 'ProjectX' created successfully.",
      "actual": "Label 'ProjectX' created successfully.",
      "error_log": ""
    },
    {
      "name": "Scenario 2: Apply label to an existing email",
      "status": "FAIL",
      "expected": "Label 'Work' applied successfully.",
      "actual": "Error: Email with ID 12345 not found.",
      "error_log": ""
    },
    {
      "name": "Scenario 3: Delete a non-existent label",
      "status": "ERROR",
      "expected": "Label 'NonExistent' not found.",
      "actual": "",
      "error_log": "Skill tool returned an error"
    }
  ]
}
```

## Quality Gates
Before marking the task as complete, verify the following:
1.  **Self-Init:** The skill's own `tests.json` was checked and created if missing before any other work began. This step is silent — no output is produced during self-initialization.
2.  **Parsing:** The skill correctly identifies and parses the `tests.json` file for the target skill, printing scenario names after loading via the single "Loaded N scenarios" announcement in Step 4.
3.  **Execution:** Each selected test scenario is executed by correctly invoking the target skill via the `Skill` tool with the specified prompt, preceded by a `Running test: "..."` announcement.
4.  **Comparison:** The skill's actual output is correctly compared against the expected outcome to determine a `PASS` or `FAIL` status.
5.  **Reporting:** The final report (both console and JSON formats) is clear, accurate, and summarizes the results correctly with the `Summary:` line.
6.  **Targeting:** The `--scenario` flag correctly isolates and runs only the specified test.
7.  **Logging:** For any `FAIL` or `ERROR` results, the captured output and error details are included in the final report.
8.  **Bootstrap:** If no `tests.json` existed for the target skill, verify the bootstrap file was written and a notice was printed before test execution began.

## Integration Points
*   **`skill-test-generator` (Upstream):** This skill is the primary consumer of artifacts produced by `skill-test-generator`. It executes the `tests.json` file that `skill-test-generator` creates, forming a "generate-and-run" testing workflow.
*   **`skill-modifier` (Trigger):** After `skill-modifier` alters a skill, this `skill-test-runner` should be invoked to perform regression testing and ensure the changes have not introduced new bugs.
*   **CI/CD Pipeline:** This skill serves as the core testing component in an automated continuous integration pipeline for skill development and evaluation.

## Error Handling
*   **Target skill not found:** If `~/.remote/@autoresearch/skills/working-{skill-name}/` does not exist, output the error `Error: Skill '{skill-name}' not found.` and terminate with a non-zero exit code.
*   **`tests.json` not found:** If `tests.json` is missing from the skill's directory, execute the Bootstrap Test Scenarios procedure to create it rather than terminating. Only terminate if the bootstrap write itself fails.
*   **Invalid `tests.json` format:** If the JSON is malformed or missing required keys, output `Error: tests.json for skill '{skill-name}' is malformed. Please check the file structure.` and terminate with a non-zero exit code.
*   **Invalid scenario index:** If the index provided via `--scenario` is out of bounds, output `Error: Invalid scenario index '{index}'. Skill '{skill-name}' only has {count} scenarios.` and terminate.
*   **Test Execution Error:** If the `Skill` tool invocation for a specific test scenario fails or throws an error, capture the error message, mark the test as `ERROR`, log the error, and continue to the next test scenario. Do not halt the entire test suite.

## Examples
**Example 1: Run a full test suite**
*   **User:** `/test create-proposal`
*   **Agent Action:**
    1.  Silently checks and initializes `skill-test-runner`'s own `tests.json` if needed (no output produced).
    2.  Locates `~/.remote/@autoresearch/skills/working-create-proposal/tests.json`; prints loaded scenario names: `Loaded N scenarios for 'create-proposal': 1. <name>, 2. <name>, ...`
    3.  Prints `Running test: "..."` for each scenario before executing it.
    4.  Executes all test scenarios by invoking the `create-proposal` skill via the `Skill` tool for each scenario's prompt.
    5.  Prints a human-readable summary of pass/fail/error results ending with `Summary: X total, ...`.

**Example 2: Run a single test and get JSON output**
*   **User:** "Run the second test for the `gmail-label` skill and give me the output in JSON format."
*   **Agent Action:**
    1.  Translates the request into the command: `/test gmail-label --scenario 2 --json`.
    2.  Executes only the second scenario from `gmail-label`'s `tests.json` via the `Skill` tool.
    3.  Outputs a single, structured JSON object containing the detailed result of that one test, including `skill_name` key.

**Example 3: Integrated generate-and-run workflow**
*   **User:** "Generate tests for the new `file-summarizer` skill I just created, then immediately run them."
*   **Agent Action:**
    1.  Invoke the `skill-test-generator` skill with `file-summarizer` as the target.
    2.  Upon successful creation of `tests.json` by the generator...
    3.  Invoke this skill: `/test file-summarizer`.
    4.  Report the results of the newly generated tests to the user.

**Example 4: Bootstrap run on a skill with no tests**
*   **User:** `/test inbox-cleaner`
*   **Agent Action:**
    1.  Silently self-initializes `skill-test-runner`'s own `tests.json` (no output produced).
    2.  Locates `~/.remote/@autoresearch/skills/working-inbox-cleaner/` — directory exists.
    3.  Finds no `tests.json` for `inbox-cleaner` — triggers Bootstrap Test Scenarios procedure.
    4.  Writes a starter `tests.json` with 2 generic scenarios and prints a notice.
    5.  Prints loaded scenario names: `Loaded 2 scenarios for 'inbox-cleaner': 1. <name>, 2. <name>`
    6.  Prints `Running test: "..."` for each bootstrap scenario before executing.
    7.  Executes the 2 bootstrap scenarios via the `Skill` tool and reports results ending with `Summary: 2 total, ...`.
    8.  Reminds user to update `tests.json` with accurate prompts and expected outcomes.