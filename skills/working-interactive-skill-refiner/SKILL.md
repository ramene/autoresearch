# interactive-skill-refiner
Provides a guided, conversational interface for improving a target skill by orchestrating log analysis, test generation, and code modification.

## Purpose
This skill addresses `want-018`. The core hypothesis is that users need a high-level, interactive workflow to facilitate the skill improvement process. Instead of requiring users to manually run a sequence of diagnostic, editing, and testing tools, this skill acts as an orchestrator, guiding the user through the end-to-end refinement loop: diagnosing issues, proposing modifications, generating tests, applying changes, and evaluating the results.

## Trigger Conditions
- **Slash Command:** `/refine-skill [skill_name]`, `/improve-skill [skill_name]`
- **Keywords:** "fix skill", "improve skill", "refine", "debug the skill", "let's work on", "what's wrong with this skill".
- **Automatic Detection:** This skill should be activated when a user provides a failure log from a skill run or expresses frustration with a specific skill's performance.

## Prerequisites
1.  The autoresearch environment must be available at `$HOME/.remote/@autoresearch/`.
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
    a. Scan the entire initial message for any indication of the target skill name. This includes:
        - An explicit skill name stated directly (e.g., "fix the `content-strategy-optimizer` skill")
        - A skill name embedded in a failure log, stack trace, file path, or error message (e.g., `working-api-client/` in a traceback means the skill is `api-client`)
        - An implicit reference where the skill name can be confidently inferred from context (e.g., a log header or a file path like `$HOME/.remote/@autoresearch/skills/working-classify-leads/events.jsonl`)
        - Any path containing `working-{name}` — extract `{name}` as the skill name.
    b. If a skill name was confidently identified in step 1a, confirm it with the user: "I identified the target skill as `{name}` from your message. I'll proceed with that — let me know if that's incorrect."
    c. If no skill name could be identified, ask the user: "Which skill would you like to work on?"
    d. To help the user choose, provide suggestions:
        i.  **(Bash)** Invoke `skill-lister` to show a list of available skills.
        ii. **(Bash)** Invoke `skill-eval-reporter --lowest 3` to suggest the three lowest-scoring skills as candidates for improvement.
    e. Once the skill name is confirmed (e.g., "my-skill"), construct the path: `TARGET_SKILL_DIR="$HOME/.remote/@autoresearch/skills/working-my-skill/"`.
    f. **(Bash)** Verify the directory exists. If not, inform the user and go back to step 1c.

2.  **Diagnose the Problem:**
    a. **Check if context was already provided in the initial trigger.** If the user's initial message already contains a failure log, error traceback, or a description of the problem (including feature requests), skip asking for context and proceed directly to the appropriate sub-step: **2c** for logs/tracebacks, **2d** for general problem descriptions, or **2e** for feature requests. Only proceed to step 2b if the initial message contained no context at all.
    b. If no context was provided yet, ask the user: "What is the problem you're trying to solve? For example, is the skill failing, producing poor results, or do you want to add a new feature? If you have a failure log, please provide it."
    c. **If the user provides a log (or the initial message contained a log):**
        i.  **(Bash)** Invoke `failure-log-analyzer` with the provided log as input.
        ii. Store the structured output (root cause, suggested fix) as `DIAGNOSIS_RESULT`.
    d. **If the user describes a general problem (e.g., "it's not working well") or no specific log or feature request is given:**
        i.  **(Bash)** Invoke `stuck-skill-diagnoser --skill-dir "$TARGET_SKILL_DIR"`.
        ii. Store the output as `DIAGNOSIS_RESULT`.
    e. **If the user wants to add a feature or make a specific change (e.g., "add a new eval criterion"):**
        i.  **(Bash)** Always invoke `stuck-skill-diagnoser --skill-dir "$TARGET_SKILL_DIR"` first to understand the skill's current state and identify any pre-existing issues before introducing changes.
        ii. Store the diagnoser output as `DIAGNOSIS_RESULT`, then augment it with the user's feature request: `DIAGNOSIS_RESULT["user_request"] = "User wants to [summary of requested change]."`.
        iii. Inform the user: "I've analyzed the current state of the skill. Here is what I found: [DIAGNOSIS_RESULT summary]. Now I'll factor in your requested change."
    f. Present a summary of the diagnosis to the user: "Based on my analysis, the issue seems to be [summary from DIAGNOSIS_RESULT]. I will now propose a solution."

