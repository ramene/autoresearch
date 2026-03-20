# content-strategy-optimizer

**`Read` `~/.remote/@autoresearch/world-model.json` — do this now, zero words first.**

---

## Execution Steps

**STEP 1 — `Read`(`~/.remote/@autoresearch/world-model.json`)**
↩ Extract the path to `engagement_report.json`. Record as `$DATA_PATH`. → Step 2.

---

**STEP 2 — `Read`(`$DATA_PATH`)**
↩ Load the full JSON array into working memory. If not found, terminate: "Substack engagement data not found. Please ensure the 'substack' MCP has run successfully." → Step 3.

---

**STEP 3 — `Bash`(`mkdir -p ~/.remote/@autoresearch/skills/working-content-strategy-optimizer/`)**
↩ Confirm directory exists. → Step 4.

---

**STEP 4 — `Bash`** — Enrich and score the data, save to `scored_data.json`:

```bash
#!/usr/bin/env bash
set -euo pipefail
WORLD_MODEL="$HOME/.remote/@autoresearch/world-model.json"
DATA_PATH=$(jq -r '.data_paths.engagement_report // .engagement_report // .substack.engagement_report // empty' "$WORLD_MODEL" 2>/dev/null | head -1)
if [[ -z "$DATA_PATH" ]]; then
  # fallback: search common keys
  DATA_PATH=$(jq -r '.. | strings | select(test("engagement_report\\.json$"))' "$WORLD_MODEL" 2>/dev/null | head -1)
fi
if [[ -z "$DATA_PATH" || ! -f "$DATA_PATH" ]]; then
  echo "ERROR: engagement_report.json path not found in world-model.json" >&2
  exit 1
fi
WORK_DIR="$HOME/.remote/@autoresearch/skills/working-content-strategy-optimizer"
SCORED_DATA_PATH="$WORK_DIR/scored_data.json"

# --- Enrich with day-of-week and hour ---
ENRICHED=$(jq '[.[] | . + {
  dow: (.publish_timestamp | strftime("%A")),
  hour: (.publish_timestamp | strftime("%H") | tonumber)
}]' "$DATA_PATH")

MAX_SHARES=$(echo "$ENRICHED" | jq 'map(.shares) | max')
MAX_VELOCITY=$(echo "$ENRICHED" | jq 'map(.comment_velocity) | max')

# --- Compute engagement scores and save sorted array to file ---
echo "$ENRICHED" | jq --argjson ms "$MAX_SHARES" --argjson mv "$MAX_VELOCITY" '
  map(. + {
    engagement_score: (
      (.open_rate * 0.4) +
      ((.shares / $ms) * 0.3) +
      ((.comment_velocity / $mv) * 0.3)
    )
  }) | sort_by(.engagement_score)
' > "$SCORED_DATA_PATH"

echo "Enriched and scored $(jq length "$SCORED_DATA_PATH") articles → $SCORED_DATA_PATH"
```
↩ Confirm `scored_data.json` was created and contains a non-empty array. → Step 5.

---

**STEP 5 — `Bash`** — Extract top/bottom performers and best publication slot, save to `analysis_state.json`:

```bash
#!/usr/bin/env bash
set -euo pipefail
WORK_DIR="$HOME/.remote/@autoresearch/skills/working-content-strategy-optimizer"
SCORED_DATA_PATH="$WORK_DIR/scored_data.json"
ANALYSIS_STATE_PATH="$WORK_DIR/analysis_state.json"

jq -n --slurpfile data "$SCORED_DATA_PATH" '
  ($data[0]) as $d |
  {
    article_count: ($d | length),
    top_performers: [$d[($d | length * 0.75 | floor):][] | {title, engagement_score}],
    bottom_performers: [$d[0:($d | length * 0.25 | ceil)][] | {title, engagement_score}],
    top_quartile_avg: ([$d[($d | length * 0.75 | floor):][] | .engagement_score] | add / length),
    bottom_quartile_avg: ([$d[0:($d | length * 0.25 | ceil)][] | .engagement_score] | add / length),
    best_slot: (
      [$d | group_by(.dow + (.hour | tostring))[] |
        {
          slot: (.[0].dow + " " + (.[0].hour | tostring) + ":00"),
          avg_score: (map(.engagement_score) | add / length)
        }
      ] | sort_by(-.avg_score) | .[0]
    )
  }
' > "$ANALYSIS_STATE_PATH"

echo "Key insights saved → $ANALYSIS_STATE_PATH"
cat "$ANALYSIS_STATE_PATH"
```
↩ Confirm `analysis_state.json` contains `article_count`, `top_performers`, `bottom_performers`, `best_slot`, and quartile averages. → Step 6.

