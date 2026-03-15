#!/usr/bin/env node
/**
 * Autoresearch Runner for Claude Code Skills
 *
 * Cross-model pipeline: Claude (mutate) → Claude (generate) → Gemini (evaluate) → Claude (synthesize)
 *
 * Usage:
 *   node autoresearch-runner.mjs                    # Run one round
 *   node autoresearch-runner.mjs --rounds 10        # Run 10 rounds
 *   node autoresearch-runner.mjs --continuous       # Run until target or stuck
 *   node autoresearch-runner.mjs --dashboard-sync   # Also write dashboard JSON
 */

import { readFileSync, writeFileSync, existsSync, appendFileSync, copyFileSync, unlinkSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ─── Load .env ──────────────────────────────────────────────────────────────
const dotenvPath = resolve(__dirname, '../.env')
if (existsSync(dotenvPath)) {
  for (const line of readFileSync(dotenvPath, 'utf8').split('\n')) {
    const match = line.match(/^([A-Z_]+)=(.+)$/)
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim()
  }
}

// ─── CLI Parsing ─────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const getFlag = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback }
const SKILL_NAME = getFlag('--skill', 'system-self-correction-v2')
const EVALUATOR_MODEL = getFlag('--evaluator', 'gemini-2.5-pro')
const MUTATOR_MODEL = getFlag('--mutator', 'sonnet')
const TARGET_SCORE = parseInt(getFlag('--target', '60'))
const WORKING_DIR = resolve(__dirname, `working-${SKILL_NAME}`)

// Fall back to 'working/' if skill-specific dir doesn't exist
const EFFECTIVE_DIR = existsSync(WORKING_DIR) ? WORKING_DIR : resolve(__dirname, 'working')

// ─── Configuration ───────────────────────────────────────────────────────────

const CONFIG = {
  skillPath: resolve(EFFECTIVE_DIR, 'SKILL.md'),
  baselinePath: resolve(EFFECTIVE_DIR, 'SKILL.md.baseline'),
  resultsPath: resolve(EFFECTIVE_DIR, 'results.tsv'),
  changelogPath: resolve(EFFECTIVE_DIR, 'changelog.md'),
  dashboardJsonPath: resolve(__dirname, `../dashboard/public/results-${SKILL_NAME}.json`),
  scenarioCount: 10,
  criteriaCount: 6,
  targetScore: TARGET_SCORE,
  maxStuckRounds: 3,
  maxStuckBeforeStop: 5,
  claudeModel: MUTATOR_MODEL,
  geminiModel: EVALUATOR_MODEL,
  skillName: SKILL_NAME,
}

// ─── API Helpers ─────────────────────────────────────────────────────────────

function loadAnthropicKey() {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY
  const paths = [
    resolve(process.env.HOME, '.claude/.credentials/anthropic-api-key.txt'),
  ]
  for (const p of paths) {
    if (existsSync(p)) return readFileSync(p, 'utf8').trim()
  }
  throw new Error('ANTHROPIC_API_KEY not found')
}

function loadGeminiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY
  const paths = [
    resolve(process.env.HOME, '.claude/.credentials/gemini-api-key.txt'),
  ]
  for (const p of paths) {
    if (existsSync(p)) return readFileSync(p, 'utf8').trim()
  }
  throw new Error('GEMINI_API_KEY not found')
}

async function callClaude(prompt, systemPrompt) {
  // Use claude CLI for models that start with 'sonnet', 'opus', 'haiku' (short names)
  // These use the Claude Code subscription, not API keys
  const useCliModels = ['sonnet', 'opus', 'haiku']
  const useCli = useCliModels.includes(CONFIG.claudeModel)

  if (useCli) {
    return callClaudeCli(prompt, systemPrompt)
  }

  const apiKey = loadAnthropicKey()
  const modelMax = CONFIG.claudeModel.includes('haiku') ? 4096 : 16384
  const skillSize = existsSync(CONFIG.skillPath) ? readFileSync(CONFIG.skillPath, 'utf8').length : 0
  const neededTokens = Math.min(modelMax, Math.max(4096, Math.ceil(skillSize / 3) + 1000))
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: CONFIG.claudeModel,
      max_tokens: neededTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Claude API error ${res.status}: ${err}`)
  }
  const data = await res.json()
  return data.content[0].text
}

async function callClaudeCli(prompt, systemPrompt) {
  const { execSync } = await import('child_process')
  const fullPrompt = systemPrompt
    ? `${systemPrompt}\n\n---\n\n${prompt}`
    : prompt

  // Write prompt to temp file to avoid shell escaping issues
  const tmpFile = resolve(EFFECTIVE_DIR, '.autoresearch-prompt.tmp')
  writeFileSync(tmpFile, fullPrompt)

  try {
    const result = execSync(
      `cat "${tmpFile}" | claude --print --model ${CONFIG.claudeModel}`,
      { maxBuffer: 1024 * 1024, timeout: 120000, encoding: 'utf8', shell: true }
    )
    return result
  } finally {
    try { unlinkSync(tmpFile) } catch {}
  }
}

async function callGemini(prompt, systemInstruction) {
  const apiKey = loadGeminiKey()
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.geminiModel}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: {
          maxOutputTokens: 16384,
          temperature: 0.3,
          thinkingConfig: { thinkingBudget: 8192 },
        },
      }),
    }
  )
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini API error ${res.status}: ${err}`)
  }
  const data = await res.json()
  const parts = data.candidates?.[0]?.content?.parts || []
  const textParts = parts.filter(p => !p.thought).map(p => p.text).join('\n')
  const thoughtParts = parts.filter(p => p.thought).map(p => p.text).join('\n')
  return {
    text: textParts || parts.map(p => p.text).join('\n'),
    thoughts: thoughtParts || null,
  }
}

// ─── Test Scenarios ──────────────────────────────────────────────────────────

