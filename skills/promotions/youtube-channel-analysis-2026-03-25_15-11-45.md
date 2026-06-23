# Promotion Proposal: youtube-channel-analysis

## Scores
- **Baseline**: 25/36
- **Current**: 36/36
- **Improvement**: +11 points (100.0%)
- **Rounds**: 6

## Promotion Target
`/Users/ramene/Journal/.seed/base/skills/youtube-channel-analysis/SKILL.md`

## Key Mutations That Improved Score
1. Added Prerequisites & Fallback section clarifying how to proceed without Chrome DevTools MCP (use Bash+curl) and what to skip/note when YouTube Studio data is absent — addresses Instructions Clarity and Completeness failures in scenarios 2 and 4.
2. Expanded the Bash/curl fallback in Phase 1 with a more complete multi-step extraction pattern (channel stats + video list) and explicit failure handling, targeting residual Tool Usage clarity from S4's prior failures.
3. Added explicit "Minimum Report Requirements" section defining which report sections are always mandatory regardless of data availability, plus error handling fallback for Phase 6 Google Doc creation failure — targets Completeness failures in S3/S5/S6 and Instructions Clarity in S3/S5.
4. No failures to fix — all criteria score 0 failures. Adding a YouTube Search extraction step to the curl fallback sequence to improve completeness of the fallback path for candidate topic research (Phase 1, Step 3 was already present but lacked URL-encoding guidance).
5. No failures present — all criteria score 0 failures. Adding Google Trends URL-encoding guidance to the curl fallback Step 4 to improve robustness for multi-word topic queries.

