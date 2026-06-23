---
name: linkedin-response
description: Respond to LinkedIn DMs with short, casual, human-like messages matching {{USER_NAME}}'s voice. Use for replying to thank-yous, compliments, interest expressions, and simple questions in LinkedIn messaging.
allowed-tools: Read, Grep, Glob, mcp__chrome-stealth__take_snapshot, mcp__chrome-stealth__click, mcp__chrome-stealth__hover, mcp__chrome-stealth__evaluate_script, mcp__chrome-stealth__navigate_page
---

> **Demo Library Skill** — This skill is from a demo library. Some configuration values use placeholders (e.g. `{{USER_NAME}}`, `{{COMMUNITY_ID}}`). If something doesn't work, check for placeholder values and replace them with your own information first.

# LinkedIn DM Response

## Goal
Triage and respond to LinkedIn DMs with short, lowercase, human-like messages matching {{USER_NAME}}'s casual texting voice.

## Model Recommendation
Use **Sonnet** for this skill. The task is procedural (classify → execute DOM action) and doesn't need Opus-level reasoning. Sonnet at ~$0.27/DM vs Opus at ~$1.30/DM.

## CRITICAL SAFETY CONSTRAINTS

**NEVER send a message without explicit user approval.** Always:
1. Show the proposed response (or batch table in dry-run)
2. Wait for user confirmation
3. Only then type and send

## CRITICAL: No Double Messages

**NEVER reply if {{USER_NAME}}'s message is the most recent one in the conversation.** The cadence must always be them→me→them→me. Never me→me. If {{USER_NAME}} already replied last, skip the conversation entirely. This is the single most important rule — double-messaging looks automated and not human.

## Voice & Style Rules

{{USER_NAME}}'s LinkedIn DM voice:
- **Always lowercase** (never capitalize, even sentence starts)
- **Short** — typically 2-8 words, occasionally a short sentence
- **Casual/friendly** — like texting a friend
- **No punctuation overkill** — one exclamation max, no periods on short replies
- **No emojis** unless the other person used them first (then mirror sparingly)
- **Never formal** — no "Thank you for your kind words" or "I appreciate your message"
- **Never salesy** — don't pitch {{COMMUNITY_NAME}} or link to anything
- **Context-aware** — generate responses intelligently based on what they actually said. Don't just pick from templates. If someone mentions something specific ("your course saved me 10 hours"), weave that in naturally ("10 hours is wild, glad it helped!")

## Three Categories

### Category 1: Gratitude / Happiness / Compliments
**Trigger:** Someone expresses thanks, satisfaction, gratitude, compliments {{USER_NAME}}'s work/content, says something nice, or shares how their content helped them.

**Action:** Reply with a short, lowercase, warm acknowledgment. Generate contextually — read their actual message and respond to what they said, not a generic template.

