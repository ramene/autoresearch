---
name: welcome-email
description: Send welcome email sequence to new clients. Use when user asks to send welcome emails, onboard new client with emails, or trigger welcome sequence.
allowed-tools: Bash, Read, Write, Edit, Glob, Grep
---

> **Demo Library Skill** — This skill is from a demo library. Some configuration values use placeholders (e.g. `{{USER_NAME}}`, `{{COMMUNITY_ID}}`). **Before running, replace all placeholders with your actual values.**

# Welcome Client Emails

## Goal
Send 3-email welcome sequence ({{USER_NAME}}, Peter, Sam) when a new client signs.

## Scripts
- `./scripts/welcome_client_emails.py` - Send welcome sequence

## Process
1. Receive client info (name, email, company)
2. Send email from {{USER_NAME}} (welcome, expectations)
3. Send email from Peter (technical setup)
4. Send email from Sam (support intro)

## Usage

Run the script with the required client details:

```bash
python3 ./scripts/welcome_client_emails.py \
  --client_name "John Doe" \
  --client_email "john@company.com" \
  --company "Acme Corp"
```

**Required arguments:**
- `--client_name` — Full name of the new client
- `--client_email` — Client's email address
- `--company` — Client's company name

## Email Structure
Each email is personalized with client details and sent from different team members to establish relationships.

## Error Handling
- If the script does not exist at `./scripts/welcome_client_emails.py`, report the missing file path and stop — do not attempt to create or substitute the script.
- If `{{USER_NAME}}` or any other placeholder text (surrounded by `{{` and `}}`) is still present in the skill, stop immediately and tell the user exactly which placeholders need to be replaced before the skill can run.
- If the script exits with a non-zero status, capture and display the full error output so the user can diagnose the failure.
- If client name, email, or company are not provided, ask the user for the missing fields before running.

## Expected Output
After a successful run, report all of the following:
1. Which 3 emails were sent — include the sender name and recipient email for each
2. The script's exit status (e.g. exit code 0) or confirmation message from the script
3. Any warnings returned by the script (even on success)

If the run fails, report:
- The exact error message or stack trace from the script
- The specific step that failed (e.g. which email failed to send)
- What the user should do next to resolve the issue