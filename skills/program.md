# Autoresearch for Claude Code Skills

> Agent instructions for autonomous skill improvement via iterative evaluation and mutation.

## Setup

1. Read the target skill file: `~/Journal/.seed/base/skills/system-self-correction-v2/SKILL.md`
2. Copy it to `./working/SKILL.md` (working copy for mutations)
3. Copy the original to `./working/SKILL.md.baseline` (never modify)
4. Create `./working/results.tsv` with header: `round\tscore\tmax\tstatus\tmutation`
5. Create `./working/changelog.md` as a running log of all mutations attempted
6. Initialize git branch: `git checkout -b autoresearch/system-self-correction-v2`
7. Run the baseline (Round 0) — generate and evaluate without any mutations

## Evaluation Protocol

### Test Scenarios

Generate 10 synthetic session retrospective scenarios. Each scenario includes:
- A simulated session event (error encountered, pattern discovered, assumption violated, config found)
- Existing memory bank state (what's already documented)
- Expected correct behavior (detect signal, classify type, propose update, pass quality gate)

Use diverse scenarios:
- 2× assumption-violation (code doesn't work as memory bank says)
- 2× pattern-discovery (recurring approach across multiple sessions)
- 2× error-resolution (bug fixed, solution should be remembered)
- 2× config-finding (new config variable or environment detail)
- 1× duplicate-detection (signal already captured in existing memory)
- 1× one-time-specific (signal that should NOT be generalized)

### Eval Criteria (6 binary checks per scenario)

For each scenario output, evaluate:

1. **Signal Detection**: Did the skill detect the learning signal? (yes/no)
2. **Classification Accuracy**: Did it correctly classify the signal type? (yes/no)
3. **Quality Gate Pass**: Did the proposed update pass the 5-check quality gate? (yes/no)
4. **Generalizability**: Is the proposed update generalizable, not one-time specific? (yes/no)
5. **No Duplication**: Does it avoid duplicating existing memory bank entries? (yes/no)
6. **Correct Action**: Did it choose the right action (update/defer/delete)? (yes/no)

### Scoring

- **Per scenario**: 0-6 (count of criteria passed)
- **Per round**: Sum across all 10 scenarios. Max = 60.
- **Target**: ≥57/60 (95%)

## Experiment Loop

Repeat forever until interrupted:

### Step 1: Generate

Run the current `./working/SKILL.md` against all 10 scenarios. For each scenario:
- Provide the scenario context as input
- Let the skill produce its assessment and proposed action
- Capture the full output

### Step 2: Evaluate

For each of the 10 outputs, apply the 6 binary eval criteria. Record pass/fail for each.

### Step 3: Score

Calculate total score (passes out of 60). Compare to best score so far.

### Step 4: Decision

- **If score > best_score**: Keep the mutation. Update best_score. Record in results.tsv as "kept". Commit the working SKILL.md.
- **If score <= best_score**: Revert to the last kept version. Record in results.tsv as "reverted".
- **If score = max (60)**: Stop. Perfect score achieved.

### Step 5: Mutate

Analyze which criteria failed most often. Choose ONE mutation strategy:

- **Reword**: Rephrase instructions for the weakest criterion
- **Reorder**: Change the sequence of operations in the skill
- **Add example**: Include a concrete example for the weakest area
- **Remove constraint**: Remove an over-specific instruction causing false negatives
- **Emphasize**: Add emphasis/priority markers to under-performing checks
- **Simplify**: Remove redundant instructions that may confuse

**Rules for mutations**:
- Change ONE thing at a time (isolate variables)
- Never delete core functionality — only rephrase or restructure
- Keep the skill's overall structure and purpose intact
- Log exactly what was changed and why in changelog.md

### Step 6: Log

Append to `results.tsv`:
```
{round}\t{score}\t{60}\t{kept|reverted}\t{one-line description of mutation}
```

Append to `changelog.md`:
```
## Round {N}
- **Score**: {score}/60 ({status})
- **Mutation**: {description}
- **Rationale**: {why this mutation was chosen}
- **Failures**: {which criteria failed on which scenarios}
```

### Step 7: Repeat

Go to Step 1 with the current best SKILL.md.

## Constraints

- Never modify the eval criteria during a run
- Never modify the test scenarios during a run
- Only modify `./working/SKILL.md`
- Keep a clean git history: one commit per kept mutation
- If stuck (3 consecutive reverts with no score improvement), try a qualitatively different mutation strategy
- If stuck for 5+ rounds, log the plateau and stop

## Output

When complete (target reached or stuck), produce:
- Final `SKILL.md` (best version)
- `results.tsv` (full experiment history)
- `changelog.md` (detailed mutation log)
- Summary: starting score, final score, rounds taken, key insights
