# skill-test-generator
Generates a set of evaluation scenarios and criteria for a given skill based on its description and code.

## Purpose
This skill addresses the critical capability gap identified in **want-021**. The core hypothesis is that the system cannot create or execute tests for its own skills, resulting in a significant portion of skills (15/27) being completely untested. This blindness to skill performance hinders reliability and iterative improvement. This skill automates the creation of robust test suites (`eval.json` files), providing the foundation for systematic evaluation and improving overall system observability and quality.

## Trigger Conditions
- **Slash Command:** `/generate_tests <skill_name>`
- **Keywords:** "generate tests for", "create evaluation for", "test the skill", "how do we test" followed by a skill name.
- **Automatic Detection:** This skill should be proposed as a next step when a new skill directory `skills/working-{name}/` is created and contains a `SKILL.md` but lacks an `eval.json` file.

## Prerequisites
- A target skill must exist in a directory at `~/.remote/@autoresearch/skills/working-<skill_name>/`.
- The target skill directory must contain a `SKILL.md` file with, at a minimum, a clear description of the skill's purpose, inputs, and outputs.
- For best results, the directory should also contain the skill's implementation file(s) (e.g., `main.py`, `run.sh`).

## Execution Steps

1.  **Identify and Validate Target Skill:**
    -   Parse the user prompt or system trigger to extract the `<skill_name>`.
    -   Construct the skill's directory path: `SKILL_DIR="~/.remote/@autoresearch/skills/working-<skill_name>/"`.
    -   Use `Bash` to check if `SKILL_DIR` exists (`test -d "$SKILL_DIR"`). If not, terminate and report an error (see Error Handling).
    -   Use `Bash` to check if `${SKILL_DIR}/SKILL.md` exists. If not, terminate and report an error.

2.  **Gather Skill Intelligence:**
    -   Use `Read` to load the full content of `${SKILL_DIR}/SKILL.md`. Pay close attention to the `Purpose`, `Execution Steps`, `Prerequisites`, and `Output Format` sections.
    -   Use `Glob` to list all files within `SKILL_DIR`. Identify potential implementation files (e.g., `.py`, `.sh`, `.js`).
    -   If implementation files are found, use `Read` to load their contents. This is crucial for code-aware test generation.

3.  **Analyze Skill Specification (Black-Box Analysis):**
    -   From the `SKILL.md`, synthesize the skill's primary function. What problem does it solve?
    -   Identify all expected inputs: command-line arguments, environment variables, files it reads, or data it pulls from other system models (`world-model.json`).
    -   Identify all expected outputs: files it creates/modifies, console output, or changes to system models.

4.  **Analyze Skill Implementation (White-Box Analysis):**
    -   If source code was read, scan it for key constructs:
        -   Function/method definitions and their parameters.
        -   External interactions: API calls (e.g., `requests.get`), file system operations (`os.path.exists`, `open`), or shell commands (`subprocess.run`).
        -   Conditional logic (`if/else`) and error handling blocks (`try/except`). These represent different execution paths that need testing.

5.  **Synthesize Test Scenarios (Target: 6-8):**
    -   Based on the combined analysis, generate a diverse list of test scenarios. Each scenario should have a concise `description`.
    -   **Success Case (Happy Path):** Create 1-2 scenarios where the skill is given perfect, valid inputs and is expected to succeed. *Example: "Generate a plan for a simple, well-defined task."*
    -   **Failure Cases (Error Handling):** Create 2-3 scenarios where the skill is expected to fail gracefully. Test for invalid inputs, missing prerequisites, or simulated external failures. *Example: "Attempt to label a non-existent email ID."* or *Example: "Run the skill against a file that the user does not have permission to read."*
    -   **Edge Cases:** Create 2-3 scenarios that test the boundaries of the skill's functionality. Use empty inputs, very large inputs, inputs with special characters, or zero values. *Example: "List files in an empty directory."*
    -   **Integration Cases:** If the skill interacts with other system components, create 1 scenario to test that interaction. *Example: "Run the skill and verify it correctly updates the world-model.json."*

6.  **Synthesize Evaluation Criteria (Target: 4-6):**
    -   Based on the expected outcomes from the scenarios, generate a list of specific, binary (yes/no) evaluation criteria. Each criterion should have a clear `question`.
    -   **Functional Correctness:** Does the skill produce the exact, expected output? *Example: "Does the command produce a non-empty `plan.md` file?"*
    -   **State Change Verification:** Does the skill correctly modify the system state? *Example: "Is the `status` field in `world-model.json` updated to 'complete'?"*
    -   **Error Reporting:** Does the skill handle failure gracefully and informatively? *Example: "Does the skill exit with a non-zero status code when the input file is not found?"*
    -   **Idempotency:** If applicable, does running the skill multiple times with the same input yield the same result without causing errors? *Example: "Does running the skill a second time on the same email result in only one label being applied?"*

7.  **Fill Gaps, Then Write `eval.json` Immediately:**
    -   Count the scenarios from Step 5 and the criteria from Step 6.
    -   **If scenarios < 6:** Generate additional scenarios right now (prioritize edge cases, then failure cases) until you have at least 6. Do not move on until count ≥ 6.
    -   **If criteria < 4:** Generate additional binary yes/no criteria right now (focus on output correctness and error handling) until you have at least 4. Do not move on until count ≥ 4.
    -   Verify every criterion's `question` ends with `?` and is answerable with yes/no. Rewrite any that fail this check.
    -   **After meeting minimums, immediately proceed to write the file.** Do not loop back or re-evaluate. If counts are between the minimum and maximum targets (e.g., 6 scenarios when 8 is ideal), that is acceptable — write what you have and note any shortfall in the console report.

