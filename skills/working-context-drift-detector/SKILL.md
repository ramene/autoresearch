---
name: find-dead-references
description: "Scans CLAUDE.md and other context files for file or directory paths that no longer exist in the codebase. Use for requests like: 'are my docs up to date?', 'find dead references', 'check for stale files in my context', 'is CLAUDE.md accurate?', 'clean up my docs'."
allowed-tools:
  - Read
  - Grep
  - Bash
---

# Skill: Find Dead File/Directory References

> A simple and fast utility to find references in your documentation that point to non-existent files or directories — with severity classification, git-aware deletion history, and ready-to-run fix commands.

## ⚡ EXECUTE IMMEDIATELY

**When this skill is invoked, immediately run the following script using the Bash tool. Do not summarize or explain it first — just run it.**

```bash
CONTEXT_FILES=$(ls CLAUDE*.md 2>/dev/null)
if [ -z "$CONTEXT_FILES" ]; then
  echo "No CLAUDE.md or CLAUDE-*.md files found."
  exit 0
fi

echo "Scanning for dead references in: $CONTEXT_FILES"
echo "---"

# Load ignore patterns into an array for reliable multi-line handling
IGNORE_PATTERNS=()
if [ -f ".dead-refs-ignore" ]; then
  while IFS= read -r line; do
    # Skip comment lines and blank lines
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ -z "${line//[[:space:]]/}" ]] && continue
    IGNORE_PATTERNS+=("$line")
  done < .dead-refs-ignore
  echo "Loaded ${#IGNORE_PATTERNS[@]} ignore pattern(s) from .dead-refs-ignore"
fi

is_ignored() {
  local path="$1"
  local normalized="${path#./}"
  for pattern in "${IGNORE_PATTERNS[@]}"; do
    local norm_pattern="${pattern#./}"
    # Exact match
    [[ "$normalized" == "$norm_pattern" ]] && return 0
    # Glob match (unquoted RHS enables glob expansion)
    [[ "$normalized" == $norm_pattern ]] && return 0
    # Substring match
    [[ "$normalized" == *"$norm_pattern"* ]] && return 0
  done
  return 1
}

classify_severity() {
  local path="$1"
  if [[ "$path" =~ \.(sh|bash|zsh)$ ]] || [[ "$path" =~ (^|/)bin/ ]] || [[ "$path" =~ (^|/)scripts?/ ]]; then
    echo "CRITICAL"
  elif [[ "$path" =~ \.(json|yaml|yml|toml|env|ini|cfg)$ ]] || [[ "$path" =~ (Dockerfile|Makefile|docker-compose) ]]; then
    echo "HIGH"
  elif [[ "$path" =~ (^|/)(test|tests|spec|examples?|fixtures?|samples?)/ ]]; then
    echo "LOW"
  else
    echo "MEDIUM"
  fi
}

git_context() {
  local path="$1"
  local context=""
  if git rev-parse --is-inside-work-tree &>/dev/null 2>&1; then
    local del_commit
    del_commit=$(git log --diff-filter=D --format="%h %ad %s" --date=short -- "$path" 2>/dev/null | head -1)
    if [ -n "$del_commit" ]; then
      context="    git: deleted in commit $del_commit"
    fi
    local rename_commit
    rename_commit=$(git log --diff-filter=R --follow --format="%h %ad %s" --date=short -- "$path" 2>/dev/null | head -1)
    if [ -n "$rename_commit" ]; then
      local new_name
      new_name=$(git log --diff-filter=R --follow --name-status --format="" -- "$path" 2>/dev/null | grep "^R" | head -1 | awk '{print $3}')
      if [ -n "$new_name" ]; then
        context="${context}\n    git: may have been renamed to '$new_name' (commit $rename_commit)"
      fi
    fi
    if git ls-files --error-unmatch "$path" &>/dev/null 2>&1; then
      context="${context}\n    git: still in index (staged for deletion?)"
    fi
  fi
  echo "$context"
}

DEAD_CRITICAL=""
DEAD_HIGH=""
DEAD_MEDIUM=""
DEAD_LOW=""
DEAD_REFS=0

for FILE in $CONTEXT_FILES; do
  # Two-stage pipeline: first capture any token with valid path characters,
  # then filter to only strings containing a slash or dot (eliminating bare words),
  # then strip common trailing punctuation that may be accidentally captured.
  PATHS=$(grep -oE '([a-zA-Z0-9\._~\-\/]+)' "$FILE" | grep -E '\/|\.' | sed 's/[.,:;]$//' | sort -u)

  for path in $PATHS; do
    if [[ "$path" == http* ]]; then continue; fi
    if is_ignored "$path"; then continue; fi

    if [ ! -e "$path" ]; then
      SEVERITY=$(classify_severity "$path")
      GIT_CTX=$(git_context "$path")
      ESCAPED=$(printf '%s\n' "$path" | sed 's/[[\.*^$()+?{|]/\\&/g')
      FIX_CMD="sed -i '' '/\\b${ESCAPED}\\b/d' \"$FILE\""
      ENTRY="  [${SEVERITY}] '$path' (in $FILE)\n"
      if [ -n "$GIT_CTX" ]; then
        ENTRY="${ENTRY}${GIT_CTX}\n"
      fi
      ENTRY="${ENTRY}  FIX: $FIX_CMD\n"
      case "$SEVERITY" in
        CRITICAL) DEAD_CRITICAL="${DEAD_CRITICAL}${ENTRY}" ;;
        HIGH)     DEAD_HIGH="${DEAD_HIGH}${ENTRY}" ;;
        MEDIUM)   DEAD_MEDIUM="${DEAD_MEDIUM}${ENTRY}" ;;
        LOW)      DEAD_LOW="${DEAD_LOW}${ENTRY}" ;;
      esac
      DEAD_REFS=$((DEAD_REFS + 1))
    fi
  done
done

if [ -n "$DEAD_CRITICAL" ]; then
  echo "=== CRITICAL (broken automation) ==="
  printf "%b" "$DEAD_CRITICAL"
fi
if [ -n "$DEAD_HIGH" ]; then
  echo "=== HIGH (broken configs/builds) ==="
  printf "%b" "$DEAD_HIGH"
fi
if [ -n "$DEAD_MEDIUM" ]; then
  echo "=== MEDIUM (missing source/docs) ==="
  printf "%b" "$DEAD_MEDIUM"
fi
if [ -n "$DEAD_LOW" ]; then
  echo "=== LOW (missing examples/tests) ==="
  printf "%b" "$DEAD_LOW"
fi

echo "---"
if [ "$DEAD_REFS" -eq 0 ]; then
  echo "Scan complete. No dead references found."
else
  echo "Scan complete. Found $DEAD_REFS dead reference(s)."
  echo "Run the FIX commands above to remove dead lines, or apply all at once by copying each FIX line."
fi
```

