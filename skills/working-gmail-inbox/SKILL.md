---
name: gmail-inbox
description: Manage emails across multiple Gmail accounts with unified tooling. Use when user asks to check email, read inbox, label emails, archive messages, or manage Gmail across accounts.
allowed-tools: Bash, Read, Write, Edit, Glob, Grep
---

> **Demo Library Skill** — This skill is from a demo library. Some configuration values use placeholders (e.g. `{{USER_NAME}}`, `{{COMMUNITY_ID}}`). If something doesn't work, check for placeholder values and replace them with your own information first.

# Gmail Inbox Management

## Goal
Check and manage emails across multiple Gmail accounts using unified tooling.

## Workflow

When this skill is invoked, follow these steps:

1. **List registered accounts** — run `python3 ./scripts/gmail_unified.py --accounts` to confirm which accounts are available.
2. **Fetch emails** — run the appropriate query (see Quick Reference below) based on what the user asked for. Default to `is:unread` across all accounts if no specific query is given.
3. **Handle auth errors immediately** — if any step produces an auth error, do NOT continue. Instead:
   - For "Token file not found": run `python3 ./scripts/gmail_multi_auth.py --account <account> --email <email>` for the failing account, then retry.
   - For "invalid_scope: Bad Request": delete the failing token (`rm token_<account>.json`), re-run `python3 ./scripts/gmail_multi_auth.py --account <account> --email <email>`, then retry.
   - For "Failed to authenticate": check that `credentials.json` exists in the workspace root, then retry.
   - After re-authing, resume from the step that failed.
4. **Display results clearly** — summarize emails in a table or list showing: account, sender, subject, date, and any labels. Group by account if multiple accounts are checked.
5. **Perform requested actions** — if the user asked to label, archive, or mark-read, execute those commands directly. Use `--dry-run` only when the user explicitly requests a preview or when the action scope is unclear (e.g. query would match more than 100 emails unexpectedly).
6. **Confirm completion** — report what was done: how many emails found, how many actioned, on which accounts.

## Advanced Actions

The main workflow covers checking and managing existing emails. For other tasks, use the following procedures.

### Creating Filters

If the user asks to create a new filter to automatically manage incoming mail:

1. **Identify Criteria:** Determine the filter criteria from the user's request (e.g., from a specific sender, with a certain subject, etc.).
2. **Identify Action:** Determine the action the filter should take (e.g., apply a label, archive, mark as read).
3. **List Labels if Needed:** If the user specifies a label by name rather than ID, first retrieve the label list to find the correct ID:
   ```bash
   python3 ./scripts/gmail_unified.py --query "label:INBOX" --account youruser --limit 1
   # Or use the Gmail API directly to list labels for the account
   ```
4. **Construct Command:** Use the `gmail_create_filters.py` script with the account and a JSON string defining the filter:
   ```bash
   # Example: Create a filter to label emails from "newsletter@example.com" as "Newsletters"
   python3 ./scripts/gmail_create_filters.py --account youruser --filter '{"criteria": {"from": "newsletter@example.com"}, "action": {"addLabelIds": ["LABEL_ID_NEWSLETTERS"]}}'
   ```
5. **Confirm Creation:** Report back to the user that the filter has been successfully created, including the criteria and action applied.

## Scripts
- `./scripts/gmail_unified.py` - Check and manage inboxes
- `./scripts/gmail_multi_auth.py` - Authenticate accounts
- `./scripts/gmail_bulk_label.py` - Bulk labeling
- `./scripts/gmail_create_filters.py` - Create filters
- `./scripts/gmail_auth.py` - Auth helper

## Quick Reference

```bash
# Check unread across all accounts
python3 ./scripts/gmail_unified.py --query "is:unread" --limit 50

# Check specific account only
python3 ./scripts/gmail_unified.py --query "is:unread" --account yourcompany

# List registered accounts
python3 ./scripts/gmail_unified.py --accounts

# Label and archive emails
python3 ./scripts/gmail_unified.py --query "from:notifications@" --label "Notifications" --archive

# Mark as read
python3 ./scripts/gmail_unified.py --query "from:noreply@" --mark-read

# Dry run (preview only — use when scope is uncertain)
python3 ./scripts/gmail_unified.py --query "subject:invoice" --label "Invoices" --dry-run

# Create a filter
python3 ./scripts/gmail_create_filters.py --account youruser --filter '{"criteria": {"from": "sender@example.com"}, "action": {"addLabelIds": ["LABEL_ID"]}}'
```

## Account Registry

| Account | Email | Credentials | Token |
|---------|-------|-------------|-------|
| youruser | you@example.com | credentials.json | token_youruser.json |
| yourcompany | you@yourdomain.com | credentials_yourcompany.json | token_yourcompany.json |

## Required Scopes
- `gmail.modify` - Read/write emails
- `gmail.labels` - Create/manage labels
- `gmail.settings.basic` - Manage settings
- `spreadsheets` - Google Sheets access
- `drive` - Google Drive access

## Credentials Location
All credential files should be in the workspace root:
- `credentials.json` / `credentials_yourcompany.json` - OAuth client configs
- `token_*.json` - Auth tokens (auto-generated)
- `gmail_accounts.json` - Account registry