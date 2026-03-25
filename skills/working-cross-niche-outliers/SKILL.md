---
name: cross-niche-outliers
description: Find viral YouTube videos from adjacent business niches to extract content patterns and hooks. Use when user asks to find content inspiration, YouTube outliers, viral video patterns, or cross-niche content ideas.
allowed-tools: Bash, Read, Write, Edit, Glob, Grep
---

> **Demo Library Skill** — This skill is from a demo library. Some configuration values use placeholders (e.g. `{{USER_NAME}}`, `{{COMMUNITY_ID}}`). If something doesn't work, check for placeholder values and replace them with your own information first.

# Cross-Niche Outlier Detection

## Goal
Identify high-performing videos from adjacent business niches to extract transferable content patterns, hooks, and structures. These outliers provide inspiration for content ideation without being directly competitive.

## Agent Execution Guide

When this skill is invoked, follow these steps in order:

**0. Gather user context** *(respond in plain text)*
Before running anything, check whether the user has specified:
- Their niche or business topic (e.g. "SaaS", "e-commerce", "coaching")
- Any custom search terms they want to use

If neither is provided, ask: *"What's your niche or topic? I'll use this to find the most relevant cross-niche outliers. (Or just say 'default' to use general entrepreneur keywords.)"*

If the user says "default" or has already provided context, proceed to step 1.

**1. Check prerequisites** *(use: Bash)*
```bash
echo $TUBELAB_API_KEY && echo $ANTHROPIC_API_KEY
ls ./scripts/scrape_cross_niche_tubelab.py 2>/dev/null && echo "Script found" || echo "Script missing"
```
- If env vars are empty → tell the user which keys are missing. Instruct them to set them:
  ```bash
  export TUBELAB_API_KEY=your_tubelab_key_here
  export ANTHROPIC_API_KEY=your_anthropic_key_here
  ```
  Then stop and wait for the user to re-invoke.
- If the script is missing → skip to Manual Fallback (step 4) below.

**2. Run the scraper** *(use: Bash)*

Use the user's niche/terms from Step 0 when building the command:
- If the user provided a niche or search terms, pass them with `--terms`:
  ```bash
  python3 ./scripts/scrape_cross_niche_tubelab.py --terms "<user's niche or search terms>"
  ```
- If the user said "default" or provided no specific terms, run without `--terms`:
  ```bash
  python3 ./scripts/scrape_cross_niche_tubelab.py
  ```

Watch for exit codes and output:
- Success → proceed to step 3
- Auth error / 401 → tell user to fix `TUBELAB_API_KEY`, then stop
- Credit error / 402 → fall back to yt-dlp (step 2b)
- Any other error → report the error message verbatim and proceed to step 4

**2b. yt-dlp fallback (only if TubeLab credits exhausted)** *(use: Bash)*

Apply the same `--terms` logic from step 2 if the yt-dlp script supports it; otherwise run:
```bash
python3 ./scripts/scrape_cross_niche_outliers.py
```
If this also fails → proceed directly to Manual Fallback (step 4).

**3. Report results to user** *(use: Read to inspect output CSV if needed, then respond in plain text)*
After a successful run, summarize:
- How many outliers were found
- The Google Sheet link (printed by the script)
- Top 3 outliers by Cross-Niche Score with their titles and scores
- Score interpretation: 1.6+ = Exceptional, 1.3–1.6 = Strong (high priority), 1.1–1.3 = Worth reviewing, below 1.1 = Skip
- Recommended next action (e.g. "Pick the top outlier and run recreate-thumbnails")

**4. Manual Fallback (when all scripts fail)** *(use: Write to save results as a markdown table)*
If no scripts are available or all automated methods fail:
1. Tell the user that automated methods failed and you are switching to manual analysis.
2. Ask the user to search YouTube for the keyword terms listed in **Reference Manual → Keyword Tiers** (or use the niche/terms provided in Step 0 as the primary search terms).
3. Apply the cross-niche scoring criteria from **Reference Manual → Cross-Niche Scoring** to filter candidates.
4. Use **Write** to save results to `./output/manual_outliers.md` as a table with columns: Title, Channel, Views, Hook (first line), Adaptation Idea.
5. Report the file path and top 3 entries inline to the user.

---

## Reference Manual

*This section is human-facing documentation. Refer to it for detailed criteria, configuration options, and background information.*

### Quick Start (End-to-End)

Follow these steps in order for a complete run:

