# Promotion Proposal: linkedin-response

## Scores
- **Baseline**: 28/36
- **Current**: 36/36
- **Improvement**: +8 points (100.0%)
- **Rounds**: 5

## Promotion Target
`/Users/ramene/Journal/.seed/base/skills/linkedin-response/SKILL.md`

## Key Mutations That Improved Score
1. Added explicit DOM error recovery procedures for failed evaluate_script calls (no editor, no send button, no reaction toolbar) to fix Error Handling and Completeness failures in scenarios 2 and 4.
2. Replace vague "find profile link" last-sender detection with a concrete evaluate_script snippet that returns the last sender's name, plus a fallback procedure when it can't be determined — fixing Instructions Clarity, Task Completion, Error Handling, and Completeness for scenario 2.
3. Harmonized the "unknown" last-sender fallback report message in Selection Logic to exactly match the DOM Error Recovery section's wording, ensuring consistent operator-facing language and reducing ambiguity for edge cases.
4. Clarify the "Mark as unread" DOM section to handle both cases: marking from the conversation list (when you haven't opened it yet) and from within an already-open thread (add the thread-header options path as a fallback), fixing the Instructions Clarity and Completeness gaps for Cat 3 execution.
5. Clarify Cat 2 hover step to explicitly identify the other person's last message UID in the snapshot (not {{USER_NAME}}'s), reducing ambiguity when multiple messages appear in the thread.

