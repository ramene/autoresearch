#!/bin/bash
# Autonomous Skill Improvement + Want Loop
# Runs via launchd every 12 hours
# Logs to ~/.local/share/tmux-logs/autoresearch/

set -euo pipefail

AUTORESEARCH_DIR="$HOME/.remote/@autoresearch"
OPENCLAW_DIR="$HOME/.remote/@openclaw-integration"
LOG_DIR="$HOME/.local/share/tmux-logs/autoresearch"
DATE=$(date +%Y-%m-%d)
TIME=$(date +%H%M%S)
LOG_FILE="$LOG_DIR/$DATE/loop-$TIME.log"

mkdir -p "$LOG_DIR/$DATE"

exec > >(tee -a "$LOG_FILE") 2>&1

echo "═══ Autonomous Loop — $(date) ═══"

# Step 1: Run the skill scheduler (picks weakest, runs 5 rounds)
echo ""
echo "--- Step 1: Skill Scheduler ---"
cd "$AUTORESEARCH_DIR"
node skills/skill-scheduler.mjs --budget 0.50 --rounds 5 2>&1 || echo "Scheduler exited: $?"

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
elif [ "$(find "$WANTS_FILE" -mtime +7 2>/dev/null)" ]; then
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

echo ""
echo "═══ Loop Complete — $(date) ═══"
echo "Log: $LOG_FILE"
