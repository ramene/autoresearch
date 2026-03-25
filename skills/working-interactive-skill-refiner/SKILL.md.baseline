# interactive-skill-refiner
Provides a guided, conversational interface for improving a target skill by orchestrating log analysis, test generation, and code modification.

## Purpose
This skill addresses `want-018`. The core hypothesis is that users need a high-level, interactive workflow to facilitate the skill improvement process. Instead of requiring users to manually run a sequence of diagnostic, editing, and testing tools, this skill acts as an orchestrator, guiding the user through the end-to-end refinement loop: diagnosing issues, proposing modifications, generating tests, applying changes, and evaluating the results.

## Trigger Conditions
- **Slash Command:** `/refine-skill [skill_name]`, `/improve-skill [skill_name]`
- **Keywords:** "fix skill", "improve skill", "refine", "debug the skill", "let's work on", "what's wrong with this skill".
- **Automatic Detection:** This skill should be activated when a user provides a failure log from a skill run or expresses frustration with a specific skill's performance.

## Prerequisites
1.  The autoresearch environment must be available at `~/.remote/@autoresearch/`.
2.  The `skills/` directory must contain at least one skill in a `working-{name}/` subdirectory.
3.  The following skills must be available and executable:
    - `stuck-skill-diagnoser`: To analyze a skill's artifacts and find potential issues.
    - `failure-log-analyzer`: To determine the root cause of a failure from logs.
    - `skill-test-generator`: To create new evaluation criteria based on a proposed change.
    - `skill-test-runner`: To execute `eval.json` against a skill and report the score.
    - `skill-lister`: To list all available skills.
    - `skill-eval-reporter`: To find the lowest-scoring skills.

## Execution Steps
The skill operates as a conversational state machine. Follow these steps in order, communicating with the user at each stage.

1.  **Identify Target Skill:**
    a. Check if the user specified a skill name in the initial prompt.
    b. If no skill is specified, ask the user: "Which skill would you like to work on?"
    c. To help the user, provide suggestions:
        i.  **(Bash)** Invoke `skill-lister` to show a list of available skills.
        ii. **(Bash)** Invoke `skill-eval-reporter --lowest 3` to suggest the three lowest-scoring skills as candidates for improvement.
    d. Once the user provides a name (e.g., "my-skill"), confirm it and construct the path: `TARGET_SKILL_DIR="~/.remote/@autoresearch/skills/working-my-skill/"`.
    e. **(Bash)** Verify the directory exists. If not, inform the user and go back to step 1b.

2.  **Diagnose the Problem:**
    a. Ask the user for context: "What is the problem you're trying to solve? For example, is the skill failing, producing poor results, or do you want to add a new feature? If you have a failure log, please provide it."
    b. **If the user provides a log:**
        i.  **(Bash)** Invoke `failure-log-analyzer` with the provided log as input.
        ii. Store the structured output (root cause, suggested fix) as `DIAGNOSIS_RESULT`.
    c. **If the user describes a general problem (e.g., "it's not working well"):**
        i.  **(Bash)** Invoke `stuck-skill-diagnoser --skill-dir "$TARGET_SKILL_DIR"`.
        ii. Store the output as `DIAGNOSIS_RESULT`.
    d. **If the user wants to add a feature or make a specific change (e.g., "add a new eval criterion"):**
        i.  Set `DIAGNOSIS_RESULT` to a summary of the user's request, e.g., `{ "summary": "User wants to add a new evaluation criterion to eval.json to check for JSON output." }`.
    e. Present a summary of the diagnosis to the user: "Based on my analysis, the issue seems to be [summary from DIAGNOSIS_RESULT]. I will now propose a solution."