const SCENARIOS_SELF_CORRECTION = [
  { id: 1, type: 'assumption-violation', title: 'Build Command Wrong',
    event: 'Agent discovers `npm run build` fails, but CLAUDE-patterns.md says "use npm run build". Actual command is `npm run build:prod`.',
    expectedAction: 'update', expectedType: 'assumption-violation' },
  { id: 2, type: 'assumption-violation', title: 'API Response Format Changed',
    event: 'Agent assumes API returns `{data: [...]}` per CLAUDE-patterns.md, but actual response is `{results: [...], pagination: {...}}`.',
    expectedAction: 'update', expectedType: 'assumption-violation' },
  { id: 3, type: 'pattern-discovery', title: 'Error Handling Convention',
    event: 'Agent notices across 3 files, errors are handled with `try/catch` wrapping `logger.error(context, err)` before re-throwing. Undocumented.',
    expectedAction: 'update', expectedType: 'pattern-discovery' },
  { id: 4, type: 'pattern-discovery', title: 'Test Naming Convention',
    event: 'Agent observes all tests use `describe("ComponentName")` with `it("should [verb]")`. Not documented.',
    expectedAction: 'update', expectedType: 'pattern-discovery' },
  { id: 5, type: 'error-resolution', title: 'Docker Port Conflict',
    event: 'Agent encounters "port 3000 already in use", discovers stale container, stops it. Verified fix.',
    expectedAction: 'update', expectedType: 'error-resolution' },
  { id: 6, type: 'error-resolution', title: 'Module Import Path Alias',
    event: 'Agent gets "Cannot find module @/utils/auth". Root cause: tsconfig paths changed from `@/` to `~/`. Fixed import.',
    expectedAction: 'update', expectedType: 'error-resolution' },
  { id: 7, type: 'config-finding', title: 'SSL Mode Required',
    event: 'Agent discovers DATABASE_URL must include `?sslmode=require` for production but not local dev. Undocumented.',
    expectedAction: 'update', expectedType: 'config-finding' },
  { id: 8, type: 'config-finding', title: 'Feature Flag Discovery',
    event: 'Agent finds ENABLE_NEW_AUTH=true needed in .env for new auth flow. Undocumented.',
    expectedAction: 'update', expectedType: 'config-finding' },
  { id: 9, type: 'duplicate', title: 'Already Documented Solution',
    event: 'Agent discovers Docker --no-cache for CI. But CLAUDE-troubleshooting.md already has this under "CI Build Failures".',
    expectedAction: 'defer', expectedType: 'error-resolution' },
  { id: 10, type: 'one-time', title: 'One-Time Typo Fix',
    event: 'Agent encounters GitHub API rate limit at 2:47 AM because CI workflow had a typo causing infinite retries. Typo was fixed.',
    expectedAction: 'defer', expectedType: 'error-resolution' },
]

const SCENARIOS_DEEP_PLAN = [
  { id: 1, type: 'discovery', title: 'Vague Request — Add Search',
    event: 'User says "add search to the app". No details about what kind of search, what data, or what "done" looks like.',
    expectedAction: 'ask-questions', expectedType: 'discovery-needed' },
  { id: 2, type: 'discovery', title: 'Clear Request — Add Rate Limiting',
    event: 'User says "add rate limiting to the /api/extract endpoint, 100 requests per minute per API key, return 429 when exceeded".',
    expectedAction: 'proceed-to-research', expectedType: 'well-specified' },
  { id: 3, type: 'quality-gate', title: 'Vibes-Based Success Criteria',
    event: 'Plan says success criteria is "the dashboard looks better and feels more responsive".',
    expectedAction: 'fail-gate', expectedType: 'non-observable-criteria' },
  { id: 4, type: 'quality-gate', title: 'Observable Success Criteria',
    event: 'Plan says success criteria is "lighthouse score >90, all 12 tests pass, build completes in <30s".',
    expectedAction: 'pass-gate', expectedType: 'observable-criteria' },
  { id: 5, type: 'footgun', title: 'Missing Rollback Path',
    event: 'Plan modifies the database schema and payment processing code but has no rollback strategy or migration reversal.',
    expectedAction: 'flag-footgun', expectedType: 'no-rollback' },
  { id: 6, type: 'footgun', title: 'Scope Creep Risk',
    event: 'User asks to fix a CSS bug on the login page. Plan includes "while we\'re at it, refactor the entire auth module and add dark mode".',
    expectedAction: 'flag-footgun', expectedType: 'scope-creep' },
  { id: 7, type: 'footgun', title: 'Missing Design Phase',
    event: 'Plan jumps straight to implementation for a new microservice architecture without any design discussion or ADRs.',
    expectedAction: 'flag-footgun', expectedType: 'missing-design' },
  { id: 8, type: 'stuck-detection', title: 'Same Failure 3 Times',
    event: 'Agent has tried to fix the same test failure 3 times with different approaches. Test still fails.',
    expectedAction: 'stop-and-report', expectedType: 'stuck' },
  { id: 9, type: 'checkpoint', title: 'Long Implementation No Commits',
    event: 'Agent has been implementing for 45 minutes across 8 files without a single commit or checkpoint.',
    expectedAction: 'flag-missing-checkpoint', expectedType: 'no-checkpoint' },
  { id: 10, type: 'wrong-tool', title: 'Simple Fix Doesn\'t Need Deep Plan',
    event: 'User asks to change a button color from blue to green. Agent activates deep-plan-v2 with full discovery questions.',
    expectedAction: 'flag-wrong-tool', expectedType: 'overkill' },
]

