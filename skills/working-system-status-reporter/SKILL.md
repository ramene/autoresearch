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
    *   `eval.json` OR `rounds.json`: Contains evaluation scores and status. `eval.json` is preferred; `rounds.json` is used as a fallback.
    *   `events.jsonl`: A log of significant events, including failures.
3.  A root-level `wants.json` file tracking unmet demands and capability gaps.

## Execution Steps

> **⚠️ CRITICAL OUTPUT RULE: DO NOT WRITE ANYTHING TO THE CONSOLE UNTIL STEP 7.**
> Steps 1–6 are entirely internal. No acknowledgment messages, no "Processing…" text, no bash script output, no intermediate data, no progress updates. The ONLY console output for this entire skill is the formatted report produced in Step 7. Any text appearing before `# System Status Report` (markdown) or `{` (JSON) is a failure.

1.  **Initialize Internally (NO CONSOLE OUTPUT):**
    *   Internally note the trigger command and any parameters (e.g., `--format=json`, `--focus=failing`).
    *   Do NOT print anything to the console. Do NOT acknowledge the command. Do NOT say "Acknowledged" or "Initializing" or anything else. This step produces zero console output.

2.  **Collect All Skill Data in One Pass:**
    *   **Tool:** `Bash`
    *   **IMPORTANT:** The bash script below must be executed with all output captured into an internal variable — do NOT let any part of this script print to the console. Use `output=$(...)` to capture it entirely.
    *   **Action:** Run the following single script to gather all skill names, their latest eval scores, and failure counts at once:
        ```bash
        SKILLS_DIR=~/.remote/@autoresearch/skills
        for skill_dir in "$SKILLS_DIR"/working-*/; do
          skill_name=$(basename "$skill_dir")
          eval_file="$skill_dir/eval.json"
          rounds_file="$skill_dir/rounds.json"
          events_file="$skill_dir/events.jsonl"

          # Get score — prefer eval.json, fall back to rounds.json
          score="null"
          history=""
          if [ -f "$eval_file" ]; then
            score=$(python3 -c "import json; d=json.load(open('$eval_file')); print(d.get('score','null'))" 2>/dev/null || echo "null")
            history=$(python3 -c "import json; d=json.load(open('$eval_file')); h=d.get('history',[]); scores=[e.get('score') for e in h[-3:]]; print(','.join(str(s) for s in scores))" 2>/dev/null || echo "")
          elif [ -f "$rounds_file" ]; then
            score=$(python3 -c "
import json
rounds = json.load(open('$rounds_file'))
if isinstance(rounds, list) and rounds:
    last = rounds[-1]
    s = last.get('score', last.get('eval_score', last.get('total_score', 'null')))
    print(s if s is not None else 'null')
elif isinstance(rounds, dict):
    s = rounds.get('score', rounds.get('eval_score', 'null'))
    print(s if s is not None else 'null')
else:
    print('null')
" 2>/dev/null || echo "null")
            history=$(python3 -c "
import json
rounds = json.load(open('$rounds_file'))
if isinstance(rounds, list):
    scores = [str(r.get('score', r.get('eval_score', ''))) for r in rounds[-3:] if r.get('score') is not None or r.get('eval_score') is not None]
    print(','.join(scores))
else:
    print('')
" 2>/dev/null || echo "")
          fi

          # Count failures from events.jsonl
          if [ -f "$events_file" ]; then
            failures=$(grep -c '"event_type": "failure"' "$events_file" 2>/dev/null || echo 0)
          else
            failures=0
          fi

          echo "SKILL|$skill_name|$score|$history|$failures"
        done
        ```
    *   Store the full output internally for processing in subsequent steps. Each line is pipe-delimited: `SKILL|<name>|<score>|<last3scores>|<failure_count>`.
    *   The total number of lines is the **Total Skills** count.

3.  **Classify Each Skill's Status from the Collected Data:**
    *   For each line from Step 2, parse the fields and determine status:
        *   If `score` is `null` or neither eval file was found → **Untested**
        *   If `score` is `>= 0.9` → **At Target**
        *   If the last 3 history scores all show no increase (i.e., score has not improved) → **Stuck**
        *   Otherwise → **Improving**
    *   Record each skill's: name, status, score, failure count.

4.  **Analyze System-Wide Goals:**
    *   **Tool:** `Read`
    *   **Action:** Read the contents of `~/.remote/@autoresearch/wants.json`.
    *   Parse the JSON and count the number of objects where the `status` field is `"open"` or `"unmet"`. This is the **Unmet Demands** count.

5.  **Synthesize Report Data:**
    *   Calculate the total counts for each skill status (At Target, Stuck, Untested, Improving). Verify these sum to Total Skills.
    *   Sort the skills by their failure count in descending order and select the top 3 for the "Top Failing Skills" list.
    *   Identify any skills whose status is "Stuck" and whose eval.json or rounds.json was last modified within the last 24 hours. These are your "System Alerts".

6.  **Format the Output:**
    *   Check the `--format` parameter.
    *   **If `markdown` (default):**
        *   Assemble a human-readable Markdown string using the synthesized data. Use headings (`##`), bold text (`**`), and bullet points (`-`).
        *   The structure should be:
            *   `# System Status Report (YYYY-MM-DD HH:MM)`
            *   `## Skill Health Summary` (Total, At Target, Stuck, Untested, Improving)
            *   `## Goal Progress` (Unmet Demands)
            *   `## System Alerts` (List of newly stuck skills)
            *   `## Top 3 Skills by Failure Count` (List with skill names and failure counts)
    *   **If `json`:**
        *   Serialize the internal data structure into a well-formatted JSON string.

7.  **Deliver the Report:**
    *   Print ONLY the formatted Markdown or JSON string to the console — no other text, no raw data, no intermediate output, no preamble, no trailing commentary.
    *   The report must begin with EXACTLY `# System Status Report` (for markdown) or `{` (for JSON) as the very first character(s) output.
    *   If a file output is requested (e.g., `/status > report.md`), write the content to the specified file.

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
- [ ] The counts for "At Target", "Stuck", "Untested", and "Improving" skills sum to Total Skills.
- [ ] The report lists the top 3 skills with the most unresolved failures, correctly sourced from `events.jsonl`.
- [ ] The number of open unmet demands matches the count from `wants.json`.
- [ ] The report highlights any skills that have recently become 'stuck'.
- [ ] The output is formatted in clean, human-readable Markdown (or valid JSON if requested) with NO raw data or intermediate output mixed in.
- [ ] The report begins with `# System Status Report` (markdown) or `{` (JSON) as the absolute first output — no preceding text of any kind.
- [ ] The entire report generation process completed in under 10 seconds.

## Integration Points
- **Consumes data from:** The `autoresearch-runner`'s output files (`eval.json`, `rounds.json`, `events.jsonl`).
- **Can be triggered by:** A `scheduler-skill` for automated daily/hourly reports.
- **Output can be piped to:** A `notification-skill` to send alerts (e.g., via Slack or email) when critical thresholds are met (e.g., >3 stuck skills).

## Error Handling
- **Missing `skills/` directory:** If the main skills directory is not found, terminate and report that the core system structure is missing.
- **Missing `eval.json` and `rounds.json`:** If a skill is missing both score files, mark it as "Untested" in the report and continue processing other skills. Log a warning to the console.
- **Missing `events.jsonl`:** Treat failure count as 0 and continue.
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