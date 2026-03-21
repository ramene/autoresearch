#!/bin/bash
# Autonomous Skill Improvement + Want Loop
# Runs via launchd every 8 hours
# Logs to ~/.local/share/tmux-logs/autoresearch/
# ALERTS on failure via macOS notification + Resend email
# Email sent via EXIT TRAP — fires no matter what, even on crash

set +e  # DO NOT exit on error — we handle errors ourselves
set +o pipefail  # DO NOT kill on pipe failures

AUTORESEARCH_DIR="$HOME/.remote/@autoresearch"
OPENCLAW_DIR="$HOME/.remote/@openclaw-integration"
LOG_DIR="$HOME/.local/share/tmux-logs/autoresearch"
DATE=$(date +%Y-%m-%d)
TIME=$(date +%H%M%S)
LOG_FILE="$LOG_DIR/$DATE/loop-$TIME.log"
ERRORS_FOUND=0
ERROR_DETAILS=""

mkdir -p "$LOG_DIR/$DATE"

exec > >(tee -a "$LOG_FILE") 2>&1

# ─── EXIT TRAP: Email fires NO MATTER WHAT — crash, error, success ────────────
cleanup_and_report() {
    echo ""
    echo "═══ Sending report via EXIT trap ═══"
    osascript -e "display notification \"Loop finished\" with title \"Autoresearch\" sound name \"Glass\"" 2>/dev/null || true
    /Users/ramene/.nvm/versions/node/v23.11.1/bin/node "$AUTORESEARCH_DIR/scripts/send-report.mjs" "$LOG_FILE" 2>&1 || echo "EMAIL TRAP FAILED"
    echo "═══ Loop Complete — $(date) ═══"
    echo "Log: $LOG_FILE"
}
trap cleanup_and_report EXIT SIGTERM SIGINT SIGHUP

# ─── Failure Alerting ─────────────────────────────────────────────────────────
alert_failure() {
    local msg="$1"
    ERRORS_FOUND=$((ERRORS_FOUND + 1))
    ERROR_DETAILS="${ERROR_DETAILS}\n- ${msg}"
    echo "⚠ ERROR: $msg"

    # macOS notification (always works, no external deps)
    osascript -e "display notification \"$msg\" with title \"Autoresearch Loop FAILED\" sound name \"Basso\"" 2>/dev/null || true
}

send_error_summary() {
    if [ "$ERRORS_FOUND" -gt 0 ]; then
        echo ""
        echo "═══ ERRORS DETECTED: $ERRORS_FOUND ═══"
        echo -e "$ERROR_DETAILS"
        echo "Log: $LOG_FILE"

        # macOS notification with full summary
        osascript -e "display notification \"$ERRORS_FOUND error(s) in autonomous loop. Check $LOG_FILE\" with title \"Autoresearch ALERT\" sound name \"Sosumi\"" 2>/dev/null || true

        # Try Resend email alert (if key readable)
        RESEND_KEY=$(cat "/usr/local/etc/autoresearch-credentials/resend-api-key.txt" 2>/dev/null || echo "")
        if [ -n "$RESEND_KEY" ]; then
            curl -sf -X POST https://api.resend.com/emails \
                -H "Authorization: Bearer $RESEND_KEY" \
                -H "Content-Type: application/json" \
                -d "{
                    \"from\": \"alerts@micropaymnts.ai\",
                    \"to\": \"ramene.anthony@gmail.com\",
                    \"subject\": \"⚠ Autoresearch Loop: $ERRORS_FOUND error(s) — $(date +%Y-%m-%d)\",
                    \"text\": \"Autonomous loop encountered $ERRORS_FOUND error(s):\\n$(echo -e "$ERROR_DETAILS")\\n\\nLog: $LOG_FILE\\nTime: $(date)\"
                }" >/dev/null 2>&1 && echo "  → Error email sent" || echo "  → Email alert failed (non-critical)"
        fi
    fi
}

# ─── Pre-flight credential check ──────────────────────────────────────────────
echo "═══ Autonomous Loop — $(date) ═══"
echo ""
echo "--- Pre-flight ---"
for cred in gemini-api-key.txt anthropic-api-key.txt; do
    if [ ! -r "/usr/local/etc/autoresearch-credentials/$cred" ]; then
        alert_failure "Cannot read credential: $cred"
    else
        echo "  ✓ $cred readable"
    fi
done

if [ "$ERRORS_FOUND" -gt 0 ]; then
    send_error_summary
    exit 1
fi

# Step 1: Run the skill scheduler (picks weakest, runs 5 rounds)
echo ""
echo "--- Step 1: Skill Scheduler ---"
cd "$AUTORESEARCH_DIR"
node skills/skill-scheduler.mjs --budget 0.50 --rounds 5 2>&1 || alert_failure "Skill scheduler failed (exit $?)"

# Step 2: Check promotions
echo ""
echo "--- Step 2: Promotion Check ---"
node skills/promotion-pipeline.mjs --list 2>&1 || true

# Step 2.5: Board Sync — update GitHub Project #19 with skill lifecycle
echo ""
echo "--- Step 2.5: Board Sync ---"
node skills/board-sync.mjs 2>&1 || true

# Step 3: Run reflection loop (check if wants were satisfied)
echo ""
echo "--- Step 3: Reflection ---"
node skills/reflection-loop.mjs 2>&1 || true

# Step 4: Want loop (weekly — check if 7 days since last run)
WANTS_FILE="$AUTORESEARCH_DIR/wants.json"
WANT_LOOP_NEEDED=false
if [ ! -f "$WANTS_FILE" ]; then
    WANT_LOOP_NEEDED=true
elif [ "$(find "$WANTS_FILE" -mtime +2 2>/dev/null)" ]; then
    WANT_LOOP_NEEDED=true
fi

# Also trigger if 3+ stuck escalations since last want run
STUCK_COUNT=0
for events_file in "$AUTORESEARCH_DIR"/skills/working-*/events.jsonl; do
    if [ -f "$events_file" ]; then
        SC=$(grep -c "stuck_escalation" "$events_file" 2>/dev/null || true)
        STUCK_COUNT=$((STUCK_COUNT + ${SC:-0}))
    fi
done
if [ "$STUCK_COUNT" -ge 3 ]; then
    WANT_LOOP_NEEDED=true
    echo "Triggered by $STUCK_COUNT stuck escalations"
fi

if [ "$WANT_LOOP_NEEDED" = true ]; then
    echo ""
    echo "--- Step 4: Want Loop (self-model → world-model → wants) ---"
    node skills/self-model-builder.mjs 2>&1 || true
    node skills/world-model-builder.mjs 2>&1 || true
    node skills/want-engine.mjs 2>&1 || true

    # Check for actionable wants — notify but don't auto-create
    ACTIONABLE=$(jq '[.wants[] | select(.status == "actionable")] | length' "$WANTS_FILE" 2>/dev/null || echo 0)
    if [ "$ACTIONABLE" -gt 0 ]; then
        echo "⚠ $ACTIONABLE actionable wants detected — review wants.json"
        # Could run: node skills/skill-genesis.mjs --dry-run
        node skills/skill-genesis.mjs --dry-run 2>&1 || true
    fi
else
    echo ""
    echo "--- Step 4: Want Loop — skipped (last run < 7 days, $STUCK_COUNT stuck) ---"
fi

# ─── Send error summary if any step failed ───────────────────────────────────
send_error_summary

# Email + notification handled by EXIT trap (cleanup_and_report)
# This fires even if the script crashes, gets killed, or any step fails