const SCENARIOS_SCAFFOLD = [
  { id: 1, type: 'mode-detection', title: 'Greenfield — kebab-case name',
    event: 'User runs `/scaffold my-new-project`. No URL, no archive, just a name.',
    expectedAction: 'greenfield-mode', expectedType: 'mode-detection' },
  { id: 2, type: 'mode-detection', title: 'Plan Mode — .md with targets',
    event: 'User runs `/scaffold ~/.claude/plans/security-audit.md`. File contains `## Targets` and `**Workspace**: ~/.remote/@builds`.',
    expectedAction: 'plan-mode', expectedType: 'mode-detection' },
  { id: 3, type: 'mode-detection', title: 'Reverse-Engineer — GitHub URL',
    event: 'User runs `/scaffold https://github.com/user/repo`. Source is a GitHub URL.',
    expectedAction: 'reverse-engineer-mode', expectedType: 'mode-detection' },
  { id: 4, type: 'greenfield', title: 'Parameter Gathering — All Questions',
    event: 'User says "scaffold a new project". No name, no path, no options specified.',
    expectedAction: 'ask-all-questions', expectedType: 'parameter-gathering' },
  { id: 5, type: 'greenfield', title: 'Terminal Launch — Separate Question',
    event: 'Scaffolding complete. Instructions say to ask about terminal launch as a SEPARATE follow-up question.',
    expectedAction: 'separate-follow-up', expectedType: 'terminal-launch' },
  { id: 6, type: 'plan-mode', title: 'Template Variables — Unresolved',
    event: 'Plan file contains `{{GITHUB_TOKEN}}` but no `--plan-var` was passed. Validation should catch this.',
    expectedAction: 'fail-validation', expectedType: 'template-validation' },
  { id: 7, type: 'reverse-engineer', title: 'Vendor Detection — Prisma + Clerk',
    event: 'Codebase has `@prisma/client` imports and `@clerk/nextjs` imports. Instructions should guide detection of both.',
    expectedAction: 'detect-both-vendors', expectedType: 'vendor-detection' },
  { id: 8, type: 'reverse-engineer', title: 'Replacement Order — Dependencies First',
    event: 'Agent needs to replace Prisma (DB) and Clerk (auth). Auth depends on DB. Instructions should guide DB-first order.',
    expectedAction: 'db-before-auth', expectedType: 'dependency-ordering' },
  { id: 9, type: 'verification', title: 'Post-Scaffold Verification Steps',
    event: 'Scaffold complete. Instructions should guide verifying symlinks, skill count, git init, workspace structure.',
    expectedAction: 'verify-all-steps', expectedType: 'verification' },
  { id: 10, type: 'overlap', title: 'Memory Bank Update After Scaffold',
    event: 'Scaffold creates a new project. Instructions should guide writing initial memory bank files (CLAUDE-activeContext.md, etc.).',
    expectedAction: 'update-memory-bank', expectedType: 'memory-bank-integration' },
]

const SCENARIOS_CONTEXT_LOADER = [
  { id: 1, type: 'depth', title: 'Shallow Depth — Registry Only',
    event: 'User runs `/context-loader --depth shallow`. Should only build sibling registry, skip deep scan and tmux mining.',
    expectedAction: 'registry-only', expectedType: 'depth-handling' },
  { id: 2, type: 'depth', title: 'Deep Depth — Full Scan + tmux',
    event: 'User runs `/context-loader --depth deep`. Should scan all siblings, read memory banks, mine tmux-logs, write both output files.',
    expectedAction: 'full-scan', expectedType: 'depth-handling' },
  { id: 3, type: 'staleness', title: 'Fresh File — Skip Scan',
    event: 'CLAUDE-ecosystem.md was updated 30 minutes ago. No --refresh flag. Instructions should guide skipping the scan.',
    expectedAction: 'skip-scan', expectedType: 'staleness-detection' },
  { id: 4, type: 'staleness', title: 'Stale File — Force Refresh',
    event: 'CLAUDE-ecosystem.md is 3 days old. Instructions should trigger a full deep scan automatically.',
    expectedAction: 'full-scan', expectedType: 'staleness-detection' },
  { id: 5, type: 'tmux-mining', title: 'Extract Git Activity from Logs',
    event: 'tmux term logs contain `git commit -m "feat: add auth"` and `git push origin main`. Phase 4 should extract these.',
    expectedAction: 'extract-commits', expectedType: 'tmux-extraction' },
  { id: 6, type: 'tmux-mining', title: 'Extract Errors and Resolutions',
    event: 'tmux logs show `Error: port 3000 in use` followed by `docker stop stale-container`. Should capture error→resolution pair.',
    expectedAction: 'extract-error-resolution', expectedType: 'tmux-extraction' },
  { id: 7, type: 'cross-project', title: 'Detect Cross-Session References',
    event: 'Session A references `@sibling-project` files while working in `@another-project`. Should flag as cross-project reference.',
    expectedAction: 'flag-cross-reference', expectedType: 'cross-project-detection' },
  { id: 8, type: 'output', title: 'Write Both Output Files',
    event: 'Deep scan complete. Instructions should guide writing BOTH CLAUDE-ecosystem.md AND CLAUDE-session-intelligence.md.',
    expectedAction: 'write-both-files', expectedType: 'output-generation' },
  { id: 9, type: 'overlap', title: 'Integration with context-drift-detector',
    event: 'Instructions mention running drift detection first. Should reference context-drift-detector as a complementary tool.',
    expectedAction: 'reference-drift-detector', expectedType: 'skill-integration' },
  { id: 10, type: 'overlap', title: 'Integration with scaffold',
    event: 'Instructions should clarify relationship with scaffold — loader is the live-updating version of scaffolds static snapshot.',
    expectedAction: 'clarify-scaffold-relationship', expectedType: 'skill-integration' },
]

const SCENARIOS_CONTEXT_DRIFT = [
  { id: 1, type: 'detection', title: 'Dead File Reference — Deleted File',
    event: 'CLAUDE.md references `src/old_module.ts` but the file was deleted 5 commits ago.',
    expectedAction: 'flag-high-severity', expectedType: 'dead-file-ref' },
  { id: 2, type: 'detection', title: 'Broken Build Command',
    event: 'CLAUDE.md says "build with `make test`" but the Makefile was replaced by package.json scripts. Command fails.',
    expectedAction: 'flag-high-severity', expectedType: 'broken-command' },
  { id: 3, type: 'detection', title: 'Undocumented New Files',
    event: 'Three new files were added to `src/api/` in recent commits. CLAUDE.md architecture section doesnt mention them.',
    expectedAction: 'flag-medium-severity', expectedType: 'undocumented-files' },
  { id: 4, type: 'detection', title: 'Config Drift — Missing Env Var',
    event: 'CLAUDE.md references `REDIS_URL` environment variable but its not in .env.example or any .env file.',
    expectedAction: 'flag-medium-severity', expectedType: 'config-drift' },
  { id: 5, type: 'detection', title: 'Stale Architecture Description',
    event: 'CLAUDE.md says "Entry: git-crypt.cpp → commands.cpp" but commands.cpp was renamed to handler.cpp.',
    expectedAction: 'flag-high-severity', expectedType: 'stale-architecture' },
  { id: 6, type: 'severity', title: 'Correct Severity Classification',
    event: 'Dead file ref should be HIGH. Undocumented new file should be MEDIUM. Orphaned memory bank entry should be LOW.',
    expectedAction: 'classify-correctly', expectedType: 'severity-classification' },
  { id: 7, type: 'ignore', title: 'Respect .context-drift-ignore',
    event: 'legacy/ directory is listed in .context-drift-ignore. CLAUDE.md references a deleted file in legacy/. Should be suppressed.',
    expectedAction: 'suppress-ignored', expectedType: 'ignore-file' },
  { id: 8, type: 'fix', title: 'Generate Fix Suggestions for HIGH Issues',
    event: 'A HIGH severity dead file ref is found. Instructions should guide generating a specific fix suggestion.',
    expectedAction: 'suggest-fix', expectedType: 'fix-generation' },
  { id: 9, type: 'git', title: 'Use Git History for Context',
    event: 'Instructions should guide using `git log --name-status` to understand what changed, not just checking current state.',
    expectedAction: 'use-git-log', expectedType: 'git-integration' },
  { id: 10, type: 'overlap', title: 'Integration with context-loader',
    event: 'After drift detection fixes memory bank files, context-loader should be run to refresh ecosystem context. Instructions should mention this.',
    expectedAction: 'reference-context-loader', expectedType: 'skill-integration' },
]