8.  **Construct and Write `eval.json`:**
    -   Format the validated scenarios and criteria into a JSON object matching the system's schema exactly:
        ```json
        {
          "scenarios": [
            { "description": "..." }
          ],
          "criteria": [
            { "question": "...?" }
          ]
        }
        ```
    -   **Pre-write schema check:** Before writing, confirm the JSON object you have constructed contains:
        -   A top-level `scenarios` key whose value is a non-empty array of objects each with a `description` string.
        -   A top-level `criteria` key whose value is a non-empty array of objects each with a `question` string ending in `?`.
        -   No extra top-level keys beyond `scenarios` and `criteria`.
        If any of these checks fail, fix the structure now before proceeding.
    -   Check if `${SKILL_DIR}/eval.json` already exists.
    -   If it exists, use `Edit` to merge the new scenarios and criteria. Be careful not to create duplicates. Inform the user that you are adding to the existing test suite.
    -   If it does not exist, use `Write` to create a new file at `${SKILL_DIR}/eval.json` with the JSON content.
    -   Report success to the user, stating the number of scenarios and criteria generated for the specified skill, plus any quality notes from Step 7.

## Output Format
- **Primary:** A file named `eval.json` is created or updated in the target skill's directory (`~/.remote/@autoresearch/skills/working-<skill_name>/eval.json`).
- **Console:** A confirmation message, e.g., "Successfully generated 7 scenarios and 5 evaluation criteria for skill `<skill_name>` in `eval.json`." Include any count notes if targets were not fully met.

## Quality Gates
Before marking the task as complete, verify the following:
- [ ] Generated 6-8 relevant test scenarios (generate additional items if fewer than 6 — do not accept shortfall).
- [ ] Generated 4-6 binary (yes/no) evaluation criteria (generate additional items if fewer than 4 — do not accept shortfall).
- [ ] All generated criteria are specific and unambiguous (e.g., "Does it create a file named `output.csv`?" is good; "Does it work?" is bad).
- [ ] The scenarios cover a mix of success, edge, and failure cases.
- [ ] The output is a valid JSON file named `eval.json` conforming to the system schema (top-level keys: `scenarios` and `criteria` only).
- [ ] The generation process included analysis of the skill's source code, not just its `SKILL.md`.

## Integration Points
- **Autoresearch Runner:** The `eval.json` file produced by this skill is the direct input for the `autoresearch-runner`, which executes and scores skill evaluations.
- **Skill Development Workflow:** This skill is a key step in the "Implement-Test-Refine" loop for skill development. It should be invoked after initial implementation and before evaluation.
- **Want Tracking:** Successful execution of this skill contributes to resolving `want-021` by increasing the system's overall test coverage.

## Error Handling
- **Skill Not Found:** If the specified `<skill_name>` directory does not exist, report "Error: Skill '<skill_name>' not found at the expected location." and terminate.
- **`SKILL.md` Missing:** If the skill directory exists but `SKILL.md` is missing, report "Error: Cannot generate tests for '<skill_name>' because its `SKILL.md` definition is missing." and terminate.
- **Vague Description:** If the `SKILL.md` is too ambiguous to generate meaningful tests (e.g., "processes stuff"), pause execution and ask the user for clarification: "The description for `<skill_name>` is too vague. To generate effective tests, please clarify: 1. What are its specific inputs? 2. What is its expected output? 3. What does 'process' mean in this context?"
- **No Code Found:** If no implementation files are found, proceed with a black-box analysis based on `SKILL.md` alone, but inform the user: "Warning: No source code found for `<skill_name>`. Generating tests based on its description only. These tests may not cover internal logic or error handling."

## Examples

**Example 1: Generating tests for a new file utility skill**
- **User:** `/generate_tests file-counter`
- **Agent Action:**
    1. Reads `skills/working-file-counter/SKILL.md` and `skills/working-file-counter/main.py`.
    2. The code shows it counts lines in a text file.
    3. Generates `eval.json` with scenarios: "Count lines in a 10-line file", "Count lines in an empty file", "Attempt to count lines in a binary file", "Attempt to count lines in a non-existent file", "Count lines in a file with only whitespace", "Count lines in a very large file (10,000+ lines)".
    4. Criteria include: "Does the output number match the actual line count?", "Does it output '0' for an empty file?", "Does it exit with a non-zero status code for a non-existent file?", "Does it handle binary files without crashing?".
- **Agent Output:** "Successfully generated 6 scenarios and 4 evaluation criteria for skill `file-counter` in `eval.json`."

**Example 2: Generating tests for a skill that interacts with an API**
- **User:** "Let's create the tests for the `github-issue-fetcher` skill."
- **Agent Action:**
    1. Reads `skills/working-github-issue-fetcher/SKILL.md` and its Python code.
    2. Identifies `requests` calls to the GitHub API.
    3. Generates `eval.json` with scenarios: "Fetch issues from a public repo", "Fetch issues from a repo with no issues", "Attempt to fetch from a private repo without credentials", "Handle a 404 error for a non-existent repo", "Fetch issues when API rate limit is exceeded", "Fetch issues with pagination (>100 issues)", "Run fetch twice on same repo to verify idempotency".
    4. Criteria include: "Is the output JSON file created with the correct issue data?", "Is the output file an empty list for a repo with no issues?", "Does the skill log an authentication error for a private repo?", "Does the skill exit with a non-zero status code on a 404 response?", "Does repeated execution produce identical output files?"
- **Agent Output:** "Created `eval.json` for `github-issue-fetcher` with 7 scenarios and 5 criteria."