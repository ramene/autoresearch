# system-dashboard-generator
Generates a text-based or HTML dashboard summarizing key system metrics.

## Purpose
This skill addresses the high user demand for visibility into the autoresearch system's status and performance (want-020). The core hypothesis is that providing a consolidated, easy-to-read dashboard will improve user understanding and trust in the system's operations. This skill provides a user-facing summary of key metrics, including overall skill performance, problematic skills, and unmet user demands.

## Trigger Conditions
This skill should be activated under the following conditions:
1.  **Slash Command:** When the user explicitly invokes `/dashboard`.
    -   Example: `/dashboard --format html --output /tmp/status.html`
2.  **Keyword Detection:** When the user asks for a "status report", "system summary", "dashboard", "performance overview", or similar phrases.
3.  **Scheduled Execution:** Can be triggered by a scheduler skill to provide regular updates.

## Prerequisites
1.  **File System:** The `~/.remote/@autoresearch/` directory structure must exist and be populated.
2.  **Core Files:** The following files must be accessible and contain valid JSON data:
    -   `~/.remote/@autoresearch/skills/*/eval.json` for skill performance data.
    -   `~/.remote/@autoresearch/wants.json` for user intent signals.
3.  **Tools:** The agent must have access to standard shell tools, especially `jq` for JSON processing.

## Execution Steps

1.  **Parse Arguments:**
    -   Identify the user's requested output format (`text`, `html`, `json`). Default to `text`.
    -   Identify the user's requested output file path. Default to `null` (stdout).

2.  **Generate Skill Performance Section:**
    -   **This is a self-contained sub-task.**
    -   **Goal:** Produce a data object for the `skill_performance` section of the dashboard.
    -   **On Success:** The function must return an object like:
        ```json
        {
          "status": "success",
          "data": {
            "overall_score_ratio": "85/100 (85.0%)",
            "total_skills": 50,
            "untested_skills": 5,
            "stuck_skills": 2,
            "lowest_scoring_skills": [
              {"name": "skill-a", "score": 1, "total": 10},
              ...
            ]
          }
        }
        ```
    -   **On Failure:** If no `eval.json` files are found, or they are unreadable, the function must return an error object:
        ```json
        {
          "status": "error",
          "reason": "No eval.json files found"
        }
        ```
    -   **Action:**
        a. Use `Glob` to find all `~/.remote/@autoresearch/skills/*/eval.json` files.
        b. If no files are found, immediately return the failure object above.
        c. If files are found, initialize local counters (`total_score`, `total_possible`, etc.) to zero and an empty `skill_list`.
        d. Iterate through each file, parsing it with `jq`. Skip any unreadable or malformed files. Accumulate scores and skill details.
        e. Calculate the final metrics (`overall_ratio`, sort for `lowest_scoring`, etc.).
        f. Assemble and return the success object with the calculated data.

3.  **Generate User Demands Section:**
    -   **This is a self-contained sub-task.**
    -   **Goal:** Produce a data object for the `user_demands` section of the dashboard.
    -   **On Success:** The function must return an object like:
        ```json
        {
          "status": "success",
          "data": {
            "high_frequency_intents": [
              {"intent": "dashboard", "frequency": 419},
              ...
            ]
          }
        }
        ```
    -   **On Failure:** If `wants.json` is missing or unparseable, the function must return an error object:
        ```json
        {
          "status": "error",
          "reason": "wants.json not found or is unparseable"
        }
        ```
    -   **Action:**
        a. Use `Read` to load `~/.remote/@autoresearch/wants.json`.
        b. If the read fails, return the failure object.
        c. Use `jq` to parse the JSON and extract the top 5 intents by frequency.
        d. If parsing fails, return the failure object.
        e. If successful, assemble and return the success object.

4.  **Assemble Final Data Structure:**
    -   Call the functions from Step 2 and Step 3 to get their results.
    -   Construct the final output object, populating it based on the `status` of each result.
    -   **Example logic:**
        -   `skill_performance_result = call_step_2()`
        -   `user_demands_result = call_step_3()`
        -   `final_json.timestamp = <current_time>`
        -   `if skill_performance_result.status == 'success'`:
            -   `final_json.skill_performance = skill_performance_result.data`
        -   `else`:
            -   `final_json.skill_performance = { overall_score_ratio: "N/A", total_skills: 0, ..., "_data_note": skill_performance_result.reason }`
        -   `if user_demands_result.status == 'success'`:
            -   `final_json.user_demands = user_demands_result.data`
        -   `else`:
            -   `final_json.user_demands = { high_frequency_intents: [], "_data_note": user_demands_result.reason }`

5.  **Render Output:**
    -   **REQUIRED FIELDS CONTRACT — these MUST appear in every output regardless of format or data availability:**
        -   **Overall skill score ratio** (e.g., "85/100 (85.0%)" or "N/A — No skill eval.json files found")
        -   **Top 3 lowest-scoring skills** (list by name with score/total, or "No skill data available")
        -   **Count of stuck skills and untested skills** (e.g., "Stuck: 2, Untested: 5" — use 0 if no data)
        -   **High-frequency user intent signals** (top entries, or "No intent data available: <reason>")
    -   Based on the `output_format` from Step 1, render the assembled data from Step 4 into the chosen format (`text`, `html`, or `json`).

