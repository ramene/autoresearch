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
   If either is missing, stop and tell the user which key is absent.

2. **Verify the script exists** — Confirm `./scripts/instantly_autoreply.py` is present:
   ```bash
   ls ./scripts/instantly_autoreply.py
   ```
   If missing, report the error and stop.

3. **Identify the thread ID** — Extract it from the user's message. If no thread ID was provided, ask the user for it before proceeding.

4. **Run the auto-reply script**:
   ```bash
   python3 ./scripts/instantly_autoreply.py --thread_id <id>
   ```

5. **Report results** — Show the user:
   - Whether the reply was sent successfully
   - The campaign matched (if visible in output)
   - Any errors with a plain-language explanation and suggested fix

6. **On failure** — Use the Read tool to inspect the script and diagnose the issue:
   - Read `./scripts/instantly_autoreply.py` using the Read tool (not cat/bash)
   - Identify the failing section (API call, sheet lookup, reply generation, etc.)
   - Explain what went wrong in plain language
   - Tell the user specifically what to check: API keys, sheet ID (`{{SHEET_ID}}`), network connectivity, or thread ID validity

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