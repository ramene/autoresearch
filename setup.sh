#!/bin/bash
# Autoresearch — Quick Setup
# Run: bash setup.sh

set -e

echo ""
echo "  ⚗  Autoresearch Setup"
echo "  ────────────────────────"
echo ""

# Check Node.js
if ! command -v node &>/dev/null; then
  echo "  ✗ Node.js not found. Install Node.js 20+ first."
  exit 1
fi
echo "  ✓ Node.js $(node --version)"

# Check claude CLI
if command -v claude &>/dev/null; then
  echo "  ✓ Claude CLI available (can use sonnet/opus as mutator)"
else
  echo "  ○ Claude CLI not found (will need Anthropic API key for mutations)"
fi

# Gemini key
echo ""
if [ -n "$GEMINI_API_KEY" ]; then
  echo "  ✓ GEMINI_API_KEY already set in environment"
elif [ -f "$HOME/.claude/.credentials/gemini-api-key.txt" ]; then
  echo "  ✓ Gemini key found at ~/.claude/.credentials/gemini-api-key.txt"
elif [ -f .env ] && grep -q "GEMINI_API_KEY=" .env; then
  echo "  ✓ Gemini key found in .env"
else
  echo "  Gemini API key is required for evaluation."
  echo "  Get one at: https://aistudio.google.com/apikey"
  echo ""
  read -p "  Paste your Gemini API key: " GEMINI_KEY
  if [ -n "$GEMINI_KEY" ]; then
    echo "GEMINI_API_KEY=$GEMINI_KEY" >> .env
    echo "  ✓ Saved to .env"
  fi
fi

# Anthropic key (optional)
echo ""
if command -v claude &>/dev/null; then
  echo "  ○ Anthropic API key is optional (you have Claude CLI)"
elif [ -n "$ANTHROPIC_API_KEY" ]; then
  echo "  ✓ ANTHROPIC_API_KEY already set"
elif [ -f "$HOME/.claude/.credentials/anthropic-api-key.txt" ]; then
  echo "  ✓ Anthropic key found at ~/.claude/.credentials/"
elif [ -f .env ] && grep -q "ANTHROPIC_API_KEY=" .env; then
  echo "  ✓ Anthropic key found in .env"
else
  echo "  Anthropic API key (optional — for API-based mutations)."
  echo "  Get one at: https://console.anthropic.com/settings/keys"
  echo ""
  read -p "  Paste your Anthropic API key (or press Enter to skip): " ANTHROPIC_KEY
  if [ -n "$ANTHROPIC_KEY" ]; then
    echo "ANTHROPIC_API_KEY=$ANTHROPIC_KEY" >> .env
    echo "  ✓ Saved to .env"
  fi
fi

# Install dashboard
echo ""
echo "  Installing dashboard..."
cd dashboard && npm install --silent 2>/dev/null && npm run build --silent 2>/dev/null && cd ..
echo "  ✓ Dashboard built"

echo ""
echo "  ────────────────────────"
echo "  Setup complete!"
echo ""
echo "  Start the dashboard:"
echo "    node dashboard/server.mjs"
echo ""
echo "  Run from CLI:"
echo "    node skills/autoresearch-runner.mjs --skill deep-plan-v2 --continuous --dashboard-sync"
echo ""
echo "  Or use the dashboard UI to configure and run."
echo ""
