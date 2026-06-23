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
    *   `eval.json` OR `rounds.json`: Contains evaluation scores and status. `eval.json` is preferred if it contains a top-level `.score` field; `rounds.json` (with `.score` and optional `.max` fields per round) is used as a fallback.
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
        set +e
        SKILLS_DIR="$HOME/.remote/@autoresearch/skills"
        WANTS_FILE="$HOME/.remote/@autoresearch/wants.json"
        NOW=$(date +%s)

        # --- Collect skill data as JSON Lines ---
        for skill_path in "$SKILLS_DIR"/*/; do
          [ -d "$skill_path" ] || continue
          # Only process directories that contain skill score files
          [ -f "$skill_path/eval.json" ] || [ -f "$skill_path/rounds.json" ] || continue
          skill_name=$(basename "$skill_path")

          # Read score from eval.json (only if it has a top-level .score field),
          # fall back to rounds.json and normalize raw/max to a 0-1 float.
          score="null"
          s1="null"; s2="null"; s3="null"
          if [ -f "$skill_path/eval.json" ]; then
            score=$(jq -r '.score // "null"' "$skill_path/eval.json" 2>/dev/null)
            if [ "$score" != "null" ]; then
              s1=$(jq -r '.history[-3].score // "null"' "$skill_path/eval.json" 2>/dev/null)
              s2=$(jq -r '.history[-2].score // "null"' "$skill_path/eval.json" 2>/dev/null)
              s3=$(jq -r '.history[-1].score // "null"' "$skill_path/eval.json" 2>/dev/null)
            fi
          fi

          # If eval.json provided a score but no history (s1/s2/s3 still null),
          # fall back to rounds.json for the history progression data.
          if [ "$score" != "null" ] && [ "$s1" = "null" ] && [ "$s2" = "null" ] && [ -f "$skill_path/rounds.json" ]; then
            s1=$(jq -r '.[-3].score // "null"' "$skill_path/rounds.json" 2>/dev/null)
            s2=$(jq -r '.[-2].score // "null"' "$skill_path/rounds.json" 2>/dev/null)
            s3=$(jq -r '.[-1].score // "null"' "$skill_path/rounds.json" 2>/dev/null)
          fi

          if [ "$score" = "null" ] && [ -f "$skill_path/rounds.json" ]; then
            raw_score=$(jq -r '.[-1].score // "null"' "$skill_path/rounds.json" 2>/dev/null)
            max_score=$(jq -r '.[-1].max // "null"' "$skill_path/rounds.json" 2>/dev/null)
            if [ "$raw_score" != "null" ] && [ "$max_score" != "null" ] && [ "$max_score" != "0" ]; then
              # Has both score and max — normalize to 0-1 float
              score=$(awk -v r="$raw_score" -v m="$max_score" 'BEGIN { printf "%.4f", r/m }')
            elif [ "$raw_score" != "null" ]; then
              # No .max field (or max is null/zero) — treat score as already normalized (0–1 float).
              # This handles rounds.json files that store pre-normalized scores without a .max field.
              score="$raw_score"
            fi
            # History scores from rounds.json (raw values — used only for relative comparison)
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
          # IMPORTANT: Use `grep ... | wc -l` instead of `grep -c ... || echo 0`.
          # `grep -c` exits with code 1 when there are zero matches (while still outputting "0"),
          # causing `|| echo 0` to append a second "0", producing "0\n0" which breaks arithmetic.
          failures=0
          if [ -f "$skill_path/events.jsonl" ]; then
            f1=$(grep '"event_type": "failure"' "$skill_path/events.jsonl" 2>/dev/null | wc -l | tr -d ' ')
            f2=$(grep '"type": "failure"' "$skill_path/events.jsonl" 2>/dev/null | wc -l | tr -d ' ')
            failures=$((f1 + f2))
          fi

          # Last modified time of score file
          last_mod=0
          if [ -f "$skill_path/eval.json" ]; then
            last_mod=$(stat -f %m "$skill_path/eval.json" 2>/dev/null || stat -c %Y "$skill_path/eval.json" 2>/dev/null || echo 0)
          elif [ -f "$skill_path/rounds.json" ]; then
            last_mod=$(stat -f %m "$skill_path/rounds.json" 2>/dev/null || stat -c %Y "$skill_path/rounds.json" 2>/dev/null || echo 0)
          fi

          # Emit one JSON object per skill (avoids delimiter-collision in pipe-separated formats)
          score_json=$([ "$score" = "null" ] && echo "null" || echo "$score")
          # Escape skill_name for JSON safety
          safe_name=$(printf '%s' "$skill_name" | sed 's/\\/\\\\/g; s/"/\\"/g')
          printf '{"record":"skill","name":"%s","score":%s,"stuck":%d,"failures":%d,"last_mod":%d}\n' \
            "$safe_name" "$score_json" "$stuck" "$failures" "$last_mod"
        done

        # --- Emit current timestamp for stuck-age calculation ---
        printf '{"record":"now","ts":%d}\n' "$NOW"

        # --- Collect wants.json data ---
        wants_count=0
        if [ -f "$WANTS_FILE" ]; then
          wants_count=$(jq '[.[] | select(.status == "open" or .status == "unmet")] | length' "$WANTS_FILE" 2>/dev/null || echo 0)
        fi
        printf '{"record":"wants","count":%d}\n' "$wants_count"
        ```
    *   Parse each line of the tool result as a JSON object:
        *   Lines where `"record"` is `"skill"` contain fields: `name` (string), `score` (number or null), `stuck` (0 or 1), `failures` (integer), `last_mod` (unix timestamp). Build an internal list of skill records.
        *   The single line where `"record"` is `"now"` contains `ts` — the current Unix timestamp (use this for stuck-age calculation in Step 3).
        *   The single line where `"record"` is `"wants"` contains `count` — the number of open/unmet demands.
    *   If no skill records appear, treat the skill list as empty (Total Skills = 0) and add an alert in Step 4 about no skills being found.
    *   If no wants record appears (script error), use 0 for unmet demands and note it in the Alerts section.

3.  **Determine Status for Each Skill:**
    *   For each skill record collected in Step 2, determine its status using these rules **in the exact order listed** (first matching rule wins):
        1.  If `score` is `null` or absent → **Untested**
        2.  If `stuck == 1` → **Stuck** *(a skill plateaued at any score, including ≥ 0.9, is Stuck, not At Target)*
        3.  If `score >= 0.9` → **At Target**
        4.  Otherwise → **Improving**
    *   **Note:** The `stuck` flag was already computed in bash (Step 2). You do NOT need to re-analyze history arrays. Just read the flag directly from the JSON record.
    *   **Note:** The `score` from `rounds.json` is already normalized to a 0–1 float by the bash script (either via raw/max division, or directly if no .max field was present). Do not treat it as a raw integer.
    *   For **Stuck** skills: check if `last_mod` is within the last 86400 seconds (24 hours) relative to the `ts` value from the `"now"` record. If yes, flag this skill as "newly stuck" for System Alerts.

4.  **Synthesize and Deliver the Report:**
    *   Calculate the total counts for each skill status (At Target, Stuck, Untested, Improving). Verify these sum to Total Skills.
    *   Sort the skills by their `failures` count in descending order and select the top 3 for the "Top Failing Skills" list.
    *   Collect all "newly stuck" flagged skills (from Step 3) for the System Alerts section.
    *   Use the `count` from the wants record (Step 2) as the **Unmet Demands** count.
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
- ⚠️ No skill directories containing score files were found in the skills directory.

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
- **Zero skills found (glob returns nothing or no dirs contain score files):** Treat as 0 total skills, generate the report with zero counts and a System Alert noting no skill directories were found.
- **Missing `eval.json` and `rounds.json`:** If a skill directory is missing both score files, it is skipped during discovery (not counted at all). This is handled by the guard in Step 2.
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
*   **Agent Action:** Executes the standard steps unchanged. In Step 4, expands the "Top 3 Skills by Failure Count" section to show all Stuck and high-failure skills with additional detail (e.g., last event from `events.jsonl`). All standard report sections — Skill Health Summary, Goal Progress, System Alerts, and Top Failing Skills — MUST still be present and fully populated. Do NOT omit any section.
*   **Output:** A Markdown report with the same structure as the standard report, with an expanded failing-skills section appended after the standard Top 3 list.