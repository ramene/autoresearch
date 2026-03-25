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

> **⚠️ CRITICAL OUTPUT RULES — READ BEFORE EXECUTING ANY STEP:**
>
> **Rule 1 — NO EARLY OUTPUT:** DO NOT WRITE ANYTHING TO THE CONSOLE UNTIL STEP 4. Steps 1–3 are entirely internal. No acknowledgment messages, no "Processing…" text, no intermediate data, no progress updates. Running tools (Bash, Read, etc.) does NOT count as console output — tool results are only visible to you, not the user.
>
> **Rule 2 — NO CODE FENCES:** The final Markdown report MUST NOT be wrapped in code fences. Do NOT surround the output with ` ```markdown `, ` ``` `, or any other code block delimiters. The raw Markdown text is output directly, as-is.
>
> **Rule 3 — EXACT FIRST CHARACTER:** The ONLY console output for this entire skill is the formatted report produced in Step 4. For Markdown output, the very first character written to the console MUST be `#` (from `# System Status Report`). For JSON output, the very first character MUST be `{`. Any text, fence, or character appearing before that is a failure.
>
> **Rule 4 — ALWAYS GENERATE A REPORT:** Even if data collection in Steps 2–3 produces zero results, errors, or missing files, you MUST still generate and output the report in Step 4. Never abort, never output an error message instead of the report. Use zeroed counts and a note in the Alerts section if data is unavailable.

1.  **Initialize Internally (NO CONSOLE OUTPUT):**
    *   Internally note the trigger command and any parameters (e.g., `--format=json`, `--focus=failing`).
    *   Do NOT print anything to the console. Do NOT acknowledge the command. Do NOT say "Acknowledged" or "Initializing" or anything else. This step produces zero console output.

2.  **Collect ALL Data in a Single Bash Pass:**
    *   **Tool:** `Bash`
    *   **Action:** Run the following script to collect all skill data AND wants.json data in one fast execution. The output is only visible to you (the agent) as a tool result — it is NOT sent to the user console.
        ```bash
        SKILLS_DIR="$HOME/.remote/@autoresearch/skills"
        WANTS_FILE="$HOME/.remote/@autoresearch/wants.json"
        NOW=$(date +%s)

        # --- Collect skill data ---
        for skill_path in "$SKILLS_DIR"/working-*/; do
          [ -d "$skill_path" ] || continue
          skill_name=$(basename "$skill_path")

          # Read score + last 3 scores from eval.json, fall back to rounds.json
          score="null"
          s1="null"; s2="null"; s3="null"
          if [ -f "$skill_path/eval.json" ]; then
            score=$(jq -r '.score // "null"' "$skill_path/eval.json" 2>/dev/null)
            s1=$(jq -r '.history[-3].score // "null"' "$skill_path/eval.json" 2>/dev/null)
            s2=$(jq -r '.history[-2].score // "null"' "$skill_path/eval.json" 2>/dev/null)
            s3=$(jq -r '.history[-1].score // "null"' "$skill_path/eval.json" 2>/dev/null)
          fi
          if [ "$score" = "null" ] && [ -f "$skill_path/rounds.json" ]; then
            score=$(jq -r '.[-1].score // "null"' "$skill_path/rounds.json" 2>/dev/null)
            s1=$(jq -r '.[-3].score // "null"' "$skill_path/rounds.json" 2>/dev/null)
            s2=$(jq -r '.[-2].score // "null"' "$skill_path/rounds.json" 2>/dev/null)
            s3=$(jq -r '.[-1].score // "null"' "$skill_path/rounds.json" 2>/dev/null)
          fi

          # Determine stuck flag in bash (1=stuck, 0=not stuck)
          stuck=0
          if [ "$s1" != "null" ] && [ "$s2" != "null" ] && [ "$s3" != "null" ]; then
            improving=$(awk -v a="$s1" -v b="$s2" -v c="$s3" 'BEGIN { print (b > a || c > a) ? 1 : 0 }')
            [ "$improving" = "0" ] && stuck=1
          elif [ "$s2" != "null" ] && [ "$s3" != "null" ]; then
            improving=$(awk -v b="$s2" -v c="$s3" 'BEGIN { print (c > b) ? 1 : 0 }')
            [ "$improving" = "0" ] && stuck=1
          fi

          # Count failures from events.jsonl
          failures=0
          if [ -f "$skill_path/events.jsonl" ]; then
            failures=$(grep -c '"event_type": "failure"' "$skill_path/events.jsonl" 2>/dev/null || echo 0)
            alt=$(grep -c '"type": "failure"' "$skill_path/events.jsonl" 2>/dev/null || echo 0)
            failures=$((failures + alt))
          fi

          # Last modified time of score file
          last_mod=0
          if [ -f "$skill_path/eval.json" ]; then
            last_mod=$(stat -f %m "$skill_path/eval.json" 2>/dev/null || stat -c %Y "$skill_path/eval.json" 2>/dev/null || echo 0)
          elif [ -f "$skill_path/rounds.json" ]; then
            last_mod=$(stat -f %m "$skill_path/rounds.json" 2>/dev/null || stat -c %Y "$skill_path/rounds.json" 2>/dev/null || echo 0)
          fi

          echo "SKILL|${skill_name}|${score}|${stuck}|${failures}|${last_mod}"
        done

        # --- Collect wants.json data ---
        wants_count=0
        if [ -f "$WANTS_FILE" ]; then
          wants_count=$(jq '[.[] | select(.status == "open" or .status == "unmet")] | length' "$WANTS_FILE" 2>/dev/null || echo 0)
        fi
        echo "WANTS|${wants_count}"
        ```
    *   Parse each line from the tool result:
        *   Lines starting with `SKILL|` have 6 pipe-separated fields: `SKILL`, name, score, stuck (0 or 1), failures (integer), last_mod (unix timestamp). Build an internal list of skill records: `{name, score, stuck, failures, last_mod}`.
        *   The single line starting with `WANTS|` contains the count of open/unmet demands.
    *   If the script produces no `SKILL|` lines, treat the skill list as empty (Total Skills = 0) and add an alert in Step 4 about no skills being found.
    *   If the script produces no `WANTS|` line (script error), use 0 for unmet demands and note it in the Alerts section.

