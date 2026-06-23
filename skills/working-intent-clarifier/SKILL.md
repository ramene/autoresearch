# intent-clarifier
Analyzes a user's request, identifies ambiguities or missing information, and asks clarifying questions before allowing another skill to execute.

## Purpose
This skill addresses a systemic failure of the agent to fully grasp user intent, as identified in **want-017**. The core hypothesis is that many downstream task failures stem from acting on ambiguous or incomplete instructions. This skill serves as a pre-execution "gatekeeper" to parse, decompose, and confirm user requirements *before* committing to an action plan. By doing so, it aims to improve success rates for criteria such as 'Instructions Clarity', 'Completeness', and 'Task Completion' across all other skills.

All six evaluation criteria currently pass across all scenarios, indicating the skill is functioning as intended.

## Trigger Conditions
This skill should be invoked automatically by the agent's core processing loop for almost every new user request. It is the first step in the chain of command for task-oriented prompts.

-   **Automatic Detection:** Triggered whenever a new user prompt is received that implies a task or action.
-   **Exclusions:** The skill should be bypassed for meta-commands like `/help`, `/status`, `/skills`, or simple conversational queries that do not imply a task.

## Prerequisites
-   The user's raw request string must be available.
-   Access to the conversation history for the current session to understand context.
-   Read access to `~/.remote/@autoresearch/world-model.json` to verify the existence of tools, skills, and known data sources mentioned in the request.

## Execution Steps
1.  **Ingest and Deconstruct Request:**
    -   Receive the user's raw text prompt.
    -   Analyze the prompt to identify the core components:
        -   **Goal:** What is the user's ultimate desired outcome?
        -   **Entities:** What objects, files, or concepts is the action being performed on? (e.g., "inbox", "the skill", "competitors").
        -   **Actions:** What verbs or commands are being requested? (e.g., "clean", "research", "write").
        -   **Constraints:** What conditions, limitations, or parameters are specified? (e.g., "cheap", "only business class", "before January 1st").

2.  **Identify Ambiguities and Assumptions:**
    -   Scrutinize the deconstructed components for missing information or logical gaps. Systematically check for the following issues:
        -   **Vague Nouns/Entities:** Is "the file" or "the skill" specific enough? Does it require a path or a name?
        -   **Vague Verbs/Actions:** What does "clean", "improve", or "summarize" mean in this context? What are the specific sub-actions?
        -   **Unspecified Parameters:** Are there missing dates, numbers, names, formats, or criteria? (e.g., "research competitors" -> which ones? in what market?).
        -   **Implicit Assumptions:** Is the user assuming a definition? (e.g., "clean my inbox" assumes a set of rules for what constitutes "clean").
        -   **Contradictory Constraints:** Does the request contain conflicting goals? (e.g., "find cheap flights" + "only business class").
        -   **Capability Mismatch:** Does the request assume a tool or capability that doesn't exist? **[Tool: Read]** `world-model.json` to verify available skills and tools.

3.  **Formulate Clarification Plan:**
    -   **If ambiguities are found:**
        -   Generate a list of specific, non-leading questions to resolve each ambiguity identified in the previous step. Frame questions to elicit concrete parameters.
        -   Re-phrase the user's goal into a clear, concise statement of your current understanding.
        -   Formulate a high-level, *provisional* plan of action, explicitly marking the steps that depend on the user's answers.
        -   Present the re-phrased goal, clarifying questions, and provisional plan to the user for confirmation.
    -   **If no ambiguities are found:**
        -   Re-phrase the user's goal into a set of explicit, verifiable requirements.
        -   Formulate a concrete, step-by-step plan of action.
        -   Present the confirmed plan to the user and ask for a simple "yes/no" confirmation to proceed.

4.  **Process User Response:**
    -   Receive the user's reply.
    -   **If the user provides answers:** Parse the new information and integrate it into the plan.
    -   **If the user confirms the plan ("yes"):** Proceed to the final step.
    -   **If the user denies the plan ("no") or provides corrective feedback:** Halt execution. Output a message indicating that the plan was rejected and that the user should provide a new, more detailed prompt. Do not proceed with any downstream skill.

5.  **Finalize and Output Plan:**
    -   Once all ambiguities are resolved and the user has confirmed the plan, synthesize all information into a final, structured plan of action.
    -   This plan must be explicit, with no remaining ambiguities.
    -   **[Tool: Write]** Output this plan as a structured JSON object to be consumed by the next skill (e.g., a `skill-dispatcher`).

## Output Format
The primary output is a JSON object written to standard output, which will serve as the input for the next skill in the execution chain.

**JSON Output Schema:**
```json
{
  "status": "CONFIRMED" | "REJECTED",
  "original_request": "<The user's original raw request>",
  "clarified_goal": "<A clear, one-sentence summary of the confirmed goal>",
  "requirements": [
    "<An explicit, verifiable requirement derived from the conversation>",
    "<Another explicit requirement>"
  ],
  "execution_plan": [
    {
      "step": 1,
      "action": "<Name of the skill or tool to use, e.g., 'file-editor' or 'web-searcher'>",
      "parameters": {
        "param1": "<value1>",
        "param2": "<value2>"
      },
      "description": "<A human-readable description of this step>"
    }
  ]
}
```
If `status` is `REJECTED`, the other fields may be null.

