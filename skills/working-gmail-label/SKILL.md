---
name: gmail-label
description: Auto-label Gmail emails into Action Required, Waiting On, and Reference categories. Use when user asks to label emails, triage inbox, categorize emails, or organize Gmail.
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, Task
---

> **Demo Library Skill** — This skill is from a demo library. Some configuration values use placeholders (e.g. `{{USER_NAME}}`, `{{COMMUNITY_ID}}`). If something doesn't work, check for placeholder values and replace them with your own information first.

# Gmail Auto-Label

## Goal
Fetch inbox emails, classify them via parallel subagents into Action Required / Waiting On / Reference, and apply labels in bulk via Gmail API.

## Prerequisites — Run First

Before executing any step, resolve the `ACCOUNT` value:

```bash
cat gmail_accounts.json
```

This file lists configured accounts. Each entry has a key (the account name) and an `email` field. Use the key as `ACCOUNT` in all commands below. Example: if the file contains `{"work": {"email": "you@example.com", ...}}`, then `ACCOUNT=work`.

If `gmail_accounts.json` is missing or empty, add an account first:
```bash
python3 .claude/skills/gmail-inbox/scripts/gmail_multi_auth.py --account ACCOUNT_NAME --email EMAIL
```

Also ensure `.tmp/` directory exists:
```bash
mkdir -p .tmp/chunks
```

## Scripts
- `./scripts/gmail_label_fetch.py` - Fetch email summaries as compact JSON
- `./scripts/gmail_label_split.py` - Split emails into N chunks for parallel classification
- `./scripts/gmail_label_merge.py` - Merge classified chunks into single labels.json
- `./scripts/gmail_label_apply.py` - Apply label classifications in bulk

## Subagent
- `email-classifier` — defined in `.claude/agents/email-classifier.md`
- Model: Sonnet 4.5 (fast, cost-efficient classification)
- Each subagent reads one chunk, writes one classified output file

## Flow (Parallel — default)

### Step 1: Fetch emails
```bash
python3 .claude/skills/gmail-label/scripts/gmail_label_fetch.py \
  --account ACCOUNT --query "in:inbox" --limit 100 --output .tmp/emails.json
```

**Error handling:** If this fails, check:
1. `gmail_accounts.json` exists and contains the account key
2. OAuth token is valid — re-run `gmail_multi_auth.py` if you get an auth error
3. `.tmp/` directory exists (`mkdir -p .tmp/chunks`)

Do not proceed to Step 2 if `.tmp/emails.json` was not created.

### Step 2: Split into chunks
```bash
python3 .claude/skills/gmail-label/scripts/gmail_label_split.py \
  --input .tmp/emails.json --chunks 10 --output-dir .tmp/chunks
```

**Error handling:** If this fails or produces fewer than expected chunk files, check that `.tmp/emails.json` is non-empty. If the inbox has fewer than 10 emails, the script may produce fewer chunks — note the actual count and use that count (not 10) in Steps 3 and 4.

After this step, capture the actual chunk count for use in Steps 3 and 4:
```bash
CHUNKS=$(ls .tmp/chunks/chunk_*.json 2>/dev/null | wc -l | tr -d ' ')
echo "Chunk count: $CHUNKS"
```

### Step 3: Classify in parallel (spawn subagents per chunk)

First, capture the absolute working directory — subagents need full paths:
```bash
pwd
```
Save the output as `WORKDIR` (e.g. `/Users/you/project`). Use this value in every subagent prompt below.

Spawn one `email-classifier` subagent per chunk in background. Each subagent:
- Reads `WORKDIR/.tmp/chunks/chunk_N.json`
- Classifies each email
- Writes `WORKDIR/.tmp/chunks/classified_N.json`

Use the Task tool with `run_in_background: true` and `model: "sonnet"`. Launch ALL at once in a single message for true parallelism:

```
For each chunk 0-(N-1), spawn a Task with:
  subagent_type: "email-classifier"
  model: "sonnet"
  run_in_background: true
  prompt: "Read WORKDIR/.tmp/chunks/chunk_N.json, classify each email, write results to WORKDIR/.tmp/chunks/classified_N.json"
```