---

**STEP 6 — `Bash`** — Extract winning/losing title patterns and audience signals, save to `patterns.json`:

```bash
#!/usr/bin/env bash
set -euo pipefail
WORLD_MODEL="$HOME/.remote/@autoresearch/world-model.json"
DATA_PATH=$(jq -r '.data_paths.engagement_report // .engagement_report // .substack.engagement_report // empty' "$WORLD_MODEL" 2>/dev/null | head -1)
if [[ -z "$DATA_PATH" ]]; then
  DATA_PATH=$(jq -r '.. | strings | select(test("engagement_report\\.json$"))' "$WORLD_MODEL" 2>/dev/null | head -1)
fi
if [[ -z "$DATA_PATH" || ! -f "$DATA_PATH" ]]; then
  echo "ERROR: engagement_report.json path not found in world-model.json" >&2
  exit 1
fi
WORK_DIR="$HOME/.remote/@autoresearch/skills/working-content-strategy-optimizer"
ANALYSIS_STATE_PATH="$WORK_DIR/analysis_state.json"
PATTERNS_PATH="$WORK_DIR/patterns.json"
PATTERN="How to|[0-9]+ |The Future|Why |What |Secret|Guide"

TOP_TITLES=$(jq -r '.top_performers[].title' "$ANALYSIS_STATE_PATH")
BOTTOM_TITLES=$(jq -r '.bottom_performers[].title' "$ANALYSIS_STATE_PATH")

WINNING=$(echo "$TOP_TITLES" | grep -oiE "$PATTERN" | sort | uniq -c | sort -rn | \
  awk '{print "{\"pattern\":\"" $2 "\",\"count\":" $1 "}"}' | jq -s '.' || echo '[]')
LOSING=$(echo "$BOTTOM_TITLES" | grep -oiE "$PATTERN" | sort | uniq -c | sort -rn | \
  awk '{print "{\"pattern\":\"" $2 "\",\"count\":" $1 "}"}' | jq -s '.' || echo '[]')

AUDIENCE_SIGNALS=$(jq -r '[.[].comments[]] | .[]' "$DATA_PATH" 2>/dev/null | \
  grep -oiE "\?|how do|can you explain|I wish|what about|follow.up|next time|part 2" | \
  sort | uniq -c | sort -rn | \
  awk '{print "{\"signal\":\"" $2 "\",\"count\":" $1 "}"}' | jq -s '.' || echo '[]')

TOP_REFERRERS=$(jq '[.[].top_referrers[]] | group_by(.) | map({source: .[0], count: length}) | sort_by(-.count) | .[:5]' "$DATA_PATH")

jq -n \
  --argjson winning "$WINNING" \
  --argjson losing "$LOSING" \
  --argjson signals "$AUDIENCE_SIGNALS" \
  --argjson referrers "$TOP_REFERRERS" \
  '{winning_patterns: $winning, losing_patterns: $losing, audience_signals: $signals, top_referrers: $referrers}' \
  > "$PATTERNS_PATH"

echo "Patterns and signals saved → $PATTERNS_PATH"
cat "$PATTERNS_PATH"
```
↩ Confirm `patterns.json` contains `winning_patterns`, `losing_patterns`, `audience_signals`, and `top_referrers`. → Step 7.

---