3.  **Determine Status for Each Skill:**
    *   For each skill record collected in Step 2, determine its status using these rules **in the exact order listed** (first matching rule wins):
        1.  If `score` is `null` or empty → **Untested**
        2.  If `stuck == 1` → **Stuck** *(a skill plateaued at any score, including ≥ 0.9, is Stuck, not At Target)*
        3.  If `score >= 0.9` → **At Target**
        4.  Otherwise → **Improving**
    *   **Note:** The `stuck` flag was already computed in bash (Step 2). You do NOT need to re-analyze history arrays. Just read the flag directly.
    *   For **Stuck** skills: check if `last_mod` is within the last 86400 seconds (24 hours) relative to the current time. If yes, flag this skill as "newly stuck" for System Alerts.

4.  **Synthesize and Deliver the Report:**
    *   Calculate the total counts for each skill status (At Target, Stuck, Untested, Improving). Verify these sum to Total Skills.
    *   Sort the skills by their `failures` count in descending order and select the top 3 for the "Top Failing Skills" list.
    *   Collect all "newly stuck" flagged skills (from Step 3) for the System Alerts section.
    *   Use the `WANTS|` count from Step 2 as the **Unmet Demands** count.
    *   Check the `--format` parameter.
    *   **If `markdown` (default):**
        *   Assemble a human-readable Markdown string using the synthesized data. Use headings (`##`), bold text (`**`), and bullet points (`-`).
        *   Output the raw Markdown text directly — do NOT wrap it in a code block (no ` ```markdown ` or ` ``` ` delimiters around the report). See Critical Output Rule 2 above.
        *   The structure must be:
            *   `# System Status Report (YYYY-MM-DD HH:MM)`
            *   `## Skill Health Summary` (Total, At Target, Stuck, Untested, Improving)
            *   `## Goal Progress` (Unmet Demands)
            *   `## System Alerts` (List of newly stuck/plateauing skills, or data-unavailable notes)
            *   `## Top 3 Skills by Failure Count` (List with skill names and failure counts)
    *   **If `json`:**
        *   Serialize the internal data structure into a well-formatted JSON string.
    *   Print ONLY the formatted Markdown or JSON string to the console — no other text, no raw data, no intermediate output, no preamble, no trailing commentary.
    *   The report must begin with EXACTLY `# System Status Report` (for markdown) or `{` (for JSON) as the very first character(s) output.
    *   **DO NOT wrap the output in code fences.** The `#` character (or `{`) must be the absolute first character written to the console.

