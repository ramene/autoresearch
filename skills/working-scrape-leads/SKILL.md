---
name: scrape-leads
description: Scrape leads via Apify with iterative filter refinement, verify quality, classify with LLM, and upload to Google Sheets. Use for bulk lead generation with test-before-scale approach.
allowed-tools: Read, Grep, Glob, Bash
---

> **Demo Library Skill** — This skill is from a demo library. Some configuration values use placeholders (e.g. `{{USER_NAME}}`, `{{COMMUNITY_ID}}`). If something doesn't work, check for placeholder values and replace them with your own information first.

# Lead Scraping & Verification

## Goal
Scrape leads using Apify (`code_crafter/leads-finder`), iteratively refine search filters for quality, and save results to a Google Sheet. Uses a test-before-scale approach: validate filter quality on 25 leads before committing to a full scrape.

## Inputs
- **Industry / Target Profile**: The target industry or ideal customer description (e.g., "Plumbers", "B2B SaaS companies selling to enterprises, $5M+ revenue")
- **Location**: The target location (e.g., `"new york, us"`, `"united states"`). **Format**: US states use `"texas, us"` format; countries use lowercase full names (e.g., `"united states"`). Must match Apify's allowed values exactly.
- **Total Count**: The total number of leads desired (default: 5,000)
- **Quality Threshold**: Minimum acceptable match rate (default: 80%)

## Critical Command Parameters

| Parameter | Requirement | Example |
|---|---|---|
| `location` | Must use exact Apify format. US states require `, us`. | `"texas, us"`, `"united states"` |
| `--query` | Use this flag for the search keywords. | `"<validated_keywords>"` |
| `--output_prefix` | Path for output files. A space is required after the flag. | `active/leads_final.json` |
| `--no-email-filter` | **Required on all `scrape_apify.py` and `scrape_apify_parallel.py` commands.** | N/A |

## Tools/Scripts
- Script: `.claude/skills/scrape-leads/scrape_apify.py` (single scrape, for <1000 leads)
- Script: `.claude/skills/scrape-leads/scrape_apify_parallel.py` (parallel scraping, for 1000+ leads)
- Script: `.claude/skills/scrape-leads/classify_leads_llm.py` (AI-based lead classification)
- Script: `.claude/skills/scrape-leads/update_sheet.py` (batch sheet updates)
- Script: `.claude/skills/scrape-leads/enrich_emails.py` (email enrichment via AnyMailFinder)
- Dependencies: Apify API Token, Anthropic API Key, Google Service Account

## Process

### 1. Generate Initial Filter
**Objective**: Create search keywords/criteria based on target profile.

**Agent Actions**:
- Analyze the **Industry / Target Profile** description
- Generate specific search terms (industry keywords, business types, etc.)
- Example: "B2B SaaS, enterprise software" → Keywords: "enterprise software", "B2B SaaS platform", "business intelligence tools"

**Output**: Initial filter criteria (industry keywords, location)

---

### 2. Test Scrape (Sample: 25 Leads)
**Objective**: Validate filter quality before committing resources.

```bash
python3 .claude/skills/scrape-leads/scrape_apify.py \
  --query "<generated_keywords>" \
  --location "<location>" \
  --max_items 25 \
  --no-email-filter \
  --output_prefix active/test_leads.json
```

**Output**: `active/test_leads.json` (25 sample leads)

---

### 3. Quality Check
**Objective**: Evaluate if leads match the target profile.

**Agent Actions**:
- Read `active/test_leads.json`
- Count leads that match the **Target Profile**
- Calculate match rate: `good_leads / 25 * 100`

**Decision Tree**:
- **≥ 80% match** → Proceed to Step 5 (Full Scrape)
- **50-79% match** → Proceed to Step 5 with warning (acceptable quality)
- **< 50% match** → Go to Step 4 (Retry with New Filter)

---

### 4. Retry with New Filter (If < 50% Match)
**Objective**: Refine search criteria to improve quality.

**Agent Actions**:
- Analyze why leads didn't match (wrong industry, wrong size, wrong business model)
- Generate new filter with refined keywords
- Example: "software" too broad → "enterprise SaaS" or "business intelligence software"

**Loop**:
- Return to Step 2 with new filter
- Maximum 3 retry attempts
- If still < 50% after 3 attempts → Ask user to clarify **Target Profile**

---

### 5. Full Scrape

#### Small Scrapes (<1000 leads)
```bash
python3 .claude/skills/scrape-leads/scrape_apify.py \
  --query "<validated_keywords>" \
  --location "<location>" \
  --max_items <total_count> \
  --no-email-filter \
  --output_prefix active/leads_final.json
```

#### Large Scrapes (1000+ leads) — Parallel Processing
```bash
python3 .claude/skills/scrape-leads/scrape_apify_parallel.py \
  --query "<validated_keywords>" \
  --location "<location>" \
  --total_count <total_count> \
  --strategy regions \
  --no-email-filter \
  --output_prefix active/leads_final.json
```