## Unified Diff (baseline -> current)
```diff
--- /Users/ramene/.remote/@autoresearch/skills/working-linkedin-response/SKILL.md.baseline	2026-03-19 08:16:48.000000000 -0600
+++ /Users/ramene/.remote/@autoresearch/skills/working-linkedin-response/SKILL.md	2026-03-20 15:24:52.000000000 -0600
@@ -76,7 +76,7 @@
 
 ## Selection Logic
 
-1. Check if {{USER_NAME}}'s message is the most recent → if yes, **SKIP** (no double messaging)
+1. Check if {{USER_NAME}} is NOT the last sender (see "Finding the last sender" below) → if {{USER_NAME}} IS last, **SKIP**
 2. Read the other person's last message
 3. Classify into Category 1, 2, or 3
 4. If Cat 1: generate a contextual reply based on their actual message
@@ -84,8 +84,31 @@
 6. If Cat 3: mark as unread
 7. Present proposed action to user, then execute
 
+If the last sender cannot be determined (`'no_messages'` or `'unknown'`), treat as **Cat 3**: mark as unread and report: "Could not determine last sender for [Name] — marked as unread for manual review"
+
 ## Technical Notes (LinkedIn DOM)
 
+### Finding the last sender (REQUIRED before every action)
+
+Use `evaluate_script` to reliably determine who sent the last message. This avoids misreading the DOM snapshot:
+
+```javascript
+() => {
+  const messages = document.querySelectorAll('.msg-s-message-list__event');
+  if (!messages.length) return 'no_messages';
+  const last = messages[messages.length - 1];
+  const senderEl = last.querySelector('.msg-s-message-group__profile-link, .msg-s-event-listitem__link');
+  if (!senderEl) return 'unknown';
+  return senderEl.textContent.trim();
+}
+```
+
+- If the returned name matches **{{USER_NAME}}** → **SKIP** (would double-message)
+- If it returns the other person's name → proceed with classification
+- If it returns `'no_messages'` or `'unknown'` → treat as **Cat 3** (mark unread) and report: "Could not determine last sender for [Name] — marked as unread for manual review"
+
+**Never guess the last sender from the snapshot alone.** Always run this script first.
+
 ### Sending a message (Cat 1)
 LinkedIn's contenteditable does NOT work with `type_text` or `fill`. You MUST use `evaluate_script`:
 
@@ -115,18 +138,59 @@
 
 ### Reacting with 👍 (Cat 2)
 JS `mouseenter` dispatch does NOT reveal the reaction toolbar. You MUST:
-1. Use MCP `hover` tool on the **message text UID** (with `includeSnapshot: true` to save a round-trip)
-2. In the returned snapshot, find `menuitem "React with thumbs up"` UID
-3. Click that UID
+1. In the snapshot, locate the **other person's last message** bubble UID — this is the message sent by them, not by {{USER_NAME}}. When multiple messages are visible, use the last one whose sender is NOT {{USER_NAME}}.
+2. Use MCP `hover` tool on that message bubble UID (with `includeSnapshot: true` to save a round-trip)
+3. In the returned snapshot, find `menuitem "React with thumbs up"` UID
+4. Click that UID
 
 **Make sure you're hovering on the OTHER person's message, not {{USER_NAME}}'s.**
 
 ### Mark as unread (Cat 3)
-1. Click the "Open the options list..." button on the conversation **list item** (not the thread header)
-2. In the dropdown, click "Mark as unread"
 
-### Finding the last sender
-In the thread, each message group has an `a[href*="/in/"]` profile link with text like "View [Name]'s profile". Check whether the last message group belongs to {{USER_NAME}} or the other person.
+You will be **inside the conversation thread** when marking as unread (since the Execution Flow has you click in first). There are two ways to access the mark-as-unread option:
+
+**Primary path — from the conversation list item (preferred):**
+1. The options button (`"Open the options list..."`) is on the conversation **list item** in the left panel, not the thread header
+2. Click that button on the list item
+3. In the dropdown, click "Mark as unread"
+
+**Fallback path — from the thread header (if the list item button is not accessible):**
+1. Look for a "More options" or `"..."` / kebab menu button in the **thread header** at the top of the open conversation
+2. Click it to open the dropdown
+3. Click "Mark as unread"
+
+Use whichever path is visible in the current snapshot. If neither is found, follow the DOM Error Recovery procedure below.
+
+## DOM Error Recovery
+
+When a DOM operation returns an error value or the expected element is not found, follow these steps rather than stopping:
+
+### `evaluate_script` returns `'no_messages'` or `'unknown'` (can't determine last sender)
+- Treat conversation as **Cat 3**: mark as unread
+- Report to the user: "Could not determine last sender for [Name] — marked as unread for manual review"
+- Do NOT attempt to classify or reply
+
+### `evaluate_script` returns `'no editor'` (Cat 1 — can't find the message input)
+1. Take a fresh snapshot to check current page state
+2. If the conversation is still open, try clicking directly into the message thread area to ensure the compose box is visible, then retry the evaluate_script once
+3. If it still returns `'no editor'` after one retry, **mark the conversation as unread** (treat as Cat 3) and report to the user: "Could not find message editor for [Name] — marked as unread for manual review"
+
+### `evaluate_script` returns `'no send button'` (Cat 1 — message typed but can't send)
+1. Take a snapshot to confirm whether the text was typed into the editor
+2. If text is visible in the editor, try clicking the send button by UID from the snapshot instead of via evaluate_script
+3. If send still fails, **do not leave a partial message** — clear the editor with `editor.innerHTML = ''` and mark the conversation as unread, reporting to the user
+
+### Hover returns no `"React with thumbs up"` menuitem (Cat 2 — reaction toolbar not visible)
+1. Take a fresh snapshot and retry the hover on the message UID once
+2. If the reaction option still doesn't appear, **skip the reaction** and report to the user: "Could not react to [Name]'s message — reaction toolbar not found, skipped"
+3. Do NOT fall back to sending a text reply for a Cat 2 message
+
+### "Mark as unread" option not found in dropdown (Cat 3)
+1. Close the dropdown and retry — first try the list item options button, then the thread header options button (see both paths above)
+2. If the option still doesn't appear via either path, skip and report: "Could not mark [Name]'s conversation as unread — options menu missing"
+
+### General rule
+**Never silently skip a conversation due to a DOM error.** Always report what failed and what fallback action (if any) was taken, so the user has a complete summary at the end.
 
 ## Token Optimization
 
@@ -144,11 +208,14 @@
 
 Process conversations ONE AT A TIME:
 1. Click into the conversation (use `includeSnapshot: true`)
-2. Verify {{USER_NAME}} is NOT the last sender
-3. Identify the last message from the other person
-4. Classify into category 1/2/3
-5. Execute the appropriate action (reply / react / mark unread)
-6. Move to next conversation
+2. Run the last-sender `evaluate_script` to verify {{USER_NAME}} is NOT the last sender
+3. If {{USER_NAME}} is last sender → SKIP immediately, move to next
+4. If sender is unknown/undetectable → treat as Cat 3 (mark unread), report, move to next
+5. Identify the last message from the other person
+6. Classify into category 1/2/3
+7. Execute the appropriate action (reply / react / mark unread)
+8. If a DOM error occurs, follow the DOM Error Recovery procedures above
+9. Move to next conversation
 
 ## Dry Run Mode
 
@@ -165,15 +232,22 @@
 
 Process conversations ONE AT A TIME. For each:
 1. Click into the conversation
-2. Check last sender (skip if {{USER_NAME}})
+2. Run last-sender script (skip if {{USER_NAME}}, mark unread if unknown)
 3. Read last message
 4. Classify, execute action immediately
-5. Move to next
+5. If a DOM error occurs, apply the recovery procedure and note the outcome
+6. Move to next
 
 **Do NOT do two passes** (scan all → compile table → execute all). That wastes tokens and degrades quality. Process each conversation fully before moving to the next. Present dry-run table only if explicitly asked for a dry run.
 
+## End-of-Batch Summary
+
+After processing all conversations, always report a brief summary:
+- How many conversations were actioned (Cat 1 replies, Cat 2 reactions, Cat 3 marked unread, skipped)
+- Any DOM errors encountered and what fallback action was taken
+
 ## Setup
 
 1. Navigate to LinkedIn messaging: `https://www.linkedin.com/messaging/?filter=unread`
 2. Use the `chrome-stealth` MCP server (not `chrome-devtools`)
-3. Process all visible unread conversations, then click "Load more conversations" if present
+3. Process all visible unread conversations, then click "Load more conversations" if present
\ No newline at end of file

```

## Generated
- **Timestamp**: 2026-03-25T15:11:45.194Z
- **Source**: `/Users/ramene/.remote/@autoresearch/skills/working-linkedin-response/SKILL.md`
- **Baseline**: `/Users/ramene/.remote/@autoresearch/skills/working-linkedin-response/SKILL.md.baseline`