After the script completes, present the output to the user and offer to apply any of the FIX commands shown.

## Purpose

This skill performs the most critical documentation health check: ensuring that every file path mentioned in `CLAUDE.md` and other context files actually exists. It helps clean up stale references after files have been moved, renamed, or deleted, classifies each dead reference by severity, uses git history to show *when* and *why* a file disappeared, and produces ready-to-run commands to remove the dead lines.

## Severity Classification

Each dead reference is classified by severity based on the type of file it points to:

- **CRITICAL** — Executable scripts, binaries, or sourced shell files (`.sh`, `.bash`, `.zsh`, files in `bin/`, `scripts/`). A missing script likely breaks automation.
- **HIGH** — Core configuration files, CI/CD definitions, Dockerfiles, or files explicitly marked as required (`.json`, `.yaml`, `.toml`, `.env`, `Dockerfile`, `Makefile`). Missing configs break builds or deployments.
- **MEDIUM** — Documentation files, README-style references, or general source files (`.md`, `.py`, `.js`, `.ts`, `.go`, `.rs`). Missing docs reduce usability but don't break execution.
- **LOW** — Example files, test fixtures, or loosely referenced paths (files in `examples/`, `test/`, `fixtures/`). Low-impact if missing.

## Git Integration

The skill uses git to provide richer context for each dead reference:

- **`git ls-files`** — Checks whether a path is tracked in the git index.
- **`git log --diff-filter=D`** — Finds the commit that last deleted the file.
- **Rename detection** — Uses `git log --diff-filter=R --follow` to check if a file was renamed.

## Ignore File Support

If a file named `.dead-refs-ignore` exists in the current directory, paths listed in it (one per line, `#` for comments) are excluded from the scan. Patterns are loaded into a bash array for reliable handling and support exact matches, glob patterns (`dist/*`), and substring matches.

Example `.dead-refs-ignore`:
```
# Generated at build time
dist/bundle.js
# Only exists in CI
/etc/secrets/token
```

## Example Output

```
=== MEDIUM (missing source/docs) ===
  [MEDIUM] 'src/utils/old_helper.py' (in CLAUDE.md)
    git: deleted in commit a3f92b1 2024-11-15 refactor: remove legacy helpers
  FIX: sed -i '' '/\bold_helper\.py\b/d' "CLAUDE.md"
---
Scan complete. Found 1 dead reference(s).
```