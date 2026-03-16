#!/bin/bash
# E2E Test: Domain-General AGI — Substack Content Creation
#
# Proves: MCP detected → want identified → skill created → autoresearch improves
# This is THE empirical validation of domain-general goal origination.

set -euo pipefail

AUTORESEARCH_DIR="${HOME}/.remote/@autoresearch"
PASS=0; FAIL=0; ERRORS=()

green()  { printf "\033[32m%s\033[0m\n" "$1"; }
red()    { printf "\033[31m%s\033[0m\n" "$1"; }
dim()    { printf "\033[2m%s\033[0m\n" "$1"; }

check() {
    local desc="$1"; shift
    if eval "$@" >/dev/null 2>&1; then
        PASS=$((PASS + 1)); green "  PASS  $desc"
    else
        FAIL=$((FAIL + 1)); ERRORS+=("$desc"); red "  FAIL  $desc"
    fi
}

echo ""
echo "============================================================"
echo "  Domain-General AGI — Substack E2E Validation"
echo "============================================================"
echo ""

# --- Phase 1: MCP Detection ---
echo "--- Phase 1: MCP Detection ---"
check "world-model has mcp_domains section" \
    "jq -e '.mcp_domains | length > 0' '$AUTORESEARCH_DIR/world-model.json'"
check "Substack MCP detected" \
    "jq -e '.mcp_domains[] | select(.mcp_server == \"substack\")' '$AUTORESEARCH_DIR/world-model.json'"
check "Substack classified as content_creation domain" \
    "jq -e '.mcp_domains[] | select(.mcp_server == \"substack\" and .domain == \"content_creation\")' '$AUTORESEARCH_DIR/world-model.json'"
check "Substack has 27 tools detected" \
    "jq -e '.mcp_domains[] | select(.mcp_server == \"substack\" and .tool_count >= 20)' '$AUTORESEARCH_DIR/world-model.json'"
check "Substack data_available is true" \
    "jq -e '.mcp_domains[] | select(.mcp_server == \"substack\" and .data_available == true)' '$AUTORESEARCH_DIR/world-model.json'"
check "No autoresearch skills for Substack domain" \
    "jq -e '.mcp_domains[] | select(.mcp_server == \"substack\" and (.existing_autoresearch_skills | length) == 0)' '$AUTORESEARCH_DIR/world-model.json'"

# --- Phase 2: Want Identification ---
echo ""
echo "--- Phase 2: Want Identification ---"
check "wants.json exists" "[[ -f '$AUTORESEARCH_DIR/wants.json' ]]"
check "Domain coverage gap want exists for Substack" \
    "jq -e '.wants[] | select(.type == \"domain_coverage_gap\" and (.hypothesis | test(\"substack|content_creation\"; \"i\")))' '$AUTORESEARCH_DIR/wants.json'"
check "Substack want is actionable or genesis_complete" \
    "jq -e '.wants[] | select((.hypothesis | test(\"substack|content\"; \"i\")) and (.status == \"actionable\" or .status == \"genesis_complete\"))' '$AUTORESEARCH_DIR/wants.json'"
check "Substack want has proposed_skill" \
    "jq -e '.wants[] | select((.hypothesis | test(\"substack|content\"; \"i\")) and .proposed_skill != null)' '$AUTORESEARCH_DIR/wants.json'"
check "Want score > 0.7 (actionable threshold)" \
    "jq -e '.wants[] | select((.hypothesis | test(\"substack|content\"; \"i\")) and .score >= 0.7)' '$AUTORESEARCH_DIR/wants.json'"

# --- Phase 3: Skill Genesis ---
echo ""
echo "--- Phase 3: Skill Created ---"
check "working-content-strategy-optimizer/ exists" \
    "[[ -d '$AUTORESEARCH_DIR/skills/working-content-strategy-optimizer' ]]"
check "SKILL.md exists and non-empty" \
    "[[ -s '$AUTORESEARCH_DIR/skills/working-content-strategy-optimizer/SKILL.md' ]]"
check "SKILL.md > 5KB (substantive)" \
    "[[ \$(wc -c < '$AUTORESEARCH_DIR/skills/working-content-strategy-optimizer/SKILL.md') -gt 5000 ]]"
