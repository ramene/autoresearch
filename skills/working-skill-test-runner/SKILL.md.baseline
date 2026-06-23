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

## Execution Steps
1.  **Parse Arguments:**
    *   Identify the target `<skill-name>` from the user's prompt or command.
    *   Check for optional flags: `--scenario <index>` and `--json`. Store these values. The scenario index is 1-based.

2.  **Locate Skill Directory:**
    *   **Tool:** `Bash`
    *   **Action:** Construct the path `SKILL_DIR="~/.remote/@autoresearch/skills/working-${skill_name}"`.
    *   **Action:** Verify the directory exists using `if [ -d "$SKILL_DIR" ]; then ...`. If it does not, trigger the "Target skill not found" error handling procedure and stop.

3.  **Locate and Read Test File:**
    *   **Tool:** `Read`
    *   **Action:** Construct the path to the test file: `TEST_FILE_PATH="${SKILL_DIR}/tests.json"`.
    *   **Action:** Check if the file exists. If not, trigger the "`tests.json` not found" error handling procedure and stop.
    *   **Action:** Read the entire content of `TEST_FILE_PATH` into a variable.

4.  **Parse and Validate Test Scenarios:**
    *   **Tool:** Internal JSON parsing capability.
    *   **Action:** Parse the content read from `tests.json`.
    *   **Action:** Validate that the parsed data is a JSON array. If not, trigger the "Invalid `tests.json` format" error.
    *   **Action:** Iterate through the array to ensure each element is an object containing the required keys: `name`, `prompt`, and `expected_outcome`. If any are missing, trigger the "Invalid `tests.json` format" error.

5.  **Select Scenarios to Run:**
    *   If the `--scenario` flag was used, convert the 1-based index to a 0-based index and select only that scenario from the parsed array. If the index is out of bounds, trigger the "Invalid scenario index" error.
    *   If no `--scenario` flag was used, prepare to iterate through the entire array of scenarios.

6.  **Initialize Results Collector:**
    *   Create an empty array in memory to store the results of each test run. Each entry will be an object containing details about the test outcome.

7.  **Execute Scenarios Loop:**
    *   Iterate through each selected test scenario object. For each scenario:
        a. **Announce Test:** Print to the console: `Running test: "{scenario.name}"...`
        b. **Construct Command:** Formulate the command to execute the target skill. This should use the system's standard skill runner. Example: `CMD="claude-code --skill ${skill_name} --prompt \"${scenario.prompt}\""`.
        c. **Execute and Capture:**
            *   **Tool:** `Bash`
            *   **Action:** Execute the command, capturing `stdout`, `stderr`, and the exit code. Example: `OUTPUT=$(eval $CMD 2> stderr.log); EXIT_CODE=$? ; STDERR=$(cat stderr.log)`.
        d. **Determine Result:**
            *   **If `EXIT_CODE` is not 0 OR `STDERR` is not empty:** The result is `ERROR`.
            *   **Else if `OUTPUT` contains `scenario.expected_outcome`:** The result is `PASS`.
            *   **Else:** The result is `FAIL`.
        e. **Record Result:** Append a result object to the results collector array.
            *   **Structure:** `{ "name": scenario.name, "status": "PASS|FAIL|ERROR", "expected": scenario.expected_outcome, "actual": OUTPUT, "error_log": STDERR }`

8.  **Generate and Display Report:**
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
[PASS] Scenario 1: Create a new label
[FAIL] Scenario 2: Apply label to an existing email
  - Expected: "Label 'Work' applied successfully."
  - Actual: "Error: Email with ID 12345 not found."
  - Stderr:
[ERROR] Scenario 3: Delete a non-existent label
  - Expected: "Label 'NonExistent' not found."
  - Actual: ""
  - Stderr: "gcloud command failed with exit code 1"
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
      "error_log": "gcloud command failed with exit code 1"
    }
  ]
}
```

## Quality Gates
Before marking the task as complete, verify the following:
1.  **Parsing:** The skill correctly identifies and parses the `tests.json` file for the target skill.
2.  **Execution:** Each selected test scenario is executed by correctly invoking the target skill with the specified prompt.
3.  **Comparison:** The skill's actual output is correctly compared against the expected outcome to determine a `PASS` or `FAIL` status.
4.  **Reporting:** The final report (both console and JSON formats) is clear, accurate, and summarizes the results correctly.
5.  **Targeting:** The `--scenario` flag correctly isolates and runs only the specified test.
6.  **Logging:** For any `FAIL` or `ERROR` results, the captured `stdout` and `stderr` are included in the final report.

## Integration Points
*   **`skill-test-generator` (Upstream):** This skill is the primary consumer of artifacts produced by `skill-test-generator`. It executes the `tests.json` file that `skill-test-generator` creates, forming a "generate-and-run" testing workflow.
*   **`skill-modifier` (Trigger):** After `skill-modifier` alters a skill, this `skill-test-runner` should be invoked to perform regression testing and ensure the changes have not introduced new bugs.
*   **CI/CD Pipeline:** This skill serves as the core testing component in an automated continuous integration pipeline for skill development and evaluation.

## Error Handling
*   **Target skill not found:** If `~/.remote/@autoresearch/skills/working-{skill-name}/` does not exist, output the error `Error: Skill '{skill-name}' not found.` and terminate with a non-zero exit code.
*   **`tests.json` not found:** If `tests.json` is missing from the skill's directory, output `Warning: No tests.json file found for skill '{skill-name}'. No tests to run.` and terminate gracefully with a zero exit code.
*   **Invalid `tests.json` format:** If the JSON is malformed or missing required keys, output `Error: tests.json for skill '{skill-name}' is malformed. Please check the file structure.` and terminate with a non-zero exit code.
*   **Invalid scenario index:** If the index provided via `--scenario` is out of bounds, output `Error: Invalid scenario index '{index}'. Skill '{skill-name}' only has {count} scenarios.` and terminate.
*   **Test Execution Error:** If a specific test scenario command fails (non-zero exit code), capture `stderr`, mark the test as `ERROR`, log the error, and continue to the next test scenario. Do not halt the entire test suite.

## Examples
**Example 1: Run a full test suite**
*   **User:** `/test create-proposal`
*   **Agent Action:**
    1.  Locates `~/.remote/@autoresearch/skills/working-create-proposal/tests.json`.
    2.  Executes all test scenarios defined in the file.
    3.  Prints a human-readable summary of pass/fail/error results to the console.

**Example 2: Run a single test and get JSON output**
*   **User:** "Run the second test for the `gmail-label` skill and give me the output in JSON format."
*   **Agent Action:**
    1.  Translates the request into the command: `/test gmail-label --scenario 2 --json`.
    2.  Executes only the second scenario from `gmail-label`'s `tests.json`.
    3.  Outputs a single, structured JSON object containing the detailed result of that one test.

**Example 3: Integrated generate-and-run workflow**
*   **User:** "Generate tests for the new `file-summarizer` skill I just created, then immediately run them."
*   **Agent Action:**
    1.  Invoke the `skill-test-generator` skill with `file-summarizer` as the target.
    2.  Upon successful creation of `tests.json` by the generator...
    3.  Invoke this skill: `/test file-summarizer`.
    4.  Report the results of the newly generated tests to the user.