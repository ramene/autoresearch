# prompt-refiner-for-robustness
Iteratively refines a skill's prompt to improve performance against core criteria like task completion and error handling.

## Purpose
This skill exists to address systemic weaknesses in prompt engineering across the autoresearch ecosystem, as identified in **want-022**. The core hypothesis is that fundamental reasoning capabilities like following instructions, ensuring task completion, and handling errors are weak because the underlying prompts lack sufficient clarity, structure, and guidance. Evidence from evaluation runs shows multiple skills failing on criteria such as 'Task Completion', 'Instructions Clarity', and 'Error Handling'. This skill provides a targeted, automated solution to analyze and strengthen prompts, creating a positive feedback loop for skill improvement.

## Trigger Conditions
- **Slash Command:** `/refine-prompt <skill_name> [--focus=<criterion>]`
  - `skill_name`: The name of the skill to refine (e.g., `classify-leads`).
  - `focus` (optional): The specific criterion to prioritize for improvement (e.g., `Error Handling`, `Task Completion`, `Instructions Clarity`).
- **Keywords:** "refine prompt for", "improve skill prompt", "fix prompt robustness".
- **Automatic Detection (Future):** This skill could be automatically triggered by the `autoresearch-runner` when a skill's evaluation score for a specific criterion drops below a certain threshold over multiple rounds.

## Prerequisites
- The target skill's directory must exist at `~/.remote/@autoresearch/skills/working-{skill_name}/`.
- The target skill directory must contain a `SKILL.md` file.
- The `SKILL.md` file must contain an `## Execution Steps` section which includes the core prompt for the agent.

## Execution Steps
1.  **Parse Inputs:**
    - Identify the target `<skill_name>` and the optional `--focus=<criterion>` from the trigger command.
    - Set the target skill directory path: `SKILL_DIR="~/.remote/@autoresearch/skills/working-{skill_name}"`.

2.  **Locate and Read Skill Context:**
    - **[Read]** Read the contents of the target skill's manifest: `cat ${SKILL_DIR}/SKILL.md`.
    - **[Read]** (Optional) To gather more context on failures, attempt to read the evaluation results and past execution rounds: `cat ${SKILL_DIR}/eval.json` and `cat ${SKILL_DIR}/rounds.json`. If these files do not exist, proceed without them.

3.  **Isolate the Core Prompt:**
    - From the content of `SKILL.md`, extract the text under the `## Execution Steps` section. This numbered list constitutes the core prompt that guides the agent's behavior. Store this text in a variable `ORIGINAL_PROMPT`.

