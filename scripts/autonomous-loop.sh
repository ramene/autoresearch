#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# AUTONOMOUS LOOP — Self-Healing, Self-Reporting
# ═══════════════════════════════════════════════════════════════════════════════
# Cloud Foundry / BOSH style: health checks are INSIDE the process.
# Every step: execute → health check → on failure: diagnose → fix → retry
# On persistent failure: quarantine step, continue remaining steps.
# EXIT trap guarantees report delivery no matter what.

set +e
set +o pipefail

NODE="/Users/ramene/.nvm/versions/node/v23.11.1/bin/node"
AUTORESEARCH_DIR="$HOME/.remote/@autoresearch"
CRED_DIR="/usr/local/etc/autoresearch-credentials"
LOG_DIR="$HOME/.local/share/tmux-logs/autoresearch"
DATE=$(date +%Y-%m-%d)
TIME=$(date +%H%M%S)
LOG_FILE="$LOG_DIR/$DATE/loop-$TIME.log"

# ─── Run state (collected throughout, used in report) ─────────────────────────
STEP_RESULTS=()     # "step_name|status|detail"
ERRORS_FOUND=0
FIXES_APPLIED=0
RETRIES=0
START_EPOCH=$(date +%s)

mkdir -p "$LOG_DIR/$DATE"
exec > >(tee -a "$LOG_FILE") 2>&1

# ─── EXIT TRAP: Rich report fires NO MATTER WHAT ─────────────────────────────
send_final_report() {
    local duration=$(( $(date +%s) - START_EPOCH ))
    # Write Loop Complete BEFORE sending report so duration regex can match
    echo ""
    echo "═══ Loop Complete — $(date) | ${duration}s | ${ERRORS_FOUND} errors | ${FIXES_APPLIED} fixes ═══"
    echo ""
    echo "═══ Sending report ═══"
    "$NODE" "$AUTORESEARCH_DIR/scripts/send-report.mjs" "$LOG_FILE" 2>&1 || \
        echo "EXIT TRAP: send-report.mjs failed — trying direct curl"

    # Fallback: if Node fails, raw curl (ugly but it gets through)
    if ! grep -q "Report emailed" "$LOG_FILE" 2>/dev/null; then
        local key=$(cat "$CRED_DIR/resend-api-key.txt" 2>/dev/null)
        if [ -n "$key" ]; then
            local subj="Autoresearch $(date +%H:%M) | ${duration}s | ${ERRORS_FOUND} errors | ${FIXES_APPLIED} fixes"
            curl -sf -X POST https://api.resend.com/emails \
                -H "Authorization: Bearer $key" \
                -H "Content-Type: application/json" \
                -d "{\"from\":\"Autoresearch <alerts@micropaymnts.ai>\",\"to\":\"ramene.anthony@gmail.com\",\"subject\":\"$subj\",\"text\":\"Fallback email. Log: $LOG_FILE\"}" \
                >/dev/null 2>&1 && echo "→ Fallback email sent" || echo "→ ALL EMAIL METHODS FAILED"
        fi
    fi

    osascript -e "display notification \"${duration}s | ${ERRORS_FOUND} errors | ${FIXES_APPLIED} fixes\" with title \"Autoresearch $([ $ERRORS_FOUND -gt 0 ] && echo '⚠' || echo '✓')\" sound name \"$([ $ERRORS_FOUND -gt 0 ] && echo 'Basso' || echo 'Glass')\"" 2>/dev/null || true
}
trap send_final_report EXIT SIGTERM SIGINT SIGHUP

# ─── Self-healing step runner ─────────────────────────────────────────────────
# Usage: run_step "Step Name" "command" [max_retries]
# On failure: diagnoses, attempts fix, retries. On persistent failure: continues.
run_step() {
    local step_name="$1"
    local cmd="$2"
    local max_retries="${3:-1}"
    local attempt=0

    echo ""
    echo "--- $step_name ---"

    while [ "$attempt" -le "$max_retries" ]; do
        if [ "$attempt" -gt 0 ]; then
            echo "  ↻ Retry $attempt/$max_retries after self-heal"
            RETRIES=$((RETRIES + 1))
        fi

        # Execute
        eval "$cmd" 2>&1
        local exit_code=$?

        if [ "$exit_code" -eq 0 ]; then
            STEP_RESULTS+=("$step_name|✓|completed")
            return 0
        fi

        # ─── DIAGNOSE + FIX ───────────────────────────────────────────────
        echo "  ⚠ $step_name failed (exit $exit_code) — diagnosing..."

        # Check EPERM
        if tail -20 "$LOG_FILE" 2>/dev/null | grep -q "EPERM"; then
            echo "  → Diagnosis: EPERM on credentials"
            xattr -cr "$CRED_DIR/" 2>/dev/null
            chmod 644 "$CRED_DIR"/*.txt "$CRED_DIR"/*.json 2>/dev/null
            echo "  → Fix: cleared xattrs + reset permissions"
            FIXES_APPLIED=$((FIXES_APPLIED + 1))
        fi

        # Check claude not found
        if tail -20 "$LOG_FILE" 2>/dev/null | grep -q "claude: command not found"; then
            echo "  → Diagnosis: claude CLI not in PATH"
            if ! grep -q "$NODE" "$AUTORESEARCH_DIR/skills/autoresearch-runner.mjs" 2>/dev/null; then
                sed -i '' "s|claude --print|$NODE/../claude --print|g" "$AUTORESEARCH_DIR/skills/autoresearch-runner.mjs" 2>/dev/null
                echo "  → Fix: patched absolute claude path"
                FIXES_APPLIED=$((FIXES_APPLIED + 1))
            fi
        fi

        # Check corrupted rounds.json
        if tail -20 "$LOG_FILE" 2>/dev/null | grep -q "rounds.push is not a function"; then
            echo "  → Diagnosis: corrupted rounds.json"
            for rfile in "$AUTORESEARCH_DIR"/skills/working-*/rounds.json; do
                [ -f "$rfile" ] && [ "$(head -c 1 "$rfile" 2>/dev/null)" != "[" ] && echo '[]' > "$rfile"
            done
            echo "  → Fix: reset corrupted rounds.json files"
            FIXES_APPLIED=$((FIXES_APPLIED + 1))
        fi

        # Check ETIMEDOUT
        if tail -20 "$LOG_FILE" 2>/dev/null | grep -q "ETIMEDOUT"; then
            echo "  → Diagnosis: CLI timeout"
            echo "  → Note: skill may be too large — will try anyway on retry"
        fi

        attempt=$((attempt + 1))
    done

    # Persistent failure — quarantine and continue
    ERRORS_FOUND=$((ERRORS_FOUND + 1))
    STEP_RESULTS+=("$step_name|✗|failed after $max_retries retries")
    echo "  ✗ $step_name quarantined — continuing remaining steps"
    return 1
}