3.  **Propose a Modification:**
    a. Based on `DIAGNOSIS_RESULT`, formulate a specific change to a file (usually `SKILL.md` or `eval.json`). Determine which file to modify based on the diagnosis; if ambiguous, default to `SKILL.md`.
    b. **(Read)** Read the current content of the target file (e.g., `$TARGET_SKILL_DIR/SKILL.md`).
    c. Generate the complete proposed new content as a full replacement for that file. Compose this as a complete text string ready to be written to disk.
    d. **(Write)** Save the proposed content to a temporary file by writing the complete new file content to `/tmp/skill_proposed.tmp`.
       **(Bash)** Show the exact changes using diff:
       ```bash
       diff -u "$TARGET_SKILL_DIR/SKILL.md" /tmp/skill_proposed.tmp || true
       ```
       The `|| true` ensures the diff output is always displayed even when differences exist (diff returns exit code 1 for differences).
    e. Present the diff to the user and ask for confirmation: "I propose the following change. Does this look correct and should I proceed?"

4.  **Handle User Feedback on Proposal:**
    a. If the user approves ("yes", "looks good"), **stage the change** and proceed to Step 5:
       i.  **(Bash)** `mv /tmp/skill_proposed.tmp /tmp/approved_change.tmp`
       ii. Inform the user: "Great, I've staged that change. Now, let's generate a test for it."
    b. If the user rejects or suggests changes ("no", "change X to Y"), ask for clarification: "Understood. What would you like to change in this proposal?"
    c. Incorporate the user's feedback and loop back to step 3 to generate and present a new proposal. If this loop repeats more than twice, ask: "It seems we're not getting it right. Would you like to try a different approach or specify the exact change you want me to make?"

5.  **Generate New Tests (Always Required):**
    a. For every approved modification — whether it fixes a bug, adds a capability, or makes any other change — a new test case must be generated. This is mandatory and cannot be skipped.
    b. Inform the user: "To ensure this change works as expected and doesn't break in the future, I will now generate a new test case."
    c. **(Bash)** Invoke `skill-test-generator` with the context of the change: `skill-test-generator --skill-dir "$TARGET_SKILL_DIR" --context "The skill was modified to [summary of change]. The test should verify this."`
    d. Present the newly generated JSON test case to the user for approval.
    e. **(Write)** If approved, create a temporary test file `/tmp/eval_with_new_test.json` by appending the new test case to the existing `$TARGET_SKILL_DIR/eval.json`. If the user rejects the generated test, use the original `eval.json` as the temporary file.

6.  **Run Pre-Modification Tests (Baseline):**
    a. Inform the user: "First, I'll run the tests against the *current* version of the skill to establish a baseline."
    b. **(Bash)** Invoke the test runner: `skill-test-runner --skill-dir "$TARGET_SKILL_DIR" --eval-file /tmp/eval_with_new_test.json`.
    c. Report the result: "The baseline score is [X/Y]. As expected, the new test case is currently failing."

7.  **Apply the Modification:**
    a. Inform the user: "Now, I will apply the staged modification."
    b. **(Bash)** Create a backup of the original file: `cp "$TARGET_SKILL_DIR/SKILL.md" "$TARGET_SKILL_DIR/SKILL.md.bak"`.
    c. **(Bash)** Apply the staged change by copying it to the target file: `cp /tmp/approved_change.tmp "$TARGET_SKILL_DIR/SKILL.md"` (or whichever file was being modified).
    d. **(Edit)** Append a record of the change to `$TARGET_SKILL_DIR/changelog.md`: `* Refined skill based on interactive session (want-018). Change: [summary of change].`

8.  **Run Post-Modification Tests:**
    a. Inform the user: "The change has been applied. I will now run the tests again on the modified skill."
    b. **(Bash)** Invoke the test runner: `skill-test-runner --skill-dir "$TARGET_SKILL_DIR" --eval-file /tmp/eval_with_new_test.json`.
    c. Report the new score.

9.  **Report Results and Conclude:**
    a. Present a final summary to the user: "The refinement is complete. The test score improved from [baseline score] to [new score]. The new test case is now passing."
    b. Ask for next steps: "Are you satisfied with this result, or is there anything else you'd like to improve on this skill?"
    c. If the user wants to continue, loop back to Step 2. Otherwise, conclude the session: "Great! The changes have been saved. I'm ready for the next task."
    d. **(Bash)** Clean up temporary files: `rm -f /tmp/eval_with_new_test.json /tmp/approved_change.tmp`.

## Output Format
- **Console:** Interactive, conversational text guiding the user through the refinement process.
- **File System:** Modified files within the target skill's directory (`$HOME/.remote/@autoresearch/skills/working-{name}/`). This typically includes `SKILL.md`, `eval.json`, and `changelog.md`.

