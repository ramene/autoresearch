---
name: onboarding-kickoff
description: Automated client onboarding after kickoff call - generates leads, creates email campaigns, sets up auto-reply. Use when user asks to onboard a new client, set up campaigns for client, or run post-kickoff automation.
allowed-tools: Bash, Read, Write, Edit, Glob, Grep
---

> **Demo Library Skill** — This skill is from a demo library. Some configuration values use placeholders (e.g. `{{USER_NAME}}`, `{{COMMUNITY_ID}}`). If something doesn't work, check for placeholder values and replace them with your own information first.

# Post-Kickoff Client Onboarding

## Goal
Automated onboarding workflow that runs after kickoff call. Generates leads, creates campaigns, and sets up auto-reply system.

## ⚠️ CRITICAL EXECUTION RULE
**You MUST run ALL 7 steps to completion using the Bash tool. Do NOT stop after collecting inputs. Do NOT ask for confirmation between steps. Do NOT consider the task done until you have run every Bash command and output the final JSON summary. Partial execution is a failure.**

## When Invoked

**Follow this exact sequence:**

1. **Collect required inputs** — If any required field is missing, ask for ALL missing fields in ONE prompt. Do not proceed until you have all required inputs.
2. **Run Steps 1–7 in order** — Use the Bash tool for each step. Substitute real values for every ALL_CAPS variable before running.
3. **Capture sheet_url** — After Step 2, extract the `sheet_url` from stdout and use that exact URL string in Steps 3, 5, and 7.
4. **Handle errors without stopping** — On non-fatal errors, log the issue and continue to the next step.
5. **Output the final JSON** — After Step 7 completes (or fails), output the JSON summary. This is the only acceptable stopping point.

## Inputs (from kickoff call)

**Required:**
- `CLIENT_NAME`: Company name
- `CLIENT_EMAIL`: Primary contact email
- `SERVICE_TYPE`: What service they provide
- `TARGET_LOCATION`: Geographic area
- `OFFERS`: Three offers (pipe-separated)
- `TARGET_AUDIENCE`: Who they're targeting
- `SOCIAL_PROOF`: Credentials/results

**Optional:**
- `LEAD_LIMIT`: Number of leads (default: 500)
- `VALUE_PROPOSITION`: Additional context (if not provided, derive it as: `"SERVICE_TYPE for TARGET_AUDIENCE"` — do NOT ask the user for this)

## Scripts
- `./scripts/gmaps_lead_pipeline.py` - Lead generation
- `./scripts/casualize_company_names_batch.py` - Name casualization
- `./scripts/instantly_create_campaigns.py` - Campaign creation
- `./scripts/onboarding_post_kickoff.py` - Full orchestration (Steps 5-7)
- `./scripts/update_sheet.py` - Sheet updates

## Execution Checklist — Complete ALL 7 Steps

### ✅ Step 1: Construct Search Query
Build the search query as: `SERVICE_TYPE in TARGET_LOCATION` (e.g. "plumbers in Austin TX"). Display it to the user as an informational note (e.g. "Search query: plumbers in Austin TX"), then **IMMEDIATELY execute Step 2 without waiting for any response or approval**.

### ✅ Step 2: Scrape and Enrich Leads
**RUN THIS NOW with the Bash tool** (substitute real values):
```bash
python3 ./scripts/gmaps_lead_pipeline.py \
  --search "SERVICE_TYPE in TARGET_LOCATION" \
  --limit LEAD_LIMIT \
  --sheet-name "CLIENT_NAME - Leads" \
  --workers 5
```
**Required**: Extract `sheet_url` from stdout. Store it — you will use this exact string in Steps 3, 5, and 7.
**Required**: Extract the lead count (number of leads found/scraped) from stdout. Store it — you will use this exact number in the final JSON `lead_count` field.

### ✅ Step 3: Casualize Company Names
**RUN THIS NOW with the Bash tool** (substitute SHEET_URL with the exact URL string extracted from Step 2 stdout — the same URL you will use in Steps 5 and 7):
```bash
python3 ./scripts/casualize_company_names_batch.py \
  --sheet-url "SHEET_URL" \
  --column "business_name" \
  --output-column "casualCompanyName"
```