**STEP 7 — `Bash`** — Generate topic proposals and two-week calendar, save to `proposals.json`:

```bash
#!/usr/bin/env bash
set -euo pipefail
WORK_DIR="$HOME/.remote/@autoresearch/skills/working-content-strategy-optimizer"
STATE="$WORK_DIR/analysis_state.json"
PATTERNS="$WORK_DIR/patterns.json"
PROPOSALS_PATH="$WORK_DIR/proposals.json"

BEST_SLOT=$(jq -r '.best_slot.slot' "$STATE")
BEST_SLOT_SCORE=$(jq '.best_slot.avg_score' "$STATE")
TOP_TITLES=$(jq -r '.top_performers[].title' "$STATE" | head -3)
REFERRERS=$(jq -r '.top_referrers[].source' "$PATTERNS" | head -3 | tr '\n' ', ')

# Build calendar entries with real dates
CALENDAR=$(for i in 1 2 3; do
  date -v+${i}w "+Week $i: %A %B %d — Publish Topic $i"
done)

jq -n \
  --arg best_slot "$BEST_SLOT" \
  --argjson best_score "$BEST_SLOT_SCORE" \
  --arg top_titles "$TOP_TITLES" \
  --arg referrers "$REFERRERS" \
  --arg calendar "$CALENDAR" \
  '{
    best_slot: $best_slot,
    best_slot_avg_score: $best_score,
    proposals: [
      {
        id: 1,
        theme: "Top-performer theme",
        rationale: ("Data: top titles=" + $top_titles + "; referrers=" + $referrers),
        headlines: {
          A: "How to [topic from top performer]",
          B: "[N] Ways to [topic from top performer]",
          C: "Why [topic from top performer] Matters Now"
        }
      },
      {
        id: 2,
        theme: "Audience-signal driven",
        rationale: "Derived from comment signal analysis: question patterns, follow-up requests",
        headlines: {
          A: "Can You [topic]?",
          B: "[N] Answers to [topic]",
          C: "The [topic] Guide You Have Been Waiting For"
        }
      },
      {
        id: 3,
        theme: "Follow-up to top performer",
        rationale: "Follow-up/part-2 signals detected in comments; expands on proven topic",
        headlines: {
          A: "What Comes After [topic]?",
          B: "[N] Next Steps for [topic]",
          C: "The Future of [topic]"
        }
      }
    ],
    two_week_calendar: $calendar
  }' > "$PROPOSALS_PATH"

echo "Proposals saved → $PROPOSALS_PATH"
cat "$PROPOSALS_PATH"
```
↩ Confirm `proposals.json` contains `proposals` (3 items with headlines A/B/C), `best_slot`, and `two_week_calendar`. → Step 8.

---

**STEP 8 — `Read`(`~/.remote/@autoresearch/skills/working-content-strategy-optimizer/analysis_state.json`)**
↩ Load final metrics: `article_count`, `top_performers`, `bottom_performers`, `best_slot`, quartile averages. → Step 9.

---

**STEP 9 — `Read`(`~/.remote/@autoresearch/skills/working-content-strategy-optimizer/patterns.json`)**
↩ Load `winning_patterns`, `losing_patterns`, `audience_signals`, `top_referrers`. → Step 10.

---

**STEP 10 — `Read`(`~/.remote/@autoresearch/skills/working-content-strategy-optimizer/proposals.json`)**
↩ Load all 3 proposals, headlines, best slot score, and calendar. → Step 11.

---

**STEP 11 — `Write`(`~/.remote/@autoresearch/skills/working-content-strategy-optimizer/content_strategy_report.md`)** — Assemble the complete report from all loaded values (see Output Format below). Substitute every `[$VARIABLE]` placeholder with the actual numeric value read from the JSON files — no placeholder text in the final report.
↩ File must exist on disk before proceeding. → Step 12.

---

**STEP 12 — `Read`(`~/.remote/@autoresearch/skills/working-content-strategy-optimizer/content_strategy_report.md`)**
↩ Confirm file was written correctly with real numeric values (not placeholders). If empty or truncated, rewrite. Report is complete only after this confirmation.

