#!/bin/bash
# Control the autonomous loop daemon
# Usage: loop-ctl.sh [start|stop|status|run-now|logs]

PLIST="$HOME/.remote/@autoresearch/scripts/com.autoresearch.loop.plist"
LABEL="com.autoresearch.loop"
LOG_DIR="$HOME/.local/share/tmux-logs/autoresearch"

case "${1:-status}" in
    start)
        mkdir -p "$LOG_DIR"
        launchctl load "$PLIST"
        echo "✓ Autonomous loop started (every 12 hours)"
        echo "  Next run: $(date -v+12H '+%Y-%m-%d %H:%M')"
        ;;
    stop)
        launchctl unload "$PLIST" 2>/dev/null
        echo "✓ Autonomous loop stopped"
        ;;
    status)
        if launchctl list | grep -q "$LABEL"; then
            echo "● RUNNING — $LABEL"
            LAST_LOG=$(ls -t "$LOG_DIR"/*/loop-*.log 2>/dev/null | head -1)
            if [ -n "$LAST_LOG" ]; then
                echo "  Last run: $(stat -f '%Sm' "$LAST_LOG" 2>/dev/null)"
                echo "  Log: $LAST_LOG"
            fi
        else
            echo "○ STOPPED — not loaded"
        fi
        ;;
    run-now)
        echo "Running autonomous loop now..."
        bash "$HOME/.remote/@autoresearch/scripts/autonomous-loop.sh"
        ;;
    logs)
        LAST_LOG=$(ls -t "$LOG_DIR"/*/loop-*.log 2>/dev/null | head -1)
        if [ -n "$LAST_LOG" ]; then
            echo "Latest log: $LAST_LOG"
            cat "$LAST_LOG"
        else
            echo "No logs found"
        fi
        ;;
    *)
        echo "Usage: loop-ctl.sh [start|stop|status|run-now|logs]"
        ;;
esac