### ✅ Step 4: Create Instantly Campaigns
**RUN THIS NOW with the Bash tool**. For `--client_description`, use the VALUE_PROPOSITION if provided; otherwise substitute `"SERVICE_TYPE for TARGET_AUDIENCE"` (e.g. "plumbers for homeowners in Austin TX"). Do NOT ask the user — derive the value and run immediately:
```bash
python3 ./scripts/instantly_create_campaigns.py \
  --client_name "CLIENT_NAME" \
  --client_email "CLIENT_EMAIL" \
  --client_description "VALUE_PROPOSITION_OR_DERIVED_FALLBACK" \
  --offers "OFFERS" \
  --target_audience "TARGET_AUDIENCE" \
  --social_proof "SOCIAL_PROOF"
```
**Required**: Note the campaign IDs from stdout.

### ✅ Step 5: Upload Leads to Campaigns
**RUN THIS NOW with the Bash tool**:
```bash
python3 ./scripts/onboarding_post_kickoff.py \
  --step upload-leads \
  --sheet-url "SHEET_URL" \
  --client_name "CLIENT_NAME"
```

### ✅ Step 6: Add Knowledge Base Entry
**RUN THIS NOW with the Bash tool**:
```bash
python3 ./scripts/onboarding_post_kickoff.py \
  --step knowledge-base \
  --client_name "CLIENT_NAME" \
  --client_email "CLIENT_EMAIL" \
  --service_type "SERVICE_TYPE" \
  --target_audience "TARGET_AUDIENCE" \
  --social_proof "SOCIAL_PROOF"
```

### ✅ Step 7: Send Summary Email
**RUN THIS NOW with the Bash tool**:
```bash
python3 ./scripts/onboarding_post_kickoff.py \
  --step send-summary \
  --client_name "CLIENT_NAME" \
  --client_email "CLIENT_EMAIL" \
  --sheet-url "SHEET_URL"
```

## Output
**After Step 7 completes, you MUST output this JSON summary. Every field MUST use ACTUAL values extracted from the Bash tool stdout — do NOT use the placeholder text shown below, do NOT estimate or assume values, do NOT leave any field as a template string:**

```json
{
  "status": "success",
  "client_name": "<actual CLIENT_NAME you used — e.g. 'Acme Plumbing'>",
  "sheet_url": "<actual sheet_url extracted from Step 2 stdout — e.g. 'https://docs.google.com/spreadsheets/d/...'>",
  "lead_count": "<actual integer count of leads returned by Step 2 stdout — e.g. 487>",
  "campaigns": ["<campaign ID 1 from Step 4 stdout>", "<campaign ID 2 from Step 4 stdout>"],
  "leads_uploaded": "<true if Step 5 succeeded, false if it failed>",
  "knowledge_base_updated": "<true if Step 6 succeeded, false if it failed>",
  "summary_email_sent": "<true if Step 7 succeeded, false if it failed>"
}
```

**Critical field sourcing rules:**
- `client_name`: the exact CLIENT_NAME input you received
- `sheet_url`: parsed from Step 2 stdout (look for a URL beginning with `https://`)
- `lead_count`: parsed from Step 2 stdout (look for a number indicating leads found/scraped); never default to 0 unless stdout explicitly reports 0
- `campaigns`: each ID parsed from Step 4 stdout; include all campaign IDs returned
- Boolean fields: `true` only if the step completed without error, `false` otherwise

If any step failed, set its corresponding field to `false` and add an `"errors"` key listing each failure with the step number and error message:
```json
{
  "errors": [
    {"step": 5, "message": "<actual error from stdout/stderr>"}
  ]
}
```

## Timing
- Full workflow: ~10-15 minutes for 50 leads
- Lead scraping uses 5 workers by default

## Error Handling
- **< 10 leads found**: Warn the user but continue with remaining steps
- **0 leads found**: This is a fatal error — the search query is likely invalid. Skip Steps 3–7, then **output the JSON summary** with `"status": "error"`, `"lead_count": 0`, all step fields set to `false`, and `"errors": [{"step": 2, "message": "0 leads found — invalid search query"}]`. Do not silently stop; the JSON output is still required.
- **Instantly API error**: Capture the error message, note it in the final summary, continue remaining steps
- **Sheet/email failures**: Log the failure in summary output, complete the rest of the workflow