## Output Format
The primary output is a Markdown formatted report printed to standard output.

**Markdown Example:**
```
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

**Markdown Example (no skills found):**
```
# System Status Report (2023-10-27 14:30)

## Skill Health Summary
- **Total Skills:** 0
- **At Target:** 0
- **Stuck:** 0
- **Untested:** 0
- **Improving:** 0

## Goal Progress
- **Open Unmet Demands:** 0

## System Alerts
- ⚠️ No skill directories matching `working-*/` were found in the skills directory.

## Top 3 Skills by Failure Count
- No skills found.
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
- [ ] The report highlights any skills that have recently become 'stuck' or 'plateauing' — **including skills that plateaued at a high score (≥ 0.9)**.
- [ ] The output is formatted in clean, human-readable Markdown (or valid JSON if requested) with NO raw data or intermediate output mixed in.
- [ ] The report begins with `# System Status Report` (markdown) or `{` (JSON) as the absolute first output — no preceding text, no code fences, no delimiters of any kind.
- [ ] The entire report generation process completed in under 10 seconds.
- [ ] A report was generated even if data collection returned zero results or errors.

## Integration Points
- **Consumes data from:** The `autoresearch-runner`'s output files (`eval.json`, `rounds.json`, `events.jsonl`).
- **Can be triggered by:** A `scheduler-skill` for automated daily/hourly reports.
- **Output can be piped to:** A `notification-skill` to send alerts (e.g., via Slack or email) when critical thresholds are met (e.g., >3 stuck skills).

## Error Handling
- **Missing `skills/` directory:** If the main skills directory is not found, still generate the report with zero counts and a System Alert noting the missing directory. Do NOT abort.
- **Zero skills found (glob returns nothing):** Treat as 0 total skills, generate the report with zero counts and a System Alert noting no `working-*/` directories were found.
- **Missing `eval.json` and `rounds.json`:** If a skill is missing both score files, mark it as "Untested" in the report and continue processing other skills.
- **Missing `events.jsonl`:** Treat failure count as 0 and continue.
- **Corrupt JSON:** If a JSON file is malformed and cannot be parsed, report a data corruption error for that specific file/skill in a dedicated "Errors" section of the report and continue.
- **Permission Denied:** If unable to read a file due to permissions, report the specific file path and the permission error in the Alerts section.

## Examples
**Example 1: Standard Daily Report**
*   **User Command:** `/status`
*   **Agent Action:** Executes the steps as defined above, gathering all data in one bash pass, then synthesizing the report.
*   **Output:** A full Markdown report printed to the console, similar to the example in the "Output Format" section.

**Example 2: JSON Output for Programmatic Use**
*   **User Command:** `/status --format=json`
*   **Agent Action:** Follows all data gathering steps, but in Step 4, it formats the final data structure as a JSON object instead of Markdown.
*   **Output:** A valid JSON object printed to the console, suitable for parsing by other tools or scripts.

**Example 3: Focused Report on Failing Skills**
*   **User Command:** `/status --focus=failing`
*   **Agent Action:** Executes the standard steps but modifies the final report to provide more detail on skills that are "Stuck" or have a high failure count, potentially omitting sections on healthy or untested skills.
*   **Output:** A Markdown report with an expanded section on failing skills, perhaps including the last few error messages from their `events.jsonl`.