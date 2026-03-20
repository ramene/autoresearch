---
name: title-variants
description: Generate title variants for YouTube videos from outlier analysis. Use when user asks to create title variations, generate YouTube titles, or adapt video titles.
allowed-tools: Bash, Read, Write, Edit, Glob, Grep
---

> **Demo Library Skill** — This skill is from a demo library. Some configuration values use placeholders (e.g. `{{USER_NAME}}`, `{{COMMUNITY_ID}}`). If something doesn't work, check for placeholder values and replace them with your own information first.

# Title Variant Generation

## Goal
Analyze top-performing video titles and generate variants adapted to your niche.

## How It Works
1. Analyzes original title's hook, emotional trigger, and structure
2. Adapts to your specific niche (AI agents, automation, etc.)
3. Generates 3 meaningfully different variants per title
4. Keeps each variant under 100 characters (YouTube best practice)

## Configuration
```python
USER_CHANNEL_NICHE = "AI agents, automation, LangGraph, CrewAI, agentic workflows"
```

## Step 1: Find Input Titles

Check for available input sources in this order:

```bash
# Check for input files
ls .tmp/*.json 2>/dev/null || ls chain-results/*.json 2>/dev/null
```

**After running the check, follow this decision:**
- **If `.tmp/outliers.json` exists** → Read it and use its titles as input. Proceed to Step 2.
- **If another `.json` file exists** in `.tmp/` or `chain-results/` with title data → Read it and use its titles. Proceed to Step 2.
- **If no files are found** → Stop and ask the user: "No input title files found. Please paste the titles you want me to generate variants for." Once they provide titles, proceed to Step 2.

## Step 2: Generate Title Variants

Follow this decision path in order — stop at the first step that succeeds:

**2a. Check if the generation script exists:**
```bash
ls ./scripts/generate_title_variants.py 2>/dev/null
```

**2b. If the script exists, run it using this mode selection:**
- **Use Mode A** if a Google Sheet URL is available (i.e., a `SHEET_URL` env var is set or the user has provided one):
```bash
python3 ./scripts/generate_title_variants.py \
  --sheet-url "SHEET_URL" \
  --mode update
```
- **Use Mode B** otherwise (input file already found in Step 1):
```bash
python3 ./scripts/generate_title_variants.py \
  --input .tmp/outliers.json \
  --mode create
```
If the script runs successfully, skip to Step 3.

**2c. If the script is missing OR crashes, generate variants directly:**

Apply these rules to each input title to produce exactly 3 variants:
- **Variant 1 — Reframe the hook**: Keep the core topic, change the emotional angle (curiosity → urgency, or fear → aspiration)
- **Variant 2 — Swap the structure**: If original uses a question, try a statement. If it uses a number, try a bold claim.
- **Variant 3 — Niche-adapt**: Explicitly reference the niche context (AI agents, automation workflows, etc.) that the original may have left implicit

Rules for all variants:
- Under 100 characters
- Preserve what made the original perform well (specific numbers, power words, concrete outcomes)
- Do not use clickbait — keep claims accurate

After generating variants inline, **proceed immediately to Step 3** to write the JSON file and print the summary table.

## Step 3: Output

First, ensure the output directory exists:
```bash
mkdir -p .tmp
```

Write results to `.tmp/title-variants.json` in this format:
```json
[
  {
    "original": "Original title here",
    "variant_1": "Variant 1 here",
    "variant_2": "Variant 2 here",
    "variant_3": "Variant 3 here"
  }
]
```

Then print a clean summary table to the terminal in this format for each title:

```
Original : <original title>
Variant 1: <variant 1>
Variant 2: <variant 2>
Variant 3: <variant 3>
---
```

## Error Handling
- If no input titles found: prompt the user to paste titles directly, then generate variants inline
- If a script crashes: log the error, fall back to Step 2c direct generation, continue
- If a title exceeds 100 chars after generation: truncate at word boundary and note it