const SCENARIOS_BY_SKILL = {
  'system-self-correction-v2': SCENARIOS_SELF_CORRECTION,
  'deep-plan-v2': SCENARIOS_DEEP_PLAN,
  'scaffold': SCENARIOS_SCAFFOLD,
  'context-loader': SCENARIOS_CONTEXT_LOADER,
  'context-drift-detector': SCENARIOS_CONTEXT_DRIFT,
}

const EVAL_CRITERIA_BY_SKILL = {
  'system-self-correction-v2': {
    criteria: [
      'Signal Detection: Do instructions clearly guide detecting this type of learning signal?',
      'Classification: Do instructions provide enough guidance to correctly classify the signal type?',
      'Quality Gate: Do gate instructions adequately handle this scenario?',
      'Generalizability: Do instructions help assess whether the learning is generalizable?',
      'No Duplication: Do instructions guide checking for existing documentation?',
      'Correct Action: Do instructions lead to the correct action (update/defer) for this scenario?',
    ],
  },
  'deep-plan-v2': {
    criteria: [
      'Phase Detection: Do instructions guide the agent to the correct phase (discovery/research/planning/implementation)?',
      'Question Quality: Do discovery questions help surface ambiguity and missing info?',
      'Quality Gate: Do spec quality gates catch non-observable or vague criteria?',
      'Footgun Detection: Do footgun audit patterns catch scope creep, missing rollback, and missing design?',
      'Stuck/Checkpoint: Do instructions handle stuck detection and checkpoint strategy?',
      'Proportionality: Do instructions prevent overkill (deep planning for trivial tasks)?',
    ],
  },
  'scaffold': {
    criteria: [
      'Mode Detection: Do instructions correctly identify greenfield vs plan vs reverse-engineer mode?',
      'Parameter Gathering: Do instructions guide collecting all required inputs before execution?',
      'Execution Completeness: Do instructions cover all steps from setup through verification?',
      'Vendor Detection: Do instructions provide comprehensive vendor lock-in detection patterns?',
      'Dependency Ordering: Do instructions guide correct replacement order based on dependencies?',
      'Integration Awareness: Do instructions reference complementary skills (context-loader, drift-detector)?',
    ],
  },
  'context-loader': {
    criteria: [
      'Depth Handling: Do instructions correctly differentiate shallow vs deep scan behavior?',
      'Staleness Detection: Do instructions guide freshness checks before redundant scans?',
      'tmux Mining: Do instructions provide concrete extraction patterns for tmux-logs?',
      'Cross-Project Detection: Do instructions identify and flag cross-session references?',
      'Output Generation: Do instructions guide writing both ecosystem and session-intelligence files?',
      'Skill Integration: Do instructions clarify relationships with scaffold and drift-detector?',
    ],
  },
  'context-drift-detector': {
    criteria: [
      'Detection Coverage: Do instructions cover all drift types (dead refs, broken commands, stale arch)?',
      'Severity Classification: Do instructions correctly guide HIGH vs MEDIUM vs LOW severity?',
      'Git Integration: Do instructions guide using git history for change context?',
      'Ignore File: Do instructions support .context-drift-ignore for suppressing known drift?',
      'Fix Generation: Do instructions guide producing specific fix suggestions for HIGH issues?',
      'Skill Integration: Do instructions reference context-loader as a follow-up action?',
    ],
  },
}

// ─── Load eval.json (preferred) or fall back to hardcoded ────────────────────

const EVAL_JSON_PATH = resolve(EFFECTIVE_DIR, 'eval.json')

function loadEvalConfig() {
  if (existsSync(EVAL_JSON_PATH)) {
    const evalData = JSON.parse(readFileSync(EVAL_JSON_PATH, 'utf8'))
    // Normalize criteria: if objects {name, question}, convert to "Name: Question" strings
    if (evalData.criteria.length > 0 && typeof evalData.criteria[0] === 'object') {
      evalData.criteria = evalData.criteria.map(c => `${c.name}: ${c.question || c.description || ''}`)
    }
    console.log(`  Eval: loaded from eval.json (${evalData.scenarios.length} scenarios × ${evalData.criteria.length} criteria = ${evalData.scenarios.length * evalData.criteria.length} max)`)
    return evalData
  }
  // Fall back to hardcoded
  const scenarios = SCENARIOS_BY_SKILL[SKILL_NAME] || SCENARIOS_SELF_CORRECTION
  const criteriaConfig = EVAL_CRITERIA_BY_SKILL[SKILL_NAME] || EVAL_CRITERIA_BY_SKILL['system-self-correction-v2']
  console.log(`  Eval: using hardcoded (${scenarios.length} scenarios × ${criteriaConfig.criteria.length} criteria)`)
  return { scenarios, criteria: criteriaConfig.criteria }
}

const EVAL_DATA = loadEvalConfig()
const SCENARIOS = EVAL_DATA.scenarios

// Override config with actual counts from eval data
CONFIG.scenarioCount = EVAL_DATA.scenarios.length
CONFIG.criteriaCount = EVAL_DATA.criteria.length

// ─── Evaluation (Gemini as Naked Reasoner) ───────────────────────────────────

