# Cost Analysis: Autonomous Skill Improvement Loop

> Hourly schedule cost projections for the sleep/wake architecture running
> autoresearch skill optimization via OpenClaw supervisor.

## Per-Invocation Cost Breakdown

### Pre-Filter (CHECK 6) — $0.00/check
| Component | Cost | Notes |
|-----------|------|-------|
| Filesystem reads | $0.00 | `scheduler-state.json` timestamp, `rounds.json` scores |
| `bc` arithmetic | $0.00 | Score/max ratio comparison |
| Total | **$0.00** | Pure filesystem, no API calls |

### Supervisor Evaluation — ~$0.001/wake
| Component | Cost | Notes |
|-----------|------|-------|
| Goal parsing | $0.00 | Read `strategic.md`, regex matching |
| Pattern matching | $0.00 | `DETAIL_PATTERNS` against observation detail |
| ROI pre-check | $0.00 | Local `economic_model.py` computation |
| Plan generation | $0.00 | Template fill, write to disk |
| Total | **~$0.001** | Mostly free; cost only if Haiku triage used |

### Skill Scheduler — $0.00/invocation
| Component | Cost | Notes |
|-----------|------|-------|
| Read all `rounds.json` | $0.00 | Local filesystem |
| Score/max ranking | $0.00 | In-memory sort |
| Cooldown check | $0.00 | `scheduler-state.json` timestamps |
| Total | **$0.00** | Scheduler itself is free; cost is in the runner |

### Autoresearch Runner (per round) — ~$0.05/round
| Component | Cost | Notes |
|-----------|------|-------|
| Gemini evaluation | ~$0.03 | 8 scenarios x 6 criteria, `gemini-2.5-pro` |
| Claude mutation | ~$0.02 | `sonnet` via CLI (Max plan) or API |
| CoT capture | $0.00 | Included in Gemini response |
| Event emission | $0.00 | Local `events.jsonl` append |
| Total per round | **~$0.05** | |

### Stuck Escalation (when triggered) — ~$0.03/escalation
| Component | Cost | Notes |
|-----------|------|-------|
| Gemini meta-analysis | ~$0.03 | One `gemini-2.5-pro` call with skill + changelog |
| Total | **~$0.03** | Only fires after 3+ consecutive reverts |

### Research Pipeline Run (when triggered) — ~$0.19/run
| Component | Cost | Notes |
|-----------|------|-------|
| Stage 1: Claude synthesis | ~$0.06 | `sonnet` — extract frameworks/claims |
| Stage 2: Gemini reasoning | ~$0.04 | `gemini-2.5-pro` — adversarial review |
| Stage 3: Claude execution | ~$0.09 | `sonnet` — action plan generation |
| Total per pipeline | **~$0.19** | Only when explicitly triggered |

### Telegram Notification — $0.00/message
| Component | Cost | Notes |
|-----------|------|-------|
| Gateway webhook POST | $0.00 | HTTP to grammY, no LLM |
| Total | **$0.00** | Free |

## Hourly Schedule Cost Projections

### Scenario: Default (5 rounds per hour)
```
Per hour:
  Pre-filter check:         $0.00
  Supervisor evaluation:    $0.001
  Scheduler overhead:       $0.00
  Runner (5 rounds):        $0.25   (5 × $0.05)
  Notifications:            $0.00
  ─────────────────────────────────
  Total per hour:          ~$0.25

Per day (24h):             ~$6.00
Per day (active 16h):      ~$4.00
Per month (30d, 16h/day): ~$120.00  ← exceeds daily budget, capped
```

### Scenario: Budget-Capped ($2.00/day goal limit)
```
Effective rounds/day:      ~40 rounds ($2.00 ÷ $0.05)
Rounds/hour (16h active):  ~2.5 rounds/hour
Skills cycled/day:         ~8 full evaluations (5 rounds each)

Per day:                   $2.00 (hard cap)
Per month:                $60.00
```

### Scenario: With Stuck Escalation (realistic)
```
Assuming 30% of skills get stuck within 5 rounds:
  Normal rounds (70%):     28 × $0.05 = $1.40
  Escalation rounds (30%): 12 × $0.05 + 4 × $0.03 = $0.72
  Notifications:           $0.00
  ─────────────────────────────────
  Per day:                ~$2.12 → capped at $2.00

Per month:                $60.00
```

### Scenario: With Occasional Pipeline Runs
```
Assuming 2 research pipeline runs/week:
  Skill optimization:      $2.00/day × 30 = $60.00/month
  Pipeline runs:           2/week × $0.19 × 4 = $1.52/month
  ─────────────────────────────────
  Total monthly:          ~$61.52
```

## Sleep/Wake Architecture Analysis