3.  **Propose a Modification:**
    a. Based on `DIAGNOSIS_RESULT`, formulate a specific change to a file (usually `SKILL.md` or `eval.json`).
    b. **(Read)** Read the content of the target file (e.g., `$TARGET_SKILL_DIR/SKILL.md`).
    c. Generate the proposed new content.
    d. **(Bash)** Use `diff` to show the user the exact changes: `diff -u <(cat $TARGET_SKILL_DIR/SKILL.md) <(echo "$PROPOSED_CONTENT")`.
    e. Present the diff to the user and ask for confirmation: "I propose the following change. Does this look correct and should I proceed?"

4.  **Handle User Feedback on Proposal:**
    a. If the user approves ("yes", "looks good"), proceed to Step 5.
    b. If the user rejects or suggests changes ("no", "change X to Y"), ask for clarification: "Understood. What would you like to change in this proposal?"
    c. Incorporate the user's feedback and loop back to step 3 to generate and present a new proposal. If this loop repeats more than twice, ask: "It seems we're not getting it right. Would you like to try a different approach or specify the exact change you want me to make?"

5.  **Generate New Tests (Conditional):**
    a. Analyze the approved modification. If the change fixes a bug or adds a new capability, a new test is required to prevent regressions and validate the change.
    b. Inform the user: "To ensure this change works as expected and doesn't break in the future, I will now generate a new test case."
    c. **(Bash)** Invoke `skill-test-generator` with the context of the change: `skill-test-generator --skill-dir "$TARGET_SKILL_DIR" --context "The skill was modified to [summary of change]. The test should verify this."`
    d. Present the newly generated JSON test case to the user for approval.
    e. **(Write)** If approved, create a temporary test file `/tmp/eval_with_new_test.json` by appending the new test case to the existing `$TARGET_SKILL_DIR/eval.json`. If no new test was generated, copy the original `eval.json` to the temporary file.

6.  **Run Pre-Modification Tests (Baseline):**
    a. Inform the user: "First, I'll run the tests against the *current* version of the skill to establish a baseline."
    b. **(Bash)** Invoke the test runner: `skill-test-runner --skill-dir "$TARGET_SKILL_DIR" --eval-file /tmp/eval_with_new_test.json`.
    c. Report the result: "The baseline score is [X/Y]. As expected, the new test case is currently failing."

7.  **Apply the Modification:**
    a. Inform the user: "Now, I will apply the approved modification."
    b. **(Bash)** Create a backup of the original file: `cp "$TARGET_SKILL_DIR/SKILL.md" "$TARGET_SKILL_DIR/SKILL.md.bak"`.
    c. **(Write/Edit)** Write the approved content to the target file (e.g., `$TARGET_SKILL_DIR/SKILL.md`).
    d. **(Edit)** Append a record of the change to `$TARGET_SKILL_DIR/changelog.md`: `* Refined skill based on interactive session (want-018). Change: [summary of change].`

8.  **Run Post-Modification Tests:**
    a. Inform the user: "The change has been applied. I will now run the tests again on the modified skill."
    b. **(Bash)** Invoke the test runner: `skill-test-runner --skill-dir "$TARGET_SKILL_DIR" --eval-file /tmp/eval_with_new_test.json`.
    c. Report the new score.

9.  **Report Results and Conclude:**
    a. Present a final summary to the user: "The refinement is complete. The test score improved from [baseline score] to [new score]. The new test case is now passing."
    b. Ask for next steps: "Are you satisfied with this result, or is there anything else you'd like to improve on this skill?"
    c. If the user wants to continue, loop back to Step 2. Otherwise, conclude the session: "Great! The changes have been saved. I'm ready for the next task."
    d. **(Bash)** Clean up temporary files: `rm /tmp/eval_with_new_test.json`.

## Output Format
- **Console:** Interactive, conversational text guiding the user through the refinement process.
- **File System:** Modified files within the target skill's directory (`~/.remote/@autoresearch/skills/working-{name}/`). This typically includes `SKILL.md`, `eval.json`, and `changelog.md`.