**Step 1 — Verify environment**
```bash
echo $TUBELAB_API_KEY      # Must be non-empty
echo $ANTHROPIC_API_KEY    # Must be non-empty
```
If either is missing, set them now:
```bash
export TUBELAB_API_KEY=your_tubelab_key_here
export ANTHROPIC_API_KEY=your_anthropic_key_here
export APIFY_API_TOKEN=your_apify_token_here   # optional, for transcript fallback
```

**Step 2 — Run the scraper**
```bash
python3 ./scripts/scrape_cross_niche_tubelab.py
```
This fetches ~100 outliers from the last 30 days using the default search terms. Costs 5 TubeLab credits.

**Step 3 — Wait for completion**
The script will print progress as it fetches videos, scores them, and generates transcripts. Expect 2–5 minutes depending on transcript availability.

**Step 4 — Review results**
Open the Google Sheet created at the end (link printed in terminal). Sort by **Cross-Niche Score** (column A) descending. Use this table to prioritize:

| Score Range | Priority |
|-------------|----------|
| 1.6+ | Exceptional — act immediately |
| 1.3–1.6 | Strong outlier — high priority |
| 1.1–1.3 | Worth reviewing |
| Below 1.1 | Skip |

Focus on scores above 1.3. Within those, prioritize rows with money hooks ($, revenue, income) or curiosity gaps (?) — these transfer best across niches.

**Step 5 — Pick an outlier and adapt**
- Read the Claude summary (column K) for hook structure and adaptation notes
- Use Title Variants 1–3 (columns L–N) as starting points for your own title
- Recreate the thumbnail style using the `recreate-thumbnails` skill

**Step 6 — Generate more title variants (optional)**
```bash
python3 ./scripts/generate_title_variants.py
```

If anything fails at any step, see the Troubleshooting section below.

---

### Two Approaches

#### 1. TubeLab API (RECOMMENDED)
```bash
# Default: 1 query = 5 credits, ~100 outliers from last 30 days
python3 ./scripts/scrape_cross_niche_tubelab.py

# Custom search term
python3 ./scripts/scrape_cross_niche_tubelab.py --terms "business strategy"

# Skip transcripts (faster, cheaper)
python3 ./scripts/scrape_cross_niche_tubelab.py --skip_transcripts
```

**Pros:** Pre-calculated scores, no rate limiting, fast
**Cons:** 5 credits per query

#### 2. yt-dlp Scraping (LEGACY)
```bash
python3 ./scripts/scrape_cross_niche_outliers.py
```
**Use only if TubeLab credits are exhausted.** Often fails due to rate limiting.

### Scripts
- `./scripts/scrape_cross_niche_tubelab.py` - TubeLab API (recommended)
- `./scripts/scrape_cross_niche_outliers.py` - yt-dlp direct scraping
- `./scripts/generate_title_variants.py` - Generate title variants for outliers

---

### Troubleshooting & Error Handling

#### Common Failures and Fixes

**TubeLab script exits with auth error / 401**
→ `TUBELAB_API_KEY` is missing or invalid. Verify the key at your TubeLab dashboard and re-export it.

**TubeLab script exits with credit error / 402**
→ Credits exhausted. Fall back to yt-dlp: `python3 ./scripts/scrape_cross_niche_outliers.py`

**yt-dlp returns 0 results or HTTP 429 (rate limited)**
→ Wait 10–15 minutes and retry with fewer keywords, or reduce `--queries` to 1.

**Transcript fetch fails for some videos**
→ Normal — not all videos have transcripts. The script skips them. Add `--skip_transcripts` to bypass entirely.

**Google Sheet not created / permission error**
→ Ensure Google Sheets API credentials are configured. As a fallback, results are also saved locally as CSV in `./output/`.

**Script not found**
→ Run from the project root directory where `./scripts/` exists. Confirm with: `ls ./scripts/`

#### Fallback Priority Order
1. TubeLab API (default)
2. yt-dlp scraping (if TubeLab credits gone)
3. **Manual YouTube search** (if all automated methods fail — see Manual Fallback below)

---

### Manual Fallback: Finding Outliers Without Scripts

Use this when Python is unavailable, scripts are missing, or all APIs are exhausted.

**Step 1 — Search YouTube manually**
Go to YouTube and search each of these terms, filtered to "This month":
- "AI for business", "scale your business", "increase revenue", "passive income systems"
- Sort results by "View count" (click Filters → Sort by → View count)

