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
3.  **Tools:** The agent must have access to standard file tools (Glob, Read). **Do NOT use `jq` or any external shell command for JSON parsing — parse JSON content directly from Read tool output.**

> **NEVER call `jq`, `bash`, or any shell command to parse JSON.** Read files directly with the Read tool and parse JSON content yourself from the returned text. If a file's content is not valid JSON, treat it as "file not found" and leave the variable at its fallback value.

## Execution Steps

Work through Steps 1–4 in order. Do not skip any step. The dashboard is rendered exactly once at the end of Step 4.

---

### Step 1 — Initialize Variables

Before reading any files or calling any tools, set ALL of the following variables to their safe fallback values:

```
output_format        = "text"
output_file          = null
overall_score_ratio  = "N/A — No skill eval.json files found"
total_skills         = 0
stuck_skills         = 0
untested_skills      = 0
lowest_scoring_skills = []   (empty list)
skill_data_note      = "No skill eval.json files found"
high_frequency_intents = []  (empty list)
intent_data_note     = "wants.json not found or is unparseable"
timestamp            = <current timestamp>
```

Parse any user-provided arguments now:
- If the user specified a format (`text`, `html`, `json`), overwrite `output_format`. If unrecognized, inform the user and keep `text`.
- If the user specified an output file path, overwrite `output_file`.

**Proceed to Step 2.**

---

### Step 2 — Gather Skill Performance Data (Best Effort)

Attempt to overwrite the skill performance variables with real data. Any failure at any sub-step means that sub-step is skipped and execution continues to the next sub-step or Step 3. Missing files and parse errors are not failures — they simply leave variables at the fallback values set in Step 1.

- a. Use `Glob` to find all `~/.remote/@autoresearch/skills/*/eval.json` files. If Glob errors or returns empty → **proceed directly to Step 3** (fallback values remain).
- b. If files found, initialize local counters: `total_score = 0`, `total_possible = 0`, `stuck_count = 0`, `untested_count = 0`, `skill_list = []`.
- c. For each file path returned by Glob:
    - Use `Read` to read the file. If Read errors or returns empty → skip this file, continue to next.
    - Parse the returned text as JSON yourself. If not valid JSON → skip this file, continue to next.
    - Extract `score` (number), `total` (number), `status` (string), `name` (string, or derive from file path).
    - If `status` is `"untested"` → increment `untested_count`. If `status` is `"stuck"` → increment `stuck_count`.
    - Add `total_score += score`, `total_possible += total`. Append `{name, score, total}` to `skill_list`.
- d. If at least one file was successfully parsed:
    - Overwrite `overall_score_ratio` = `"<total_score>/<total_possible> (<pct>%)"`.
    - Sort `skill_list` by `score/total` ascending; take top 3 non-untested skills as `lowest_scoring_skills`.
    - Overwrite `total_skills`, `stuck_skills`, `untested_skills`, `lowest_scoring_skills`.
    - Set `skill_data_note = null`.
- e. If no files were successfully parsed → fallback values from Step 1 remain unchanged.

**Proceed to Step 3 regardless of outcome.**

---

### Step 3 — Gather User Demands Data (Best Effort)

Attempt to overwrite the intent variables with real data. Any failure leaves the fallback values unchanged and execution continues. Missing files and parse errors are not failures.

- a. Use `Read` to load `~/.remote/@autoresearch/wants.json`. If Read errors or returns empty → **proceed directly to Step 4**.
- b. Parse the returned text as JSON yourself. If not valid JSON → **proceed directly to Step 4**.
- c. Extract the top 5 intents by frequency. If extraction fails for any reason → **proceed directly to Step 4**.
- d. If successful: overwrite `high_frequency_intents` with the parsed list; set `intent_data_note = null`.

**Proceed to Step 4 regardless of outcome.**

---

### Step 4 — Render Final Dashboard (MANDATORY — THIS SKILL CANNOT FAIL)

> **CRITICAL**: This step executes unconditionally, no matter what happened in Steps 1–3. Errors, missing files, empty data, parse failures — none of these prevent rendering. This skill has **no failure mode**. A dashboard with all N/A/fallback values is a **successful execution**. Never report an error to the user instead of rendering. Never abort. Never skip this step.
>
> **If every data source was unavailable**, you MUST still print this exact output (substituting the real timestamp):
> ```
> =======================================
> ==      System Dashboard             ==
> =======================================
> Generated: <timestamp>
>
> === Skill Performance ===
> Overall Score: N/A — No skill eval.json files found
> Total Skills: 0 (Stuck: 0, Untested: 0)
>
> Top 3 Lowest-Scoring Skills:
> No skill data found
>
> === High-Frequency User Demands ===
> No intent data available — wants.json not found or is unparseable
> ```
> That output is a SUCCESS. Print it and mark the task complete.

