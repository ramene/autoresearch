# Cross-Model Reasoning Pipeline

> Claude (synthesize) → Gemini (reason + challenge) → Claude (execute)

A standalone 3-stage pipeline that takes **any content** — a video transcript, blog post, research paper, competitor announcement — and produces a **validated, executable action plan** by routing it through multiple LLMs that play different roles.

This is **completely independent** of the autoresearch skill improvement loop. The autoresearch runner borrows the *concept* of cross-model evaluation (having Gemini score things Claude produces), but the reasoning pipeline is its own tool for a different job.

## What It Does

```
┌─────────────────────────────────┐
│  YOUR CONTENT                   │  A transcript, article, report, etc.
│  + YOUR PROJECT CONTEXT         │  What you're building, your codebase, your goals
└────────────┬────────────────────┘
             │
  ╔══════════▼══════════════════════════════════╗
  ║  STAGE 1: Claude Opus                      ║
  ║  "The Equipped Reasoner"                   ║
  ║                                            ║
  ║  Has full context about your project.      ║
  ║  Synthesizes the content against what      ║
  ║  you're building. Maps insights to your    ║
  ║  specific components. Identifies gaps.     ║
  ║  Frames debate positions for Gemini.       ║
  ╚═══════════════════════╦════════════════════╝
                          │
  ╔═══════════════════════▼════════════════════╗
  ║  STAGE 2: Gemini Pro                       ║
  ║  "The Naked Reasoner"                      ║
  ║                                            ║
  ║  Has NO project context. Gets only         ║
  ║  Claude's synthesis + debate positions.    ║
  ║  Challenges claims. Debates the strongest  ║
  ║  position. Catches blind spots. Reranks    ║
  ║  priorities by ROI. Asks hard questions.   ║
  ╚═══════════════════════╦════════════════════╝
                          │
  ╔═══════════════════════▼════════════════════╗
  ║  STAGE 3: Claude Opus                      ║
  ║  "The Equipped Reasoner" (again)           ║
  ║                                            ║
  ║  Takes Gemini's challenges + reranked      ║
  ║  priorities. Merges with its own analysis. ║
  ║  Produces executable agent team configs,   ║
  ║  worktree branches, verification commands. ║
  ╚═══════════════════════╦════════════════════╝
                          │
  ┌───────────────────────▼─────────────────────┐
  │  OUTPUT                                      │
  │  stage-1-claude-synthesis.md    (20-30K)     │
  │  stage-2-gemini-reasoning.md   (15-25K)     │
  │  stage-3-agent-team-execution.md (30-40K)   │
  │  pipeline-complete.md          (70-100K)     │
  └──────────────────────────────────────────────┘
```

## Why Two Models?

Claude is excellent at structured synthesis with tools and context — it knows your codebase, your patterns, your constraints. But it has blind spots. It tends to agree with its own analysis.

Gemini is given Claude's output **without any project context**. It's a "naked reasoner" — it can only evaluate the logic, challenge the assumptions, and rank priorities based on first principles. It can't be biased by knowing your preferences or your existing architecture.

The result: Claude's domain expertise + Gemini's independent reasoning = validated plans you can actually trust.

## Quick Start

### 1. Set Up Credentials

```bash
# Gemini API key (get one at https://aistudio.google.com/apikey)
echo "YOUR_GEMINI_KEY" > ~/.claude/.credentials/gemini-api-key.txt

# Anthropic API key (get one at https://console.anthropic.com)
# Either set the env var or save to a file:
export ANTHROPIC_API_KEY="sk-ant-..."
```

### 2. Prepare Your Content

Save whatever you want to analyze as a markdown file:

```bash
# Example: a YouTube video transcript
yt-dlp --write-auto-sub --sub-lang en --skip-download -o "transcript" "VIDEO_URL"
# Or just paste text into a file
echo "# My Analysis Content\n\n..." > content.md
```

### 3. Prepare Your Context (optional but recommended)

Create a file describing your project — what you're building, key components, current priorities:

```bash
cat > my-project-context.md << 'EOF'
# My Project

## What we're building
A SaaS platform for X that does Y.

## Key components
- Frontend: React + Next.js
- Backend: Node.js API
- Database: PostgreSQL

## Current priorities
1. Ship feature X by end of month
2. Fix performance issue in dashboard
3. Evaluate whether to add capability Z
EOF
```

### 4. Run the Pipeline

```bash
# Run all 3 stages
node reasoning-pipeline/pipeline.mjs \
  --transcript content.md \
  --context my-project-context.md \
  --output ./pipeline-output/

# Or run stages individually (useful for iteration)
node reasoning-pipeline/pipeline.mjs --stage 1 --transcript content.md
node reasoning-pipeline/pipeline.mjs --stage 2   # reads Stage 1 output from disk
node reasoning-pipeline/pipeline.mjs --stage 3   # reads Stage 1 + 2 outputs from disk
```

### 5. Read the Output

```bash
ls pipeline-output/
# stage-1-claude-synthesis.md     — Claude's structured analysis
# stage-2-gemini-reasoning.md    — Gemini's challenges + reranked priorities
# stage-3-agent-team-execution.md — Executable plan with team configs
# pipeline-complete.md            — All 3 combined
```