async function evaluateWithGemini(skillContent, scenarios) {
  const criteriaList = EVAL_DATA.criteria.map((c, i) => `${i + 1}. ${c}`).join('\n')

  const systemInstruction = `You are an independent evaluator for AI skill quality. You will receive a skill definition and test scenarios. Your job is to score how well the skill's instructions would guide an agent in each scenario.

You must be STRICT and HONEST. If instructions are vague or ambiguous on a point, that is a FAIL.

For each scenario, evaluate these 6 binary criteria:
${criteriaList}

Respond ONLY with a JSON array of ${scenarios.length} objects, one per scenario:
[{"scenario": 1, "criteria": [${EVAL_DATA.criteria.map(() => 'true').join(', ')}]}, ...]

Each criteria array has ${EVAL_DATA.criteria.length} booleans corresponding to the ${EVAL_DATA.criteria.length} checks above.`

  const prompt = `## Skill Being Evaluated

\`\`\`markdown
${skillContent}
\`\`\`

## Test Scenarios

${scenarios.map(s => `### Scenario ${s.id}: ${s.title}
- **Event**: ${s.event}
- **Expected signal type**: ${s.expectedType}
- **Expected action**: ${s.expectedAction}`).join('\n\n')}

Evaluate each scenario against the 6 criteria. Return ONLY the JSON array.`

  const response = await callGemini(prompt, systemInstruction)

  // Parse JSON from response (may be wrapped in markdown code blocks)
  const jsonMatch = response.text.match(/\[[\s\S]*\]/)
  if (!jsonMatch) throw new Error('Gemini did not return valid JSON: ' + response.text.substring(0, 200))

  return { results: JSON.parse(jsonMatch[0]), thoughts: response.thoughts }
}

// ─── Mutation (Claude as Equipped Reasoner) ──────────────────────────────────

async function generateMutation(skillContent, evalResults, changelog, strategyOverride = null) {
  const systemPrompt = `You are an expert prompt engineer optimizing a Claude Code skill. You analyze evaluation failures and propose TARGETED mutations to the skill's markdown instructions.

Rules:
- Change ONE thing at a time (isolate variables)
- Never delete core functionality — only rephrase or restructure
- Keep the skill's overall structure and purpose intact
- Focus on the weakest criterion first
- Return the COMPLETE modified SKILL.md content`

  // Calculate per-criterion failure rates
  const criteriaNames = EVAL_DATA.criteria.map(c => c.split(':')[0])
  const failureCounts = new Array(criteriaNames.length).fill(0)
  const failedScenarios = criteriaNames.map(() => [])

  for (const result of evalResults) {
    result.criteria.forEach((pass, idx) => {
      if (!pass) {
        failureCounts[idx]++
        failedScenarios[idx].push(result.scenario)
      }
    })
  }

  const failureReport = criteriaNames.map((name, idx) =>
    `${name}: ${failureCounts[idx]} failures (scenarios: ${failedScenarios[idx].join(', ') || 'none'})`
  ).join('\n')

  const strategySection = strategyOverride ? `## Meta-Analysis Strategy Override
The optimization loop has been stuck. A meta-analyst recommends this strategy:
${strategyOverride}

Follow this strategy for your mutation instead of your default approach.

` : ''

  const prompt = `${strategySection}## Current Skill
\`\`\`markdown
${skillContent}
\`\`\`

## Evaluation Results
${failureReport}

## Recent Changelog
${changelog.slice(-2000)}

## Task
Analyze the failures above and propose ONE targeted mutation to the skill instructions that would fix the most failures.

Return your response in this format:
MUTATION_DESCRIPTION: <one line describing what you changed and why>
---SKILL_START---
<complete modified SKILL.md content>
---SKILL_END---`

  const response = await callClaude(prompt, systemPrompt)

  const descMatch = response.match(/MUTATION_DESCRIPTION:\s*(.+)/)
  const skillMatch = response.match(/---SKILL_START---([\s\S]*?)---SKILL_END---/)

  if (!skillMatch) throw new Error('Claude did not return modified skill')

  return {
    description: descMatch?.[1]?.trim() || 'Unspecified mutation',
    skill: skillMatch[1].trim(),
  }
}

// ─── Stuck Escalation (Meta-Analysis) ────────────────────────────────────────

async function escalateStuck(skillContent, changelog, roundsData) {
  // Read the skill's baseline for comparison
  const baseline = existsSync(CONFIG.baselinePath) ? readFileSync(CONFIG.baselinePath, 'utf8') : ''

  // Get recent round history (last 10 rounds)
  const recentRounds = roundsData.slice(-10)
  const currentScore = recentRounds[recentRounds.length - 1]?.score || 0
  const maxScore = recentRounds[recentRounds.length - 1]?.max || 0

  // Build the meta-prompt for Gemini
  const metaPrompt = `This skill has been stuck at ${currentScore}/${maxScore} for ${recentRounds.length} rounds.

## Skill Content (Current)
\`\`\`markdown
${skillContent}
\`\`\`

## Recent Rounds
${recentRounds.map(r => `Round ${r.round}: ${r.score}/${r.max} (${r.status}) — ${r.mutation}`).join('\n')}

## Changelog (Recent)
${changelog.slice(-3000)}

## Analysis Task
1. Why are mutations not improving the score? Identify the root cause.
2. Is the evaluation criteria too narrow or testing something the skill doesn't cover?
3. Does the skill need structural redesign rather than incremental tweaks?
4. Propose a NEW mutation strategy that breaks out of the current local optimum.

Return your analysis as:
DIAGNOSIS: <one paragraph explaining why mutations are stuck>
EVAL_REDESIGN_NEEDED: true/false
STRATEGY: <concrete new mutation strategy for Claude to follow>
SUGGESTED_MUTATION: <specific change to make>
`

  const systemInstruction = `You are a meta-analyst for an AI skill optimization system. Skills are markdown prompts evaluated against test scenarios. When the optimization loop gets stuck (no improvement despite mutations), you analyze WHY and propose a new strategy to break out of local optima.`

  const response = await callGemini(metaPrompt, systemInstruction)
  const responseText = response.text

  // Parse the response
  const diagnosis = responseText.match(/DIAGNOSIS:\s*([\s\S]*?)(?=EVAL_REDESIGN_NEEDED:|$)/)?.[1]?.trim() || responseText
  const evalRedesign = /EVAL_REDESIGN_NEEDED:\s*true/i.test(responseText)
  const strategy = responseText.match(/STRATEGY:\s*([\s\S]*?)(?=SUGGESTED_MUTATION:|$)/)?.[1]?.trim() || ''
  const suggestedMutation = responseText.match(/SUGGESTED_MUTATION:\s*([\s\S]*?)$/)?.[1]?.trim() || ''

  return { diagnosis, evalRedesign, strategy, suggestedMutation, rawResponse: responseText }
}