### Cost Comparison: Always-On vs Sleep/Wake

| Metric | Always-On Polling | Sleep/Wake (Current) |
|--------|-------------------|---------------------|
| **Idle cost** | $0.048/day | **$0.00/day** |
| **Idle monthly** | $1.44 | **$0.00** |
| **Light day** (2 triggers, 1 action) | $0.61 | **$0.56** |
| **Active day** (5 triggers, 3 actions) | $1.73 | **$1.68** |
| **Heavy day** (24 triggers, hourly autoresearch) | $8.40 | **$2.00** (budget-capped) |
| **Monthly (realistic)** | $9-48 | **$5-18** |
| **Monthly (with autoresearch)** | $60-120 | **$60** (budget-capped) |

### Why Sleep/Wake Wins for Autoresearch

1. **$0 idle floor** — Vacation, weekends, quiet periods cost nothing
2. **Budget enforcement at 3 tiers**:
   - Invocation: $0.50/run (prevents single runaway)
   - Goal: $2.00/day (prevents autoresearch from starving other goals)
   - Global: $10.00/day (prevents total system runaway)
3. **Natural circuit breaker** — Process exits after each cycle, can't spin
4. **Hourly granularity matches optimization cadence** — Skills don't improve faster than ~5 rounds/hour
5. **Scales without linear cost** — Adding more skills doesn't increase idle cost; scheduler rotates through them within the same budget

### GCP Cloud Run Cost (Infrastructure)

| Component | Idle | Active (per wake) | Monthly |
|-----------|------|--------------------|---------|
| Gateway (scale-to-zero) | $0.00 | ~$0.0001/request | ~$0.05 |
| Supervisor (scale-to-zero) | $0.00 | ~$0.001/wake | ~$0.50 |
| Secret Manager (3 secrets) | $0.00 | $0.03/10K accesses | ~$0.01 |
| Cloud Run min instances | $0.00 | N/A (min=0) | $0.00 |
| **Total infrastructure** | **$0.00** | | **~$0.56/month** |

### Total Monthly Cost (All-In)

| Component | Monthly Cost |
|-----------|-------------|
| Autoresearch API calls (budget-capped) | $60.00 |
| Other supervisor goals (security, research, etc.) | $6.60-17.60 |
| GCP infrastructure | ~$0.56 |
| Telegram notifications | $0.00 |
| **Total** | **$67-78/month** |

### Break-Even Analysis

Each skill improvement cycle produces a measurably better prompt. At $0.05/round:
- **Cost per 1% improvement**: ~$0.25 (typical 5 rounds to gain 1 criterion)
- **Value per improvement**: Improved prompts affect every future Claude Code session
- **ROI**: If an improved skill saves 1 minute/day across sessions = ~$10/month value at $20/hour equivalent
- **Break-even**: ~3 skills improving 5%+ each covers the $60/month cost

## Environment Configuration

### Local Development
```bash
# API keys in ~/.remote/@autoresearch/.env
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=AIza...

# Dashboard on localhost
cd ~/.remote/@autoresearch/dashboard && node server.mjs  # :4100

# Manual scheduler run
node skills/skill-scheduler.mjs --budget 0.10 --rounds 2

# Test supervisor locally
python3 -m supervisor.supervisor \
  --observations /tmp/test-obs.json \
  --state /tmp/test-state.json \
  --strategic supervisor/strategic.md
```

### Production (GCP Cloud Run)
```bash
# Wake the beast
/platform openclaw wake --wait

# Services
# Gateway:    https://openclaw-gateway-<hash>.run.app
# Supervisor: https://openclaw-supervisor-<hash>.run.app (IAM-locked)

# Supervisor API (via proxy)
gcloud beta run services proxy openclaw-supervisor --region=us-central1
# → http://localhost:8080/api/webhook

# Trigger autoresearch observation
curl -X POST http://localhost:8080/api/webhook \
  -H "Content-Type: application/json" \
  -d '{"type": "autoresearch", "detail": "skill-optimization due: scaffold at 49/60"}'

# Put back to sleep when done
/platform openclaw sleep
```

### Docker (Local Supervisor with Autoresearch)
```bash
# Mount autoresearch dir into supervisor container
docker run --rm -it \
  -v ~/.remote/@autoresearch:/opt/autoresearch \
  -e AUTORESEARCH_DIR=/opt/autoresearch \
  -e GEMINI_API_KEY=$GEMINI_API_KEY \
  -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
  openclaw-supervisor:latest \
  python3 -m supervisor.supervisor \
    --observations /tmp/obs.json \
    --state /opt/supervisor/state/state.json \
    --strategic /opt/supervisor/supervisor/strategic.md
```
