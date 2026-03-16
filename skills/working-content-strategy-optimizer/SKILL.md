# content-strategy-optimizer
Analyzes engagement data from the 'substack' MCP to propose new article topics, headlines, and publication schedules to maximize audience growth.

## Purpose
This skill addresses `want-016`. The system is connected to rich data streams like the 'substack' MCP, but these environments are merely observable, not actionable. This skill aims to bridge that gap by introducing an active, optimizable capability that perceives the content performance data and acts upon it to propose strategies for audience growth. It turns raw engagement metrics into a concrete, data-driven content plan, transforming the 'substack' domain from a passive data source into an active environment for optimization.

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

## Execution Steps

> ### ⚠️ TOOL-FIRST EXECUTION PROTOCOL
> **Each step below begins with a CALL directive. "CALL" means: invoke that tool RIGHT NOW before writing any other output. Do not write a sentence describing what you are about to do. Do not write "I will now...". The CALL directive IS your next action. Execute it. The pattern is: CALL → receive output → record findings → proceed to next CALL. Violation = writing any prose before executing the CALL directive.**

---

**STEP 1 — CALL `Read`(`~/.remote/@autoresearch/world-model.json`)**
→ From the output, extract the path to `engagement_report.json`. Record the path as `$DATA_PATH`.

**STEP 2 — CALL `Read`(`$DATA_PATH`)**
→ Load the full JSON array into working memory. If the file is not found, terminate with: "Substack engagement data not found. Please ensure the 'substack' MCP has run successfully." and stop.

**STEP 3 — CALL `Bash`(`mkdir -p ~/.remote/@autoresearch/skills/working-content-strategy-optimizer/`)**
→ Confirm the working directory exists before proceeding.

**STEP 4 — CALL `Bash`(`jq 'length' $DATA_PATH`)**
→ Record the article count as `$ARTICLE_COUNT`. If `$ARTICLE_COUNT < 10`, set a warning flag for the final report.

**STEP 5 — CALL `Bash`(`jq '[.[] | . + {dow: (.publish_timestamp | strftime("%A")), hour: (.publish_timestamp | strftime("%H"))}]' $DATA_PATH`)**
→ Record the enriched array with day-of-week and hour fields as `$ENRICHED_DATA`.

**STEP 6 — CALL `Bash`(`jq 'map(.shares) | max' $DATA_PATH` and `jq 'map(.comment_velocity) | max' $DATA_PATH`)**
→ Record `$MAX_SHARES` and `$MAX_VELOCITY`. These are normalization denominators for the engagement score formula.

**STEP 7 — CALL `Bash`** with this exact jq command to compute engagement scores and split into top/bottom quartiles:
```bash
jq --argjson ms $MAX_SHARES --argjson mv $MAX_VELOCITY '
  map(. + {engagement_score: ((.open_rate * 0.4) + ((.shares / $ms) * 0.3) + ((.comment_velocity / $mv) * 0.3))}) |
  sort_by(.engagement_score) |
  {
    top: .[(length * 0.75 | floor):],
    bottom: .[:( length * 0.25 | ceil)]
  }
' $DATA_PATH
```
→ Record `$TOP_PERFORMERS` (titles + scores) and `$BOTTOM_PERFORMERS` (titles + scores).

**STEP 8 — CALL `Grep`** on the titles of `$TOP_PERFORMERS` for patterns: `"How to|[0-9]+ |The Future|Why |What |Secret|Guide"` (case-insensitive)
→ Record all matching patterns as `$WINNING_PATTERNS`. Note counts per pattern.

**STEP 9 — CALL `Grep`** on the titles of `$BOTTOM_PERFORMERS` for the same patterns.
→ Record as `$LOSING_PATTERNS`. Note which formats/keywords to avoid.

**STEP 10 — CALL `Bash`** to compute average engagement score by day-of-week and hour:
```bash
jq '[group_by(.dow, .hour)[] | {slot: (.[0].dow + " " + .[0].hour + ":00"), avg_score: (map(.engagement_score) | add / length)}] | sort_by(-.avg_score)' <<< "$ENRICHED_DATA"
```
→ Record the top result as `$BEST_SLOT` (e.g., "Tuesday 09:00").

**STEP 11 — CALL `Grep`** on all `comments` arrays combined for audience signals: `"\?|how do|can you explain|I wish|what about|follow.up|next time|part 2"`
→ Record recurring questions and requests as `$AUDIENCE_SIGNALS`. Count occurrences per theme.

**STEP 12 — CALL `Bash`** to tally referrers:
```bash
jq '[.[].top_referrers[]] | group_by(.) | map({source: .[0], count: length}) | sort_by(-.count)' $DATA_PATH
```
→ Record the top 5 referrer sources as `$TOP_REFERRERS`.

**STEP 13 — CALL `Bash`** to generate topic proposals and headline variants. Construct a bash heredoc that combines `$WINNING_PATTERNS`, `$AUDIENCE_SIGNALS`, and top-performer themes to print 3–5 topic proposals with 3 headline variants each (question format, numbered list, strong statement). Print explicit data references for each (e.g., "open_rate avg for AI topics: 42%").
→ Record the output as `$PROPOSALS`.

**STEP 14 — CALL `Bash`(`date` commands)** to compute actual calendar dates for the next 14 days, assigning each proposal to `$BEST_SLOT`:
```bash
for i in 1 2 3 4 5; do
  date -v+${i}w -v+$(echo $BEST_SLOT | cut -d' ' -f1)=) "+Week $i: %A %B %d at $(echo $BEST_SLOT | cut -d' ' -f2)"
done
```
→ Record as `$CALENDAR`.

**STEP 15 — CALL `Write`(`~/.remote/@autoresearch/skills/working-content-strategy-optimizer/content_strategy_report.md`)** with the complete report assembled from all recorded variables above (see Output Format below).
→ Do not skip this write. The file must exist on disk.

**STEP 16 — CALL `Read`(`~/.remote/@autoresearch/skills/working-content-strategy-optimizer/content_strategy_report.md`)**
→ Confirm the file was written correctly. If the content is empty or truncated, rewrite it. Report is complete only after this confirmation.

---

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
[Pattern counts from Step 8]

### Audience Signals from Comments
[Question/request themes and occurrence counts from Step 11]

### Referrer Analysis
[Top 5 sources and counts from Step 12]

### Engagement by Time Slot (Top 5)
[Slot: avg_score table from Step 10]
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