## Unified Diff (baseline -> current)
```diff
--- /Users/ramene/.remote/@autoresearch/skills/working-youtube-channel-analysis/SKILL.md.baseline	2026-03-19 08:16:48.000000000 -0600
+++ /Users/ramene/.remote/@autoresearch/skills/working-youtube-channel-analysis/SKILL.md	2026-03-20 17:06:12.000000000 -0600
@@ -21,6 +21,85 @@
 
 The three-layer validation (market demand via Google Trends, competitive landscape via YouTube browsing, own-channel performance via Studio) produces high-conviction recommendations that any single source would miss.
 
+## Minimum Report Requirements
+
+**Regardless of which data sources are available, every completed run of this skill MUST produce:**
+
+1. **A saved markdown report file** at `active/youtube-strategy/reports/YYYY-MM-DD_report-slug.md` — even if sections are partially filled with `[Data not available]` annotations.
+2. **All 8 report sections** from Phase 5 must be present (The Big Picture, What's Working, Competitive Landscape, Search Pipeline, Trend Classification, Course Recommendations, Sequencing, Key Strategic Insights). Sections without data must include the annotation `[Data not available — {reason}]` rather than being omitted.
+3. **At least one scored course recommendation** in the Course Recommendations section, even if scores are reduced due to missing data. If no Studio data is available, reduce Search Demand scores by 1 point and note this.
+4. **A Trend Classification section** based on whatever Google Trends data was retrievable. If Google Trends was also unavailable, classify based on YouTube search result volumes alone and note the limitation.
+5. **A data availability summary** at the top of the report listing which sources were used and which were unavailable:
+   ```
+   **Data Sources Used:**
+   - YouTube browsing: ✅ / ❌ [reason if unavailable]
+   - Google Trends: ✅ / ❌ [reason if unavailable]
+   - YouTube Studio: ✅ / ❌ [reason if unavailable]
+   ```
+
+**Do not wait for missing data before producing the report.** A partial report with clear annotations is always the correct output. If you cannot complete a phase, note the limitation and continue to the next phase.
+
+## Prerequisites & Fallback Behavior
+
+**Before starting, check what tools and data are available:**
+
+### Tool availability
+- **Chrome DevTools MCP available:** Follow Phases 1-2 as written (browse YouTube and Google Trends directly).
+- **Chrome DevTools MCP NOT available (only Read, Grep, Glob, Bash):** Use `Bash` with `curl` to fetch page HTML from YouTube and Google Trends. Follow this extraction sequence:
+
+  **Step 1 — Fetch channel page and extract subscriber/video counts:**
+  ```bash
+  curl -s -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" \
+    "https://www.youtube.com/@{channel}/about" \
+    | grep -oP '"subscriberCountText":\{"simpleText":"[^"]*"' \
+    | head -5
+  ```
+
+  **Step 2 — Fetch video list (sorted by popular) and extract titles + view counts:**
+  ```bash
+  curl -s -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" \
+    "https://www.youtube.com/@{channel}/videos?view=0&sort=p" \
+    | grep -oP '"title":\{"runs":\[\{"text":"[^"]*"' \
+    | sed 's/"title":{"runs":\[{"text":"//;s/"//' \
+    | head -30
+  ```
+
+  **Step 3 — Fetch search results for a candidate topic:**
+  ```bash
+  QUERY=$(python3 -c "import urllib.parse; print(urllib.parse.quote('{topic}'))")
+  curl -s -A "Mozilla/5.0" \
+    "https://www.youtube.com/results?search_query=${QUERY}" \
+    | grep -oP '"title":\{"runs":\[\{"text":"[^"]*"' \
+    | head -20
+  ```
+
+  **Step 4 — Fetch Google Trends data for a topic (web search, 12-month):**
+  ```bash
+  # Always URL-encode the full topic string, including spaces and special characters.
+  # For multi-word topics like "Claude Code tutorial", encode each term separately:
+  TERM=$(python3 -c "import urllib.parse; print(urllib.parse.quote('claude code tutorial'))")
+  TERM2=$(python3 -c "import urllib.parse; print(urllib.parse.quote('cursor ai'))")
+  curl -s -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" \
+    "https://trends.google.com/trends/explore?date=today%2012-m&q=${TERM},${TERM2}&hl=en" \
+    | grep -oP '"value":\[\d+\]' \
+    | head -20
+  # For YouTube Search trends instead of Web Search, add &gprop=youtube to the URL.
+  # If the response contains no "value" fields, Google Trends may have returned a
+  # JavaScript-rendered page. Note the limitation and proceed with available data.
+  ```
+
+  **If curl-based extraction yields insufficient data** (e.g., YouTube returns a bot-challenge page or JavaScript-rendered content that grep can't parse), **note the limitation explicitly in the report** and proceed with whatever data is available. Do not stall — a partial report with clear data-gap annotations is better than no report.
+
+### Input availability
+| Input | Required? | If Missing |
+|-------|-----------|------------|
+| Channel URL | Yes | Ask user before proceeding |
+| Topic space | Yes | Infer from channel content if possible, otherwise ask |
+| Candidate topics | No | Generate during Phase 1 research |
+| YouTube Studio data | No | Skip Phase 3; note in report as "Studio data not provided — search gap analysis omitted" |
+
+**If YouTube Studio data is not provided:** Complete Phases 1, 2, 4, and 5 using only YouTube browsing + Google Trends data. Mark all Studio-dependent sections (search gap table, watch-time analysis) as `[Data not available — requires Studio export]`. Still produce a full scored report with the data you have; reduce Search Demand scores by 1 point to reflect missing Studio validation.
+
 ## Inputs
 
 1. **Channel to analyze** -- the target YouTube channel URL
@@ -45,7 +124,7 @@
 
 ### Phase 1: YouTube Browsing -- Channel & Competitor Data
 
-**Tool:** Chrome DevTools MCP (browse YouTube directly)
+**Tool:** Chrome DevTools MCP (preferred) or `Bash` with `curl` (fallback — see Prerequisites)
 
 **Steps:**
 
@@ -69,7 +148,7 @@
 
 4. **Record everything** in `active/youtube_raw_data.md`
 
-**JavaScript snippets for data extraction:**
+**JavaScript snippets for data extraction (Chrome DevTools MCP):**
 
 Channel stats:
 ```javascript
@@ -95,7 +174,7 @@
 
 ### Phase 2: Google Trends -- Trend Durability Analysis
 
-**Tool:** Chrome DevTools MCP (browse Google Trends)
+**Tool:** Chrome DevTools MCP (preferred) or `Bash` with `curl` (fallback — see Prerequisites)
 
 **Purpose:** Classify each topic as Platform Trend, Emerging Durable, Hype Bubble, or Declining/Dead.
 
@@ -149,6 +228,8 @@
 
 ### Phase 3: YouTube Studio Analytics -- Own-Channel Data
 
+**Skip this phase entirely if Studio data was not provided by the user. Mark affected report sections as `[Data not available — requires Studio export]` and continue to Phase 4.**
+
 **Tool:** User-provided data (screenshots, CSV exports, or pasted summaries)
 
 **What to request from the channel owner:**
@@ -192,13 +273,13 @@
 
 ### Phase 4: Synthesis & Scoring
 
-**Combine all three data sources into a 4-dimension scoring framework:**
+**Combine all available data sources into a 4-dimension scoring framework:**
 
 For each candidate course/topic:
 
 | Factor | Score | How to assess |
 |--------|-------|--------------|
