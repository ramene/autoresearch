---
name: the-real-scrumness
description: Generates rich, detailed GitHub Project board cards with score charts, round history, mutation logs, skill instructions, and lifecycle tracking. The standard for ALL project board management across the platform. Use when creating, updating, or syncing GitHub Project boards.
allowed-tools: Bash, Read, Grep, Glob
---

# The Real Scrumness

> Every GitHub Project board card should tell a complete story — score, progress, mutations, instructions, origin, and promotion readiness. No empty cards. No missing context. Ever.

## Purpose

Replace the default bare-bones GitHub Project board experience with rich, information-dense cards that show exactly what's happening with every skill, task, issue, or story. This is the standard for ALL boards across the platform.

## When to Use

- After every autoresearch cron cycle (board-sync)
- When creating new GitHub Project boards for any purpose
- When updating existing cards with new progress
- When `/scaffold` creates a new session and needs board tracking
- Any time someone says "update the board"

## Card Format Standard

Every card MUST include:

### For Skills (Autoresearch Lifecycle)
```
## Score: {score}/{max} ({pct}%)
Rounds: {N} | Kept: {K} | Reverted: {R} | Escalations: {E}
Origin: {manual|want-genesis} | Status: {untested|improving|perfect}

### Score Progress
R0   18/36  [#########...........]  KEPT  Added error handling section
R1   16/36  [########............]  REV   Removed context section (regression)
R2   30/36  [###############.....]  KEPT  Fixed MCP tool identification
R3   30/36  [###############.....]  REV   Placeholder fix didn't improve
R4   36/36  [####################]  KEPT  Error handling added → PERFECT
R3  ESC  Gemini meta-analysis triggered

### Skill Instructions
{First 40 lines of SKILL.md — purpose, triggers, usage}

_(truncated — see full SKILL.md in repo)_
```

### For Tasks/Stories/Issues
```
## {Task Title}
**Priority**: {P0|P1|P2|P3}
**Assignee**: {agent|human|unassigned}
**Sprint**: {current|backlog}
**Blocked by**: {dependencies}

### Acceptance Criteria
- [ ] {Observable outcome 1}
- [ ] {Observable outcome 2}

### Progress Log
{timestamp} — {what happened}
{timestamp} — {what happened}

### Context
{Relevant links, files, decisions}
```

## Board Sync Workflow

### After Every Cron Cycle
1. Read all `working-*/rounds.json` for current scores
2. Read `working-*/changelog.md` for mutation history  
3. Read `working-*/SKILL.md` for skill instructions (first 40 lines)
4. Read `working-*/events.jsonl` for genesis origin
5. Generate card body with score chart + instructions
6. Update or create card on GitHub Project board
7. Set status column: Todo (untested) | In Progress (improving) | Done (perfect)

### Deduplication
- NEVER create duplicate cards — check by skill name before creating
- If card exists, UPDATE the body with new scores/rounds
- If card doesn't exist, CREATE with full rich content

### Board Identification
- Skill Lifecycle: Project #20 (PVT_kwHOAT8jZ84BSWkb)
- Use GitHub GraphQL API via `gh api graphql`
- Authenticate with token from `/usr/local/etc/autoresearch-credentials/github-pat.txt`

## Score Chart Format

```
R{round}  {score}/{max}  [{bar}]  {KEPT|REV|ESC}  {mutation summary}
```

Where:
- `{bar}` = `#` repeated proportionally + `.` for remainder (20 chars total)
- `KEPT` = mutation improved the score
- `REV` = mutation was reverted (score didn't improve)
- `ESC` = stuck escalation triggered (Gemini meta-analysis)

## Error Handling

- If GitHub API fails: log error, continue without blocking the cron
- If token is missing: skip board sync silently
- If a card body exceeds 65535 chars: truncate skill instructions
- If rate-limited: back off and retry once

## Integration Points

- Called from `autonomous-loop.sh` as Step 2.5
- Can be invoked directly: `node skills/board-sync.mjs`
- Reads from: `skills/working-*/` directories
- Writes to: GitHub Project #20 via GraphQL API

## Quality Standards

- Zero empty cards — every card has content
- Zero duplicate cards — deduplication by skill name
- Score charts show ALL rounds (not just latest)
- Mutation descriptions are human-readable (max 60 chars)
- Skill instructions show purpose + trigger + usage
- Genesis skills are tagged with origin want ID
- Promotion-ready skills are clearly marked
