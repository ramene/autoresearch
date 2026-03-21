#!/bin/bash
# Email Watchdog — runs every hour, checks if the last cron run sent an email
# If not, sends an alert. This is the safety net for the safety net.

LOG_DIR="$HOME/.local/share/tmux-logs/autoresearch"
CRED="/usr/local/etc/autoresearch-credentials/resend-api-key.txt"
NODE="/Users/ramene/.nvm/versions/node/v23.11.1/bin/node"
WATCHDOG_STATE="/tmp/email-watchdog-last-check"

# Find the most recent loop log
LATEST=$(ls -t "$LOG_DIR"/2026-03-*/loop-*.log 2>/dev/null | head -1)
[ -z "$LATEST" ] && exit 0

# Check if we already verified this log
LAST_CHECKED=$(cat "$WATCHDOG_STATE" 2>/dev/null || echo "none")
[ "$LATEST" = "$LAST_CHECKED" ] && exit 0

# Check if the log has "Report emailed" or "EMAIL TRAP"
if grep -q "Report emailed\|EMAIL TRAP" "$LATEST" 2>/dev/null; then
    echo "$LATEST" > "$WATCHDOG_STATE"
    exit 0
fi

# Check if the loop is still running (log is being written to)
LOG_AGE=$(( $(date +%s) - $(stat -f %m "$LATEST" 2>/dev/null || echo 0) ))
[ "$LOG_AGE" -lt 900 ] && exit 0  # Less than 15 min old — still running

# EMAIL MISSED — send watchdog alert
RESEND_KEY=$(cat "$CRED" 2>/dev/null || exit 0)
SKILL=$(grep 'Optimizing:' "$LATEST" 2>/dev/null | head -1 | sed 's/.*Optimizing: //' | sed 's/ (.*//' || echo "unknown")
SCORE=$(grep 'Final best' "$LATEST" 2>/dev/null | grep -o '[0-9]*/[0-9]*' || echo "?")

$NODE -e "
const key = require('fs').readFileSync('$CRED', 'utf8').trim();
fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    from: 'Watchdog <alerts@micropaymnts.ai>',
    to: 'ramene.anthony@gmail.com',
    subject: '🚨 WATCHDOG: Cron email MISSED — $SKILL: $SCORE',
    text: 'The email watchdog detected that the last cron run did NOT send its report email.\n\nLog: $LATEST\nSkill: $SKILL\nScore: $SCORE\n\nThis is the watchdog catching what the main loop missed.\nTimestamp: ' + new Date().toISOString()
  })
}).then(r => r.json()).then(d => console.log('Watchdog email: ' + (d.id || JSON.stringify(d))));
" 2>&1

# Also macOS notification
osascript -e 'display notification "Cron email missed — watchdog sent alert" with title "🚨 Email Watchdog" sound name "Sosumi"' 2>/dev/null

echo "$LATEST" > "$WATCHDOG_STATE"