-| **Search Demand** | 1-5 | Google Trends volume + trajectory + YouTube Search volume + Studio search capture |
+| **Search Demand** | 1-5 | Google Trends volume + trajectory + YouTube Search volume + Studio search capture (reduce by 1 if no Studio data) |
 | **Algorithmic Amplification** | 1-5 | Browse features performance, view/sub ratios across creators, evidence of algorithmic push |
 | **Fit** | 1-5 | Channel's existing audience, brand alignment, creator expertise |
 | **ROI** | 1-5 | Competitive gap (does a definitive course exist?), monetization potential, production effort vs expected return |
@@ -233,7 +314,7 @@
 
 **Table discipline:** Use tables sparingly — only where structured comparison is genuinely clearer than prose (gap analysis, scoring breakdowns). Massive raw-data tables belong in appendices or raw data files, not the strategy doc.
 
-Write the final report with these sections:
+Write the final report with these sections (all 8 are required — see Minimum Report Requirements):
 
 1. **The Big Picture** -- 2-3 sentences framing the channel's current competitive position and what to do with it. Set the strategic context.
 
@@ -241,7 +322,7 @@
 
 3. **Competitive Landscape** -- Place this EARLY (not buried at the end). Brief summary table (subs, growth/wk, threat level) then 1-2 paragraph deep-dives per significant competitor. Focus on: what they're doing, what the risk is, how to defend. Include view/sub ratios where relevant to show algorithmic push.
 
-4. **The Search Pipeline: Where the Gaps Are** -- Gap analysis table cross-referencing Google Trends demand vs Studio capture (Term | Trends Demand | Your Capture | Signal). This is the most actionable table in the report. Follow with narrative interpretation of the most important gaps and crossovers.
+4. **The Search Pipeline: Where the Gaps Are** -- Gap analysis table cross-referencing Google Trends demand vs Studio capture (Term | Trends Demand | Your Capture | Signal). If Studio data is unavailable, note this and show Trends demand only. Follow with narrative interpretation of the most important gaps and crossovers.
 
 5. **Trend Classification** -- Categorize topics into Platform Trends, Stable High-Volume, Spike-then-Settle, Declining, No Urgency. Brief prose per category — what it means for production decisions.
 
@@ -266,6 +347,8 @@
 python3 .claude/skills/youtube-channel-analysis/md_to_gdoc.py "report.md" --update DOC_ID
 ```
 
+**If Phase 6 fails** (script not found, `gws` CLI unavailable, authentication error, or any other error): Do not retry or stall. Note the failure in your final response to the user (e.g., "Google Doc creation failed: {error}. The markdown report was saved at {path} and can be manually imported.") and consider the skill run complete. The markdown report is the primary deliverable; the Google Doc is a convenience artifact.
+
 ## Edge Cases & Lessons Learned
 
 - **Subscriber counts from LLMs are unreliable.** Always verify by browsing the channel directly. Reports have been wrong by 2-5x.
@@ -275,6 +358,8 @@
 - **YouTube Search != Web Search on Google Trends.** Some terms are huge on web but tiny on YouTube (e.g., voice AI agent: 2 on web, 69 on YouTube). Always check both.
 - **Watch-time > views for algorithmic value.** A 6-hour course with 60K views can generate more watch-time than a viral short with 164K views. YouTube's algorithm rewards the course.
 - **The "24 views" pattern:** When Google Trends shows high demand for a term but your Studio shows near-zero capture, you've found an untapped search pipeline. This is the highest-signal gap in the entire analysis.
+- **curl extraction may return bot-challenge pages.** YouTube increasingly serves JavaScript-only pages to non-browser clients. If curl output contains `<noscript>` or `"UNPLAYABLE"` patterns, flag it in the report and rely on whatever data was retrievable rather than retrying indefinitely.
+- **Multi-word Google Trends queries via curl require URL encoding.** Always use `python3 -c "import urllib.parse; print(urllib.parse.quote('{topic}'))"` for each term before interpolating into the Trends URL. Spaces or special characters in raw query strings will cause malformed requests that return no data.
 
 ## Files
 
@@ -285,4 +370,4 @@
 
 ## Versioning
 
-Reports are dated (`YYYY-MM-DD_slug.md`), not versioned (v1, v2). Each analysis round produces a new dated report. Previous reports stay for historical comparison.
+Reports are dated (`YYYY-MM-DD_slug.md`), not versioned (v1, v2). Each analysis round produces a new dated report. Previous reports stay for historical comparison.
\ No newline at end of file

```

## Generated
- **Timestamp**: 2026-03-25T15:11:45.394Z
- **Source**: `/Users/ramene/.remote/@autoresearch/skills/working-youtube-channel-analysis/SKILL.md`
- **Baseline**: `/Users/ramene/.remote/@autoresearch/skills/working-youtube-channel-analysis/SKILL.md.baseline`
