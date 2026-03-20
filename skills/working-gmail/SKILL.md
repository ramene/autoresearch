---
name: gmail
description: Search, read, send, reply, label, and archive Gmail emails across multiple accounts (your-email@example.com, your-work-email@example.com, your-personal-email@example.com). Use for any Gmail or email operations.
allowed-tools: Read, Grep, Glob, Bash
---

# Gmail Operations

## Goal
Manage Gmail emails across multiple registered accounts. Search, read, send, reply, label, archive, and mark-read.

## Tools/Scripts
- **All operations**: `.claude/skills/gmail/gmail_unified.py`
- **Authenticate accounts**: `.claude/skills/gmail/gmail_multi_auth.py`
- **Bulk labeling**: `.claude/skills/gmail/gmail_bulk_label.py`
- **Create filters**: `.claude/skills/gmail/gmail_create_filters.py`

## Core Command Reference

**Base Command:** `python3 .claude/skills/gmail/gmail_unified.py [ACTION] [ARGUMENTS]`

### Primary Actions & Arguments

| Argument | Description | Example |
|---|---|---|
| `--query "<search>"` | **Search emails.** Uses Gmail search syntax. Searches all accounts unless `--account` is specified. | `--query "from:hello@cal.com is:unread"` |
| `--read MESSAGE_ID` | **Read a specific email.** Requires `--account`. | `--read 18e5b... --account yourwork` |
| `--send` | **Send a new email.** Requires `--to`, `--subject`, `--body`, and `--account`. | `--send --to "a@b.com" --subject "Hi" ...` |
| `--reply MESSAGE_ID` | **Reply to an email thread.** Requires `--body` and `--account`. | `--reply 18e5b... --body "Thanks!" --account personal` |
| `--forward MESSAGE_ID` | **Forward an email.** Requires `--to` and `--account`. | `--forward 18e5b... --to "c@d.com" --account yourwork` |
| `--label "Label Name"` | **Apply a label** to messages matching a `--query`. Creates label if it doesn't exist. | `--query "subject:invoice" --label "Finance"` |
| `--archive` | **Archive** messages matching a `--query`. | `--query "from:notifications@" --archive` |
| `--mark-read` | **Mark messages as read** that match a `--query` or are being forwarded. | `--query "is:unread" --mark-read` |

### Common Modifiers

| Argument | Description |
|---|---|
| `--account <name>` | **Specify which account to use.** See Account Management below. **Required for read, send, reply, forward.** |
| `--limit <N>` | Limit search results to N emails. Default is 25. |
| `--json` | Output message content in JSON format for easier parsing. |
| `--dry-run` | Preview a bulk action (send, label, archive) without executing it. **Always use for bulk operations first.** |
| `--accounts` | List all registered accounts from the registry. |

### Common Usage Patterns
```bash
# Search for unread emails from Cal.com in the 'yourwork' account
python3 .claude/skills/gmail/gmail_unified.py --query "from:hello@cal.com is:unread" --account yourwork

# Read a specific email
python3 .claude/skills/gmail/gmail_unified.py --read MESSAGE_ID --account yourwork

# Read a specific email and get structured JSON output (useful for programmatic parsing)
python3 .claude/skills/gmail/gmail_unified.py --read MESSAGE_ID --account yourwork --json

# Send a new email from the default account
python3 .claude/skills/gmail/gmail_unified.py --send --to "test@example.com" --subject "Test" --body "Test body" --account youraccount

# Reply to an email
python3 .claude/skills/gmail/gmail_unified.py --reply MESSAGE_ID --body "Got it, thanks." --account personal

# Forward an email and mark original as read
python3 .claude/skills/gmail/gmail_unified.py --forward MESSAGE_ID --to "recipient@example.com" --account yourwork --mark-read

# Find all invoices, label them, archive them, and mark them as read
python3 .claude/skills/gmail/gmail_unified.py --query "subject:invoice" --label "Accounting" --archive --mark-read

# Always dry-run first for bulk operations
python3 .claude/skills/gmail/gmail_unified.py --query "older_than:30d" --archive --dry-run
```

## Account Management

When a user request is ambiguous, use this table to select the correct account. For `send`, `reply`, `read`, and `forward`, you **must** select a single account. For `query`, you can omit `--account` to search all.

