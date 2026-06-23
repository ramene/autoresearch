---
name: title-variants
description: Generate title variants for YouTube videos from outlier analysis. Use when user asks to create title variations, generate YouTube titles, or adapt video titles.
allowed-tools: Bash, Read, Write, Edit, Glob, Grep
---

> **Demo Library Skill** — This skill is from a demo library. Some configuration values use placeholders (e.g. `{{USER_NAME}}`, `{{COMMUNITY_ID}}`). If something doesn't work, check for placeholder values and replace them with your own information first.

# Title Variant Generation

## Goal
Analyze top-performing video titles and generate variants adapted to your niche.

## Configuration
```python
USER_CHANNEL_NICHE = "AI agents, automation, LangGraph, CrewAI, agentic workflows"
```

## Execution Strategy
Your primary goal is to use the dedicated Python script. Follow **Plan A** first.

**If any step in Plan A fails** (e.g., the script is not found, the script crashes with an error, or the output file is missing/empty after the script runs), you must **stop immediately and switch to Plan B**.

---

## Plan A: Script-Based Generation

**Step A1: Find Input File**
Find an input JSON file containing titles.
```bash
# Check for input files
ls .tmp/outliers.json 2>/dev/null || ls .tmp/*.json 2>/dev/null || ls chain-results/*.json 2>/dev/null
```
- If no file is found, this plan fails. **Switch to Plan B.**
- If a file is found, note its path as `INPUT_FILE`.

**Step A2: Run Generation Script**
Execute the script `scripts/generate_title_variants.py`. Use the `&&`/`||` pattern to explicitly detect failure:

- **If a `SHEET_URL` is available** (from user or env var), use `--mode update`:
```bash
python3 ./scripts/generate_title_variants.py --sheet-url "SHEET_URL" --mode update && echo "SCRIPT_OK" || echo "SCRIPT_FAILED"
```
- **Otherwise**, use the `INPUT_FILE` from Step A1 and `--mode create`:
```bash
python3 ./scripts/generate_title_variants.py --input <INPUT_FILE> --mode create && echo "SCRIPT_OK" || echo "SCRIPT_FAILED"
```

If the output is `SCRIPT_FAILED` (non-zero exit code), or the script file is not found, this plan fails. **Switch to Plan B immediately.**

**Step A3: Validate and Output Results from Script**
First, verify the output file was created and is non-empty:
```bash
# Check output file exists and has content
test -s .tmp/title-variants.json && echo "OK" || echo "MISSING"
```
- If the file is missing or empty, this plan fails. **Switch to Plan B.**
- If the file exists and has content, read the file contents using this command:
```bash
cat .tmp/title-variants.json
```
The file contains a JSON array with this structure:
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
For each object in the array, print the summary using the `original`, `variant_1`, `variant_2`, and `variant_3` fields:
```
Original : <original>
Variant 1: <variant_1>
Variant 2: <variant_2>
Variant 3: <variant_3>
---
```

---

## Plan B: Direct Generation (Fallback)

**Step B1: Get Input Titles**
- **If you already identified an `INPUT_FILE` in Step A1**, use that file directly — read the titles from it. Do NOT search again.
- **If Plan A failed before finding any file** (Step A1 failed), search for input files:
  ```bash
  ls .tmp/outliers.json 2>/dev/null || ls .tmp/*.json 2>/dev/null || ls chain-results/*.json 2>/dev/null
  ```
  - If a file is found, read the titles from it.
  - If no file is found, ask the user: "No input title files found. Please paste the titles you want me to generate variants for (one per line)." Use their provided titles as input.

**Step B2: Generate Variants Directly**
For each input title, generate exactly 3 variants using these specific templates.

- **Variant 1 (Question Format):** Rephrase the original title as a question. If the original is "How to Build an AI Agent in 5 Minutes", a variant could be "Can You Really Build an AI Agent in 5 Minutes?"
- **Variant 2 (Bold Statement Format):** Turn the core idea into a strong, definitive statement. If the original is "My Top 5 LangGraph Tricks", a variant could be "This is the Only LangGraph Tutorial You Need."
- **Variant 3 (Niche Keyword Insertion):** Add a specific keyword from the `USER_CHANNEL_NICHE` list. For example, add "with CrewAI" or "for Agentic Workflows" to the end of the original title.

**Strict Rules for Generation:**
- Each original title must have exactly three variants generated.
- All variants must be under 100 characters.
- Do not invent new facts or outcomes; only rephrase the existing title.

**Step B3: Write and Output Results**
1. Ensure the output directory exists: `mkdir -p .tmp`
2. Write the generated variants to `.tmp/title-variants.json` in the standard JSON format:
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
3. Print the summary for each title to the terminal in the required format:
    ```
    Original : <original title>
    Variant 1: <variant 1>
    Variant 2: <variant 2>
    Variant 3: <variant 3>
    ---
    ```