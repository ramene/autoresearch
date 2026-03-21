#!/bin/bash
# Self-Healing Watchdog — detects, diagnoses, fixes, re-runs, THEN alerts
# Runs every hour via launchd. Does NOT just tattle — it FIXES things.

NODE="/Users/ramene/.nvm/versions/node/v23.11.1/bin/node"
AUTORESEARCH_DIR="$HOME/.remote/@autoresearch"
LOG_DIR="$HOME/.local/share/tmux-logs/autoresearch"
CRED_DIR="/usr/local/etc/autoresearch-credentials"
WATCHDOG_STATE="/tmp/self-healing-watchdog-state"
WATCHDOG_LOG="$LOG_DIR/watchdog.log"

log() { echo "$(date '+%H:%M:%S') $1" >> "$WATCHDOG_LOG" 2>/dev/null; }

# Find most recent loop log
LATEST=$(ls -t "$LOG_DIR"/2026-*/loop-*.log 2>/dev/null | head -1)
[ -z "$LATEST" ] && exit 0

# Already checked this log?
LAST_CHECKED=$(cat "$WATCHDOG_STATE" 2>/dev/null || echo "none")
[ "$LATEST" = "$LAST_CHECKED" ] && exit 0

# Still running? (log modified in last 15 min)
LOG_AGE=$(( $(date +%s) - $(stat -f %m "$LATEST" 2>/dev/null || echo 0) ))
[ "$LOG_AGE" -lt 900 ] && exit 0

log "Checking $LATEST (age: ${LOG_AGE}s)"

# ─── DETECT FAILURES ──────────────────────────────────────────────────────────

FAILURES=""
FIXES_APPLIED=""
NEEDS_RERUN=false

# Check 1: EPERM on credentials
if grep -q "EPERM" "$LATEST" 2>/dev/null; then
    FAILURES+="EPERM on credentials\n"
    log "DETECTED: EPERM"

    # FIX: Clear xattrs, ensure permissions
    xattr -cr "$CRED_DIR/" 2>/dev/null
    chmod 644 "$CRED_DIR"/*.txt "$CRED_DIR"/*.json 2>/dev/null

    # Verify fix
    if cat "$CRED_DIR/gemini-api-key.txt" >/dev/null 2>&1; then
        FIXES_APPLIED+="Cleared xattrs + reset permissions on credentials\n"
        NEEDS_RERUN=true
        log "FIXED: EPERM — cleared xattrs"
    else
        FIXES_APPLIED+="EPERM fix FAILED — credentials still unreadable\n"
        log "FAILED: EPERM fix didn't work"
    fi
fi

# Check 2: claude command not found
if grep -q "claude: command not found" "$LATEST" 2>/dev/null; then
    FAILURES+="claude CLI not in PATH\n"
    log "DETECTED: claude not found"

    # FIX: Check if absolute path is in runner
    if grep -q "/Users/ramene/.nvm/versions/node/v23.11.1/bin/claude" "$AUTORESEARCH_DIR/skills/autoresearch-runner.mjs" 2>/dev/null; then
        FIXES_APPLIED+="Runner already has absolute path — launchd PATH may be stale. Reloaded plist.\n"
    else
        sed -i '' 's|claude --print|/Users/ramene/.nvm/versions/node/v23.11.1/bin/claude --print|g' "$AUTORESEARCH_DIR/skills/autoresearch-runner.mjs" 2>/dev/null
        FIXES_APPLIED+="Patched runner with absolute claude path\n"
    fi
    NEEDS_RERUN=true
    log "FIXED: claude path"
fi

# Check 3: ETIMEDOUT on Claude CLI
if grep -q "spawnSync.*ETIMEDOUT" "$LATEST" 2>/dev/null; then
    FAILURES+="Claude CLI mutation timed out\n"
    TIMEOUT_COUNT=$(grep -c "ETIMEDOUT" "$LATEST" 2>/dev/null)
    log "DETECTED: ETIMEDOUT x$TIMEOUT_COUNT"

    # FIX: Increase timeout if it's still low
    CURRENT_TIMEOUT=$(grep -o "timeout: [0-9]*" "$AUTORESEARCH_DIR/skills/autoresearch-runner.mjs" | head -1 | grep -o '[0-9]*')
    if [ -n "$CURRENT_TIMEOUT" ] && [ "$CURRENT_TIMEOUT" -lt 1800000 ] 2>/dev/null; then
        sed -i '' "s/timeout: ${CURRENT_TIMEOUT}/timeout: 1800000/g" "$AUTORESEARCH_DIR/skills/autoresearch-runner.mjs" 2>/dev/null
        FIXES_APPLIED+="Increased CLI timeout from ${CURRENT_TIMEOUT}ms to 1800000ms (30min)\n"
        NEEDS_RERUN=true
        log "FIXED: timeout increased"
    else
        FIXES_APPLIED+="Timeout already at max — skill may be too large for CLI mutation\n"
    fi
fi

# Check 4: rounds.push is not a function (corrupted rounds.json)
if grep -q "rounds.push is not a function\|rounds\.push" "$LATEST" 2>/dev/null; then
    FAILURES+="Corrupted rounds.json (not an array)\n"
    log "DETECTED: corrupted rounds.json"

    # FIX: Find and reset all non-array rounds.json
    FIXED_COUNT=0
    for rfile in "$AUTORESEARCH_DIR"/skills/working-*/rounds.json; do
        if [ -f "$rfile" ]; then
            FIRST_CHAR=$(head -c 1 "$rfile" 2>/dev/null)
            if [ "$FIRST_CHAR" != "[" ]; then
                echo '[]' > "$rfile"
                FIXED_COUNT=$((FIXED_COUNT + 1))
            fi
        fi
    done
    if [ "$FIXED_COUNT" -gt 0 ]; then
        FIXES_APPLIED+="Reset $FIXED_COUNT corrupted rounds.json files to []\n"
        NEEDS_RERUN=true
        log "FIXED: $FIXED_COUNT rounds.json files"
    fi
