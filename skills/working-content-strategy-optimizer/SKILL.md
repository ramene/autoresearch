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
1.  **Initialization:**
    *   Create a working directory: `~/.remote/@autoresearch/skills/working-content-strategy-optimizer/`.
    *   Identify the path to the Substack engagement data file by reading the `world-model.json`. `[tool: Read, Grep]`
    *   Read the `engagement_report.json` file into memory. `[tool: Read]`

2.  **Data Triage & Pre-processing:**
    *   Verify the data meets the prerequisites. If there are fewer than 10 articles, the analysis may be statistically insignificant. Note this in the final report.
    *   For each article, parse the `publish_timestamp` to extract the day of the week and the hour of the day.

3.  **Performance Analysis:**
    *   **Identify Top Performers:** Calculate a composite `engagement_score` for each article (e.g., `(open_rate * 0.4) + (shares_normalized * 0.3) + (comment_velocity_normalized * 0.3)`). Identify the top 25% of articles by this score. `[tool: Bash, jq]`
    *   **Identify Underperformers:** Identify the bottom 25% of articles by the same score.
    *   **Extract Themes:** Analyze the titles of the top-performing articles to identify recurring themes, keywords, and formats (e.g., "How to...", "The Future of...", listicles). `[tool: Grep]` Do the same for underperforming articles to identify topics to avoid.

4.  **Audience Signal Analysis:**
    *   **Temporal Analysis:** Group articles by publication day of the week and hour. Calculate the average `engagement_score` for each slot to find the optimal publication time.
    *   **Comment Analysis:** Read through the `comments` array for all articles. Use `Grep` to find common questions, points of confusion, or feature requests. These are strong signals for new article topics. `[tool: Grep]`
    *   **Referral Analysis:** Analyze the `top_referrers` to understand where the audience is coming from (e.g., Twitter, specific newsletters, search). This can inform keyword strategy.

5.  **Content Proposal Generation:**
    *   **Topic Ideas:** Based on the successful themes (Step 3) and audience questions (Step 4), generate 3-5 new article topics.
    *   **Headline Variations:** For each topic, write 3 distinct, A/B testable headlines. Use patterns from top-performing titles (e.g., a question, a strong statement, a numbered list).
    *   **Rationale:** For each recommendation, write a brief, data-driven rationale. Example: "Topic 'Advanced AI Prompting' is recommended because articles on 'AI' have a 30% higher open rate, and 15 comments specifically asked for more advanced techniques."

6.  **Scheduling Proposal:**
    *   Based on the temporal analysis (Step 4), recommend the optimal day and time for publication (e.g., "Tuesdays at 9:00 AM ET").
    *   Generate a sample two-week content calendar, assigning the proposed topics to the optimal publication slots.

7.  **Output Synthesis:**
    *   Compile all findings into a single, well-structured markdown file named `content_strategy_report.md`.
    *   The report should have clear headings: "Executive Summary", "Top Performing Content Themes", "Proposed Article Topics & Headlines", "Recommended Publication Schedule", and "Detailed Data Rationale".
    *   Write the final report to the working directory. `[tool: Write]`

## Output Format
The primary output is a markdown file located at `working-content-strategy-optimizer/content_strategy_report.md`.

**`content_strategy_report.md` structure:**

```markdown
# Content Strategy Report: [Date Range]

## 1. Executive Summary
A brief overview of the key findings and top recommendations.

## 2. Key Performance Insights
- **Top Themes:** [List of successful themes, e.g., AI tutorials, Market Analysis]
- **Underperforming Themes:** [List of themes to avoid, e.g., Personal Anecdotes]
- **Optimal Publication Time:** [e.g., Tuesdays at 9:00 AM ET, based on highest average open rates and shares]

## 3. Proposed Content Plan
### Topic 1: [Proposed Title]
- **Rationale:** [Data-driven reason for this topic]
- **Headline A/B Test:**
    - A: [Headline Variation 1]
    - B: [Headline Variation 2]
    - C: [Headline Variation 3]

### Topic 2: [Proposed Title]
...

## 4. Recommended Two-Week Content Calendar
- **Week 1, [Day], [Time]:** Publish "Topic 1 Title"
- **Week 2, [Day], [Time]:** Publish "Topic 2 Title"

## 5. Appendix: Data-Driven Rationale
Detailed breakdown of the data signals used, such as open rates by topic, comment analysis summary, and engagement by time of day charts (as text).
```

## Quality Gates
Before completion, the skill's output must be validated against the following criteria:

1.  **[✔/✖] Aligns with Successful Themes:** The proposed topics are logically derived from the themes identified in the top-performing articles.
2.  **[✔/✖] A/B Testable Headlines:** Each proposed topic includes at least two distinct headline variations for testing.
3.  **[✔/✖] Leverages Multiple Signals:** The rationale explicitly references at least three different data signals from the MCP (e.g., open rates, shares, comment velocity, comment content).
4.  **[✔/✖] Includes Data-Driven Rationale:** The report contains a clear section explaining *why* each recommendation is being made, linking it back to specific data points.
5.  **[✔/✖] Avoids Underperforming Topics:** The proposed topics do not overlap with themes identified from the set of underperforming articles.
6.  **[✔/✖] Generates a Two-Week Calendar:** The output includes a concrete publication schedule for the next 14 days.

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