# ═══════════════════════════════════════════════════════════════════════════════
# EXECUTION
# ═══════════════════════════════════════════════════════════════════════════════

echo "═══ Autonomous Loop — $(date) ═══"
echo "Mode: self-healing | Log: $LOG_FILE"

# ─── Pre-flight ───────────────────────────────────────────────────────────────
echo ""
echo "--- Pre-flight ---"
PREFLIGHT_OK=true
for cred in gemini-api-key.txt anthropic-api-key.txt resend-api-key.txt; do
    if [ ! -r "$CRED_DIR/$cred" ]; then
        echo "  ✗ $cred unreadable — attempting fix"
        xattr -cr "$CRED_DIR/" 2>/dev/null
        chmod 644 "$CRED_DIR"/*.txt "$CRED_DIR"/*.json 2>/dev/null
        FIXES_APPLIED=$((FIXES_APPLIED + 1))
        if [ ! -r "$CRED_DIR/$cred" ]; then
            echo "  ✗ $cred STILL unreadable after fix"
            PREFLIGHT_OK=false
            ERRORS_FOUND=$((ERRORS_FOUND + 1))
        else
            echo "  ✓ $cred fixed + readable"
        fi
    else
        echo "  ✓ $cred"
    fi
done

if [ "$PREFLIGHT_OK" = false ]; then
    echo "Pre-flight FAILED — exiting (EXIT trap will send report)"
    exit 1
fi

cd "$AUTORESEARCH_DIR"

# ─── Step 1: Skill Scheduler (with self-healing retry) ───────────────────────
run_step "Step 1: Skill Scheduler" \
    "$NODE skills/skill-scheduler.mjs --budget 0.50 --rounds 5" \
    2  # retry up to 2 times

# ─── Step 2: Promotion Check ─────────────────────────────────────────────────
run_step "Step 2: Promotion Check" \
    "$NODE skills/promotion-pipeline.mjs --list"

# ─── Step 2.5: Board Sync ────────────────────────────────────────────────────
run_step "Step 2.5: Board Sync" \
    "$NODE skills/board-sync.mjs"

# ─── Step 3: Reflection ──────────────────────────────────────────────────────
run_step "Step 3: Reflection" \
    "$NODE skills/reflection-loop.mjs"

# ─── Step 4: Want Loop (bi-daily or on 3+ stuck escalations) ─────────────────
WANTS_FILE="$AUTORESEARCH_DIR/wants.json"
WANT_LOOP_NEEDED=false

if [ ! -f "$WANTS_FILE" ]; then
    WANT_LOOP_NEEDED=true
elif [ "$(find "$WANTS_FILE" -mtime +2 2>/dev/null)" ]; then
    WANT_LOOP_NEEDED=true
fi

STUCK_COUNT=0
for events_file in "$AUTORESEARCH_DIR"/skills/working-*/events.jsonl; do
    if [ -f "$events_file" ]; then
        SC=$(grep -c "stuck_escalation" "$events_file" 2>/dev/null || true)
        STUCK_COUNT=$((STUCK_COUNT + ${SC:-0}))
    fi
done
[ "$STUCK_COUNT" -ge 3 ] && WANT_LOOP_NEEDED=true && echo "Want loop triggered by $STUCK_COUNT stuck escalations"

if [ "$WANT_LOOP_NEEDED" = true ]; then
    run_step "Step 4a: Self-Model" "$NODE skills/self-model-builder.mjs"
    run_step "Step 4b: World-Model" "$NODE skills/world-model-builder.mjs"
    run_step "Step 4c: Want Engine" "$NODE skills/want-engine.mjs"

    ACTIONABLE=$(jq '[.wants[] | select(.status == "actionable")] | length' "$WANTS_FILE" 2>/dev/null || echo 0)
    if [ "$ACTIONABLE" -gt 0 ]; then
        echo "⚠ $ACTIONABLE actionable wants — dry run:"
        run_step "Step 4d: Skill Genesis (dry-run)" "$NODE skills/skill-genesis.mjs --dry-run"
    fi
else
    echo ""
    echo "--- Step 4: Want Loop — skipped (last run < 2 days, $STUCK_COUNT stuck) ---"
    STEP_RESULTS+=("Step 4: Want Loop|⊘|skipped")
fi

# ─── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo "═══ STEP SUMMARY ═══"
for result in "${STEP_RESULTS[@]}"; do
    IFS='|' read sname sstatus sdetail <<< "$result"
    echo "  $sstatus $sname — $sdetail"
done
echo ""
echo "Errors: $ERRORS_FOUND | Fixes: $FIXES_APPLIED | Retries: $RETRIES"

# EXIT trap fires here → sends report