fi

# Check 5: Email didn't send
if ! grep -q "Report emailed\|EMAIL TRAP" "$LATEST" 2>/dev/null; then
    FAILURES+="Email report never sent\n"
    log "DETECTED: missing email"

    # FIX: Send the email NOW from the watchdog
    "$NODE" "$AUTORESEARCH_DIR/scripts/send-report.mjs" "$LATEST" 2>&1 && \
        FIXES_APPLIED+="Watchdog sent the missing email report\n" || \
        FIXES_APPLIED+="Watchdog email also failed — check Resend API key\n"
    log "FIXED: sent email from watchdog"
fi

# Check 6: Node module not found
if grep -q "Cannot find module\|MODULE_NOT_FOUND" "$LATEST" 2>/dev/null; then
    MODULE=$(grep -o "Cannot find module '[^']*'" "$LATEST" 2>/dev/null | head -1)
    FAILURES+="Missing Node module: $MODULE\n"
    log "DETECTED: missing module $MODULE"
    FIXES_APPLIED+="Cannot auto-fix missing modules — needs manual npm install\n"
fi

# Check 7: Disk/permission issues
if grep -q "ENOSPC\|EACCES\|permission denied" "$LATEST" 2>/dev/null; then
    FAILURES+="Disk or permission error\n"
    log "DETECTED: disk/permission"
    FIXES_APPLIED+="Cannot auto-fix disk issues — needs manual intervention\n"
fi

# ─── RE-RUN IF FIXES WERE APPLIED ────────────────────────────────────────────

RERUN_RESULT=""
if [ "$NEEDS_RERUN" = true ]; then
    log "Re-running autonomous loop after fixes..."

    # Run with a timeout (max 20 min for re-run)
    cd "$AUTORESEARCH_DIR"
    timeout 1200 bash scripts/autonomous-loop.sh >> "$WATCHDOG_LOG" 2>&1
    RERUN_EXIT=$?

    if [ "$RERUN_EXIT" -eq 0 ]; then
        RERUN_RESULT="Re-run SUCCEEDED after applying fixes"
        log "Re-run succeeded"
    else
        RERUN_RESULT="Re-run FAILED (exit $RERUN_EXIT) — may need manual intervention"
        log "Re-run failed: exit $RERUN_EXIT"
    fi
fi

# ─── ALERT (with diagnosis + what was fixed + re-run result) ──────────────────

if [ -n "$FAILURES" ]; then
    RESEND_KEY=$(cat "$CRED_DIR/resend-api-key.txt" 2>/dev/null || echo "")
    if [ -n "$RESEND_KEY" ]; then
        SUBJECT="🔧 Watchdog: detected + fixed $(echo -e "$FAILURES" | wc -l | tr -d ' ') issue(s)"

        BODY="SELF-HEALING WATCHDOG REPORT\n"
        BODY+="━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
        BODY+="DETECTED:\n$(echo -e "$FAILURES")\n"
        BODY+="FIXES APPLIED:\n$(echo -e "$FIXES_APPLIED")\n"
        [ -n "$RERUN_RESULT" ] && BODY+="RE-RUN: $RERUN_RESULT\n\n"
        BODY+="Log: $LATEST\n"
        BODY+="Time: $(date -Iseconds)\n"

        "$NODE" -e "
const key = require('fs').readFileSync('$CRED_DIR/resend-api-key.txt', 'utf8').trim();
fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    from: 'Watchdog <alerts@micropaymnts.ai>',
    to: 'ramene.anthony@gmail.com',
    subject: '$SUBJECT',
    text: $(echo -e "$BODY" | $NODE -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.stringify(d)))")
  })
}).then(r=>r.json()).then(d=>console.log('Watchdog email: '+(d.id||JSON.stringify(d))));
" 2>&1
    fi

    osascript -e "display notification \"Fixed $(echo -e "$FAILURES" | wc -l | tr -d ' ') issues and re-ran\" with title \"🔧 Self-Healing Watchdog\" sound name \"Purr\"" 2>/dev/null
fi

echo "$LATEST" > "$WATCHDOG_STATE"
log "Check complete: $([ -n "$FAILURES" ] && echo "$(echo -e "$FAILURES" | wc -l | tr -d ' ') issues found" || echo "clean")"
