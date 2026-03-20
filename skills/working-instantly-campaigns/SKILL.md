---
name: instantly-campaigns
description: Create cold email campaigns in Instantly with A/B testing. Use when user asks to create email campaigns, set up cold outreach, build email sequences, or configure Instantly campaigns.
allowed-tools: Bash, Read, Write, Edit, Glob, Grep
---

> **Demo Library Skill** — This skill is from a demo library. Some configuration values use placeholders (e.g. `{{USER_NAME}}`, `{{COMMUNITY_ID}}`). If something doesn't work, check for placeholder values and replace them with your own information first.

# Instantly Campaign Creation

## Goal
Create three email campaigns in Instantly based on a client description and offers. Each campaign has A/B tested first emails and follow-up sequences.

## Inputs
1. **Client Description**: Company name, industry, target audience, value proposition
2. **Offers** (optional): List of 3 offers. If not provided, they will be generated in Step 2.

## Scripts
- `./scripts/instantly_create_campaigns.py` - Creates campaigns via Instantly API
- `./scripts/read_sheet.py` - Read lead data if needed

## Process

### 1. Load Examples
Read `.tmp/instantly_campaign_examples/campaigns.md` for inspiration on personalization + social proof + offer structure. If this file does not exist, skip this step and proceed with default best practices.

### 2. Prepare Offers (REQUIRED before running script)
**If the user did NOT provide 3 offers**, generate them now from the client description before proceeding:
- Offer 1: Focus on speed/efficiency benefit
- Offer 2: Focus on cost/ROI benefit
- Offer 3: Focus on risk-reduction/guarantee benefit

Write out the 3 offers you will use (whether provided by the user or generated here) so the user can see them:
```
Offers to be used:
- Offer 1: [text]
- Offer 2: [text]
- Offer 3: [text]
```

**Do not proceed to Step 3 until you have exactly 3 offers ready.**

### 3. Run Script & Capture Output
Run the script **exactly once**, capturing both stdout and stderr together:

```bash
python3 ./scripts/instantly_create_campaigns.py \
  --client_name "ClientName" \
  --client_description "Description of the client..." \
  --offers "Offer 1|Offer 2|Offer 3" \
  --target_audience "Who we're emailing" \
  --social_proof "Credentials/results to mention" \
  2>&1
```

**Immediately after running**, examine the complete output and check all four conditions:

1. Does the output contain valid JSON?
2. Is `"status": "success"`?
3. Is `"campaigns_created": 3`?
4. Are there 3 entries in `"campaign_ids"`?

**If ANY of these checks fail** (error message, missing JSON, wrong counts, non-zero exit code), **STOP HERE and follow the Error Recovery Protocol below**. Do not proceed to Step 4.

**Only continue to Step 4 if all four checks pass.**

### 4. Verify & Confirm Completion
After confirming the script output shows success, confirm the task is fully complete by checking ALL of the following:

1. **Three campaigns created**: The output JSON shows `"campaigns_created": 3` and lists 3 campaign IDs
2. **Each campaign has 3 emails**: Email 1 (A/B split), Email 2 (follow-up), Email 3 (breakup)
3. **A/B variants exist**: Email 1 in each campaign has exactly 2 variants
4. **No API errors**: Output shows `"status": "success"` — if not, follow the Error Recovery Protocol below

If any check fails, follow the Error Recovery Protocol before declaring completion.

Report final results to the user in this format:
```
✅ Created 3 campaigns successfully:
- Campaign 1: [name] (ID: ...)
- Campaign 2: [name] (ID: ...)
- Campaign 3: [name] (ID: ...)

Offers used:
- Offer 1: [text]
- Offer 2: [text]
- Offer 3: [text]

Each campaign includes:
- Email 1 with 2 A/B variants
- Email 2 follow-up
- Email 3 breakup
```

## Error Recovery Protocol

When the script fails or produces incomplete results, follow these steps in order:

### Step 1 — Diagnose the failure
```bash
# Check if .env exists and has required keys
grep -E "INSTANTLY_API_KEY|ANTHROPIC_API_KEY" .env
```
If either key is missing or shows a placeholder, report the missing key to the user and stop. Do not proceed without valid API keys.

### Step 2 — Check the script exists and is executable
```bash
ls -la ./scripts/instantly_create_campaigns.py
```
If missing, report: "Script not found at ./scripts/instantly_create_campaigns.py — please verify the scripts directory."

### Step 3 — Re-run with verbose output if the error was transient
```bash
python3 ./scripts/instantly_create_campaigns.py \
  --client_name "ClientName" \
  --client_description "Description..." \
  --offers "Offer 1|Offer 2|Offer 3" \
  --target_audience "Target audience" \
  --social_proof "Social proof" \
  2>&1
```
Capture full stderr output. If the error mentions rate limits or network issues, wait 10 seconds and retry once.

### Step 4 — Report partial success honestly
If only 1 or 2 campaigns were created (partial success), report exactly which campaigns succeeded and which failed:
```
⚠️ Partial completion: Created 2/3 campaigns
- Campaign 1: [name] (ID: ...) ✅
- Campaign 2: [name] (ID: ...) ✅
- Campaign 3: [name] — FAILED: [error message] ❌

Action required: [specific fix needed]
```
Do NOT report success if fewer than 3 campaigns were created.

## Campaign Structure

### Email 1 (A/B Split Test)
- Personalization hook (`{{icebreaker}}` or custom opener)
- Social proof (credentials, results)
- Offer (clear value proposition)
- Soft CTA

### Email 2 (Follow-up)
- Brief, friendly bump
- Reference original email
- Restate value
- Clear CTA

### Email 3 (Breakup)
- Short, direct
- Last chance framing
- Simple yes/no ask

## Available Variables
- `{{firstName}}` - Lead's first name
- `{{lastName}}` - Lead's last name
- `{{companyName}}` - Lead's company
- `{{casualCompanyName}}` - Informal company name
- `{{icebreaker}}` - AI-generated icebreaker
- `{{sendingAccountFirstName}}` - Sender's first name

## Output
```json
{
  "status": "success",
  "campaigns_created": 3,
  "campaign_ids": ["id1", "id2", "id3"],
  "campaign_names": ["Campaign 1", "Campaign 2", "Campaign 3"]
}
```

## Environment
Requires in `.env`:
```
INSTANTLY_API_KEY=your_key
ANTHROPIC_API_KEY=your_key
```

## API Learnings
- Schedule requires `name` field in each schedule object
- Timezone: Use `America/Chicago` (not all IANA values work)
- HTML: Instantly strips plain text outside HTML tags - wrap in `<p>` tags
- Model: Uses `claude-opus-4-5-20251101` for generation