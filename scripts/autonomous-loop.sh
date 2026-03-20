#!/bin/bash
# Autonomous Skill Improvement + Want Loop
# Runs via launchd every 12 hours
# Logs to ~/.local/share/tmux-logs/autoresearch/
# ALERTS on failure via macOS notification + Resend email

set -uo pipefail  # removed -e so we can trap errors

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

# ─── ALWAYS send completion report ────────────────────────────────────────────
DURATION=$((SECONDS))
COST=$(grep -o 'Total spent: \$[0-9.]*' "$LOG_FILE" 2>/dev/null | tail -1 | grep -o '[0-9.]*' || echo '0.00')
SKILL_COUNT=$(grep -c 'last run:' "$LOG_FILE" 2>/dev/null || echo '?')
KEPT_COUNT=$(grep -c 'KEPT' "$LOG_FILE" 2>/dev/null || echo '0')
BASELINE_COUNT=$(grep -c 'BASELINE' "$LOG_FILE" 2>/dev/null || echo '0')
REVERTED_COUNT=$(grep -c 'REVERTED' "$LOG_FILE" 2>/dev/null || echo '0')
STUCK_COUNT_FINAL=$(grep -c 'STUCK' "$LOG_FILE" 2>/dev/null || echo '0')
PROMO_COUNT=$(grep -c 'Promotion-ready' "$LOG_FILE" 2>/dev/null || echo '0')
OPTIMIZED_SKILL=$(grep 'Optimizing:' "$LOG_FILE" 2>/dev/null | head -1 | sed 's/.*Optimizing: //' | sed 's/ (.*//')
BEST_SCORE=$(grep 'Final best score:' "$LOG_FILE" 2>/dev/null | grep -o '[0-9]*/[0-9]*' || echo '?')
STATUS_ICON=$([ "$ERRORS_FOUND" -gt 0 ] && echo "⚠" || echo "✓")

# Build clean report
REPORT="${STATUS_ICON} AUTORESEARCH LOOP REPORT"
REPORT+="\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
REPORT+="\n"
REPORT+="\n  Timestamp:  $(date '+%Y-%m-%d %H:%M %Z')"
REPORT+="\n  Duration:   ${DURATION}s"
REPORT+="\n  Cost:       \$${COST}"
REPORT+="\n  Errors:     ${ERRORS_FOUND}"
REPORT+="\n"
REPORT+="\n━ SKILL OPTIMIZED ━━━━━━━━━━━━━━━━━━"
REPORT+="\n"
REPORT+="\n  Skill:      ${OPTIMIZED_SKILL:-none}"
REPORT+="\n  Best Score: ${BEST_SCORE}"
REPORT+="\n  Kept:       ${KEPT_COUNT}  |  Reverted: ${REVERTED_COUNT}  |  Baseline: ${BASELINE_COUNT}"
[ "$STUCK_COUNT_FINAL" -gt 0 ] && REPORT+="\n  ⚠ Stuck:    ${STUCK_COUNT_FINAL} (escalated to Gemini)"
REPORT+="\n"
REPORT+="\n━ FLEET STATUS ━━━━━━━━━━━━━━━━━━━━━"
REPORT+="\n"
REPORT+="\n  Skills tracked:      ${SKILL_COUNT}"
REPORT+="\n  Promotion-ready:     ${PROMO_COUNT}"

# Top 5 skills by score
REPORT+="\n"
REPORT+="\n  Top performers:"
grep 'last run:' "$LOG_FILE" 2>/dev/null | grep -v '0/1' | sort -t'(' -k2 -rn | head -5 | while read line; do
    name=$(echo "$line" | awk '{print $1}')
    score=$(echo "$line" | grep -o '[0-9]*/[0-9]*' | head -1)
    pct=$(echo "$line" | grep -o '([0-9.]*%)' | head -1)
    REPORT_LINE="    ${name}: ${score} ${pct}"
    echo "$REPORT_LINE"
done > /tmp/top_performers.txt
REPORT+="\n$(cat /tmp/top_performers.txt 2>/dev/null)"

# Skills still at 0
ZERO_COUNT=$(grep 'last run:' "$LOG_FILE" 2>/dev/null | grep '0/1' | wc -l | tr -d ' ')
REPORT+="\n"
REPORT+="\n  Awaiting baseline:   ${ZERO_COUNT} skills"
REPORT+="\n"
REPORT+="\n━ PROMOTIONS READY ━━━━━━━━━━━━━━━━━"
REPORT+="\n"
grep 'Promotion-ready' -A20 "$LOG_FILE" 2>/dev/null | grep ':' | head -5 | while read line; do
    echo "  $line"
done > /tmp/promos.txt
REPORT+="\n$(cat /tmp/promos.txt 2>/dev/null)"
REPORT+="\n"
REPORT+="\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
REPORT+="\nLog: ${LOG_FILE}"

# macOS notification
osascript -e "display notification \"${OPTIMIZED_SKILL}: ${BEST_SCORE} | \$${COST} | ${KEPT_COUNT} kept\" with title \"Autoresearch ${STATUS_ICON}\" sound name \"$([ "$ERRORS_FOUND" -gt 0 ] && echo "Basso" || echo "Glass")\"" 2>/dev/null || true

# Email report
RESEND_KEY=$(cat "/usr/local/etc/autoresearch-credentials/resend-api-key.txt" 2>/dev/null || echo "")
if [ -n "$RESEND_KEY" ]; then
    SUBJECT="${STATUS_ICON} Autoresearch | ${OPTIMIZED_SKILL}: ${BEST_SCORE} | \$${COST} | ${KEPT_COUNT} kept | $(date +%H:%M)"
    EMAIL_BODY=$(echo -e "$REPORT" | sed 's/"/\\"/g' | tr '\n' '~' | sed 's/~/\\n/g')
    curl -sf -X POST https://api.resend.com/emails \
        -H "Authorization: Bearer $RESEND_KEY" \
        -H "Content-Type: application/json" \
        -d "{
            \"from\": \"Autoresearch <alerts@micropaymnts.ai>\",
            \"to\": \"ramene.anthony@gmail.com\",
            \"subject\": \"$SUBJECT\",
            \"text\": \"$EMAIL_BODY\"
        }" >/dev/null 2>&1 && echo "  → Report emailed" || echo "  → Email failed (non-critical)"
fi

echo ""
if [ "$ERRORS_FOUND" -gt 0 ]; then
    echo "═══ Loop Complete WITH $ERRORS_FOUND ERROR(S) — $(date) ═══"
else
    echo "═══ Loop Complete ✓ — $(date) ═══"
fi
echo "Log: $LOG_FILE"