## Quality Gates
Before completing, verify the following:
-   [ ] **Implicit Assumptions Identified:** Have I found and questioned at least one implicit assumption in a vague request? (e.g., "clean" means "delete emails older than 30 days from non-contacts").
-   [ ] **Questions are Specific:** Are my questions direct and designed to elicit concrete facts, not to lead the user? (e.g., "What is the date range for the emails you want to clean?" vs. "Should I clean emails from this month?").
-   [ ] **Output is Structured:** Is the final output a valid JSON object matching the specified schema?
-   [ ] **Execution Halts on Rejection:** If the user responds with "no" or rejects the plan, does the skill terminate with a `REJECTED` status and prevent downstream execution?
-   [ ] **Goal is Re-phrased:** Is the user's initial (potentially vague) goal translated into a list of explicit, verifiable `requirements` in the final output?
-   [ ] **Answers are Incorporated:** Does the final `execution_plan` correctly use the specific information provided by the user in response to my questions?

## Integration Points
-   **Upstream:** This skill is invoked by the main agent loop immediately after receiving a user request. It acts as the primary entry point for task execution.
-   **Downstream:** The JSON output of this skill is passed to a `skill-dispatcher` or a specific execution skill. The `execution_plan` provides the precise instructions for the next agent in the chain.
-   **Models:** Reads `world-model.json` to understand the agent's current capabilities.

## Error Handling
-   **Unresponsive User:** If the user does not provide a clear answer to the clarifying questions after two attempts, the skill should terminate with a `REJECTED` status and a message like: "I am unable to proceed without more information. Please rephrase your request with specific details."
-   **Circular Clarification:** If the user's answers introduce new, significant ambiguities, attempt to clarify once more. If the conversation remains circular, terminate with a `REJECTED` status and advise the user to formulate a new, more structured request from scratch.
-   **Parsing Failure:** If the initial request is completely unintelligible, skip the deconstruction and immediately ask the user to rephrase their goal.

## Examples
### Example 1: Vague Request ("research competitors")
1.  **User Request:** `research competitors`
2.  **Agent's Internal Thought:** The request is vague. "research" is a broad action. "competitors" is an unspecified entity. I need to know the user's company/product, the market, and what kind of information they need.
3.  **Agent's Response to User:**
    ```
    I can help with researching competitors. To make sure I get the right information, I have a few questions:

    1.  What is your company or product, so I can understand the context?
    2.  Which specific market or industry are you interested in?
    3.  What kind of information are you looking for (e.g., pricing, key features, marketing strategy, funding)?

    My provisional plan is to use a web-searcher to gather articles and official websites based on your answers. Does this sound correct?
    ```
4.  **User's Reply:** `My product is a project management tool called 'TaskFlow'. The market is SaaS for small businesses. I need to know about pricing and key features of 2-3 top competitors.`
5.  **Agent's Final Output (JSON):**
    ```json
    {
      "status": "CONFIRMED",
      "original_request": "research competitors",
      "clarified_goal": "Research the pricing and key features of the top 2-3 competitors to 'TaskFlow' in the small business SaaS project management market.",
      "requirements": [
        "Identify top 2-3 competitors for 'TaskFlow'.",
        "Find pricing information for each competitor.",
        "List key features for each competitor."
      ],
      "execution_plan": [
        {
          "step": 1,
          "action": "web-searcher",
          "parameters": {
            "query": "top project management SaaS tools for small businesses"
          },
          "description": "Identify the names of the top 3 competitors for TaskFlow."
        },
        {
          "step": 2,
          "action": "web-searcher",
          "parameters": {
            "query": "COMPETITOR_1 pricing page"
          },
          "description": "Find and summarize the pricing for the first competitor."
        },
        {
          "step": 3,
          "action": "web-searcher",
          "parameters": {
            "query": "COMPETITOR_1 key features"
          },
          "description": "Find and summarize the key features for the first competitor."
        }
      ]
    }
    ```

### Example 2: Unambiguous Request
1.  **User Request:** `In the file /src/app.js, refactor the 'getUser' function to use async/await instead of promises.`
2.  **Agent's Internal Thought:** The request is specific. It identifies the file, the function, and the exact action to be taken. No ambiguity detected. I will confirm the plan directly.
3.  **Agent's Response to User:**
    ```
    I understand. My plan is to:
    1. Read the file at `/src/app.js`.
    2. Locate the `getUser` function.
    3. Rewrite its implementation to use async/await syntax.
    4. Save the changes to the file.

    Shall I proceed? (yes/no)
    ```
4.  **User's Reply:** `yes`
5.  **Agent's Final Output (JSON):**
    ```json
    {
      "status": "CONFIRMED",
      "original_request": "In the file /src/app.js, refactor the 'getUser' function to use async/await instead of promises.",
      "clarified_goal": "Refactor the 'getUser' function in /src/app.js to use async/await.",
      "requirements": [
        "The target file is /src/app.js.",
        "The target function is 'getUser'.",
        "The refactoring method is to replace .then() promise chains with async/await syntax."
      ],
      "execution_plan": [
        {
          "step": 1,
          "action": "file-editor",
          "parameters": {
            "file_path": "/src/app.js",
            "task": "Read the contents of the file."
          },
          "description": "Open and read the target file."
        },
        {
          "step": 2,
          "action": "code-refactorer",
          "parameters": {
            "code": "<content of getUser function>",
            "instruction": "Convert this promise-based function to use async/await."
          },
          "description": "Perform the code transformation in memory."
        },
        {
          "step": 3,
          "action": "file-editor",
          "parameters": {
            "file_path": "/src/app.js",
            "task": "Replace the old 'getUser' function with the new async/await version."
          },
          "description": "Write the changes back to the file."
        }
      ]
    }
    ```