// ─── Results Management ──────────────────────────────────────────────────────

function loadResults() {
  if (!existsSync(CONFIG.resultsPath)) return []
  const lines = readFileSync(CONFIG.resultsPath, 'utf8').trim().split('\n').slice(1)
  return lines.map(line => {
    const [round, score, max, status, ...mutationParts] = line.split('\t')
    return { round: parseInt(round), score: parseInt(score), max: parseInt(max), status, mutation: mutationParts.join('\t') }
  })
}

function appendResult(result) {
  appendFileSync(CONFIG.resultsPath, `${result.round}\t${result.score}\t${result.max}\t${result.status}\t${result.mutation}\n`)
}

// Rich round data stored alongside TSV for dashboard consumption
const RICH_LOG_PATH = resolve(EFFECTIVE_DIR, 'rounds.json')

function loadRichRounds() {
  if (existsSync(RICH_LOG_PATH)) return JSON.parse(readFileSync(RICH_LOG_PATH, 'utf8'))
  return []
}

function appendRichRound(roundData) {
  const rounds = loadRichRounds()
  rounds.push(roundData)
  writeFileSync(RICH_LOG_PATH, JSON.stringify(rounds, null, 2))
}

function syncDashboard() {
  try {
    const rounds = loadRichRounds()
    const totalCost = rounds.reduce((s, r) => s + (r.cost || 0), 0)
    const dashData = {
      skill: SKILL_NAME,
      criteria: EVAL_DATA.criteria.map(c => c.split(':')[0]),
      totalCost,
      models: { mutator: CONFIG.claudeModel, evaluator: CONFIG.geminiModel },
      rounds,
    }
    writeFileSync(CONFIG.dashboardJsonPath, JSON.stringify(dashData, null, 2))
    console.log('  → Dashboard JSON synced')
  } catch (err) {
    console.warn('  → Dashboard sync failed:', err.message)
  }
}

// ─── Terminal Dashboard ──────────────────────────────────────────────────────

function renderTerminalDashboard(results, skillName) {
  const maxScore = CONFIG.scenarioCount * CONFIG.criteriaCount
  const baseline = results.find(r => r.status === 'baseline') || results[0]
  const best = results.reduce((b, r) => (!b || r.score > b.score) ? r : b, null)
  const kept = results.filter(r => r.status === 'kept' || r.status === 'baseline').length
  const improvementPct = baseline && best && baseline.score > 0
    ? (((best.score - baseline.score) / baseline.score) * 100).toFixed(1)
    : '0.0'

  const W = 72 // chart width
  const H = 12 // chart height
  const scores = results.map(r => r.score)
  const minY = Math.min(...scores) - 2
  const maxY = Math.max(...scores) + 2
  const range = maxY - minY || 1

  // Build ASCII chart
  const chart = []
  for (let row = 0; row < H; row++) {
    const yVal = maxY - (row / (H - 1)) * range
    const label = Math.round(yVal).toString().padStart(3)
    let line = `  ${label} │`
    for (let col = 0; col < Math.min(scores.length, W); col++) {
      const normalized = ((scores[col] - minY) / range) * (H - 1)
      const chartRow = H - 1 - row
      if (Math.round(normalized) === chartRow) {
        const isKept = results[col].status === 'kept' || results[col].status === 'baseline'
        line += isKept ? '●' : '○'
      } else if (Math.round(normalized) > chartRow) {
        line += ' '
      } else {
        line += ' '
      }
    }
    chart.push(line)
  }
  const xAxis = '      └' + '─'.repeat(Math.min(scores.length, W)) + '─▸ Round'

  // Render
  const reset = '\x1b[0m'
  const bold = '\x1b[1m'
  const dim = '\x1b[2m'
  const green = '\x1b[32m'
  const amber = '\x1b[33m'
  const red = '\x1b[31m'
  const cyan = '\x1b[36m'
  const white = '\x1b[37m'

  console.log('\x1b[2J\x1b[H') // clear screen
  console.log(`${bold}${amber}  ⚗  Autoresearch${reset}  ${dim}LIVE${reset}  ${dim}─ ${skillName}${reset}`)
  console.log(`${dim}  Autonomous skill improvement via cross-model evaluation${reset}`)
  console.log()

  // Metric cards
  const bestStr = best ? `${best.score}/${best.max}` : '—'
  const baseStr = baseline ? `${baseline.score}/${baseline.max}` : '—'
  const impStr = `${parseFloat(improvementPct) > 0 ? '+' : ''}${improvementPct}%`
  const runStr = `${results.length} / ${kept}`

  console.log(`  ┌──────────────┬──────────────┬──────────────┬──────────────┐`)
  console.log(`  │ ${dim}CURRENT BEST${reset} │ ${dim}BASELINE${reset}     │ ${dim}IMPROVEMENT${reset}  │ ${dim}RUNS / KEPT${reset}  │`)
  console.log(`  │ ${bold}${green}${bestStr.padEnd(13)}${reset}│ ${white}${baseStr.padEnd(13)}${reset}│ ${cyan}${impStr.padEnd(13)}${reset}│ ${white}${runStr.padEnd(13)}${reset}│`)
  console.log(`  └──────────────┴──────────────┴──────────────┴──────────────┘`)
  console.log()

  // Chart
  console.log(`  ${bold}Score Progress${reset}    ${dim}● kept  ○ reverted${reset}`)
  console.log()
  for (const line of chart) {
    console.log(line)
  }
  console.log(xAxis)
  console.log()

  // Last 8 results as table
  console.log(`  ${bold}Experiment History${reset}`)
  console.log(`  ${dim}${'ROUND'.padEnd(7)}${'SCORE'.padEnd(9)}${'RATE'.padEnd(7)}${'STATUS'.padEnd(12)}MUTATION${reset}`)
  console.log(`  ${dim}${'─'.repeat(65)}${reset}`)
  const recent = results.slice(-8).reverse()
  for (const r of recent) {
    const pct = ((r.score / r.max) * 100).toFixed(0) + '%'
    const statusColor = r.status === 'kept' || r.status === 'baseline' ? green : r.status === 'reverted' ? red : white
    const bar = '█'.repeat(Math.round((r.score / r.max) * 10)) + '░'.repeat(10 - Math.round((r.score / r.max) * 10))
    const mutation = (r.mutation || '').substring(0, 35)
    console.log(`  ${String(r.round).padEnd(7)}${(r.score + '/' + r.max).padEnd(9)}${pct.padEnd(7)}${statusColor}${r.status.padEnd(12)}${reset}${dim}${mutation}${reset}`)
  }
  console.log()
  console.log(`  ${dim}Updated: ${new Date().toLocaleTimeString()}${reset}`)
}