---

## Purpose
This skill addresses `want-016`. The system is connected to rich data streams like the 'substack' MCP, but these environments are merely observable, not actionable. This skill bridges that gap by introducing an active, optimizable capability that perceives content performance data and acts upon it to propose strategies for audience growth. It turns raw engagement metrics into a concrete, data-driven content plan, transforming the 'substack' domain from a passive data source into an active environment for optimization.

## Trigger Conditions
This skill can be activated in the following ways:

1.  **Slash Command:**
    *   `/optimize-content-strategy`: Triggers a full analysis and generates a complete content strategy report.
    *   `/optimize-content-strategy --period=<last-week|last-month>`: Scopes the analysis to a specific time frame.
    *   `/optimize-content-strategy --propose-topics`: Focuses only on generating new article topics.
    *   `/optimize-content-strategy --optimize-headline="<draft headline>"`: Focuses only on generating alternative headlines for a given draft.

2.  **Automatic Detection (Keywords):** The skill should be recommended when user prompts include phrases like:
    *   "analyze substack performance"
    *   "what should I write about next"
    *   "propose new article ideas"
    *   "improve my open rates"
    *   "create a content calendar"
    *   "review last month's posts"

3.  **Scheduled Trigger:** This skill can be configured to run automatically on a schedule (e.g., the first day of each month) to proactively generate a content strategy for the upcoming period.

## Prerequisites
1.  **MCP Connection:** The `substack` Managed Component (MCP) must be configured and active.
2.  **Data Availability:** There must be a recent data file from the `substack` MCP. The skill should look for this data at a path specified in `world-model.json`, typically `~/.remote/@autoresearch/mcp/substack/data/engagement_report.json`.
3.  **Data Schema:** The `engagement_report.json` file must be an array of objects, where each object represents an article and contains at least the following keys:
    *   `article_id` (string)
    *   `title` (string)
    *   `publish_timestamp` (integer, Unix timestamp)
    *   `open_rate` (float, 0.0 to 1.0)
    *   `shares` (integer)
    *   `comments_count` (integer)
    *   `comment_velocity` (float, comments per hour in the first 24 hours)
    *   `top_referrers` (array of strings)
    *   `comments` (array of strings, the text of each comment)

## Output Format
The primary output is a markdown file located at `working-content-strategy-optimizer/content_strategy_report.md`.

**`content_strategy_report.md` structure:**

```markdown
# Content Strategy Report: [Date Range]

## 1. Executive Summary
A brief overview of the key findings and top recommendations.

## 2. Key Performance Insights
- **Articles Analyzed:** [$ARTICLE_COUNT] (⚠️ small dataset warning if <10)
- **Top Themes:** [List of successful themes with avg engagement scores]
- **Underperforming Themes:** [List of themes to avoid with avg engagement scores]
- **Optimal Publication Time:** [$BEST_SLOT — avg engagement score: X.XX]
- **Top Traffic Sources:** [$TOP_REFERRERS]

## 3. Proposed Content Plan
### Topic 1: [Proposed Title]
- **Rationale:** [Data signal references: open_rate avg X%, shares Y, comment signals: "Z"]
- **Headline A/B Test:**
    - A: [Question format]
    - B: [Numbered list format]
    - C: [Strong statement format]

### Topic 2: [Proposed Title]
...

## 4. Recommended Two-Week Content Calendar
- **[$CALENDAR entry 1]:** Publish "Topic 1 Title"
- **[$CALENDAR entry 2]:** Publish "Topic 2 Title"
...

## 5. Appendix: Data-Driven Rationale
### Engagement Score Distribution
[Top quartile avg score: X.XX | Bottom quartile avg score: X.XX]

### Winning Title Patterns (from top 25%)
[Pattern counts from Step 6 analysis]

### Audience Signals from Comments
[Question/request themes and occurrence counts from Step 6 analysis]

### Referrer Analysis
[Top 5 sources and counts from Step 6 analysis]

### Engagement by Time Slot (Top 5)
[Slot: avg_score table from Step 5 analysis]
```

