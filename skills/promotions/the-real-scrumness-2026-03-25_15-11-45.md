# Promotion Proposal: the-real-scrumness

## Scores
- **Baseline**: 36/36
- **Current**: 36/36
- **Improvement**: +0 points (100.0%)
- **Rounds**: 6

## Promotion Target
`/Users/ramene/Journal/.seed/base/skills/the-real-scrumness/SKILL.md`

## Key Mutations That Improved Score
1. No failures detected — added a "Verification Step" to the Board Sync Workflow to confirm card was actually written (proactive quality gate, not fixing a regression)
2. Added explicit "Promotion Readiness" definition — skill referenced marking promotion-ready skills but never defined the criteria, leaving it ambiguous for future rounds.
3. No failures detected — added a "Sprint Backlog vs Kanban" clarification to Board Sync Workflow to distinguish when to use status columns vs sprint assignment for task/story cards (proactive precision improvement).
4. No failures detected — added explicit "Escalation Handling" clarification to distinguish ESC entries in score charts from regular rounds, improving readability of stuck-skill scenarios (proactive precision improvement).
5. Added Dependency Tracking and Notifications section to Board Sync Workflow to introduce automated inter-card relationship management when cards transition to Done status.

## Unified Diff (baseline -> current)
```diff
--- /Users/ramene/.remote/@autoresearch/skills/working-the-real-scrumness/SKILL.md.baseline	2026-03-20 18:08:49.000000000 -0600
+++ /Users/ramene/.remote/@autoresearch/skills/working-the-real-scrumness/SKILL.md	2026-03-21 06:06:20.000000000 -0600
@@ -74,6 +74,19 @@
 5. Generate card body with score chart + instructions
 6. Update or create card on GitHub Project board
 7. Set status column: Todo (untested) | In Progress (improving) | Done (perfect)
+8. **Verify**: re-fetch the card via GraphQL and confirm body length > 100 chars — if empty or missing, retry once
+
+### Dependency Tracking and Notifications
+- When a card's status is updated to **Done**, the sync process MUST perform a dependency check.
+- **Check**: Query the project board for any cards that list the newly-completed card in their `Blocked by:` field.
+- **Action**: For each dependent card found, add a comment via the GitHub API: `✅ Blocker resolved: {Title of completed card}`.
+- This creates an automated notification trail, unblocking dependent work without manual intervention.
+
+### Status Column vs Sprint Assignment
+- **Status columns** (Todo / In Progress / Done) apply to ALL card types and reflect current workflow state
+- **Sprint field** on task/story cards indicates which sprint iteration the work belongs to — set this separately from status
+- A card can be `Sprint: backlog` AND `Status: Todo` simultaneously — these are independent fields
+- Never use status column as a proxy for sprint assignment; always set both fields explicitly when creating task cards
 
 ### Deduplication
 - NEVER create duplicate cards — check by skill name before creating
@@ -95,7 +108,24 @@
 - `{bar}` = `#` repeated proportionally + `.` for remainder (20 chars total)
 - `KEPT` = mutation improved the score
 - `REV` = mutation was reverted (score didn't improve)
-- `ESC` = stuck escalation triggered (Gemini meta-analysis)
+- `ESC` = stuck escalation triggered (Gemini meta-analysis) — no score change on this line; the round number shown is the round that triggered the escalation
+
+### Escalation Entries in the Chart
+When a skill is stuck (score unchanged across multiple rounds), an escalation is triggered. In the score chart:
+- ESC entries appear **in addition to** the KEPT/REV entry for that round — they are not a replacement
+- ESC lines show the round number that triggered the escalation, not a new round
+- ESC lines have no score columns — format is `R{N}  ESC  {description}`
+- The escalation outcome (e.g. Gemini meta-analysis result) may appear as a mutation in a subsequent round
+
+## Promotion Readiness
+
+A skill is **promotion-ready** when ALL of the following are true:
+- Score is 100% (max/max) for at least 2 consecutive rounds
+- No regressions in the last 3 rounds
+- Has been tested across at least 3 distinct scenarios
+- Changelog shows a stable mutation history (no thrashing)
+
+Mark promotion-ready skills with `🚀 PROMOTION READY` on the card title line and set a `promotion-candidate` label via the GitHub API. If a skill is perfect but has fewer than 2 consecutive perfect rounds, mark it `✅ PERFECT — watching` instead.
 
 ## Error Handling
 
@@ -119,4 +149,4 @@
 - Mutation descriptions are human-readable (max 60 chars)
 - Skill instructions show purpose + trigger + usage
 - Genesis skills are tagged with origin want ID
-- Promotion-ready skills are clearly marked
+- Promotion-ready skills are clearly marked per the Promotion Readiness criteria above
\ No newline at end of file

```

## Generated
- **Timestamp**: 2026-03-25T15:11:45.373Z
- **Source**: `/Users/ramene/.remote/@autoresearch/skills/working-the-real-scrumness/SKILL.md`
- **Baseline**: `/Users/ramene/.remote/@autoresearch/skills/working-the-real-scrumness/SKILL.md.baseline`