## Example Use Cases

### "A competitor just shipped a feature"

```bash
# Save the competitor's announcement/blog post
echo "# Competitor X just launched..." > competitor-announcement.md

# Run it through the pipeline with your project context
node reasoning-pipeline/pipeline.mjs \
  --transcript competitor-announcement.md \
  --context my-project-context.md
```

**What you get**:
- Stage 1: Claude maps the competitor's feature to your architecture — what would it take to match?
- Stage 2: Gemini challenges whether you even *should* match it — is this actually what your users want?
- Stage 3: If yes, a prioritized execution plan. If no, a reasoned argument for why not.

### "I watched a technical talk with ideas I want to apply"

```bash
# Get the transcript
yt-dlp --write-auto-sub --sub-lang en --skip-download -o "talk" "https://youtube.com/..."

# Run it
node reasoning-pipeline/pipeline.mjs \
  --transcript talk.en.vtt \
  --context my-project-context.md
```

**What you get**:
- Stage 1: Claude extracts every applicable insight and maps it to your specific components
- Stage 2: Gemini ranks which insights have the highest ROI for *your* situation
- Stage 3: Agent team configurations to implement the top priorities

### "We need to make a strategic decision"

```bash
# Write up the decision context
cat > decision.md << 'EOF'
# Should we migrate from REST to GraphQL?

Arguments for:
- Frontend team is building more complex queries
- N+1 problem is getting worse
- Mobile app needs different data shapes

Arguments against:
- 200+ REST endpoints already working
- Team has no GraphQL experience
- Migration would take 3+ months
EOF

node reasoning-pipeline/pipeline.mjs \
  --transcript decision.md \
  --context my-project-context.md
```

**What you get**:
- Stage 1: Claude analyzes both sides against your actual codebase and team
- Stage 2: Gemini debates the strongest position (not necessarily the popular one) with 1000+ words
- Stage 3: If migrate — a phased plan. If don't — what to do instead.

## Supported Models

The pipeline uses Claude for Stages 1 and 3, and Gemini for Stage 2. To change the Claude model, edit the default in `pipeline.mjs` at the `callClaude` function. This is kept separate from the autoresearch UI model selectors to avoid configuration conflicts.

### Claude (Stages 1 & 3)
| Model | ID | Notes |
|-------|-----|-------|
| Sonnet 4.5 | `claude-sonnet-4-5-20250514` | Default — good balance of quality and cost |
| Haiku 3 | `claude-3-haiku-20240307` | Fastest, cheapest — good for testing |
| Haiku 3.5 | `claude-3-5-haiku-20241022` | Fast with better reasoning |
| Opus 4.6 | `claude-opus-4-6-20250801` | Maximum quality, highest cost |

### Gemini (Stage 2)
| Model | ID | Notes |
|-------|-----|-------|
| Gemini 2.5 Pro | `gemini-2.5-pro` | Default — strong reasoning |
| Gemini 2.5 Flash | `gemini-2.5-flash` | Faster, cheaper |

## Cost

Costs vary by model selection. With the default (Sonnet 4.5 + Gemini 2.5 Pro):

| Stage | Model | Typical Cost |
|-------|-------|-------------|
| 1 | Claude Sonnet 4.5 | ~$0.10 |
| 2 | Gemini 2.5 Pro | ~$0.03 |
| 3 | Claude Sonnet 4.5 | ~$0.06 |
| **Total** | | **~$0.19** |

## CLI Reference

```
node reasoning-pipeline/pipeline.mjs [options]

Options:
  --transcript <file>   Content to analyze (can repeat for multiple files)
  --context <file>      Your project context file
  --stage <1|2|3|all>   Run specific stage or all (default: all)
  --output <dir>        Output directory (default: .claude/pipeline-output/)
  --root <dir>          Project root override
  --help                Show help
```

## Relationship to Autoresearch

These are **independent tools** that share a cross-model philosophy:

| | Reasoning Pipeline | Autoresearch Runner |
|-|-------------------|-------------------|
| **Purpose** | Analyze content → produce action plans | Improve skill prompts iteratively |
| **Input** | Transcripts, articles, decisions | A SKILL.md file + eval criteria |
| **Output** | Validated execution plans (70-100K markdown) | An improved SKILL.md + experiment log |
| **Claude's role** | Synthesize with context (Stage 1+3) | Propose mutations + generate outputs |
| **Gemini's role** | Challenge + debate + rerank (Stage 2) | Score outputs against binary criteria |
| **Runs** | Once per content piece | Continuously in a loop |
| **Cost** | ~$0.29/run | ~$0.28/round |

The autoresearch runner borrowed the *idea* of using Gemini as an independent evaluator from this pipeline. But the pipeline itself is a content analysis tool — use it anytime you need to think through something from multiple angles before acting.

## Origin

The "naked reasoner" pattern — giving Gemini only the analysis without project context so it can reason independently — emerged from processing video transcripts through this pipeline and discovering that cross-model validation catches blind spots that single-model analysis misses.