## Quality Gates
Before completion, the skill's output must be validated against the following criteria:

1.  **[✔/✖] Aligns with Successful Themes:** The proposed topics are logically derived from the themes identified in the top-performing articles.
2.  **[✔/✖] A/B Testable Headlines:** Each proposed topic includes at least two distinct headline variations for testing.
3.  **[✔/✖] Leverages Multiple Signals:** The rationale explicitly references at least three different data signals from the MCP (e.g., open rates, shares, comment velocity, comment content).
4.  **[✔/✖] Includes Data-Driven Rationale:** The report contains a clear section explaining *why* each recommendation is being made, linking it back to specific data points.
5.  **[✔/✖] Avoids Underperforming Topics:** The proposed topics do not overlap with themes identified from the set of underperforming articles.
6.  **[✔/✖] Generates a Two-Week Calendar:** The output includes a concrete publication schedule for the next 14 days with actual dates.
7.  **[✔/✖] Numeric Measurements Present:** The report includes concrete numeric values (engagement scores, percentages, counts) from the actual data — not placeholder text.

## Integration Points
-   **Upstream:** Depends on the `substack` MCP to provide fresh `engagement_report.json` data.
-   **Downstream:**
    -   The `content_strategy_report.md` can serve as a prompt for a `content-creation` skill to begin drafting the proposed articles.
    -   The recommended schedule can be fed into a `task-scheduler` or `calendar-management` skill to create reminders or automate publishing.
-   **Feedback Loop:** This skill forms a core part of an autoresearch feedback loop. After its recommendations are implemented, a future run can analyze the performance of the new content to refine its own model of what works.

## Error Handling
-   **No Data File:** If `engagement_report.json` is not found at the expected path, the skill should terminate with an error message: "Substack engagement data not found. Please ensure the 'substack' MCP has run successfully."
-   **Insufficient Data:** If the data file contains fewer than 10 articles, the skill should proceed but include a prominent warning in the report: "WARNING: Analysis is based on a small data set (<10 articles). Recommendations may not be statistically significant."
-   **Data Parsing Error:** If the JSON is malformed, the skill should terminate and log the specific parsing error, indicating a potential issue with the `substack` MCP output.

## Examples
### Example 1: Full Monthly Strategy Review
*   **Command:** `/optimize-content-strategy --period=last-month`
*   **Action:** The skill ingests all Substack data from the last month. It performs a full analysis of top/bottom performers, themes, and temporal patterns.
*   **Output:** A comprehensive `content_strategy_report.md` with 3-5 new article ideas, multiple headlines for each, and a two-week calendar optimized for engagement.

### Example 2: Suggesting Follow-up to a Successful Post
*   **Command:** `/optimize-content-strategy --propose-topics --seed_article_id=12345`
*   **Action:** The skill focuses its analysis on article `12345` and other posts with similar themes. It heavily weighs the comments and referrers for that specific article to identify follow-up questions and audience interest.
*   **Output:** A focused report with 2-3 topic ideas that are direct sequels or deeper dives related to the successful seed article, complete with data-driven rationale.

### Example 3: Quick Headline Brainstorm
*   **Command:** `/optimize-content-strategy --optimize-headline="A Look at New AI Models"`
*   **Action:** The skill analyzes the titles of the top 10% of all-time posts to identify patterns (e.g., use of numbers, questions, specific keywords). It then applies these patterns to the user-provided draft headline.
*   **Output:** A short markdown response listing 3-5 alternative headlines.
    ```markdown
    Based on top-performing posts, here are some alternative headlines:

    1.  **Listicle:** 5 New AI Models That Will Change Everything
    2.  **Question:** Is This New AI Model the Most Powerful Yet?
    3.  **Direct Benefit:** How to Use New AI Models to 10x Your Productivity
    ```