| Account Name | Email Address | When to Use |
|---|---|---|
| `yourwork` | your-work-email@example.com | For work-related topics (clients, invoices, meetings). |
| `personal` | your-personal-email@example.com | For personal topics. |
| `youraccount` | your-email@example.com | **Default.** Use if context is unclear or for general tasks. |

If replying to, reading, or forwarding a specific email, always use the account associated with that email. Never prompt the user for account clarification before attempting a search — search first, then infer.

## Quick Actions

**"Forward to sponsorships"**
When the user says "fw to sponsorships" or similar, forward the email to the configured sponsorships address and mark the original as read.
**Note:** If `{{SPONSORSHIPS_EMAIL}}` is still the literal placeholder string, ask the user "What email address should I forward sponsorships to?" before running the command.
```bash
python3 .claude/skills/gmail/gmail_unified.py --forward MESSAGE_ID --to "{{SPONSORSHIPS_EMAIL}}" --account youraccount --mark-read
```

## Reference & Troubleshooting

### Gmail Search Syntax
- `is:unread`, `from:user@example.com`, `to:me`, `subject:keyword`, `has:attachment`, `newer_than:7d`, `older_than:30d`, `label:inbox`

### Credentials & Authentication

**File Locations** (`active/config/`):
- `credentials.json` — OAuth client for primary + personal accounts
- `credentials_{{ACCOUNT}}.json` — OAuth client for work account
- `token_{{ACCOUNT}}.json` — Auth tokens per account
- `gmail_accounts.json` — Account registry mapping names to token files

All scripts use absolute paths resolved from the script location — no need to `cd` into any directory.

### Auth Error Troubleshooting

**"Token file not found"** — Run auth flow:
```bash
python3 .claude/skills/gmail/gmail_multi_auth.py --account yourwork --email your-work-email@example.com
python3 .claude/skills/gmail/gmail_multi_auth.py --account youraccount --email your-email@example.com
python3 .claude/skills/gmail/gmail_multi_auth.py --account personal --email your-personal-email@example.com
```

**"invalid_scope: Bad Request"** — Delete token and re-auth:
```bash
rm active/config/token_{{ACCOUNT}}.json
python3 .claude/skills/gmail/gmail_multi_auth.py --account youraccount --email your-email@example.com
```

**"Access blocked: org_internal"** — Switch GCP OAuth app to "External" or add test users in the GCP consent screen.

**"Failed to authenticate"** — Check that `credentials.json` / `credentials_{{ACCOUNT}}.json` exist in `active/config/`.

### Edge Cases
- **Multiple accounts**: Search runs across all accounts unless `--account` specified
- **Missing token**: Script warns and skips account; re-run `gmail_multi_auth.py`
- **Label doesn't exist**: Auto-created when using `--label`
- **Token expired**: Script auto-refreshes if refresh token exists

## Tone of Voice — Outgoing Emails
All outgoing emails (send and reply) MUST follow these rules. This is non-negotiable.

1. **Shorter is better.** Say it in 2-3 sentences if you can. The user doesn't write essays in email.
2. **Write like a human, not an LLM.** No "Honest take:" openers. No "Not X. Not Y. Z." parallelism. Avoid stereotyped LLM patterns where every sentence feels crafted and punchy — real humans meander a bit, use filler words, and don't structure thoughts into perfect rhetorical triplets.
3. **Vary importance across sentences.** Not every sentence should feel like it matters equally. Some sentences are just connective tissue — boring, functional, forgettable. Intentionally be boring in places — it signals human.
4. **Include at least one minor mistake.** A small spelling error, a missed capital letter, a slightly awkward comma, forgetting a period.
5. **Use longer sentence structures with particles.** Connect thoughts with "and", "but", "so", "though", "because" rather than chopping everything into short declarative fragments.
6. **Match the user's voice.** Direct, casual, no corporate speak.
7. **Use parentheticals and qualifiers.** Humans hedge naturally — "(frankly)", "in my experience", "in general". Don't strip them out for conciseness.
8. **Don't be dismissive-short.** Brief is good but still acknowledge the person, close warmly.
9. **Add light filler.** Slightly unnecessary phrases like "and thank you for giving me a shout here" are human signals.
10. **No double hyphens (--).** Use a comma instead.
11. **Don't offer to do things, just do them or skip.** No dangling offers.
12. **Never copy user instructions verbatim** unless the user says "verbatim". Adapt intent to fit the conversation naturally.