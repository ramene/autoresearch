---
name: context-drift-detector
description: "Detects and fixes drift between CLAUDE.md/memory bank files and actual codebase state. Use when asked to: check if CLAUDE.md is accurate, outdated, or stale; detect stale references or dead file paths; validate context files against git history; find undocumented new files; verify build commands still work; run a context or documentation health check; keep project context files honest; or sync documentation with codebase reality."
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
  - Edit
  - Write
  - AskUserQuestion
---

# Skill: Context Drift Detector

> Keeps CLAUDE.md and memory bank files honest by detecting drift from actual codebase state.

## Purpose

Over time, CLAUDE.md files accumulate references to files that have been deleted, build commands that no longer work, architecture descriptions that no longer match reality, and missing references to newly created files. This skill systematically detects and reports these drifts.

## When to Use

- After a major refactor or restructuring
- When starting a new session and wanting to verify context accuracy
- When CLAUDE.md hasn't been updated in multiple sessions
- As a periodic hygiene check (weekly or after significant changes)
- When onboarding to a project and wanting to trust the documentation

## How It Works

### Phase 1: Inventory Collection

1. **Parse CLAUDE.md** for all referenced paths, commands, and structural claims:
   - File paths (e.g., `src/commands.cpp`, `apps/web/.env.local`)
   - Directory references (e.g., `research/papers/`, `pipeline-output/`)
   - Build commands (e.g., `make test`, `npm run build`)
   - Architecture claims (e.g., "Entry: git-crypt.cpp → commands.cpp")
   - URL references (internal endpoints, API routes)
   - Environment variables referenced

2. **Scan memory bank files** (CLAUDE-activeContext.md, CLAUDE-patterns.md, etc.) for the same categories.

3. **Collect recent git history**:
   ```bash
   git log --oneline --name-status -50
   ```
   Extract: added files, deleted files, renamed files, modified files.

### Phase 2: Drift Detection

Run these checks against the collected inventory:

| Check | What It Detects | Severity |
|-------|----------------|----------|
| **Dead file refs** | CLAUDE.md references files that don't exist | HIGH |
| **Dead dir refs** | CLAUDE.md references directories that don't exist | HIGH |
| **Broken commands** | Build/test commands that fail when run | HIGH |
| **Undocumented files** | New files in key directories not mentioned in CLAUDE.md | MEDIUM |
| **Stale architecture** | Source files referenced in architecture section that were deleted/renamed | HIGH |
| **Orphaned memory** | Memory bank files reference deleted features or resolved issues | LOW |
| **Missing new patterns** | Recent commits introduce patterns not documented in CLAUDE-patterns.md | LOW |
| **Config drift** | Environment variables or config referenced but not in .env.example or actual env | MEDIUM |
| **URL drift** | Internal URLs/endpoints that return 404 or have changed | MEDIUM |

### Phase 3: Report Generation

Produce a structured drift report:

```markdown
# Context Drift Report — [project-name]
> Generated: [timestamp]
> Commits analyzed: [count]
> Files in CLAUDE.md: [count referenced] / [count verified]

## HIGH SEVERITY
- [ ] `src/old_module.cpp` — referenced in Architecture section but file deleted in commit abc1234
- [ ] `make legacy-test` — build command fails (exit code 2)

## MEDIUM SEVERITY
- [ ] `research/new-paper-notes.md` — added 3 commits ago, not referenced in CLAUDE.md
- [ ] `API_ENDPOINT` env var — referenced but not in any .env file

## LOW SEVERITY
- [ ] CLAUDE-activeContext.md references "Sprint 12 goals" but Sprint 14 is current
- [ ] CLAUDE-patterns.md missing pattern for new `trustless_*` file naming convention

## IGNORED (via .context-drift-ignore)
- `legacy/` directory — intentionally undocumented
```

### Phase 4: Fix Suggestions

For each HIGH severity issue, provide specific fix suggestions:

**Dead file references:**
- Remove the reference from CLAUDE.md if the file is no longer needed.
- Update the reference to point to the new file location if the file was moved or renamed.

**Broken commands:**
- Check the error message and output to determine why the command is failing.
- Update the command in CLAUDE.md to the correct version that works in the current environment.

**Stale architecture claims:**
- Review the changes that caused the referenced source files to be deleted or renamed.
- Update the architecture section in CLAUDE.md to reflect the current state of the codebase.

For MEDIUM severity issues:

**Undocumented files:**
- Add a reference to the new file in the relevant section of CLAUDE.md, explaining its purpose.
- If the file is part of a new feature, consider adding a high-level overview of the feature in CLAUDE.md.

**Config drift:**
- Update CLAUDE.md to include the missing environment variables or config settings.
- Add the missing entries to the .env.example file (or equivalent) to document the required configuration.

For LOW severity issues:

**Orphaned memory:**
- Review the referenced features or issues in the memory bank files and determine if they are still relevant.
- Update the memory bank files to reflect the current state of the project.

**Missing new patterns:**
- Add the new pattern documentation to CLAUDE-patterns.md, including examples and usage guidelines.

## .context-drift-ignore

Create a `.context-drift-ignore` file in the project root to suppress known intentional drift:

```
# Intentionally undocumented directories
legacy/
vendor/
node_modules/

# Files that exist but aren't worth documenting
*.tmp
*.bak

# Intentional dead references (kept for historical context)
# path:CLAUDE.md:old_feature_name
```

Format: one pattern per line. Supports glob patterns and `path:file:pattern` for specific suppressions.

## Execution Steps

```
1. Read CLAUDE.md and all CLAUDE-*.md files
2. Extract all file paths, directory paths, commands, URLs, env vars
3. Run `git log --oneline --name-status -50` for recent changes
4. For each extracted reference:
   a. File/dir paths → check existence with `ls` or `stat`
   b. Commands → dry-run or syntax check where safe
   c. URLs → skip (only flag if --check-urls flag provided)
   d. Env vars → check .env files and process.env references
5. Cross-reference git log: find new files not in CLAUDE.md
6. Load .context-drift-ignore if present, filter results
7. Generate drift report sorted by severity
8. For HIGH items, generate fix suggestions (see above)
9. Present report to user
10. If user approves, apply fixes
```

## Example Invocation

```
"Run context drift detection on this project"
"Check if CLAUDE.md is still accurate after the last 20 commits"
"Detect stale references in the memory bank files"
"Is my CLAUDE.md up to date?"
"Find dead file references in my context files"
"Validate my project documentation against the current codebase"
"Are there undocumented new files I should add to CLAUDE.md?"
```