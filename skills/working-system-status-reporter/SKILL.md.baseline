# system-status-reporter
Generates a concise summary report of the agent's current state, including skill health, goal progress, and system alerts.

## Purpose
This skill addresses the need for improved system observability (want-024). The core hypothesis is that the agent's complex internal state is difficult for users to understand at a glance, hindering their ability to monitor progress and diagnose issues. High user demand for "dashboard"-like summaries indicates a need for a skill that can synthesize and report on key system metrics, turning raw data into an actionable overview.

## Trigger Conditions
This skill should be activated under the following conditions:
1.  **Slash Command:** User issues the command `/status` or `/report`.
2.  **Keyword Detection:** User asks questions like "How are you doing?", "What's the system status?", "Give me a dashboard view", or "Generate a health report".
3.  **Scheduled Trigger:** Can be invoked by a scheduler skill for periodic reporting (e.g., daily at 08:00).

## Prerequisites
The following files and directory structures must be present in the `~/.remote/@autoresearch/` directory for the skill to function correctly:
1.  A `skills/` directory containing subdirectories for each skill.
2.  Each skill subdirectory (e.g., `skills/working-code-generator/`) must contain:
    *   `eval.json`: Contains evaluation scores and status.
    *   `events.jsonl`: A log of significant events, including failures.
3.  A root-level `wants.json` file tracking unmet demands and capability gaps.

## Execution Steps
1.  **Acknowledge and Initialize:**
    *   Acknowledge the trigger command.
    *   Note any parameters provided, such as `--format=json` or `--focus=failing`.
    *   Initialize an empty data structure (e.g., a dictionary or object) to hold the report data.

2.  **Scan Skill Directories:**
    *   **Tool:** `Bash`
    *   **Action:** Execute `ls -d ~/.remote/@autoresearch/skills/working-*/` to get a list of all skill directories.
    *   Store the list of skill paths. The total count of these directories is the "Total Skills".

3.  **Analyze Each Skill's State:**
    *   Iterate through the list of skill paths gathered in the previous step.
    *   For each skill directory:
        *   **a. Read Evaluation Data:**
            *   **Tool:** `Read`
            *   **Action:** Read the contents of the `eval.json` file within the skill's directory. If the file doesn't exist or is empty, mark the skill as "Untested".
        *   **b. Determine Skill Status:**
            *   Parse the `eval.json` data.
            *   If `score` is `null` or the file was missing, status is **Untested**.
            *   If `score` has not increased in the last 3 evaluation entries in `history`, status is **Stuck**.
            *   If `score` is `>= 0.9`, status is **At Target**.
            *   Otherwise, the status is **Improving**.
        *   **c. Count Failures:**
            *   **Tool:** `Grep`
            *   **Action:** Execute `grep -c '"event_type": "failure"' path/to/skill/events.jsonl`.
            *   Store the skill name and its failure count.
        *   **d. Aggregate Data:** Add the skill's name, status, score, and failure count to your internal data structure.

4.  **Analyze System-Wide Goals:**
    *   **Tool:** `Read`
    *   **Action:** Read the contents of `~/.remote/@autoresearch/wants.json`.
    *   Parse the JSON and count the number of objects where the `status` field is "open" or "unmet". This is the "Unmet Demands" count.

5.  **Synthesize Report Data:**
    *   Calculate the total counts for each skill status (At Target, Stuck, Untested, Improving).
    *   Sort the skills by their failure count in descending order and select the top 3 for the "Top Failing Skills" list.
    *   Identify any skills whose status changed to "Stuck" within the last 24 hours by checking the timestamp of the relevant entry in `eval.json`. These are your "System Alerts".

6.  **Format the Output:**
    *   Check the `--format` parameter.
    *   **If `markdown` (default):**
        *   Assemble a human-readable Markdown string using the synthesized data. Use headings (`##`), bold text (`**`), and bullet points (`-`).
        *   The structure should be:
            *   `# System Status Report (YYYY-MM-DD HH:MM)`
            *   `## Skill Health Summary` (Total, At Target, Stuck, Untested)
            *   `## Goal Progress` (Unmet Demands)
            *   `## System Alerts` (List of newly stuck skills)
            *   `## Top 3 Skills by Failure Count` (List with skill names and failure counts)
    *   **If `json`:**
        *   Serialize the internal data structure you've been building into a well-formatted JSON string.

