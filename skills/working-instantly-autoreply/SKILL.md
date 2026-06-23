---
name: instantly-autoreply
description: Auto-generate intelligent replies to incoming Instantly email threads using knowledge bases. Use when user asks about email auto-replies, Instantly responses, or automated email handling.
allowed-tools: Bash, Read, Write, Edit, Glob, Grep
---

> **Demo Library Skill** — This skill is from a demo library. Some configuration values use placeholders (e.g. `{{USER_NAME}}`, `{{COMMUNITY_ID}}`). If something doesn't work, check for placeholder values and replace them with your own information first.

# Instantly Auto-Reply

## Goal
Auto-generate intelligent replies to incoming emails from Instantly campaigns using campaign-specific knowledge bases.

## Agent Action Steps

When this skill is invoked, follow these steps in order:

1. **Verify environment** — Check that `INSTANTLY_API_KEY` and `ANTHROPIC_API_KEY` are set:
   ```bash
   echo "INSTANTLY: ${INSTANTLY_API_KEY:+set}" && echo "ANTHROPIC: ${ANTHROPIC_API_KEY:+set}"
   ```
   If either is missing, stop and tell the user which key is absent. Also tell the user how to set the missing key:
   > "To set the key, add it to your shell environment before running this skill: `export INSTANTLY_API_KEY=your_key_here` (or add it to your `.env` file if the project uses one). Then restart Claude Code or re-source your shell."

2. **Verify the script exists** — Confirm `./scripts/instantly_autoreply.py` is present:
   ```bash
   ls ./scripts/instantly_autoreply.py
   ```
   If missing, tell the user: "The script `./scripts/instantly_autoreply.py` was not found. Make sure you are running this skill from the repository root directory (the folder that contains the `scripts/` subdirectory). If you are in the right directory and the file is still missing, the script may not have been installed."

3. **Identify the thread ID** — Extract it from the user's message. Thread IDs may appear as a plain string, embedded in a URL (e.g. `/threads/<id>`), or referenced inline in a sentence.

   If no thread ID was provided, ask the user for it with this explanation:
   > "Please provide the Instantly thread ID. You can find it in the Instantly dashboard under **Unibox → [thread] → thread details**, or in the URL when viewing a thread (it looks like a long alphanumeric string, e.g. `abc123def456`). You can also find it in webhook payloads under the `threadId` field."

   **Do not proceed to step 4 until you have a thread ID from the user.**

4. **Run the auto-reply script**:
   ```bash
   python3 ./scripts/instantly_autoreply.py --thread_id <id>
   ```

5. **Report results** — Capture both stdout/stderr and the exit code. Run the script with:
   ```bash
   python3 ./scripts/instantly_autoreply.py --thread_id <id>; echo "EXIT_CODE:$?"
   ```
   Then show the user:
   - Whether the reply was sent successfully (look for success/error keywords in output AND confirm exit code is 0)
   - The campaign matched (if visible in output)
   - Any errors with a plain-language explanation and suggested fix

   **Exit code rules**:
   - Exit code 0 + success message → report success
   - Exit code non-zero → treat as failure regardless of output content
   - Exit code 0 but output contains "error" or "failed" → treat as failure and flag the ambiguity

   If the script output is ambiguous or does not clearly indicate success or failure, report the raw output and note that the reply status is unclear — do not assume success.

6. **On failure** — Use the Read tool to inspect the script and diagnose the issue:
   - Read `./scripts/instantly_autoreply.py` using the Read tool (not cat/bash)
   - Identify the failing section (API call, sheet lookup, reply generation, etc.)
   - Explain what went wrong in plain language
   - Tell the user specifically what to check: API keys, sheet ID (`{{SHEET_ID}}`), network connectivity, or thread ID validity

## Test Scenarios (for evaluation)

The following scenarios must be handled correctly:

### Scenario: User is Unsure How to Find Thread ID
**User prompt:** "I need to generate a reply for an email in Instantly, but I don't know what the thread ID is or where to find it. Can you help?"

**Required agent behavior:**
1. Recognize that no thread ID was provided
2. Do NOT run `instantly_autoreply.py`
3. Follow step 3's missing-ID path and respond with the full explanation:
   - Where to find the thread ID: Instantly dashboard → Unibox → thread details
   - What it looks like: a long alphanumeric string (e.g. `abc123def456`)
   - That it also appears in webhook payloads under the `threadId` field
4. Ask the user to provide the thread ID before proceeding

## Scripts
- `./scripts/instantly_autoreply.py` - Main auto-reply script

## How It Works
1. Receives incoming email thread from Instantly webhook
2. Looks up campaign ID in knowledge base sheet
3. Retrieves campaign context (offers, credentials, tone)
4. Generates contextual reply using Claude
5. Sends reply through Instantly API

## Knowledge Base
Spreadsheet: `{{SHEET_ID}}`

Each row contains:
- Campaign ID
- Campaign Name
- Knowledge Base (service details, offers, credentials)
- Reply Examples (tone/style guidance)

## Environment
```
INSTANTLY_API_KEY=your_key
ANTHROPIC_API_KEY=your_key
```