---
name: find-dead-references
description: "Scans CLAUDE.md and other context files for file or directory paths that no longer exist in the codebase. Use for requests like: 'are my docs up to date?', 'find dead references', 'check for stale files in my context', 'is CLAUDE.md accurate?', 'clean up my docs'."
allowed-tools:
  - Read
  - Grep
  - Bash
---

# Skill: Find Dead File/Directory References

> A simple and fast utility to find references in your documentation that point to non-existent files or directories — and generate the fix commands to clean them up.

## Purpose

This skill performs the most critical documentation health check: ensuring that every file path mentioned in `CLAUDE.md` and other context files actually exists. It helps clean up stale references after files have been moved, renamed, or deleted, and produces ready-to-run commands to remove the dead lines.

## How It Works

1.  **Identify Context Files:** The skill first looks for `CLAUDE.md` and any `CLAUDE-*.md` files in the current directory.
2.  **Extract Paths:** It uses `grep` and regular expressions to extract all strings that look like file or directory paths from these files.
3.  **Verify Existence:** For each extracted path, it uses the `[ -e "$path" ]` shell command to check if the file or directory actually exists on the filesystem.
4.  **Report Findings:** It produces a list of all the paths that were found in the documentation but do not exist, specifying which context file contained the dead reference.
5.  **Generate Fixes:** For each dead reference, it emits a `sed` command that removes the offending line from the context file, so you can apply fixes with a single copy-paste.

## Execution Steps

```bash
# 1. Find all context files
CONTEXT_FILES=$(ls CLAUDE*.md 2>/dev/null)
if [ -z "$CONTEXT_FILES" ]; then
  echo "No CLAUDE.md or CLAUDE-*.md files found."
  exit 0
fi

echo "Scanning for dead references in: $CONTEXT_FILES"
echo "---"

# 2. Grep for paths, check existence, report, and generate fix commands
DEAD_REFS=0
FIX_COMMANDS=""
for FILE in $CONTEXT_FILES; do
  # Regex to find file/dir paths.
  PATHS=$(grep -oE '([a-zA-Z0-9._-]+/)+[a-zA-Z0-9._-]+|[a-zA-Z0-9._-]+\.(js|ts|py|go|rs|md|cpp|h|java|sh|rb|html|css|json|yaml|toml)' "$FILE" | sort -u)

  for path in $PATHS; do
    # Skip checking URLs
    if [[ "$path" == http* ]]; then
      continue
    fi

    # Check if the file or directory exists
    if [ ! -e "$path" ]; then
      echo "DEAD REFERENCE: '$path' (found in $FILE)"
      # Generate a sed fix command to remove the line containing this path
      ESCAPED=$(printf '%s\n' "$path" | sed 's/[[\.*^$()+?{|]/\\&/g')
      FIX_CMD="sed -i '' '/\b${ESCAPED}\b/d' \"$FILE\""
      echo "  FIX: $FIX_CMD"
      DEAD_REFS=$((DEAD_REFS + 1))
    fi
  done
done

echo "---"
if [ "$DEAD_REFS" -eq 0 ]; then
  echo "Scan complete. No dead references found."
else
  echo "Scan complete. Found $DEAD_REFS dead reference(s)."
  echo ""
  echo "To remove all dead references, run the FIX commands listed above."
  echo "To apply all fixes at once, re-run this skill with --fix flag or copy each FIX line."
fi
```

## Example Invocation

User: "Check my docs for dead file references."
> AI executes this skill, finds that `src/utils/old_helper.py` is mentioned in `CLAUDE.md` but was deleted, reports the finding, and outputs:
> `FIX: sed -i '' '/\bold_helper\.py\b/d' "CLAUDE.md"`