## Quality Gates
- The target skill is correctly identified and confirmed with the user before any action is taken.
- A diagnosis is successfully generated by invoking `stuck-skill-diagnoser` or `failure-log-analyzer`.
- A specific, actionable modification is proposed to the user in `diff` format.
- `skill-test-generator` is invoked to create a new, relevant test case for the modification.
- The user-approved modification is correctly written to the target file system.
- `skill-test-runner` is executed both before and after the modification, and the score comparison is reported to the user.

## Integration Points
- **Calls Out To:** `stuck-skill-diagnoser`, `failure-log-analyzer`, `skill-test-generator`, `skill-test-runner`, `skill-lister`, `skill-eval-reporter`.
- **Reads/Writes:** Files within a target skill's directory, primarily `SKILL.md`, `eval.json`, and `changelog.md`.
- **Triggered By:** User commands or other system-monitoring skills that detect skill failures.

## Error Handling
- **Skill Not Found:** If the user specifies a skill that does not exist, inform them and list available skills using `skill-lister`.
- **Dependent Skill Failure:** If any of the orchestrated skills (e.g., `skill-test-generator`) fail, report the error output to the user and ask for guidance. "The `skill-test-generator` failed. [Error message]. How should we proceed?"
- **File I/O Errors:** If a file cannot be read or written, report the permission error to the user and halt the process.
- **Test Score Regression:** If the test score *decreases* after the modification, issue a strong warning: "Warning: The test score has decreased from [X/Y] to [Z/Y]. This indicates a regression. I recommend reverting this change. Shall I restore the file from the backup?"

## Examples
### Example 1: Full Refinement Loop
- **User:** "Let's fix the `content-strategy-optimizer` skill. It's not handling long articles correctly."
- **Agent:** "Understood. I'll work on `content-strategy-optimizer`. I'll start by diagnosing the issue."
- **Agent:** *(Invokes `stuck-skill-diagnoser`)* "The diagnosis suggests the prompt in `SKILL.md` doesn't specify how to chunk large inputs. I propose adding a step to break down documents over 4000 words."
- **Agent:** *(Shows a `diff` of the proposed `SKILL.md` change)* "Does this look correct?"
- **User:** "Yes, proceed."
- **Agent:** "Great. I'll generate a new test case with a long article to verify the fix."
- **Agent:** *(Shows new `eval.json` entry)* "Here is the new test. I'll now run tests to get a baseline."
- **Agent:** "Baseline score is 3/5. The new test is failing as expected. Applying the change now."
- **Agent:** *(Applies change, re-runs tests)* "The modification is complete. The score is now 5/5, and the new test is passing. Are you satisfied with this result?"
- **User:** "Perfect, thank you."

### Example 2: Log-Based Debugging
- **User:** *(Pastes a JSONDecodeError traceback from a skill run)* "What went wrong here and how do we fix it?"
- **Agent:** "I've received a failure log. I will analyze it to find the root cause."
- **Agent:** *(Invokes `failure-log-analyzer`)* "The analysis indicates the `api-client` skill failed because it received an unexpected `null` value from the API and didn't handle it. I propose modifying its `SKILL.md` to add a step that checks for null values before parsing the JSON response."
- **Agent:** *(Shows `diff` for the change)* "Shall I apply this fix?"
- **User:** "Yes."
- **Agent:** *(Proceeds with the test generation, application, and verification steps.)*

### Example 3: User Rejects a Proposal
- **User:** "Improve the `classify-leads` skill."
- **Agent:** *(Diagnoses and proposes a change to the prompt to make it more specific.)* "Here is the proposed change to `SKILL.md`..."
- **User:** "No, that's not quite right. It should also ask for the output in a numbered list."
- **Agent:** "Understood. I will revise the proposal to include formatting the output as a numbered list."
- **Agent:** *(Generates a new `diff` incorporating the user's feedback.)* "How about this version?"
- **User:** "That's it. Go ahead."