---
name: inbox-cleaner
description: Clean up Gmail inbox by reading all unread emails, using AI to identify which ones are genuinely important (personalized, human-written), and marking the rest as read. Use when cleaning inbox, triaging email, or clearing unread notifications.
allowed-tools: Read, Grep, Glob, Bash
---

> **Demo Library Skill** — This skill is from a demo library. Some configuration values use placeholders (e.g. `{{USER_NAME}}`, `{{COMMUNITY_ID}}`). If something doesn't work, check for placeholder values and replace them with your own information first.

# Inbox Cleaner — AI-Powered Unread Email Triage

## Goal
Go through every unread email across ALL 3 accounts, classify each one as important or not, and mark unimportant ones as read automatically (no confirmation step). Only truly personalized, human-written emails survive as unread.

## What Counts as Important
An email is important ONLY if it was clearly written by a human specifically for the user. Indicators:
- References specific details about the user, their business, or prior conversations
- Contains substantive content that couldn't be a template
- Comes from a known contact with a real message
- Replies in an existing thread with genuine human input

## What Gets Marked as Read (Not Important)
- Automated notifications (GitHub, Stripe, Slack digests, calendar, etc.)
- Marketing emails and newsletters
- Cold outreach / sales emails (templated pitches, "I noticed your company..." spam)
- Service alerts, receipts, shipping updates
- Social media notifications
- Automated replies (out-of-office, delivery confirmations)
- Mass emails from SaaS products
- Any email that feels like it was sent to 100+ people

## Process

Run all 3 accounts in parallel. For each account, run fetch → classify → mark-read sequentially, then present a single summary at the end. **Do NOT ask for confirmation before marking as read** — just do it and report what was kept.

### Parallel execution — run all 3 accounts at the same time using background jobs:

```bash
# Launch all 3 accounts in parallel (background jobs)
(
  .venv/bin/python3 .claude/skills/inbox-cleaner/inbox_cleaner.py --fetch --account yourwork &&
  .venv/bin/python3 .claude/skills/inbox-cleaner/inbox_cleaner.py --classify --account yourwork &&
  .venv/bin/python3 .claude/skills/inbox-cleaner/inbox_cleaner.py --mark-read --account yourwork
) &

(
  .venv/bin/python3 .claude/skills/inbox-cleaner/inbox_cleaner.py --fetch --account youraccount &&
  .venv/bin/python3 .claude/skills/inbox-cleaner/inbox_cleaner.py --classify --account youraccount &&
  .venv/bin/python3 .claude/skills/inbox-cleaner/inbox_cleaner.py --mark-read --account youraccount
) &

(
  .venv/bin/python3 .claude/skills/inbox-cleaner/inbox_cleaner.py --fetch --account personal &&
  .venv/bin/python3 .claude/skills/inbox-cleaner/inbox_cleaner.py --classify --account personal &&
  .venv/bin/python3 .claude/skills/inbox-cleaner/inbox_cleaner.py --mark-read --account personal
) &

wait  # Wait for all 3 to finish before proceeding to summary
```

Within each account's subshell, steps run sequentially (fetch → classify → mark-read). All 3 accounts run simultaneously. If any step fails within an account, that account's remaining steps are skipped (see Error Handling).

### After all accounts are done:

Run `--review` on each account and present a single combined summary showing only the important emails that were kept unread. Keep it brief.

```bash
.venv/bin/python3 .claude/skills/inbox-cleaner/inbox_cleaner.py --review --account yourwork
.venv/bin/python3 .claude/skills/inbox-cleaner/inbox_cleaner.py --review --account youraccount
.venv/bin/python3 .claude/skills/inbox-cleaner/inbox_cleaner.py --review --account personal
```

## Error Handling

If any step fails for an account, **do not stop — skip that account and continue with the remaining ones**. The final summary must always be shown, even if some accounts errored.

### Per-step failure rules:
- **`--fetch` fails**: Log the error, skip `--classify` and `--mark-read` for that account, note it as "unavailable" in the summary.
- **`--classify` fails**: Log the error, skip `--mark-read` for that account (do not mark anything without classification), note it in the summary.
- **`--mark-read` fails**: Log the error, report which emails were classified as unimportant but could not be marked read, note this in the summary.
- **Auth errors** (401, token expired, missing credentials): Report "Auth failed — check `active/config/` tokens" for that account in the summary. Do not retry.
- **Script not found / venv missing**: Report the setup fix inline (see Setup Notes) and skip that account.

### Summary when errors occur:
Always include a section for each account in the final summary, even failed ones. Format:
- ✅ Account processed normally → show kept emails
- ⚠️ Account had errors → show what failed and why

**Never silently skip an account.** If all 3 accounts fail, still output a summary explaining what went wrong for each.

## Accounts
Supports all 3 Gmail accounts via `--account`:

| Account | Email | Default |
|---------|-------|---------|
| `yourwork` | your-work-email@example.com | Yes |
| `youraccount` | your-email@example.com | |
| `personal` | your-personal-email@example.com | |

```bash
# Clean yourwork (default)
python3 .claude/skills/inbox-cleaner/inbox_cleaner.py --fetch

# Clean a specific account
python3 .claude/skills/inbox-cleaner/inbox_cleaner.py --fetch --account youraccount
```

Auth tokens and credentials are in `active/config/` (same as the gmail skill).

## Output
- `active/inbox_unread_{account}.json` — fetched unread emails
- `active/inbox_classified_{account}.json` — classification results with reasoning
- Console summary showing what was kept vs marked read

## Edge Cases
- If classification is uncertain, keep the email as unread (err on the side of caution)
- Emails from contacts in existing threads should be treated as important even if short
- Forwarded emails: judge based on the forwarding context, not the forwarded content

## Setup Notes
If scripts fail on first run, check:
1. `.venv/bin/python3` exists — run `python3 -m venv .venv && .venv/bin/pip install -r requirements.txt` if not
2. Auth tokens exist in `active/config/` — follow the gmail skill setup guide if missing
3. Replace placeholder account emails in this skill with your actual Gmail addresses