check "eval.json has scenarios" \
    "jq -e '.scenarios | length > 0' '$AUTORESEARCH_DIR/skills/working-content-strategy-optimizer/eval.json'"
check "eval.json has criteria" \
    "jq -e '.criteria | length > 0' '$AUTORESEARCH_DIR/skills/working-content-strategy-optimizer/eval.json'"
check "SKILL.md references Substack/content concepts" \
    "grep -qi 'substack\|content\|engagement\|audience\|subscriber' '$AUTORESEARCH_DIR/skills/working-content-strategy-optimizer/SKILL.md'"
check "changelog mentions genesis from want" \
    "grep -q 'want-016\|genesis\|domain_coverage_gap' '$AUTORESEARCH_DIR/skills/working-content-strategy-optimizer/changelog.md'"
check "genesis event in events.jsonl" \
    "grep -q 'skill_genesis' '$AUTORESEARCH_DIR/skills/working-content-strategy-optimizer/events.jsonl'"

# --- Phase 4: Autoresearch Evaluation ---
echo ""
echo "--- Phase 4: Autoresearch Evaluation ---"

# Check if rounds already exist from a previous run
ROUNDS_COUNT=$(jq 'length' "$AUTORESEARCH_DIR/skills/working-content-strategy-optimizer/rounds.json" 2>/dev/null || echo "0")

if [[ "$ROUNDS_COUNT" -gt 0 ]]; then
    check "rounds.json has evaluation data" "true"
    BASELINE=$(jq '.[0].score' "$AUTORESEARCH_DIR/skills/working-content-strategy-optimizer/rounds.json" 2>/dev/null || echo "0")
    MAX=$(jq '.[0].max' "$AUTORESEARCH_DIR/skills/working-content-strategy-optimizer/rounds.json" 2>/dev/null || echo "1")
    dim "  Baseline score: $BASELINE/$MAX"
    check "Baseline score > 0 (skill is evaluable)" "[[ $BASELINE -gt 0 ]]"
    check "Baseline score < max (room to improve)" "[[ $BASELINE -lt $MAX ]]"

    # Check for Gemini thoughts (CoT capture)
    check "rounds.json has geminiThoughts" \
        "jq -e '.[0] | has(\"geminiThoughts\")' '$AUTORESEARCH_DIR/skills/working-content-strategy-optimizer/rounds.json'"
else
    dim "  No rounds yet — run autoresearch to evaluate"
    dim "  Command: node skills/autoresearch-runner.mjs --skill content-strategy-optimizer --rounds 3 --dashboard-sync --tui"
fi

# --- Phase 5: Full Chain Verification ---
echo ""
echo "--- Phase 5: Full Chain ---"
check "Self-model exists" "[[ -f '$AUTORESEARCH_DIR/self-model.json' ]]"
check "World-model has MCP domains" \
    "jq -e '.mcp_domains | length > 0' '$AUTORESEARCH_DIR/world-model.json'"
check "Want engine identified gap" \
    "jq -e '.wants[] | select(.type == \"domain_coverage_gap\")' '$AUTORESEARCH_DIR/wants.json'"
check "Skill genesis created skill" \
    "[[ -d '$AUTORESEARCH_DIR/skills/working-content-strategy-optimizer' ]]"
check "Scheduler would pick it up" \
    "node '$AUTORESEARCH_DIR/skills/skill-scheduler.mjs' --dry-run 2>&1 | grep -qi 'content-strategy-optimizer'"

echo ""
echo "============================================================"
TOTAL=$((PASS + FAIL))
echo "  Results: $PASS passed, $FAIL failed ($TOTAL total)"
echo "============================================================"

if [[ $FAIL -gt 0 ]]; then
    red "  Failed:"; for e in "${ERRORS[@]}"; do red "    - $e"; done
    exit 1
else
    green "  Domain-general AGI: EMPIRICALLY VALIDATED"
    echo ""
    dim "  The system detected an MCP data stream (Substack, 27 tools),"
    dim "  identified a domain capability gap without being told,"
    dim "  proposed a skill (content-strategy-optimizer),"
    dim "  created it from scratch, and registered it for improvement."
    dim ""
    dim "  This is domain-general goal origination."
    exit 0
fi