7.  **Deliver the Report:**
    *   **Tool:** `Write` or `Bash (echo)`
    *   **Action:** Print the formatted Markdown or JSON string to the console. If a file output is requested (e.g., `/status > report.md`), write the content to the specified file.

## Output Format
The primary output is a Markdown formatted report printed to standard output.

**Markdown Example:**
```markdown
# System Status Report (2023-10-27 14:30)

## Skill Health Summary
- **Total Skills:** 27
- **At Target:** 10
- **Stuck:** 1
- **Untested:** 15
- **Improving:** 1

## Goal Progress
- **Open Unmet Demands:** 9

## System Alerts
- **Newly Stuck Skill:** `code-refactorer` became stuck in the last 24 hours.

## Top 3 Skills by Failure Count
1. `code-refactorer` (42 failures)
2. `test-case-generator` (19 failures)
3. `documentation-writer` (8 failures)
```

**JSON Example (`--format=json`):**
```json
{
  "report_timestamp": "2023-10-27T14:30:00Z",
  "skill_health": {
    "total": 27,
    "at_target": 10,
    "stuck": 1,
    "untested": 15,
    "improving": 1
  },
  "goal_progress": {
    "unmet_demands": 9
  },
  "alerts": [
    {
      "type": "NEWLY_STUCK_SKILL",
      "skill_name": "code-refactorer",
      "details": "Skill status changed to 'stuck' in the last 24 hours."
    }
  ],
  "top_failing_skills": [
    { "name": "code-refactorer", "failures": 42 },
    { "name": "test-case-generator", "failures": 19 },
    { "name": "documentation-writer", "failures": 8 }
  ]
}
```

## Quality Gates
Before marking the task as complete, verify the following:
- [ ] The report correctly states the total number of skills found.
- [ ] The counts for "At Target", "Stuck", and "Untested" skills sum correctly.
- [ ] The report lists the top 3 skills with the most unresolved failures, correctly sourced from `events.jsonl`.
- [ ] The number of open unmet demands matches the count from `wants.json`.
- [ ] The report highlights any skills that have recently become 'stuck'.
- [ ] The output is formatted in clean, human-readable Markdown (or valid JSON if requested).
- [ ] The entire report generation process completed in under 10 seconds.

## Integration Points
- **Consumes data from:** The `autoresearch-runner`'s output files (`eval.json`, `events.jsonl`).
- **Can be triggered by:** A `scheduler-skill` for automated daily/hourly reports.
- **Output can be piped to:** A `notification-skill` to send alerts (e.g., via Slack or email) when critical thresholds are met (e.g., >3 stuck skills).

## Error Handling
- **Missing `skills/` directory:** If the main skills directory is not found, terminate and report that the core system structure is missing.
- **Missing `eval.json` or `events.jsonl`:** If a skill is missing a required file, mark it as "Untested" or "Data Missing" in the report and continue processing other skills. Log a warning to the console.
- **Corrupt JSON:** If a JSON file is malformed and cannot be parsed, report a data corruption error for that specific file/skill in a dedicated "Errors" section of the report and continue.
- **Permission Denied:** If unable to read a file due to permissions, report the specific file path and the permission error.

## Examples
**Example 1: Standard Daily Report**
*   **User Command:** `/status`
*   **Agent Action:** Executes the steps as defined above, gathering data on all skills and goals.
*   **Output:** A full Markdown report printed to the console, similar to the example in the "Output Format" section.

**Example 2: JSON Output for Programmatic Use**
*   **User Command:** `/status --format=json`
*   **Agent Action:** Follows all data gathering steps, but in Step 6, it formats the final data structure as a JSON object instead of Markdown.
*   **Output:** A valid JSON object printed to the console, suitable for parsing by other tools or scripts.

**Example 3: Focused Report on Failing Skills**
*   **User Command:** `/status --focus=failing`
*   **Agent Action:** Executes the standard steps but modifies the final report to provide more detail on skills that are "Stuck" or have a high failure count, potentially omitting sections on healthy or untested skills.
*   **Output:** A Markdown report with an expanded section on failing skills, perhaps including the last few error messages from their `events.jsonl`.