6.  **Finalize Output:**
    -   If an `output_file` was specified, write the rendered content to that file.
    -   Otherwise, print the rendered content to standard output.
    -   Report success to the user.

## Output Format
-   **`text` (default):** A formatted string printed to standard output, using ASCII characters to structure the information.
-   **`html`:** A single HTML file containing the dashboard, saved to a specified path.
-   **`json`:** A JSON object containing all the raw metrics, printed to standard output or saved to a file.

## Quality Gates
Before marking the task as complete, verify the following:
1.  [ ] **Overall Score:** The generated dashboard includes the overall skill score ratio (e.g., "85/100") or an explicit "N/A" with reason.
2.  [ ] **Lowest Skills:** The dashboard lists the top 3 lowest-scoring, non-untested skills, or states "No skill data available".
3.  [ ] **Stuck/Untested:** The dashboard shows the count of stuck and untested skills (even if both are 0).
4.  [ ] **User Intents:** The dashboard includes a section for recent high-frequency user intent signals, or states "No intent data available" with a reason.
5.  [ ] **Format Correctness:** The output matches the requested format (`text`, `html`, or `json`).
6.  [ ] **Successful Execution:** The skill ran without errors and produced a coherent, non-empty report.

## Integration Points
-   **Data Source:** Reads `eval.json` files generated by the `autoresearch-runner` and `wants.json` which is updated by the intent detection system.
-   **Scheduler:** Can be invoked by a `scheduler` skill to generate periodic reports (e.g., via a cron job).
-   **Notifier:** The output file (e.g., `status.html`) could be sent as an attachment by a `notification` skill.

## Error Handling
-   **Missing Files:** If `wants.json` or the `skills` directory is not found, the self-contained sub-tasks in Steps 2 and 3 return structured error objects. Step 4 then uses those error objects to populate fallback values. The dashboard must still render all section headers.
-   **Malformed JSON:** If any `eval.json` or `wants.json` file is unparseable, skip that file, log a warning, and continue generating the report with the available data.
-   **Invalid Arguments:** If an unsupported format is requested, inform the user of the available formats (`text`, `html`, `json`) and exit.
-   **Zero Skills:** If no skills are found, the dashboard must still display the Skill Performance section with "Overall Score: N/A", "Total Skills: 0 (Stuck: 0, Untested: 0)", and "Top 3 Lowest-Scoring Skills: No skill data found".

## Examples
**Example 1: Default Text Dashboard**
*   **User Command:** `/dashboard`
*   **Action:** The skill executes, gathers all metrics, and prints a formatted text summary to the console.
*   **Expected Output:**
    ```
    =======================================
    ==      System Dashboard             ==
    =======================================
    Generated: 2023-10-27T10:00:00Z

    === Skill Performance ===
    Overall Score: 85/100 (85.0%)
    Total Skills: 50 (Stuck: 2, Untested: 5)

    Top 3 Lowest-Scoring Skills:
    1. code-refactorer   (1/10)
    2. log-analyzer      (2/8)
    3. test-case-generator (5/15)

    === High-Frequency User Demands ===
    1. dashboard (419)
    2. refactor code (250)
    3. summarize git log (180)
    ```

**Example 2: HTML Dashboard to File**
*   **User Command:** `/dashboard --format html --output /tmp/system_status.html`
*   **Action:** The skill gathers all metrics and generates an HTML file at the specified path.
*   **Expected Output:** A message to the user: `Successfully generated HTML dashboard at /tmp/system_status.html`. The file `/tmp/system_status.html` contains the formatted report.

**Example 3: JSON Summary of Skill Performance**
*   **User Command:** `/dashboard --format json --focus skills`
*   **Action:** The skill gathers only the skill performance metrics and prints them to the console as a JSON object.
*   **Expected Output:**
    ```json
    {
      "timestamp": "2023-10-27T10:02:30Z",
      "skill_performance": {
        "overall_score_ratio": 0.85,
        "total_skills": 50,
        "untested_skills": 5,
        "stuck_skills": 2,
        "lowest_scoring_skills": [
          {"name": "code-refactorer", "score": 1, "total": 10},
          {"name": "log-analyzer", "score": 2, "total": 8},
          {"name": "test-case-generator", "score": 5, "total": 15}
        ]
      }
    }
    ```

**Example 4: Dashboard with Missing Data**
*   **User Command:** `/dashboard`
*   **Scenario:** `wants.json` does not exist; no `eval.json` files are found.
*   **Expected Output:**
    ```
    =======================================
    ==      System Dashboard             ==
    =======================================
    Generated: 2023-10-27T10:05:00Z

    === Skill Performance ===
    Overall Score: N/A — No skill eval.json files found
    Total Skills: 0 (Stuck: 0, Untested: 0)

    Top 3 Lowest-Scoring Skills:
    No skill data found

    === High-Frequency User Demands ===
    No intent data available — wants.json unavailable: file not found
    ```