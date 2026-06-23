---
name: deep-plan-v2
description: Specification-driven planning extending Deep Plan Mode with interactive discovery, specification quality gates, footgun detection, and implementation loop design for complex agent tasks.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
  - AskUserQuestion
---

# Skill: Deep Plan Mode v2

> Specification-driven planning with footgun detection and interactive discovery

## Purpose

Extends Deep Plan Mode with three capabilities from the agent specification discipline:
1. **Interactive Discovery** — Ask the right questions before researching
2. **Specification Quality Gates** — Ensure success criteria are observable, not vibes
3. **Footgun Detection** — Audit the plan for "speed without discipline" problems before execution

## When to Use

Same triggers as original Deep Plan Mode, plus:
- When you catch yourself saying "the agent will figure it out"
- When success criteria feel fuzzy
- When the plan touches shared packages, payments, or auth

## Extended Workflow

### Phase 0: Interactive Discovery (NEW — before research)

Before the agent dives into codebase exploration, it asks:

**Q1: What are you trying to accomplish?**
Not the task — the real goal. What problem does this solve? Why does it matter?

**Q2: What does "done" look like?**
Observable outcomes only. "It works better" is not observable. "Tests pass, API returns 200, build succeeds" is observable. If you can't describe done, the agent can't either.

**Q3: What are you most worried about?**
What could go wrong? What's the riskiest part? This shapes where research focuses.

**Q4: How much design thinking has happened?**
Have you sketched the architecture? Or are you hoping the agent will figure out what to build? Be honest — it changes the plan.

### Phase 1: Deep Research (unchanged from original)

Proceed with codebase exploration, architecture analysis, and documented findings per the original skill.

### Phase 2: Plan Formulation (enhanced)

Formulate the plan per the original skill, then add:

#### 2.5: Specification Quality Gate

Before presenting the plan for confirmation, verify:

```markdown
## Specification Quality Check

| Check | Status | Notes |
|-------|--------|-------|
| **Observable success criteria** | ✅/🚨 | Can you run a command that proves each criterion? |
| **No implementation in the spec** | ✅/🚨 | Are you specifying WHAT, not HOW? |
| **Scoped tightly** | ✅/🚨 | Could an agent reasonably interpret this as license to touch unrelated code? |
| **Context sufficient** | ✅/🚨 | Does an agent have enough info to start without asking 10 questions? |
| **Rollback path clear** | ✅/🚨 | If this goes wrong, how do you get back? |
```

If any check fails, refine before presenting.

#### 2.7: Footgun Audit

Scan the plan for these patterns before requesting confirmation:

| Pattern | Check | Status |
|---------|-------|--------|
| **Vague Success Criteria** | Would you "know it when you see it" or can you test it? | |
| **Missing Design Phase** | Is the plan solving a well-understood problem or hoping the agent figures out what to build? | |
| **Scope Creep Risk** | Could the agent reasonably wander beyond the intended scope? | |
| **Abstraction Bloat** | Does the plan encourage unnecessary complexity? Agents love adding abstractions you didn't ask for. | |
| **No Checkpoint Strategy** | If implementation runs for an hour and produces garbage, is progress saved? | |
| **Wrong Tool** | Is Deep Plan Mode even the right approach, or would 20 minutes of focused human work be faster? | |

**Overall Risk: [Low / Medium / High / Reconsider]**

Include the footgun audit results in the plan confirmation request.

### Phase 3: Confirmed Implementation (enhanced)

Add to the original confirmation block:

```markdown
---

## PLAN REVIEW REQUIRED

[Original confirmation content...]

### Footgun Audit Results
- **Overall Risk**: [Level]
- **Issues Found**: [N] ([list critical ones])
- **Mitigations Applied**: [what was tightened]

### Specification Quality
- Observable success criteria: ✅
- Tight scope: ✅
- Sufficient context: ✅
- Clear rollback: ✅

**Reply with:** `proceed` | `modify: [feedback]` | `abort`

---
```

### Phase 4: Implementation with Loop Design (NEW)

For complex implementations, add iteration structure:

```markdown
## Implementation Loop

### Iteration Cycle
1. Implement next step from approved plan
2. Run verification commands
3. If tests pass: commit and proceed to next step
4. If tests fail: adjust and retry (max 3 retries per step)

### Stuck Detection
- Same test failure 3 consecutive attempts → stop, report, ask for guidance
- Implementation diverging from plan → stop, flag divergence, request re-confirmation

### Checkpoint Strategy
- Commit after each successful step
- WIP commit before any risky change
- Never proceed past a failed step without resolution
```

---

## Relationship to Original Skill

This v2 **wraps** the original Deep Plan Mode with pre-plan discovery (Phase 0), specification quality gates (Phase 2.5), footgun audit (Phase 2.7), and implementation loop design (Phase 4). The original's research and plan formulation phases are unchanged.

---

*Skill Version: 2.0*
*Last Updated: February 2026*
*Methodology: Adapted from "The Six Weeks That Changed Software" companion prompts*
