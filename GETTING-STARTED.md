# Adding a New Skill to Autoresearch

This guide walks you through adding any Claude Code skill to the autoresearch improvement loop — from scratch.

## What You Need

1. A `SKILL.md` file — the markdown prompt you want to improve
2. An idea of what "good output" looks like for this skill
3. API keys for Gemini and Anthropic (see [Quick Start](README.md#quick-start))

## Step 1: Create a Working Directory

Autoresearch **never modifies your original skill file**. It works on a copy.

```bash
cd ~/.remote/@autoresearch/skills

# Create a working directory named after your skill
mkdir working-my-skill

# Copy your skill file in (both as working copy and untouched baseline)
cp /path/to/your/SKILL.md working-my-skill/SKILL.md
cp /path/to/your/SKILL.md working-my-skill/SKILL.md.baseline

# Initialize the results log and changelog
printf "round\tscore\tmax\tstatus\tmutation\n" > working-my-skill/results.tsv
echo "# Autoresearch Changelog: my-skill" > working-my-skill/changelog.md
```

## Step 2: Design Your Eval Suite

This is the most important step. You need **test scenarios** and **binary criteria**.

### Scoring: Scenarios × Criteria = Max Score

The max score is `number_of_scenarios × number_of_criteria`. This is fully configurable per skill:

| Scenarios | Criteria | Max Score | Use Case |
|-----------|----------|-----------|----------|
| 10 | 6 | 60 | Default — good balance of coverage and speed |
| 10 | 10 | 100 | More granular evaluation per scenario |
| 20 | 5 | 100 | Broader scenario coverage, fewer checks each |
| 5 | 4 | 20 | Quick iteration on a simple skill |

There is no hard cap. Choose the combination that makes sense for your skill's complexity. Set the target score in the dashboard settings or via `--target` on the CLI.

### Choosing Scenarios

Think of situations where your skill would be used. Include:
- **~50% happy path** scenarios where the skill should work perfectly
- **~25% edge cases** that test boundary conditions
- **~25% negative cases** where the skill should correctly NOT do something (e.g., skip, defer, flag)

Each scenario has:
```javascript
{
  id: 1,
  type: 'category',           // Group label for your reference
  title: 'Short Description',
  event: 'What happens in this scenario — be specific',
  expectedAction: 'what-the-skill-should-do',
  expectedType: 'signal-classification'
}
```

### Choosing Criteria

Pick binary (yes/no) questions that, together, define quality for your skill. Rules:

- **Binary only** — "Does it do X?" not "How well does it do X?"
- **Principle-based** — "Does it detect the signal?" not "Does it contain the word 'error'?"
- **Don't overdo it** — 4-10 criteria is the sweet spot. More = overfitting to test
- **Cover different dimensions** — detection, classification, action, edge cases

Example criteria for a code review skill:
```
1. Does it identify the correct file and line?
2. Does it classify severity correctly (critical vs suggestion)?
3. Does it provide an actionable fix, not just a complaint?
4. Does it avoid false positives on intentional patterns?
5. Does it catch the seeded bug in the test case?
6. Does it skip files outside the review scope?
```

## Step 3: Add to the Runner

Open `skills/autoresearch-runner.mjs` and add your scenarios and criteria:

```javascript
// Find the SCENARIOS_BY_SKILL section and add:

const SCENARIOS_MY_SKILL = [
  { id: 1, type: 'happy-path', title: 'Basic Usage',
    event: 'User provides a clear input matching the skill purpose.',
    expectedAction: 'produce-correct-output', expectedType: 'standard' },
  // ... 9 more scenarios
]

// Add to the lookup:
const SCENARIOS_BY_SKILL = {
  // ... existing entries
  'my-skill': SCENARIOS_MY_SKILL,
}

// Add criteria:
const EVAL_CRITERIA_BY_SKILL = {
  // ... existing entries
  'my-skill': {
    criteria: [
      'Criterion 1: Does the skill detect the input correctly?',
      'Criterion 2: Does it produce the right output format?',
      'Criterion 3: Does it handle edge cases?',
      'Criterion 4: Does it avoid over-generating?',
      'Criterion 5: Does it reference the correct sources?',
      'Criterion 6: Does it integrate with related skills?',
    ],
  },
}
```

## Step 4: Register in the Dashboard

Add your skill to `dashboard/public/skills-manifest.json`:

```json
{
  "skills": [
    "deep-plan-v2",
    "system-self-correction-v2",
    "scaffold",
    "context-loader",
    "context-drift-detector",
    "my-skill"
  ],
  "default": "my-skill"
}
```

Create an empty results file:

```bash
echo '{"skill":"my-skill","criteria":[],"rounds":[]}' > dashboard/public/results-my-skill.json
```

## Step 5: Run It

```bash
# Single round (test that everything works)
node skills/autoresearch-runner.mjs --skill my-skill --rounds 1 --dashboard-sync

# Continuous improvement (runs until target or stuck)
node skills/autoresearch-runner.mjs --skill my-skill --target 95 --continuous --dashboard-sync

# With terminal dashboard
node skills/autoresearch-runner.mjs --skill my-skill --continuous --tui --dashboard-sync

# Choose specific models
node skills/autoresearch-runner.mjs \
  --skill my-skill \
  --evaluator gemini-2.5-pro \
  --mutator claude-3-haiku-20240307 \
  --continuous --dashboard-sync
```

## Step 6: Monitor

Open the dashboard and select your skill from the dropdown:

```bash
cd dashboard && npm run dev
# → http://localhost:4100
```

Click any row in the experiment history to see:
- Which models were used (evaluator + mutator)
- Why it was kept or reverted
- Per-criteria breakdown
- Specific scenarios that failed
- Full changelog entry

## How It Works Under the Hood

```
Round N:
  1. Gemini reads your SKILL.md + 10 scenarios
  2. Gemini scores each scenario against 6 criteria (yes/no)
  3. Total score = count of passes (max 60)
  4. If score > previous best → KEEP the mutation
     If score ≤ previous best → REVERT to last good version
  5. Claude analyzes which criteria failed most
  6. Claude proposes ONE targeted mutation to the skill prompt
  7. Mutation is applied → go to Round N+1
```

**Gemini evaluates without knowing what was changed** — it only sees the skill text and the scenarios. This prevents self-grading bias.

## Tips

- **Start with a baseline run** (`--rounds 1`) to see where your skill stands
- **If baseline is already 58-60/60**, your eval criteria may be too easy — make them stricter
- **If baseline is below 30/60**, your eval criteria may be too strict or your skill needs fundamental restructuring first
- **Gemini scores are stochastic** — the same skill may score differently on re-evaluation. This is normal. The system handles it by only keeping improvements.
- **The changelog is the real asset** — it shows which phrasings work and which don't. Hand it to a future model to continue improving.
- **Don't over-specify criteria** — "must contain exactly 3 bullet points" will cause the model to game the test. "Does it provide actionable steps?" is better.

## Available Models

### Evaluator (Gemini — scores the outputs)
| Model | Speed | Quality | Cost |
|-------|-------|---------|------|
| `gemini-2.5-flash` | Fastest | Good | ~$0.01/eval |
| `gemini-2.5-pro` | Fast | Best | ~$0.03/eval |
| `gemini-3-pro-preview` | Medium | Experimental | ~$0.05/eval |

### Mutator (Claude — proposes changes)
| Model | Speed | Quality | Cost |
|-------|-------|---------|------|
| `claude-3-haiku-20240307` | Fastest | Good for simple mutations | ~$0.01/mutation |
| `claude-3-5-haiku-20241022` | Fast | Better reasoning | ~$0.02/mutation |
| `claude-sonnet-4-5-20250514` | Medium | High quality mutations | ~$0.05/mutation |
| `claude-opus-4-6-20250801` | Slow | Maximum quality | ~$0.15/mutation |

**Recommendation**: Start with `gemini-2.5-pro` + `claude-3-haiku` (~$0.04/round). Switch to Sonnet/Opus for the mutator if Haiku gets stuck.
