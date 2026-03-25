# goal-to-skill-executor

Decomposes a high-level strategic goal into a sequence of concrete skill invocations and executes the plan.

## Purpose

This skill addresses a critical gap in the core reasoning loop, as identified in **want-020**. The system possesses strategic goals (e.g., 'security-posture') and tactical skills (e.g., 'container-security-auditor') but fails to autonomously connect them. This skill acts as the bridge between high-level intent and tactical action, enabling the system to pursue its goals proactively by discovering, planning, and executing the relevant skills.

## Trigger Conditions

-   **Automatic:** This skill is a core component of the main agent loop. It should be triggered automatically on a periodic basis (e.g., every 5 minutes) to evaluate the status of strategic goals.
-   **Event-Driven:** Triggered immediately when a new goal is added to `world-model.json` or an existing goal's state is changed to `pending`.
-   **Manual:** Can be invoked via the command line for debugging or forcing a re-evaluation of a specific goal: `/execute-goal <goal_name>`

## Prerequisites

1.  A `world-model.json` file must exist at `~/.remote/@autoresearch/world-model.json`, containing a JSON object with a `goals` key. Each goal must have at least a `name`, `description`, and `status` (e.g., "pending", "active", "completed").
2.  A `skills/` directory must exist at `~/.remote/@autoresearch/skills/`, populated with subdirectories for each available skill.
3.  Each skill directory inside `skills/` must contain a `SKILL.md` file that accurately describes its purpose and usage.
4.  A system-level command or function must be available to execute a skill by name (e.g., `invoke-skill <skill_name> [params...]`).

## Execution Steps

1.  **Identify Target Goal:**
    -   **Tool:** `Read`
    -   **Action:** Read the `~/.remote/@autoresearch/world-model.json` file.
    -   **Logic:** Identify a single goal to process. Prioritize goals with `status: "pending"`. If a specific `<goal_name>` was provided via manual trigger, select that one. If no actionable goals exist, log a message and exit gracefully.

2.  **Analyze Goal Intent:**
    -   **Action:** Carefully analyze the `name` and `description` of the selected goal. Form a clear, internal understanding of the desired outcome. For example, for the goal 'security-posture', the intent is to "assess and potentially improve the security of the system's containerized components."

3.  **Discover Relevant Skills:**
    -   **Tool:** `Glob`, `Read`, `Grep`
    -   **Action:**
        a. Use `Glob` to find all `~/.remote/@autoresearch/skills/*/SKILL.md` files.
        b. For each `SKILL.md` file, use `Read` to load its contents.
        c. Perform a semantic comparison between the goal's intent (from Step 2) and the skill's `Purpose` and `Description` from its `SKILL.md`.
        d. Create a list of candidate skills, ranked by relevance.

4.  **Handle Capability Gaps:**
    -   **Tool:** `Write`, `Edit`
    -   **Action:** If the list of candidate skills from Step 3 is empty, the system lacks the capability to achieve the goal.
        a. Log this finding clearly.
        b. Update the goal's status in `world-model.json` to `blocked` with a `reason` field explaining the capability gap.
        c. Read `~/.remote/@autoresearch/wants.json`, add a new entry describing the missing capability (derived from the goal description), and write the file back.
        d. Terminate execution for this goal.

5.  **Formulate Execution Plan:**
    -   **Action:** Based on the list of relevant skills, formulate a plan.
        a. **Single-Skill Plan:** If only one highly relevant skill is found, the plan is a single invocation of that skill.
        b. **Multi-Skill Plan:** If multiple skills are relevant, reason about their dependencies to create an ordered sequence. For example, a skill that *generates content* must run before a skill that *publishes content*.
        c. **Monitoring Plan:** If the goal description contains keywords like "monitor," "continuously," "periodically," or "watch for," the plan should not be a one-off execution. Instead, the plan is to set up a recurring task (e.g., a cron job) that invokes the relevant skill(s) on a schedule.
    -   **Output:** The plan should be a structured list of steps, where each step includes the `skill_name` and a placeholder for its `parameters`.

6.  **Infer Skill Parameters:**
    -   **Tool:** `Read`
    -   **Action:** For each step in the plan, determine the required parameters.
        a. Read the target skill's `SKILL.md` to understand its required inputs from the `Execution Steps` or `Examples` sections.
        b. Attempt to extract or infer parameter values from the goal's description, the `world-model.json`, or other system context files. For example, for `container-security-auditor`, a target container name might be found in the `world-model.json` under a `system_components` key.
        c. If a parameter cannot be inferred, mark it as requiring user input.

7.  **Request Plan Approval (Conditional):**
    -   **Action:** For any multi-step plan or any plan that modifies critical system state, present the generated plan (including skill names and inferred parameters) to the user for confirmation before proceeding. Halt execution until approval is received.

8.  **Execute the Plan:**
    -   **Tool:** `Bash`
    -   **Action:** Iterate through the approved plan steps.
        a. For each step, construct the full command: `invoke-skill <skill_name> --param1=value1 ...`.
        b. Execute the command using `Bash`.
        c. Capture the `stdout`, `stderr`, and exit code of each skill invocation.
        d. If any skill fails (non-zero exit code), halt the entire plan and proceed to Error Handling (Step 10).