**Geographic Partitioning (Cost-Neutral)**:
- **Auto-detects region** based on location:
  - **United States**: 4-way (Northeast, Southeast, Midwest, West)
  - **EU/Europe**: 4-way (Western, Southern, Northern, Eastern)
  - **UK**: 4-way (SE England, N England, Scotland/Wales, SW England)
  - **Canada**: 4-way (Ontario, Quebec, West, Atlantic)
  - **Australia**: 4-way (NSW, VIC/TAS, QLD, WA/SA)
- **Alternative strategies**: `--strategy metros` (8-way US metros), `--strategy apac` (8-way APAC), `--strategy global` (8-way worldwide)
- **Custom**: Comma-separated cities/states (e.g., `--location "London,Paris,Berlin,Madrid"`)
- **Cost**: SAME as sequential. **Time**: 3-4x faster.

---

### 6. [OPTIONAL] LLM Classification
**When to use**: For complex distinctions that keywords can't capture:
- "Product SaaS vs IT consulting agencies" (use LLM)
- "High-ticket vs low-ticket businesses" (use LLM)
- "Dentists" or "Realtors" (simple keyword matching works — no LLM needed)

```bash
python3 .claude/skills/scrape-leads/classify_leads_llm.py active/leads_final.json \
  --classification_type product_saas \
  --min_confidence medium \
  --output_prefix active/classified_leads.json
```

**Performance**: ~2 minutes for 3,000 leads, ~$0.30 per 1,000 leads

**Output**: `active/classified_leads.json` (only exists if this step was run)

---

### 7. Upload to Google Sheet (DELIVERABLE)

**IMPORTANT — Choose the correct input file**:
- **If Step 6 (LLM Classification) was run** → use `active/classified_leads.json`
- **If Step 6 was skipped** → use `active/leads_final.json`

```bash
# If LLM classification was run (Step 6 completed):
python3 .claude/skills/scrape-leads/update_sheet.py active/classified_leads.json \
  --sheet_name "Qualified Leads - [Date]"

# If LLM classification was skipped:
python3 .claude/skills/scrape-leads/update_sheet.py active/leads_final.json \
  --sheet_name "Qualified Leads - [Date]"
```

Script automatically uses chunked batch updates for datasets >1000 rows.

**Output**: Google Sheet URL (this is the deliverable)

---

### 8. Enrich Missing Emails
```bash
python3 .claude/skills/scrape-leads/enrich_emails.py <SHEET_URL>
```

**IMPORTANT**:
- Always run in foreground and wait for completion
- Uses bulk API for 200+ rows (much faster)
- DO NOT notify user until enrichment completes

**Output**: Updated Google Sheet URL with enriched emails (final deliverable)

---

## Outputs (Deliverables)
**Final Deliverable**: Google Sheet URL with qualified leads + enriched emails

**Intermediates** (temporary, NOT deliverables):
- `active/test_leads.json` — Test sample
- `active/leads_final.json` — Full scrape output
- `active/classified_leads.json` — After LLM filtering (only exists if Step 6 was run)

---

## Quality Thresholds

| Match Rate | Action |
|-----------|--------|
| ≥ 80% | Excellent — Proceed immediately |
| 50-79% | Acceptable — Proceed with warning |
| < 50% | Poor — Retry with refined filter |

**Iteration Limit**: Maximum 3 filter refinement attempts. After 3 failed attempts, escalate to user for clarification.

---

## Edge Cases

- **No leads found**: Keywords too narrow → Broaden search terms
- **Consistently low match rate** (3 attempts < 50%): Target profile may be too specific → Ask user for example companies
- **Low quality classifications** (>80% "unclear"): Improve scrape keywords or use custom classification prompt
- **API failures**: Check `APIFY_API_TOKEN`, `ANTHROPIC_API_KEY`, and `GOOGLE_APPLICATION_CREDENTIALS` in `.env`

## Self-Annealing Notes
- Industry keywords too generic → low match rates → Use more specific terms (e.g., "software" → "enterprise SaaS platform")
- Test scrape shows agencies mixed with products → Add LLM classification step
- User unclear about target → Ask for 3-5 example companies to reverse-engineer criteria
- **CLI flag is `--query` not `--industry`** — the script uses `--query` for search terms
- **CLI flag is `--output_prefix <path>` not `--output`** — always include a space before the path value; script appends timestamp automatically
- **`--no-email-filter` is required** on all scrape commands (both test and full) — omitting it causes the script to fail if email filter credentials are not configured
- **Location format**: Must match Apify's allowed values exactly. US states use `"texas, us"` format, not bare `"texas"`. Countries use lowercase full names (e.g., `"united states"`)
- **Output path**: Script respects `--output_prefix` path including directories (creates them automatically). Use `active/leads/` for organized output.
- **Step 7 input file**: If Step 6 (LLM classification) was skipped, upload `active/leads_final.json` — not `active/classified_leads.json`, which won't exist.