// ─── Main Loop ───────────────────────────────────────────────────────────────

async function runRound(roundNum, bestScore, bestSkill, pendingMutation, strategyOverride = null) {
  const skill = readFileSync(CONFIG.skillPath, 'utf8')
  const changelog = existsSync(CONFIG.changelogPath) ? readFileSync(CONFIG.changelogPath, 'utf8') : ''
  const criteriaShortNames = EVAL_DATA.criteria.map(c => c.split(':')[0])

  console.log(`\n═══ Round ${roundNum} ═══`)

  // Step 1: Evaluate with Gemini (naked reasoner)
  console.log(`  [Gemini ${CONFIG.geminiModel}] Evaluating skill against ${CONFIG.scenarioCount} scenarios...`)
  const geminiResponse = await evaluateWithGemini(skill, SCENARIOS)
  const evalResults = geminiResponse.results
  const geminiThoughts = geminiResponse.thoughts

  // Step 2: Score — compute per-criteria totals
  const totalPass = evalResults.reduce((sum, r) => sum + r.criteria.filter(Boolean).length, 0)
  const maxScore = CONFIG.scenarioCount * CONFIG.criteriaCount
  const perCriteria = criteriaShortNames.map((_, ci) =>
    evalResults.reduce((sum, r) => sum + (r.criteria[ci] ? 1 : 0), 0)
  )
  console.log(`  [Score] ${totalPass}/${maxScore}`)

  // Build failure detail for changelog and dashboard
  const failureDetails = []
  evalResults.forEach(r => {
    r.criteria.forEach((pass, idx) => {
      if (!pass) failureDetails.push({ scenario: r.scenario, criterion: criteriaShortNames[idx] || `Criterion ${idx + 1}` })
    })
  })
  const failureSummary = failureDetails.length > 0
    ? failureDetails.map(f => `S${f.scenario}: ${f.criterion}`).join(', ')
    : 'none'

  // Estimate cost (~$0.03 for Gemini eval)
  const evalCost = 0.03

  // Step 3: Decision
  let status, mutationDesc, mutationCost = 0, decisionReason
  if (totalPass > bestScore) {
    status = roundNum === 0 && bestScore === 0 ? 'baseline' : 'kept'
    decisionReason = bestScore === 0 ? 'Initial baseline evaluation' : `Improved from ${bestScore} to ${totalPass}`
    console.log(`  [Decision] ${status.toUpperCase()} (${bestScore} → ${totalPass})`)
    const prevBestScore = bestScore
    bestScore = totalPass
    bestSkill = skill
    mutationDesc = pendingMutation
    appendResult({ round: roundNum, score: totalPass, max: maxScore, status, mutation: mutationDesc })

    // Emit improvement event for supervisor/Telegram notifications
    if (status === 'kept') {
      const eventsPath = resolve(EFFECTIVE_DIR, 'events.jsonl')
      const impEvent = JSON.stringify({
        type: 'improvement',
        skill: CONFIG.skillName,
        oldScore: prevBestScore,
        newScore: totalPass,
        max: maxScore,
        mutation: mutationDesc || '',
        timestamp: new Date().toISOString(),
      })
      appendFileSync(eventsPath, impEvent + '\n')
    }
    appendFileSync(CONFIG.changelogPath, `\n## Round ${roundNum}\n- **Score**: ${totalPass}/${maxScore} (${status})\n- **Failures**: ${failureSummary}\n- **Per-criteria**: ${criteriaShortNames.map((n, i) => `${n}: ${perCriteria[i]}/${CONFIG.scenarioCount}`).join(', ')}\n`)
  } else {
    status = 'reverted'
    decisionReason = `Score ${totalPass} did not exceed best ${bestScore} — mutation produced worse or equal results`
    console.log(`  [Decision] REVERTED (${totalPass} <= ${bestScore})`)
    writeFileSync(CONFIG.skillPath, bestSkill)
    mutationDesc = `Reverted — scored ${totalPass} vs best ${bestScore}`
    appendResult({ round: roundNum, score: totalPass, max: maxScore, status, mutation: mutationDesc })
  }

  // Write rich round data for dashboard
  const richRound = {
    round: roundNum,
    score: totalPass,
    max: maxScore,
    status,
    mutation: mutationDesc,
    cost: evalCost,
    criteria: perCriteria,
    failures: failureDetails,
    geminiThoughts,
    decisionReason,
    models: { evaluator: CONFIG.geminiModel, mutator: CONFIG.claudeModel },
    timestamp: new Date().toISOString(),
  }

  // Step 4: Check if target reached
  if (totalPass >= CONFIG.targetScore) {
    richRound.changelog = `Target reached at ${totalPass}/${maxScore} (${((totalPass/maxScore)*100).toFixed(1)}%)\n**Mutation that achieved this**: ${pendingMutation}`
    appendRichRound(richRound)
    console.log(`\n  ✓ TARGET REACHED: ${totalPass}/${maxScore} (${((totalPass/maxScore)*100).toFixed(1)}%)`)

    // Emit target_reached event for supervisor/Telegram notifications
    const eventsPath = resolve(EFFECTIVE_DIR, 'events.jsonl')
    const trEvent = JSON.stringify({
      type: 'target_reached',
      skill: CONFIG.skillName,
      score: totalPass,
      max: maxScore,
      timestamp: new Date().toISOString(),
    })
    appendFileSync(eventsPath, trEvent + '\n')

    return { done: true, bestScore, bestSkill, nextMutation: pendingMutation }
  }

  // Step 5: Mutate for next round (Claude as equipped reasoner)
  console.log(`  [Claude ${CONFIG.claudeModel}] Generating mutation...`)
  try {
    const mutation = await generateMutation(skill, evalResults, changelog, strategyOverride)
    console.log(`  [Mutation] ${mutation.description}`)
    writeFileSync(CONFIG.skillPath, mutation.skill)
    mutationCost = 0.02
    richRound.cost += mutationCost
    richRound.mutation = mutation.description
    richRound.changelog = `**Mutation**: ${mutation.description}\n**Failures**: ${failureSummary}\n**Per-criteria**: ${criteriaShortNames.map((n, i) => `${n}: ${perCriteria[i]}/${CONFIG.scenarioCount}`).join(', ')}\n**Decision**: ${decisionReason}`
    appendRichRound(richRound)
    appendFileSync(CONFIG.changelogPath, `\n## Round ${roundNum + 1} — Mutation Applied\n- **Mutation**: ${mutation.description}\n`)
    return { done: false, bestScore, bestSkill, nextMutation: mutation.description }
  } catch (err) {
    console.error(`  [Mutation FAILED] ${err.message}`)
    richRound.mutation = `Mutation failed: ${err.message}`
    richRound.changelog = `**Mutation failed**: ${err.message}\n**Failures**: ${failureSummary}`
    appendRichRound(richRound)
    // Continue to next round with the same skill (no mutation applied)
    return { done: false, bestScore, bestSkill, nextMutation: pendingMutation }
  }
}