**Step 2 — Identify outlier candidates**
For each result in the top 10, check the channel's other recent videos:
- Click the channel name → Videos tab → sort by "Date"
- If the video you found has **3–5× more views** than typical recent videos on that channel, it's an outlier

**Step 3 — Apply the cross-niche filter**
Mentally score each candidate (skip if it fails):
- ❌ Reject: title contains technical terms (API, Python, SDK, code)
- ✅ Bonus: title has money hooks ($, revenue, income, profit)
- ✅ Bonus: title has curiosity gap (?, "this changed everything", "secret")
- ✅ Bonus: title has a number (listicle)

**Step 4 — Extract the hook**
Watch the first 30 seconds of each qualifying video. Note:
- The opening line (this is the hook)
- The promise made in the first 30 seconds
- How the thumbnail reinforces the title

**Step 5 — Record your findings**
Create a simple table (paste into a doc or sheet):

| Title | Channel | Views | Hook (first line) | Adaptation idea |
|-------|---------|-------|-------------------|-----------------|
| ...   | ...     | ...   | ...               | ...             |

Target 5–10 rows. Prioritize videos with money hooks or curiosity gaps — these transfer most reliably to other niches.

---

### Process

#### 1. Video Discovery
- Search keywords (50 videos per keyword)
- Monitor business channels (15 videos per channel)
- Deduplicate and filter noise

#### 2. Outlier Scoring
- Base score: video views / channel average views
- Recency boost: <1 day = 2x, <3 days = 1.5x, <7 days = 1.2x
- Threshold: 1.1x or higher (10% above average)

#### 3. Cross-Niche Scoring
Modifiers applied to base score:
- -20% per technical term (API, Python, code, SDK)
- +30% for money hooks ($, revenue, income, profit)
- +20% for time hooks (faster, productivity)
- +20% for curiosity gaps (?, "this changed everything")
- +10% for listicles (numbers in title)

#### 4. Transcript & Summary
- Fetches transcript (youtube-transcript-api, Apify fallback)
- Claude summarizes: hook, structure, how to adapt
- Raw transcript saved for deeper analysis

#### 5. Title Variant Generation
For each outlier, generates 3 title variants adapted to your niche.

#### 6. Output to Google Sheet (19 columns)
Cross-Niche Score, Outlier Score, Days Old, Category, Title, Video Link, Views, Duration, Channel, Thumbnail, Summary, Title Variants 1-3, Raw Transcript, Publish Date, Source

---

### TubeLab Options
| Flag | Description | Default |
|------|-------------|---------|
| `--queries N` | Number of searches (5 credits each) | 1 |
| `--terms "a" "b"` | Custom search terms | entrepreneur |
| `--min_views N` | Minimum views | 10,000 |
| `--max_days N` | Max video age | 30 |
| `--skip_transcripts` | Skip transcripts | False |

---

### Keyword Tiers

**Tier 1: Adjacent Business/Tech**
- "AI for business", "ChatGPT business use cases", "no-code automation"

**Tier 2: Broad Business**
- "scale your business", "solopreneur success", "founder productivity"

**Tier 3: Money/Revenue Hooks**
- "increase revenue", "passive income systems", "10x your income"

### Monitored Channels
Alex Hormozi, My First Million, Starter Story, Colin and Samir, Ali Abdaal, Think Media, Iman Gadzhi, Pat Flynn, GaryVee, MrBeast, Justin Welsh, Charlie Morgan

---

### Output
- Google Sheet: "Cross-Niche Outliers v2 - [timestamp]"
- ~100 outliers with 19 columns
- Sorted by publish date (most recent first)
- 3 title variants + raw transcript per outlier

---

### Environment

Set these before running. Add to your shell profile (`~/.zshrc` or `~/.bashrc`) to persist across sessions:

```bash
export TUBELAB_API_KEY=your_tubelab_key_here        # Required — get from tubelab.io dashboard
export ANTHROPIC_API_KEY=your_anthropic_key_here    # Required — get from console.anthropic.com
export APIFY_API_TOKEN=your_apify_token_here        # Optional — fallback for transcript fetching
```

To verify they are set:
```bash
echo $TUBELAB_API_KEY && echo $ANTHROPIC_API_KEY
```

### Workflow
1. Run weekly for ~100 outliers
2. Review by Cross-Niche Score (target 1.3+)
3. Pick outlier with good thumbnail/title
4. Use title variants as starting points
5. Recreate thumbnail with your face (see recreate-thumbnails skill)