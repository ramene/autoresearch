---
name: youtube-outliers
description: Find viral YouTube videos in your niche for competitive intelligence. Use when user asks to find YouTube outliers, monitor competitors, or track viral videos.
allowed-tools: Bash, Read, Write, Edit, Glob, Grep
---

> **Demo Library Skill** — This skill is from a demo library. Some configuration values use placeholders (e.g. `{{USER_NAME}}`, `{{COMMUNITY_ID}}`). If something doesn't work, check for placeholder values and replace them with your own information first.

# YouTube Outlier Detection

## Goal
Find high-performing videos in your niche for competitive intelligence and content inspiration.

## Scripts
- `./scripts/scrape_youtube_outliers.py` - Scrape and score outliers
- `./scripts/update_transcripts.py` - Fetch transcripts for existing outliers

## Prerequisites & Error Handling

Before running, verify the environment is ready:

```bash
# Check required environment variables are set
echo "APIFY_API_TOKEN: ${APIFY_API_TOKEN:+set}${APIFY_API_TOKEN:-MISSING}"
echo "ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:+set}${ANTHROPIC_API_KEY:-MISSING}"

# Check script exists
ls -la ./scripts/scrape_youtube_outliers.py
ls -la ./scripts/update_transcripts.py
```

**Common errors and fixes:**

| Error | Cause | Fix |
|-------|-------|-----|
| `APIFY_API_TOKEN not set` | Missing env var | Export token: `export APIFY_API_TOKEN=your_token` |
| `ANTHROPIC_API_KEY not set` | Missing env var | Export key: `export ANTHROPIC_API_KEY=your_key` |
| `ModuleNotFoundError` | Missing Python deps | Run `pip install -r requirements.txt` |
| `Script not found` | Wrong working directory | Run from project root, not `./scripts/` |
| `No videos found` | Keywords too narrow or quota exceeded | Try broader keywords or check Apify quota |
| `Google Sheet error` | Sheet not configured | Check GOOGLE_SHEET_ID env var or sheet permissions |

If a script fails, always check:
1. Are both API tokens set and valid?
2. Is the working directory the project root?
3. Are Python dependencies installed?

## Usage

### Scrape New Outliers

```bash
# Default run
python3 ./scripts/scrape_youtube_outliers.py

# Custom parameters
python3 ./scripts/scrape_youtube_outliers.py \
  --keywords "AI automation,AI agents" \
  --days 30 \
  --min_score 1.5 \
  --limit 50
```

**Parameter notes:**
- `--min_score`: Minimum outlier score (views ÷ channel average). `1.5` means the video got 1.5× the channel's typical views — a good baseline. Use `2.0`+ for stricter filtering.
- `--days`: Lookback window in days. `30` is recommended for most niches — go lower (e.g. `7`) for fast-moving topics, higher (e.g. `90`) for evergreen or slower niches.

### Update Transcripts for Existing Outliers

Use this when outliers are already in your sheet but transcripts are missing or incomplete:

```bash
# Fetch transcripts for all existing outliers without one
python3 ./scripts/update_transcripts.py

# Limit how many to process in one run
python3 ./scripts/update_transcripts.py --limit 20
```

**When to use `update_transcripts.py`:**
- After scraping, if some transcripts failed to fetch
- To backfill transcripts for older entries
- When re-running after a previous transcript fetch error

## How It Works
1. Searches YouTube for keywords
2. Calculates outlier score (views / channel average)
3. Applies recency boost
4. Fetches transcripts
5. Generates Claude summaries
6. Saves to Google Sheet

## Verify Results

After running, confirm the script completed successfully:

```bash
# The script prints a summary on completion — look for output like:
# "Saved N outliers to Google Sheet"
# "Sheet URL: https://docs.google.com/spreadsheets/d/..."
```

**How to access results:**
1. Open the Google Sheet URL printed at the end of the run (or open the sheet directly using `GOOGLE_SHEET_ID`)
2. Results appear in the first tab — sorted by Outlier Score descending by default
3. If the sheet URL wasn't printed, check `GOOGLE_SHEET_ID` is set and the service account has editor access to the sheet

**What a successful run looks like:**
- Script exits with code `0`
- Prints count of videos saved (e.g. `Saved 12 outliers`)
- New rows appear in the Google Sheet with Outlier Score, Views, Title, and Summary filled in

If rows appear but Summary or Transcript columns are empty, run `update_transcripts.py` to backfill them.

## Output
Google Sheet with:
- Outlier Score, Views, Duration
- Title, Video Link, Channel
- Thumbnail, Summary, Transcript
- Publish Date

## vs Cross-Niche Outliers
- **youtube_outliers**: Your core niche (daily monitoring)
- **cross-niche-outliers**: Adjacent niches (weekly inspiration)

## Environment
```
APIFY_API_TOKEN=your_token
ANTHROPIC_API_KEY=your_key
```