Using the current values of all variables (populated from Steps 1–3), render the complete dashboard exactly once now:

```
=======================================
==      System Dashboard             ==
=======================================
Generated: [VALUE OF: timestamp]

=== Skill Performance ===
Overall Score: [VALUE OF: overall_score_ratio]
Total Skills: [VALUE OF: total_skills] (Stuck: [VALUE OF: stuck_skills], Untested: [VALUE OF: untested_skills])

Top 3 Lowest-Scoring Skills:
[IF lowest_scoring_skills is empty: "No skill data found"
 OTHERWISE: list each skill as "N. <name> (<score>/<total>)"]

=== High-Frequency User Demands ===
[IF high_frequency_intents is empty: "No intent data available — [VALUE OF: intent_data_note]"
 OTHERWISE: list each intent as "N. <intent> (<count>)"]
```

- If `output_file` was specified, write the rendered content to that file and report: `Successfully generated dashboard at <output_file>`.
- Otherwise, print the rendered content to standard output.

**The skill has completed successfully.**

---

## Output Format
-   **`text` (default):** A formatted string printed to standard output, using ASCII characters to structure the information.
-   **`html`:** A single HTML file containing the dashboard, saved to a specified path.
-   **`json`:** A JSON object containing all the raw metrics, printed to standard output or saved to a file.

## Quality Gates
Before marking the task as complete, verify the following:
1.  [ ] **Overall Score:** The generated dashboard includes the overall skill score ratio (e.g., "85/100") or an explicit "N/A" with reason.
2.  [ ] **Lowest Skills:** The dashboard lists the top 3 lowest-scoring, non-untested skills, or states "No skill data found".
3.  [ ] **Stuck/Untested:** The dashboard shows the count of stuck and untested skills (even if both are 0).
4.  [ ] **User Intents:** The dashboard includes a section for recent high-frequency user intent signals, or states "No intent data available" with a reason.
5.  [ ] **Format Correctness:** The output matches the requested format (`text`, `html`, or `json`).
6.  [ ] **Successful Execution:** The skill ran and produced a coherent, non-empty report. **A dashboard showing all N/A/fallback values due to missing data IS a successful execution.**

## Integration Points
-   **Data Source:** Reads `eval.json` files generated by the `autoresearch-runner` and `wants.json` which is updated by the intent detection system.
-   **Scheduler:** Can be invoked by a `scheduler` skill to generate periodic reports (e.g., via a cron job).
-   **Notifier:** The output file (e.g., `status.html`) could be sent as an attachment by a `notification` skill.

## Error Handling
-   **Missing Files:** Steps 2 and 3 are best-effort data gathering. Missing files cause those steps to retain fallback values and continue. The dashboard always renders all section headers.
-   **Tool Errors:** Any error from Glob or Read within Steps 2 or 3 causes that sub-step to be skipped. Fallback values are used. Tool errors never prevent Step 4 from executing.
-   **No jq / Shell Commands:** JSON parsing is always done natively by the agent from Read tool output. Never invoke `jq`, `bash`, or any shell command for JSON processing.
-   **Malformed JSON:** If any `eval.json` or `wants.json` content is not valid JSON, skip that file and continue with available data.
-   **Invalid Arguments:** If an unsupported format is requested, inform the user of available formats and default to `text` (do not abort).
-   **Zero Skills:** Dashboard displays fallback values: "Overall Score: N/A", "Total Skills: 0 (Stuck: 0, Untested: 0)", "Top 3 Lowest-Scoring Skills: No skill data found".
-   **Complete Data Unavailability:** Step 1 guarantees every variable has a safe fallback. All data sources failing produces a valid, coherent dashboard. Step 4 always renders and the skill completes successfully.

## Examples
**Example 1: Default Text Dashboard**
*   **User Command:** `/dashboard`
*   **Action:** The skill executes Steps 1–4, gathers all metrics, and prints a formatted text summary to the console.
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
*   **Action:** The skill gathers skill performance metrics and prints them to the console as a JSON object.
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
    No intent data available — wants.json not found or is unparseable
    ```