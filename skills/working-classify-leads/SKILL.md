---
name: classify-leads
description: Classify leads using LLM for complex distinctions like product SaaS vs agencies. Use when user asks to classify leads, filter leads by type, or categorize businesses.
allowed-tools: Bash, Read, Write, Edit, Glob, Grep
---

> **Demo Library Skill** — This skill is from a demo library. Some configuration values use placeholders (e.g. `{{USER_NAME}}`, `{{COMMUNITY_ID}}`). If something doesn't work, check for placeholder values and replace them with your own information first.

# LLM Lead Classification

## Goal
Classify leads using Claude for complex distinctions that keyword matching can't handle.

## When to Use
- Product SaaS vs IT consulting agencies
- High-ticket vs low-ticket businesses
- Subscription vs one-time payment models
- NOT for simple categories (dentists, realtors)

## Scripts
- `./scripts/classify_leads_llm.py` - Main classification script
- `./scripts/update_sheet.py` - Update sheets
- `./scripts/read_sheet.py` - Read from sheets

## Core Workflows

### ⚠️ STEP 0 — Choose Your Path (Do This First)

Before running any commands, determine which path applies based on the user's input:

| If the user… | Do this |
|---|---|
| Mentions a Google Sheet, spreadsheet URL, or sheet name | **Use Path A** |
| Provides a file path ending in `.json` or `.csv` | **Use Path B** |
| Mentions a file but gives no path | Ask: "What is the file path?" — then **use Path B** with that path |
| Input is unclear | Ask: "Are your leads in a Google Sheet or a local file?" — if Google Sheet, **use Path A**; if local file, ask for the path then **use Path B** |

**Do not mix steps from Path A and Path B.**

---

### **Path A: Leads are in Google Sheets**

Follow these steps if the user's leads are in a Google Sheet and need to be exported first.

**Step 1: Create a working directory**
```bash
mkdir -p .tmp
```

**Step 2: Export leads from the sheet to a local file**
```bash
python3 ./scripts/read_sheet.py --output .tmp/leads.json
```

**Step 3: Verify the exported file**
```bash
python3 -c "import json; data=json.load(open('.tmp/leads.json')); print(f'Loaded {len(data)} leads')"
```

**Step 4: Run classification**
> **Important:** Choose the `--classification_type` based on the user's request (`product_saas`, `high_ticket`, `subscription_model`). Default to `product_saas` if unsure.
```bash
python3 ./scripts/classify_leads_llm.py .tmp/leads.json \
  --classification_type product_saas \
  --output .tmp/classified_leads.json
```

**Step 5: Review and report results**
```bash
python3 -c "
import json
from collections import Counter
data = json.load(open('.tmp/classified_leads.json'))
labels = Counter(d.get('classification') for d in data)
print(f'Total leads processed: {len(data)}')
print('Classification breakdown:')
for label, count in labels.items():
    print(f'  - {label}: {count}')
"
```

**Step 6: Update the original sheet with the results**
```bash
python3 ./scripts/update_sheet.py --input .tmp/classified_leads.json
```

---

### **Path B: Leads are in a Local File (JSON/CSV)**

Follow these steps if the user provides a direct path to a local file.

**Step 1: Create a working directory**
```bash
mkdir -p .tmp
```

**Step 2: Prepare the input file**

> Replace `PATH_TO_FILE` in the commands below with the actual file path the user provided.

*   **If the file is JSON:** Copy it into the working directory for consistency.
    ```bash
    cp PATH_TO_FILE .tmp/leads.json
    ```
*   **If the file is CSV:** Convert it to the required JSON format.
    ```bash
    python3 -c "
    import csv, json
    with open('PATH_TO_FILE') as f:
        rows = list(csv.DictReader(f))
    json.dump(rows, open('.tmp/leads.json','w'))
    print(f'Converted {len(rows)} CSV rows to .tmp/leads.json')
    "
    ```

**Step 3: Run classification**
> **Important:** Choose the `--classification_type` based on the user's request (`product_saas`, `high_ticket`, `subscription_model`). Default to `product_saas` if unsure.
```bash
python3 ./scripts/classify_leads_llm.py .tmp/leads.json \
  --classification_type product_saas \
  --output .tmp/classified_leads.json
```

**Step 4: Review and report results**
Report the counts and the final file path to the user. **Do not run `update_sheet.py`**.
```bash
echo "Classification complete. The results are in .tmp/classified_leads.json"
python3 -c "
import json
from collections import Counter
data = json.load(open('.tmp/classified_leads.json'))
labels = Counter(d.get('classification') for d in data)
print(f'Total leads processed: {len(data)}')
print('Classification breakdown:')
for label, count in labels.items():
    print(f'  - {label}: {count}')
"
```

---

## Performance
- ~2 minutes for 3,000 leads
- ~$0.30 per 1,000 leads
- Default: includes "unclear" classifications (medium confidence)

## Classification Types

The `--classification_type` flag accepts any descriptive string — the LLM uses it to guide its decision. Use the exact values below for known use cases:

| Use Case | `--classification_type` value | Output labels |
|---|---|---|
| Product SaaS vs agencies/consultants | `product_saas` | `product_saas`, `agency`, `unclear` |
| High-ticket vs low-ticket businesses | `high_ticket` | `high_ticket`, `low_ticket`, `unclear` |
| Subscription vs one-time payment models | `subscription_model` | `subscription`, `one_time`, `unclear` |
| Custom distinction | any descriptive string | varies — the LLM will infer labels from the type string |

**Example commands for each use case:**
```bash
# Product SaaS vs agencies
python3 ./scripts/classify_leads_llm.py .tmp/leads.json --classification_type product_saas --output .tmp/classified_leads.json

# High-ticket vs low-ticket
python3 ./scripts/classify_leads_llm.py .tmp/leads.json --classification_type high_ticket --output .tmp/classified_leads.json

# Subscription vs one-time
python3 ./scripts/classify_leads_llm.py .tmp/leads.json --classification_type subscription_model --output .tmp/classified_leads.json
```

**If results look wrong (too many "unclear" or misclassified):** Try a more descriptive classification_type string, e.g. `high_ticket_b2b_saas` instead of `high_ticket`. The LLM uses this string as context, so more specific is better.

## Output
JSON file with classification added to each lead record.

## Error Handling

**Common failures and fixes:**

| Error | Cause | Fix |
|---|---|---|
| `FileNotFoundError: .tmp/leads.json` | Input file missing or `.tmp/` dir absent | Run `mkdir -p .tmp` (Step 1), then `read_sheet.py` (Path A Step 2) or convert your local file (Path B Step 2) |
| `ModuleNotFoundError` | Missing Python deps | Run `pip3 install -r requirements.txt` |
| `ANTHROPIC_API_KEY not set` | Missing env var | Export the key: `export ANTHROPIC_API_KEY=sk-...` |
| `JSONDecodeError` | Malformed input file | Inspect: `python3 -c "import json; json.load(open('.tmp/leads.json'))"` |
| Empty output / 0 classified | Wrong classification_type | Check supported types above; use `product_saas` as default |
| Most results are "unclear" | classification_type too vague | Use a more specific string, e.g. `high_ticket_b2b_saas` |
| Script exits mid-run | Rate limit or timeout | Re-run — the script can resume from partial output |