## Quality Gates
- The target skill is correctly identified and confirmed with the user before any action is taken. The skill name must be extracted from all available context (explicit statements, logs, file paths, error messages) before asking the user.
- A diagnosis is successfully generated by invoking `stuck-skill-diagnoser` or `failure-log-analyzer` in **all** cases — including feature addition requests. No path through Step 2 may bypass both diagnostic tools.
- A specific, actionable modification is proposed to the user in `diff` format.
- `skill-test-generator` is **always** invoked to create a new, relevant test case for every modification, without exception.
- The user-approved modification is correctly written to the target file system via the staged file `/tmp/approved_change.tmp`.
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
- **Agent:** "Understood. I'll work on `content-strategy-optimizer`. The initial message already describes the problem, so I'll proceed directly to diagnosis."
- **Agent:** *(Invokes `stuck-skill-diagnoser`)* "The diagnosis suggests the prompt in `SKILL.md` doesn't specify how to chunk large inputs. I propose adding a step to break down documents over 4000 words."
- **Agent:** *(Uses Write tool to save proposed content to `/tmp/skill_proposed.tmp`, then runs `diff -u "$TARGET_SKILL_DIR/SKILL.md" /tmp/skill_proposed.tmp || true`, shows diff output)* "Does this look correct?"
- **User:** "Yes, proceed."
- **Agent:** *(Runs `mv /tmp/skill_proposed.tmp /tmp/approved_change.tmp`)* "Great, I've staged that change. Now, let's generate a test for it."
- **Agent:** *(Shows new `eval.json` entry)* "Here is the new test. I'll now run tests to get a baseline."
- **Agent:** "Baseline score is 3/5. The new test is failing as expected. Applying the staged change now."
- **Agent:** *(Runs `cp /tmp/approved_change.tmp "$TARGET_SKILL_DIR/SKILL.md"`, re-runs tests)* "The modification is complete. The score is now 5/5, and the new test is passing. Are you satisfied with this result?"
- **User:** "Perfect, thank you."

### Example 2: Log-Based Debugging
- **User:** *(Pastes a JSONDecodeError traceback from a skill run)* "What went wrong here and how do we fix it?"
- **Agent:** "I've received a failure log in your initial message. I can see from the traceback that this is the `api-client` skill (path `working-api-client/` appears in the stack trace). I will analyze the log immediately to find the root cause."
- **Agent:** *(Invokes `failure-log-analyzer`)* "The analysis indicates the `api-client` skill failed because it received an unexpected `null` value from the API and didn't handle it. I propose modifying its `SKILL.md` to add a step that checks for null values before parsing the JSON response."
- **Agent:** *(Uses Write tool to save proposed content to `/tmp/skill_proposed.tmp`, shows diff)* "Shall I apply this fix?"
- **User:** "Yes."
- **Agent:** *(Runs `mv /tmp/skill_proposed.tmp /tmp/approved_change.tmp`)* "Great, I've staged that change. Now let's generate a test."
- **Agent:** *(Proceeds with the test generation, application via `cp /tmp/approved_change.tmp`, and verification steps.)*

### Example 3: User Rejects a Proposal
- **User:** "Improve the `classify-leads` skill."
- **Agent:** *(Diagnoses and proposes a change to the prompt to make it more specific.)* "Here is the proposed change to `SKILL.md`..."
- **User:** "No, that's not quite right. It should also ask for the output in a numbered list."
- **Agent:** "Understood. I will revise the proposal to include formatting the output as a numbered list."
- **Agent:** *(Generates a new diff incorporating the user's feedback.)* "How about this version?"
- **User:** "That's it. Go ahead."
- **Agent:** *(Runs `mv /tmp/skill_proposed.tmp /tmp/approved_change.tmp`)* "Great, I've staged that change. Now, let's generate a test for it."

### Example 4: Feature Addition Request
- **User:** "Add a new eval criterion to the `classify-leads` skill to check that output is in JSON format."
- **Agent:** "Understood. The initial message contains a feature request, so I'll proceed directly to diagnosis before proposing any change."
- **Agent:** *(Invokes `stuck-skill-diagnoser --skill-dir "$HOME/.remote/@autoresearch/skills/working-classify-leads/"`)* "The diagnosis shows the skill is generally healthy but the eval.json has no format-validation criteria. Combined with your request, I propose adding a JSON output test case."
- **Agent:** *(Uses Write tool to save proposed content to `/tmp/skill_proposed.tmp`, shows diff)* "Does this look correct?"
- **User:** "Yes, proceed."
- **Agent:** *(Runs `mv /tmp/skill_proposed.tmp /tmp/approved_change.tmp`)* "Great, I've staged that change. Now, let's generate a test for it."
- **Agent:** *(Invokes `skill-test-generator` to generate a verification test, then proceeds with baseline run, application via `cp /tmp/approved_change.tmp`, and post-modification verification steps.)*

### Example 5: Skill Name Inferred from Log Path
- **User:** *(Pastes log containing `$HOME/.remote/@autoresearch/skills/working-gmaps-leads/events.jsonl`)* "Something broke."
- **Agent:** "I can see from the log path that this refers to the `gmaps-leads` skill. I'll confirm: I'll be working on `gmaps-leads` — let me know if that's incorrect. Proceeding to analyze the failure log now."
- **Agent:** *(Invokes `failure-log-analyzer` with the log, then continues the full refinement loop.)*