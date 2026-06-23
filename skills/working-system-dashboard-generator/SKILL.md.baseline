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
    -   Identify the user's requested output format. Default to `text`. Supported formats: `text`, `html`, `json`.
    -   Identify the user's requested output file path. If not provided, output to standard output.
    -   Identify any focus areas requested (e.g., `skills`, `intents`). If none, generate a full dashboard.

2.  **Gather Skill Performance Metrics:**
    -   **Tool:** `Glob`, `Bash`, `Read`
    -   **Action:**
        a. Use `Glob` to find all `eval.json` files located at `~/.remote/@autoresearch/skills/*/eval.json`.
        b. Initialize counters: `total_score = 0`, `total_possible = 0`, `skill_count = 0`, `untested_count = 0`, `stuck_count = 0`.
        c. Create an empty list to store individual skill data: `skill_list = []`.
        d. Iterate through each `eval.json` file found:
            i. Use `Read` to get the file content.
            ii. Use `Bash` with `jq` to parse the JSON. Extract the skill name from the file path.
            iii. Extract `score` and `total` from the `summary` object.
            iv. If `total` is 0, increment `untested_count`.
            v. If `score` is 0 and `total` > 0, check the skill's `rounds.json` or `events.jsonl` for signs of repeated failures to determine if it's "stuck". For this version, we will define "stuck" as a skill with a score of 0 and a non-zero total. Increment `stuck_count` if this condition is met.
            vi. Add the extracted `score` to `total_score` and `total` to `total_possible`.
            vii. Increment `skill_count`.
            viii. Append a record `{ "name": skill_name, "score": score, "total": total, "ratio": score/total }` to `skill_list`. Handle division by zero for the ratio (if total is 0, ratio is 0).

3.  **Process Skill Metrics:**
    -   **Tool:** `Bash` (in-memory processing)
    -   **Action:**
        a. Calculate the overall skill score ratio: `overall_ratio = total_score / total_possible`. Handle division by zero.
        b. Sort `skill_list` by the `ratio` in ascending order.
        c. Identify the top 3 lowest-scoring skills from the sorted list (excluding untested skills).

4.  **Gather User Intent & Demand Metrics:**
    -   **Tool:** `Read`, `Bash`
    -   **Action:**
        a. Use `Read` to load the contents of `~/.remote/@autoresearch/wants.json`.
        b. Use `Bash` with `jq` to parse the JSON.
        c. Extract the top 5 entries, sorted by the `frequency` field in descending order. These are the recent high-frequency user intent signals.

5.  **Assemble Data Structure:**
    -   Create a single JSON object in memory to hold all the gathered data. This will be the source for all output formats.
    ```json
    {
      "timestamp": "YYYY-MM-DDTHH:MM:SSZ",
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
      },
      "user_demands": {
        "high_frequency_intents": [
          {"intent": "dashboard", "frequency": 419},
          {"intent": "refactor code", "frequency": 250},
          {"intent": "summarize git log", "frequency": 180}
        ]
      }
    }
    ```

6.  **Render Output:**
    -   Based on the format argument from Step 1, render the assembled data.
    -   **If `text`:**
        -   Format the data into a human-readable ASCII report. Use headers and spacing for clarity.
        -   Example section:
            ```
            === Skill Performance ===
            Overall Score: 85/100 (85.0%)
            Total Skills: 50 (Stuck: 2, Untested: 5)

            Top 3 Lowest-Scoring Skills:
            1. code-refactorer   (1/10)
            2. log-analyzer      (2/8)
            3. test-case-generator (5/15)
            ```
    -   **If `html`:**
        -   Generate a simple, self-contained HTML document with basic CSS for readability. Use tables for lists of skills and intents.
    -   **If `json`:**
        -   Pretty-print the assembled JSON data structure from Step 5.

7.  **Finalize Output:**
    -   **Tool:** `Write`, `Bash`
    -   **Action:**
        a. If an output file was specified, use `Write` to save the rendered content to that file.
        b. Otherwise, print the rendered content to standard output using `Bash` (`echo`).
        c. Report success to the user, indicating where the dashboard was generated.

## Output Format
-   **`text` (default):** A formatted string printed to standard output, using ASCII characters to structure the information.
-   **`html`:** A single HTML file containing the dashboard, saved to a specified path.
-   **`json`:** A JSON object containing all the raw metrics, printed to standard output or saved to a file.

## Quality Gates
Before marking the task as complete, verify the following:
1.  [ ] **Overall Score:** The generated dashboard includes the overall skill score ratio (e.g., "85/100").
2.  [ ] **Lowest Skills:** The dashboard lists the top 3 lowest-scoring, non-untested skills.
3.  [ ] **Stuck/Untested:** The dashboard shows the count of stuck and untested skills.
4.  [ ] **User Intents:** The dashboard includes a section for recent high-frequency user intent signals from `wants.json`.
5.  [ ] **Format Correctness:** The output matches the requested format (`text`, `html`, or `json`).
6.  [ ] **Successful Execution:** The skill ran without errors and produced a coherent, non-empty report.

## Integration Points
-   **Data Source:** Reads `eval.json` files generated by the `autoresearch-runner` and `wants.json` which is updated by the intent detection system.
-   **Scheduler:** Can be invoked by a `scheduler` skill to generate periodic reports (e.g., via a cron job).
-   **Notifier:** The output file (e.g., `status.html`) could be sent as an attachment by a `notification` skill.

## Error Handling
-   **Missing Files:** If `wants.json` or the `skills` directory is not found, report the error clearly and exit gracefully. The dashboard should indicate which sections could not be generated.
-   **Malformed JSON:** If any `eval.json` or `wants.json` file is unparseable, skip that file, log a warning, and continue generating the report with the available data.
-   **Invalid Arguments:** If an unsupported format is requested, inform the user of the available formats (`text`, `html`, `json`) and exit.
-   **Zero Skills:** If no skills are found, the dashboard should state "No skills found" instead of showing errors from division by zero.

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