Tone calibration examples (for style reference only, don't copy verbatim):
- "np man"
- "my pleasure!"
- "glad to hear it"
- "means a lot, thanks"
- "really appreciate that man"

For longer/heartfelt messages, lean slightly longer but still casual:
- "really appreciate that man, means a lot"
- "that's so cool to hear, glad I could help"

### Category 2: Confirmations ("it worked", "got it", "Yes", "Thanks" with no substance)
**Trigger:** Someone confirms a lead magnet link worked, says "got it", bare "Thanks", "Yes", or sends a simple acknowledgment like 👍. Purely transactional, no emotional content.

**Action:** React with 👍 (thumbs up emoji reaction on their message). Do NOT send a text reply.

**Important distinction:** If their confirmation ALSO includes genuine gratitude or a compliment (e.g., "It works! Thanks, huge fan of your work"), use Category 1 instead. Category 2 is only for bare confirmations with zero emotional content.

### Category 3: Complex / Needs Manual Review
**Trigger:** Any of:
- Complicated questions that need real thought
- Long pitches or business proposals
- Requests for collaboration/partnerships
- Technical questions {{USER_NAME}} should answer personally
- Anything ambiguous or that doesn't clearly fit Cat 1 or Cat 2
- "It didn't work" / troubleshooting requests
- Messages in foreign languages where intent is unclear

**Action:** Mark the conversation as unread. {{USER_NAME}} will review these themselves.

## Selection Logic

1. Check if {{USER_NAME}} is NOT the last sender (see "Finding the last sender" below) → if {{USER_NAME}} IS last, **SKIP**
2. Read the other person's last message
3. Classify into Category 1, 2, or 3
4. If Cat 1: generate a contextual reply based on their actual message
5. If Cat 2: react with 👍
6. If Cat 3: mark as unread
7. Present proposed action to user, then execute

If the last sender cannot be determined (`'no_messages'` or `'unknown'`), treat as **Cat 3**: mark as unread and report: "Could not determine last sender for [Name] — marked as unread for manual review"

## Technical Notes (LinkedIn DOM)

### Finding the last sender (REQUIRED before every action)

Use `evaluate_script` to reliably determine who sent the last message. This avoids misreading the DOM snapshot:

```javascript
() => {
  const messages = document.querySelectorAll('.msg-s-message-list__event');
  if (!messages.length) return 'no_messages';
  const last = messages[messages.length - 1];
  const senderEl = last.querySelector('.msg-s-message-group__profile-link, .msg-s-event-listitem__link');
  if (!senderEl) return 'unknown';
  return senderEl.textContent.trim();
}
```

- If the returned name matches **{{USER_NAME}}** → **SKIP** (would double-message)
- If it returns the other person's name → proceed with classification
- If it returns `'no_messages'` or `'unknown'` → treat as **Cat 3** (mark unread) and report: "Could not determine last sender for [Name] — marked as unread for manual review"

**Never guess the last sender from the snapshot alone.** Always run this script first.

### Sending a message (Cat 1)
LinkedIn's contenteditable does NOT work with `type_text` or `fill`. You MUST use `evaluate_script`:

**Step 1 — Type the message:**
```javascript
() => {
  const editor = document.querySelector('div[contenteditable="true"].msg-form__contenteditable');
  if (!editor) return 'no editor';
  editor.focus();
  editor.innerHTML = '<p>YOUR MESSAGE HERE</p>';
  editor.dispatchEvent(new Event('input', { bubbles: true }));
  return 'typed';
}
```

**Step 2 — Click send:**
```javascript
() => {
  const btn = document.querySelector('.msg-form__send-button');
  if (!btn) return 'no send button';
  btn.click();
  return 'sent';
}
```

**Common mistake:** Do NOT use selector `.msg-form__contenteditable [contenteditable="true"]` (descendant). The class is ON the contenteditable element itself: `div[contenteditable="true"].msg-form__contenteditable`.

### Reacting with 👍 (Cat 2)
JS `mouseenter` dispatch does NOT reveal the reaction toolbar. You MUST:
1. In the snapshot, locate the **other person's last message** bubble UID — this is the message sent by them, not by {{USER_NAME}}. When multiple messages are visible, use the last one whose sender is NOT {{USER_NAME}}.
2. Use MCP `hover` tool on that message bubble UID (with `includeSnapshot: true` to save a round-trip)
3. In the returned snapshot, find `menuitem "React with thumbs up"` UID
4. Click that UID

**Make sure you're hovering on the OTHER person's message, not {{USER_NAME}}'s.**

### Mark as unread (Cat 3)

You will be **inside the conversation thread** when marking as unread (since the Execution Flow has you click in first). There are two ways to access the mark-as-unread option:

**Primary path — from the conversation list item (preferred):**
1. The options button (`"Open the options list..."`) is on the conversation **list item** in the left panel, not the thread header
2. Click that button on the list item
3. In the dropdown, click "Mark as unread"

**Fallback path — from the thread header (if the list item button is not accessible):**
1. Look for a "More options" or `"..."` / kebab menu button in the **thread header** at the top of the open conversation
2. Click it to open the dropdown
3. Click "Mark as unread"

Use whichever path is visible in the current snapshot. If neither is found, follow the DOM Error Recovery procedure below.

## DOM Error Recovery

When a DOM operation returns an error value or the expected element is not found, follow these steps rather than stopping:

### `evaluate_script` returns `'no_messages'` or `'unknown'` (can't determine last sender)
- Treat conversation as **Cat 3**: mark as unread
- Report to the user: "Could not determine last sender for [Name] — marked as unread for manual review"
- Do NOT attempt to classify or reply

### `evaluate_script` returns `'no editor'` (Cat 1 — can't find the message input)
1. Take a fresh snapshot to check current page state
2. If the conversation is still open, try clicking directly into the message thread area to ensure the compose box is visible, then retry the evaluate_script once
3. If it still returns `'no editor'` after one retry, **mark the conversation as unread** (treat as Cat 3) and report to the user: "Could not find message editor for [Name] — marked as unread for manual review"

### `evaluate_script` returns `'no send button'` (Cat 1 — message typed but can't send)
1. Take a snapshot to confirm whether the text was typed into the editor
2. If text is visible in the editor, try clicking the send button by UID from the snapshot instead of via evaluate_script
3. If send still fails, **do not leave a partial message** — clear the editor with `editor.innerHTML = ''` and mark the conversation as unread, reporting to the user

### Hover returns no `"React with thumbs up"` menuitem (Cat 2 — reaction toolbar not visible)
1. Take a fresh snapshot and retry the hover on the message UID once
2. If the reaction option still doesn't appear, **skip the reaction** and report to the user: "Could not react to [Name]'s message — reaction toolbar not found, skipped"
3. Do NOT fall back to sending a text reply for a Cat 2 message

### "Mark as unread" option not found in dropdown (Cat 3)
1. Close the dropdown and retry — first try the list item options button, then the thread header options button (see both paths above)
2. If the option still doesn't appear via either path, skip and report: "Could not mark [Name]'s conversation as unread — options menu missing"

### General rule
**Never silently skip a conversation due to a DOM error.** Always report what failed and what fallback action (if any) was taken, so the user has a complete summary at the end.

## Token Optimization

These are critical for keeping costs low:

1. **Use `includeSnapshot: true`** on `click` and `hover` calls whenever you need the page state afterward. This returns the snapshot in the same response — saves a separate `take_snapshot` call (1 round-trip + ~5K tokens per snapshot saved).

2. **Minimize snapshots for mechanical actions.** Cat 2 (👍) needs exactly 2 calls: hover with includeSnapshot → click menuitem. Cat 3 (mark unread) needs 2 calls: click options with includeSnapshot → click "Mark as unread". Don't take extra snapshots.

3. **Don't re-read the conversation list** between actions unless you need to find the next conversation. After finishing one conversation's action, just click the next conversation in the list directly.

4. **Skip already-processed conversations.** If the list preview shows "You: ..." that means {{USER_NAME}} replied last — skip without clicking in.

## Execution Flow

Process conversations ONE AT A TIME:
1. Click into the conversation (use `includeSnapshot: true`)
2. Run the last-sender `evaluate_script` to verify {{USER_NAME}} is NOT the last sender
3. If {{USER_NAME}} is last sender → SKIP immediately, move to next
4. If sender is unknown/undetectable → treat as Cat 3 (mark unread), report, move to next
5. Identify the last message from the other person
6. Classify into category 1/2/3
7. Execute the appropriate action (reply / react / mark unread)
8. If a DOM error occurs, follow the DOM Error Recovery procedures above
9. Move to next conversation

## Dry Run Mode

When asked to "dry run", do NOT type, send, react, or mark anything. Just present a table:

| # | From | Their Message | Category | Proposed Action |
|---|------|--------------|----------|----------------|
| 1 | Name | "quote..." | 1 | Reply: "np man" |
| 2 | Name | "got it" | 2 | React 👍 |
| 3 | Name | "long pitch..." | 3 | Mark unread |
| 4 | Name | ({{USER_NAME}} replied last) | SKIP | No action (would double-msg) |

## Batch Mode

Process conversations ONE AT A TIME. For each:
1. Click into the conversation
2. Run last-sender script (skip if {{USER_NAME}}, mark unread if unknown)
3. Read last message
4. Classify, execute action immediately
5. If a DOM error occurs, apply the recovery procedure and note the outcome
6. Move to next

**Do NOT do two passes** (scan all → compile table → execute all). That wastes tokens and degrades quality. Process each conversation fully before moving to the next. Present dry-run table only if explicitly asked for a dry run.

## End-of-Batch Summary

After processing all conversations, always report a brief summary:
- How many conversations were actioned (Cat 1 replies, Cat 2 reactions, Cat 3 marked unread, skipped)
- Any DOM errors encountered and what fallback action was taken

## Setup

1. Navigate to LinkedIn messaging: `https://www.linkedin.com/messaging/?filter=unread`
2. Use the `chrome-stealth` MCP server (not `chrome-devtools`)
3. Process all visible unread conversations, then click "Load more conversations" if present