Replace `WORKDIR` with the actual absolute path from `pwd` and `N` with the chunk index. Do NOT use a literal placeholder — subagents cannot resolve relative paths.

**CRITICAL: Do NOT use TaskOutput to read subagent results.** The subagents write their results to files — the main agent never needs to see the classification data. Reading TaskOutput will flood the context window and cause "prompt too long" errors with large batches (500+ emails).

Instead, poll for file existence using the `CHUNKS` count captured in Step 2:
```bash
TIMEOUT=120
START=$(date +%s)
for i in $(seq 0 $((CHUNKS-1))); do
  while [ ! -f ".tmp/chunks/classified_$i.json" ]; do
    sleep 2
    NOW=$(date +%s)
    if [ $((NOW - START)) -ge $TIMEOUT ]; then
      echo "TIMEOUT waiting for classified_$i.json after ${TIMEOUT}s"
      exit 1
    fi
  done
done
echo "All $CHUNKS classified files ready"
```

**Error handling:** If the polling loop times out or exits with an error, check which `classified_N.json` files are missing. Re-spawn subagents only for the missing chunks before proceeding.

Then proceed directly to Step 4 (merge).

### Step 4: Merge classifications
```bash
python3 .claude/skills/gmail-label/scripts/gmail_label_merge.py \
  --input-dir .tmp/chunks --output .tmp/labels.json
```

**Error handling:** If this fails, verify all `classified_N.json` files exist and are valid JSON (`python3 -m json.tool .tmp/chunks/classified_0.json`). A malformed classified file from a subagent is the most common cause of merge failure.

### Step 5: Apply labels
```bash
python3 .claude/skills/gmail-label/scripts/gmail_label_apply.py \
  --account ACCOUNT --input .tmp/labels.json
```

**Error handling:** If this fails with an auth error, re-authenticate the account. If it fails partway through, it is safe to re-run — already-labeled emails will be skipped or re-labeled idempotently.

## Expected Output

After Step 5 completes, report a summary to the user in this format:
```
Labeled 100 emails:
  Action Required: 12
  Waiting On: 8
  Reference: 80
Labels applied to: you@example.com
```

If `gmail_label_apply.py` prints a summary, use those counts. Otherwise count entries in `.tmp/labels.json` grouped by label.

## Classification Guidelines

**Action Required:**
- Security alerts that need verification
- Expiring credit cards / domain renewals with deadlines
- Slack @mentions asking questions
- New team members to greet (Slack join notifications)
- Client emails needing response
- Business listing updates (Google Business Profile, Bing Places)
- Stripe action-required notices

**Waiting On:**
- Outbound sales emails awaiting reply
- Support tickets awaiting resolution
- Proposals sent, pending response

**Reference:**
- Marketing newsletters (DigitalMarketer, etc.)
- Charity/nonprofit newsletters (RAPS, etc.)
- Google Business Profile performance reports
- Promotional offers (Blinkist, sales, etc.)
- Platform update notifications (Google Play, Apify, etc.)
- Confirmation codes (already used)
- Real estate newsletters (Westbank, etc.)
- Gaming account emails (Riot Games, etc.)
- Informational security alerts (2FA turned on, etc.)
- Health advisories
- Legal/policy update notices

## Account Registry
Accounts are stored in `gmail_accounts.json` at workspace root. Each account needs:
- `email` - Gmail address
- `token_file` - Path to OAuth token

## Adding New Accounts
```bash
python3 .claude/skills/gmail-inbox/scripts/gmail_multi_auth.py --account ACCOUNT_NAME --email EMAIL
```

## Performance
- **Serial flow**: ~36s for 100 emails (fetch 1s + classify 34s + apply 1s)
- **Parallel flow**: ~30s for 100 emails (classify 19s + merge <1s + apply ~10s)
- Classification is the bottleneck; 10 parallel subagents cut it from 34s to 19s (~1.8x speedup)
- Agent startup overhead (~4s stagger) limits theoretical gains
- Apply step may vary due to Gmail API throttling