9.  **Update Goal Status:**
    -   **Tool:** `Edit`
    -   **Action:** After successful plan execution, update the goal's status in `world-model.json`.
        a. For one-off plans, set `status: "completed"`.
        b. For monitoring plans, set `status: "monitoring"` and add details about the recurring task that was created.
        c. Add an entry to a `history` array for the goal, timestamping the action and summarizing the executed plan.

## Output Format

-   **Console Output:** Detailed, step-by-step logging of the process: selected goal, discovered skills, formulated plan, parameter inference, and the output of each executed skill.
-   **File Modifications:**
    -   `~/.remote/@autoresearch/world-model.json`: The `status` and `history` of the processed goal will be updated.
    -   `~/.remote/@autoresearch/wants.json`: May be updated if a capability gap is identified.
-   **System State:** Other skills will be executed, potentially causing widespread changes to the system state as a downstream effect.

## Quality Gates

-   [ ] **Skill Identification:** Correctly identifies one or more relevant skills for an achievable goal.
-   [ ] **Plan Validity:** Generates a logically ordered and valid sequence of skill calls for multi-step goals.
-   [ ] **Parameter Inference:** Successfully extracts or infers necessary parameters for skill calls from the goal context.
-   [ ] **Execution Trigger:** Correctly constructs and triggers the `invoke-skill` command via `Bash`.
-   [ ] **Handling Monitoring Goals:** Correctly identifies goals requiring ongoing monitoring and proposes setting up a recurring task instead of a one-time execution.
-   [ ] **Capability Gap Detection:** Correctly recognizes when no existing skill can satisfy a goal and updates `wants.json` accordingly.

## Integration Points

-   **Reads From:**
    -   `world-model.json`: To get the list of strategic goals.
    -   `skills/*/SKILL.md`: To understand the capabilities of available skills.
    -   `wants.json`: To add new capability gaps.
-   **Writes To:**
    -   `world-model.json`: To update goal status.
    -   `wants.json`: To register new wants.
-   **Executes:**
    -   Any other skill available in the `skills/` directory via a generic `invoke-skill` shell command. This skill is a primary orchestrator.

## Error Handling

-   **No Actionable Goals:** If no goals with `status: "pending"` are found, log a message "No actionable goals found." and exit with code 0.
-   **Parameter Inference Failure:** If a required parameter for a skill cannot be inferred, the plan execution should be halted. The goal status in `world-model.json` should be updated to `blocked` with a `reason` of "Missing required parameters: `<param_name>`".
-   **Downstream Skill Failure:** If an invoked skill returns a non-zero exit code, this skill must:
    1.  Capture the `stderr` and exit code from the failed skill.
    2.  Halt the execution of the rest of the plan.
    3.  Update the goal's status in `world-model.json` to `failed`.
    4.  Add a `history` entry detailing which skill failed and include its error output.

## Examples

### Example 1: Simple Security Goal

1.  **Goal:** `world-model.json` contains `{ "name": "security-posture", "description": "Ensure the primary application container is secure.", "status": "pending" }`.
2.  **Discovery:** The skill scans `skills/` and finds `container-security-auditor/SKILL.md`, identifying it as highly relevant.
3.  **Plan:** A single-step plan is created: `invoke container-security-auditor`.
4.  **Parameters:** It infers the target container `app-main-v1` from another section of `world-model.json`.
5.  **Execution:** It runs `Bash: invoke-skill container-security-auditor --target=app-main-v1`.
6.  **Output:** The goal status is updated to `completed` in `world-model.json`.

### Example 2: Multi-step Marketing Goal

1.  **Goal:** `{ "name": "launch-q3-campaign", "description": "Launch the new marketing campaign for Q3. This involves optimizing the content strategy, creating a proposal, and then launching via Instantly.", "status": "pending" }`.
2.  **Discovery:** Identifies `content-strategy-optimizer`, `create-proposal`, and `instantly-campaigns` as relevant.
3.  **Plan:** Reasons that the correct order is:
    1. `content-strategy-optimizer`
    2. `create-proposal`
    3. `instantly-campaigns`
4.  **Approval:** Presents this 3-step plan to the user for confirmation.
5.  **Execution:** Upon approval, it executes the three skills in sequence.
6.  **Output:** The goal status is updated to `completed`.

### Example 3: Capability Gap

1.  **Goal:** `{ "name": "organize-team-offsite", "description": "Plan and organize the annual team offsite event.", "status": "pending" }`.
2.  **Discovery:** Scans all `SKILL.md` files and finds no skills related to event planning, logistics, or scheduling.
3.  **Action:**
    -   Logs "Capability Gap: No skills found for goal 'organize-team-offsite'".
    -   Updates the goal status to `blocked` in `world-model.json`.
    -   Adds a new entry to `wants.json`: `{ "id": "want-021", "description": "Need a skill to plan and organize events like team offsites." }`.