4.  **Analyze Prompt against Best Practices:**
    - Critically evaluate the `ORIGINAL_PROMPT` against the following principles. Pay special attention to the `--focus` criterion if provided.
    - **Clarity and Specificity:** Are instructions unambiguous? Is there jargon or vague language like "handle it appropriately"? Are all inputs and outputs clearly defined?
    - **Task Decomposition:** Is the task broken down into a logical sequence of small, verifiable steps? Or is it a single, monolithic instruction?
    - **Output Formatting:** Does the prompt specify the exact output format required? For structured data, does it provide a schema (e.g., JSON schema) or a clear template? Does it instruct the agent to use code fences (e.g., ```json)?
    - **Error Handling:** Does the prompt explicitly tell the agent what to do when things go wrong? (e.g., "If a file is not found, you MUST report the error and stop.", "If the API returns a 404 error, assume the resource does not exist and proceed to the next step.").
    - **Few-Shot Examples:** Does the prompt include concrete examples of both desired and undesired behavior (`Good Example` / `Bad Example`)? This is crucial for teaching by example.
    - **Persona and Role:** Does the prompt establish a clear role for the agent (e.g., "You are an expert code reviewer.")?

5.  **Identify Top 1-3 Weaknesses:**
    - Based on the analysis in the previous step, identify the most critical weaknesses.
    - If `focus=Error Handling` was specified, prioritize the lack of explicit error-handling instructions.
    - If `focus=Task Completion` was specified, prioritize ambiguity, missing steps, or poor task decomposition.
    - If the prompt has no examples, this is a high-priority weakness.
    - If the prompt requests JSON but provides no schema or formatting instructions, this is a high-priority weakness.
    - Document these weaknesses as the basis for your proposed changes.

6.  **Generate Specific Refinements:**
    - For each identified weakness, formulate a concrete change to the prompt text.
    - **To improve clarity:** Rephrase ambiguous sentences. Replace vague terms with precise instructions.
    - **To add error handling:** Add a new step or a sub-bullet to an existing step, such as: `If the 'Read' tool fails with a 'file not found' error, you must output an error message in JSON format: {"error": "File not found: [path]"}`.
    - **To improve formatting:** Add a concluding step like: `Your final output must be a single, valid JSON object enclosed in a ```json code fence. Do not include any explanatory text outside the code fence. Adhere to the following schema: ...`.
    - **To add examples:** Create a new section within the prompt called `### Examples` with `#### Good Example` and `#### Bad Example` subsections that illustrate correct and incorrect execution.

7.  **Construct the Refined Prompt and Rationale:**
    - Integrate the generated refinements into the `ORIGINAL_PROMPT` to create a new, complete `REFINED_PROMPT`.
    - Write a clear, bulleted list explaining *why* each change was made. This is the `RATIONALE`. Each point should link a specific change to an identified weakness and a predicted performance improvement. For example: "Added explicit JSON formatting instructions to prevent malformed outputs, which addresses a common failure mode in 'Task Completion'."

8.  **Write the Output File:**
    - **[Write]** Create a new file at `${SKILL_DIR}/prompt_refinement_suggestion.md`.
    - The file should contain the `REFINED_PROMPT` and the `RATIONALE`, formatted according to the `Output Format` section below.

## Output Format
The skill produces a single markdown file: `~/.remote/@autoresearch/skills/working-{skill_name}/prompt_refinement_suggestion.md`.

The content of the file must be structured as follows:

```markdown
# Prompt Refinement Suggestion for {skill_name}

## Refined Prompt

<The full, new prompt text from Execution Step 7>

## Rationale for Changes

<The bulleted list of explanations from Execution Step 7>
```

## Quality Gates
Before finishing, verify the output against these checks:
1.  **Weakness Identified:** Does the `Rationale` section clearly state the primary weakness found in the original prompt? (Yes/No)
2.  **Targeted Rewrite:** Does the `Refined Prompt` contain specific changes that directly address a known failure mode (e.g., ambiguity, missing error handling)? (Yes/No)
3.  **Examples Added/Improved:** If the original prompt lacked examples, were clear few-shot examples added? (Yes/No/NA)
4.  **Robustness Instructions Added:** Were explicit instructions for error handling and strict output formatting added or improved? (Yes/No)
5.  **Syntactically Correct:** Is the `Refined Prompt` a complete, well-formed set of instructions ready for use in a `SKILL.md`? (Yes/No)
6.  **Explanation Provided:** Does the `Rationale` clearly explain *why* the proposed changes are expected to improve performance? (Yes/No)

## Integration Points
- **Reads:** `skills/working-{skill_name}/SKILL.md`, `eval.json`, `rounds.json`.
- **Writes:** `skills/working-{skill_name}/prompt_refinement_suggestion.md`.
- **Downstream:** A human developer or a future `skill-updater` skill is expected to review the suggestion file and manually or automatically apply the changes to the `SKILL.md`.

## Error Handling
- If the target skill directory `~/.remote/@autoresearch/skills/working-{skill_name}/` or its `SKILL.md` file does not exist, terminate and report the error.
- If the `SKILL.md` file does not contain an `## Execution Steps` section, terminate and report that the prompt could not be located.
- If the analysis determines the prompt is already of very high quality and meets all best practice criteria, the skill should output a suggestion file stating this in the `Rationale` and proposing no changes to the prompt itself.

## Examples

### Example 1: Refining for Error Handling
- **Command:** `/refine-prompt create-proposal --focus=Error Handling`
- **Identified Weakness:** The prompt tells the agent to fetch customer data via an API but doesn't specify what to do if the API call fails or the customer is not found.
- **Refined Prompt Snippet (Addition):**
  ```
  3. Fetch customer details using the CRM tool: `crm-tool get-customer --id ${customer_id}`.
     a. **Error Handling:** If the tool returns a '404 Not Found' error, you MUST halt execution and output the following JSON: `{"error": "Customer with ID ${customer_id} not found."}`.
     b. If any other API error occurs, report the error and stop.
  ```
- **Rationale Snippet:**
  ```
  - **Added Explicit Error Handling:** The original prompt was vulnerable to API failures. The refined prompt adds a specific instruction for handling '404 Not Found' errors, preventing silent failures and improving robustness.
  ```

### Example 2: Refining for Output Formatting
- **Command:** `/refine-prompt gmail-inbox`
- **Identified Weakness:** The prompt asks for a summary of emails in JSON format but provides no schema, leading to inconsistent and often malformed output.
- **Refined Prompt Snippet (Addition):**
  ```
  5. Your final output MUST be a single JSON array enclosed in a ```json code fence. Each object in the array represents one email and must conform to this schema:
     {
       "id": "string",
       "from": "string",
       "subject": "string",
       "summary": "string // A one-sentence summary"
     }
  ```
- **Rationale Snippet:**
  ```
  - **Enforced Strict Output Schema:** To eliminate malformed JSON outputs, a final step was added that defines the exact JSON structure, including data types and a code fence requirement. This will improve downstream tool compatibility.
  ```

### Example 3: Adding Few-Shot Examples
- **Command:** `/refine-prompt classify-leads`
- **Identified Weakness:** The prompt describes what a "hot lead" is but provides no concrete examples, making the classification subjective and inconsistent.
- **Refined Prompt Snippet (Addition):**
  ```
  ### Examples

  #### Good Example (Correct Classification)
  - **Input:** "User downloaded the whitepaper and visited the pricing page twice this week."
  - **Output:** `{"lead_id": "user123", "classification": "hot", "reason": "High-intent actions (pricing page visit) combined with content engagement."}`

  #### Bad Example (Incorrect Classification)
  - **Input:** "User opened our weekly newsletter."
  - **Output:** `{"lead_id": "user456", "classification": "hot", "reason": "User is engaged."}`
  - **Correction:** This should be 'warm', as opening a newsletter is a low-intent action.
  ```
- **Rationale Snippet:**
  ```
  - **Added Few-Shot Examples:** The original prompt's classification criteria were abstract. By adding 'Good' and 'Bad' examples, the model gets concrete guidance on how to interpret the rules, leading to more accurate and consistent lead classification.
  ```