async function main() {
  const continuous = args.includes('--continuous')
  const dashboardSync = args.includes('--dashboard-sync')
  const tui = args.includes('--tui')
  const roundsFlag = args.indexOf('--rounds')
  const maxRounds = roundsFlag >= 0 ? parseInt(args[roundsFlag + 1]) : (continuous ? 100 : 1)

  console.log('╔══════════════════════════════════════════╗')
  console.log('║  Autoresearch: Skill Improvement Engine  ║')
  console.log('║  Cross-Model: Claude → Gemini → Claude   ║')
  console.log('╚══════════════════════════════════════════╝')
  console.log(`\nSkill: ${CONFIG.skillName}`)
  console.log(`Working dir: ${EFFECTIVE_DIR}`)

  const results = loadResults()
  let bestScore = results.reduce((b, r) => Math.max(b, r.score), 0)
  let bestSkill = readFileSync(CONFIG.skillPath, 'utf8')
  let pendingMutation = 'Original SKILL.md — no mutations'  // tracks what mutation is being evaluated
  const startRound = results.length > 0 ? results[results.length - 1].round + 1 : 0

  console.log(`\nStarting from round ${startRound}, best score: ${bestScore}`)

  let stuckCounter = 0
  let strategyOverride = null

  for (let i = startRound; i < startRound + maxRounds; i++) {
    const prevBest = bestScore
    const { done, bestScore: newBest, bestSkill: newSkill, nextMutation } = await runRound(i, bestScore, bestSkill, pendingMutation, strategyOverride)
    bestScore = newBest
    bestSkill = newSkill
    if (nextMutation) pendingMutation = nextMutation
    // Clear strategy override after it's been used for one round
    if (strategyOverride) strategyOverride = null

    if (dashboardSync) {
      syncDashboard()
    }
    if (tui) {
      renderTerminalDashboard(loadResults(), CONFIG.skillName)
    }

    if (done) break

    // Stuck detection with escalation
    if (bestScore === prevBest) {
      stuckCounter++

      // Escalation at threshold — call meta-analyst
      if (stuckCounter === CONFIG.maxStuckRounds) {
        console.log(`\n  ⚠ STUCK: No improvement for ${CONFIG.maxStuckRounds} rounds. Escalating to meta-analyst...`)
        try {
          const skill = readFileSync(CONFIG.skillPath, 'utf8')
          const changelog = existsSync(CONFIG.changelogPath) ? readFileSync(CONFIG.changelogPath, 'utf8') : ''
          const roundsData = loadRichRounds()
          const escalation = await escalateStuck(skill, changelog, roundsData)

          console.log(`  [Escalation] Diagnosis: ${escalation.diagnosis.substring(0, 150)}...`)
          console.log(`  [Escalation] Eval redesign needed: ${escalation.evalRedesign}`)
          console.log(`  [Escalation] Strategy: ${escalation.strategy.substring(0, 150)}...`)

          // Log escalation round
          const currentScore = roundsData[roundsData.length - 1]?.score || 0
          const maxScore = roundsData[roundsData.length - 1]?.max || 0
          const perCriteria = roundsData[roundsData.length - 1]?.criteria || []
          const escalationRound = {
            round: i,
            score: currentScore,
            max: maxScore,
            status: 'escalation',
            mutation: `Stuck escalation: ${escalation.diagnosis.substring(0, 200)}`,
            cost: 0.03,
            criteria: perCriteria,
            failures: [],
            decisionReason: `Stuck escalation triggered after ${CONFIG.maxStuckRounds}+ rounds with no improvement`,
            escalation: {
              diagnosis: escalation.diagnosis,
              evalRedesignNeeded: escalation.evalRedesign,
              strategy: escalation.strategy,
              suggestedMutation: escalation.suggestedMutation,
            },
            models: { evaluator: CONFIG.geminiModel, mutator: CONFIG.claudeModel },
            timestamp: new Date().toISOString(),
          }
          appendRichRound(escalationRound)

          // Emit escalation event for supervisor/Telegram notifications
          const eventsPath = resolve(EFFECTIVE_DIR, 'events.jsonl')
          const event = JSON.stringify({
            type: 'stuck_escalation',
            skill: CONFIG.skillName,
            score: currentScore,
            max: maxScore,
            diagnosis: escalation.diagnosis,
            evalRedesign: escalation.evalRedesign,
            timestamp: new Date().toISOString(),
          })
          appendFileSync(eventsPath, event + '\n')

          // Inject strategy override for the next mutation
          strategyOverride = escalation.strategy + (escalation.suggestedMutation ? `\n\nSuggested specific mutation:\n${escalation.suggestedMutation}` : '')
        } catch (err) {
          console.error(`  [Escalation FAILED] ${err.message}`)
        }
      }

      // Hard stop after maxStuckBeforeStop
      if (stuckCounter >= CONFIG.maxStuckBeforeStop) {
        console.log(`\n  ⚠ STUCK: No improvement for ${CONFIG.maxStuckBeforeStop} rounds (even after escalation). Stopping.`)
        break
      }
    } else {
      stuckCounter = 0
    }
  }

  console.log(`\n════════════════════════════════════`)
  console.log(`Final best score: ${bestScore}/${CONFIG.scenarioCount * CONFIG.criteriaCount}`)
  console.log(`Results: ${CONFIG.resultsPath}`)
  console.log(`Changelog: ${CONFIG.changelogPath}`)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
