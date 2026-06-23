#!/usr/bin/env node
// ─── Skill Genesis ──────────────────────────────────────────────────────────
// Automatically creates new skills from want engine specifications.
// Reads wants.json, calls Gemini to generate SKILL.md, creates working dirs.
//
// Usage:
//   node skills/skill-genesis.mjs                    # Dry-run: show proposed creations
//   node skills/skill-genesis.mjs --approve          # Actually create skills
//   node skills/skill-genesis.mjs --want want-015    # Process specific want
//   node skills/skill-genesis.mjs --threshold 0.5    # Lower threshold (default 0.7)
//   node skills/skill-genesis.mjs --dry-run          # Explicit dry-run (default)
//   node skills/skill-genesis.mjs --want want-015 --approve  # Create specific skill
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync, readdirSync } from 'node:fs'
import { resolve, basename } from 'node:path'

const BASE = resolve(import.meta.dirname, '..')
const WANTS_PATH = resolve(BASE, 'wants.json')
const SKILLS_DIR = resolve(BASE, 'skills')
const WORLD_MODEL_PATH = resolve(BASE, 'world-model.json')
const GEMINI_MODEL = 'gemini-2.5-pro'

// ─── Domain-Specific Eval Templates ───────────────────────────────────────────
// When skill-genesis processes a domain_coverage_gap want, these templates
// produce richer, domain-aware eval scenarios instead of generic ones.
// Extend this map for future domains.

const DOMAIN_EVAL_TEMPLATES = {
  content_creation: {
    scenarios: [
      { id: 1, type: 'analysis', title: 'Engagement Analysis', event: "User asks to analyze their last 10 posts' engagement metrics (likes, comments, restacks) and identify what content type performs best", expectedAction: 'use-engagement-data', expectedType: 'performance-analysis' },
      { id: 2, type: 'gap-detection', title: 'Content Gap Discovery', event: "User wants to find topics their audience cares about that they haven't written about yet, based on network trends and comment patterns", expectedAction: 'analyze-gaps', expectedType: 'topic-discovery' },
      { id: 3, type: 'strategy', title: 'Publishing Schedule Optimization', event: 'User publishes randomly and wants a data-driven publishing schedule based on when their audience is most engaged', expectedAction: 'optimize-schedule', expectedType: 'calendar-strategy' },
      { id: 4, type: 'competitive', title: 'Network Trend Analysis', event: 'User wants to understand what topics are trending across their Substack network (recommendations, restacks) to ride emerging waves', expectedAction: 'analyze-trends', expectedType: 'competitive-intel' },
      { id: 5, type: 'creation', title: 'Content Remix', event: 'User has a high-performing post and wants to create variations (thread, notes, newsletter) to maximize reach across formats', expectedAction: 'remix-content', expectedType: 'content-generation' },
      { id: 6, type: 'monetization', title: 'Subscriber Growth Strategy', event: 'User has 500 free subscribers and wants a plan to convert 10% to paid, using engagement data to identify most-convertible audience segments', expectedAction: 'growth-plan', expectedType: 'monetization' },
      { id: 7, type: 'edge-case', title: 'Cold Start — New Publication', event: 'User just started a Substack with 0 posts and 0 subscribers. No historical data exists. Skill should provide bootstrapping guidance', expectedAction: 'bootstrap-strategy', expectedType: 'cold-start' },
      { id: 8, type: 'integration', title: 'Cross-Platform Content Strategy', event: 'User publishes on Substack and wants to understand how to repurpose content for other platforms using available tools', expectedAction: 'cross-platform-plan', expectedType: 'integration' },
    ],
    criteria: [
      'Data Grounding: Does the skill\'s guidance reference specific metrics from MCP tools (engagement rates, comment sentiment, network trends) rather than generic advice?',
      'Actionability: Does the skill produce concrete next steps with timelines, not vague recommendations?',
      'Audience Awareness: Does the skill consider the specific audience\'s behavior patterns rather than generic Substack advice?',
      'Tool Utilization: Does the skill reference specific MCP capabilities (analyze-engagement, discover-gaps, analyze-network-trends, generate-content-calendar) by name?',
      'Measurement: Does the skill define success metrics that can be verified using MCP data after implementation?',
      'Adaptation: Does the skill handle edge cases (cold start, declining engagement, niche topics) with different strategies?',
    ],
  },
  // Future domain templates:
  // software_development: { scenarios: [...], criteria: [...] },
  // research_synthesis: { scenarios: [...], criteria: [...] },
  // monetization_platform: { scenarios: [...], criteria: [...] },
}

// ─── Domain Context Discovery ─────────────────────────────────────────────────
// Reads MCP tool descriptions and world-model domain info to enrich eval generation.

function discoverDomainContext(want) {
  const context = { domain: null, mcpServer: null, subdomains: [], toolNames: [], toolCount: 0 }

  // Only applies to domain_coverage_gap wants
  if (want.type !== 'domain_coverage_gap') return context

  // Try to find domain info from world-model.json
  if (existsSync(WORLD_MODEL_PATH)) {
    try {
      const worldModel = JSON.parse(readFileSync(WORLD_MODEL_PATH, 'utf8'))
      const mcpDomains = worldModel.mcp_domains || []

      // Match by MCP server name from evidence, or by domain from proposed_skill
      for (const mcpDomain of mcpDomains) {
        const evidenceStr = (want.evidence || []).join(' ').toLowerCase()
        if (
          evidenceStr.includes(mcpDomain.mcp_server) ||
          evidenceStr.includes(mcpDomain.domain)
        ) {
          context.domain = mcpDomain.domain
          context.mcpServer = mcpDomain.mcp_server
          context.subdomains = mcpDomain.subdomains || []
          context.toolCount = mcpDomain.tool_count || 0
          break
        }
      }
    } catch { /* ignore parse errors */ }
  }

  // For Substack specifically, read tool filenames for capability context
  if (context.mcpServer === 'substack') {
    const toolsDir = resolve(
      process.env.HOME,
      '.remote/@builds.karve.ai/packages/mcp-substack-tools/src/tools'
    )
    if (existsSync(toolsDir)) {
      try {
        context.toolNames = readdirSync(toolsDir)
          .filter(f => f.endsWith('.ts'))
          .map(f => basename(f, '.ts'))
      } catch { /* ignore read errors */ }
    }
  }

  return context
}

// ─── CLI Argument Parsing ───────────────────────────────────────────────────

const args = process.argv.slice(2)

function getArgValue(flag) {
  const idx = args.indexOf(flag)
  if (idx === -1 || idx + 1 >= args.length) return null
  return args[idx + 1]
}

const APPROVE = args.includes('--approve')
const DRY_RUN = !APPROVE // Default is dry-run unless --approve is passed
const THRESHOLD = parseFloat(getArgValue('--threshold') || '0.7')
const SPECIFIC_WANT = getArgValue('--want')

// ─── Utilities ──────────────────────────────────────────────────────────────

function loadGeminiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY
  const paths = [
    '/usr/local/etc/autoresearch-credentials/gemini-api-key.txt', resolve(process.env.HOME, '.claude/.credentials/gemini-api-key.txt'),
  ]
  for (const p of paths) {
    if (existsSync(p)) return readFileSync(p, 'utf8').trim()
  }
  throw new Error('GEMINI_API_KEY not found')
}

async function callGemini(prompt, systemInstruction) {
  const apiKey = loadGeminiKey()
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
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

// ─── Load Wants ─────────────────────────────────────────────────────────────

function loadWants() {
  if (!existsSync(WANTS_PATH)) throw new Error(`wants.json not found: ${WANTS_PATH}`)
  return JSON.parse(readFileSync(WANTS_PATH, 'utf8'))
}

function getEligibleWants(wantsData) {
  const wants = wantsData.wants || []

  return wants.filter(w => {
    // Must have a proposed_skill
    if (!w.proposed_skill) return false

    // Skip already-processed wants
    if (w.status === 'genesis_complete') return false

    // Filter by specific want ID if provided
    if (SPECIFIC_WANT && w.id !== SPECIFIC_WANT) return false

    // Filter by threshold (score must be >= threshold)
    if (w.score < THRESHOLD) return false

    // Check if working directory already exists
    const workingDir = resolve(SKILLS_DIR, `working-${w.proposed_skill.name}`)
    if (existsSync(workingDir)) {
      console.log(`  Skipping ${w.id} (${w.proposed_skill.name}): working directory already exists`)
      return false
    }

    return true
  })
}

// ─── Gemini SKILL.md Generation ─────────────────────────────────────────────

async function generateSkillMd(want) {
  const spec = want.proposed_skill

  const systemInstruction = `You are a skill prompt engineer for an AI agent system (Claude Code). You write detailed, actionable skill definition documents (SKILL.md) that guide Claude Code to perform specific tasks. Your output is a complete markdown document — no code fences wrapping it, just the raw markdown content. The document should be thorough, specific, and immediately usable.`

  const prompt = `Generate a complete SKILL.md document for the following skill specification:

SKILL NAME: ${spec.name}
DESCRIPTION: ${spec.description}

ORIGIN: Want ${want.id}
HYPOTHESIS: ${want.hypothesis}

EVIDENCE:
${(want.evidence || []).map(e => `- ${e}`).join('\n')}

EVALUATION CRITERIA (binary yes/no):
${spec.criteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}

TEST SCENARIOS:
${spec.scenarios.map((s, i) => `${i + 1}. ${s}`).join('\n')}

Generate a comprehensive SKILL.md with these sections:

1. **Header** — Skill name, one-line description
2. **Purpose** — Why this skill exists (reference the want/hypothesis)
3. **Trigger Conditions** — When should Claude Code activate this skill (slash command, keywords, automatic detection)
4. **Prerequisites** — What must exist before this skill can run
5. **Execution Steps** — Numbered, detailed steps the agent must follow. Each step should be specific enough that an LLM can execute it without ambiguity. Include tool usage hints (Read, Grep, Glob, Bash, Edit, Write).
6. **Output Format** — What the skill produces (files, console output, structured data)
7. **Quality Gates** — Validation checks before marking complete (derived from the criteria)
8. **Integration Points** — How this skill connects to other skills/systems in the autoresearch ecosystem
9. **Error Handling** — What to do when things go wrong
10. **Examples** — 2-3 concrete usage examples

The skill operates within an autoresearch ecosystem at ~/.remote/@autoresearch/ with:
- skills/ directory containing working-{name}/ directories for each skill
- Each skill has: SKILL.md, eval.json, rounds.json, changelog.md, events.jsonl
- Self-model (self-model.json) and world-model (world-model.json) track system state
- wants.json tracks capability gaps
- Skills are evaluated by an autoresearch-runner that scores them against eval.json criteria

Write the SKILL.md as a direct markdown document. Do NOT wrap it in code fences. Start with a # heading.`

  console.log(`  Calling Gemini to generate SKILL.md for "${spec.name}"...`)
  const response = await callGemini(prompt, systemInstruction)

  if (response.thoughts) {
    console.log(`  Gemini thinking: ${response.thoughts.substring(0, 150)}...`)
  }

  // Clean up response — remove any wrapping code fences if present
  let text = response.text.trim()
  if (text.startsWith('```markdown')) {
    text = text.replace(/^```markdown\n?/, '').replace(/\n?```$/, '')
  } else if (text.startsWith('```')) {
    text = text.replace(/^```\n?/, '').replace(/\n?```$/, '')
  }

  return text
}

// ─── Eval.json Generation ───────────────────────────────────────────────────

function generateEvalJson(spec, want = null) {
  // Check if a domain-specific template exists for this want
  const domainContext = want ? discoverDomainContext(want) : { domain: null }

  if (domainContext.domain && DOMAIN_EVAL_TEMPLATES[domainContext.domain]) {
    const template = DOMAIN_EVAL_TEMPLATES[domainContext.domain]
    console.log(`  Using domain-specific eval template for "${domainContext.domain}"`)
    if (domainContext.toolNames.length > 0) {
      console.log(`  MCP tools discovered: ${domainContext.toolNames.length} (${domainContext.mcpServer})`)
    }
    return {
      scenarios: template.scenarios,
      criteria: template.criteria,
      _meta: {
        domain: domainContext.domain,
        mcp_server: domainContext.mcpServer,
        subdomains: domainContext.subdomains,
        tool_count: domainContext.toolCount,
        tool_names: domainContext.toolNames,
        generated_at: new Date().toISOString(),
        template_version: '1.0',
      },
    }
  }

  // Fallback: generic eval generation from proposed_skill spec
  const scenarios = spec.scenarios.map((s, i) => {
    // Determine type based on position — first few are happy, last ones are edge cases
    let type = 'happy'
    if (i >= spec.scenarios.length - 2) type = 'edge'
    else if (i >= Math.ceil(spec.scenarios.length / 2)) type = 'diagnostic'

    return {
      id: i + 1,
      type,
      title: s.substring(0, 80).replace(/[.!?]$/, ''),
      event: s,
      expectedAction: `The skill should successfully handle this scenario and produce correct results.`,
      expectedType: 'action',
    }
  })

  const criteria = spec.criteria.map(c => {
    // Extract a short name from the criterion
    const nameMatch = c.match(/^Does the skill (correctly |successfully )?(.+?)\?/)
    const name = nameMatch
      ? nameMatch[2].charAt(0).toUpperCase() + nameMatch[2].slice(1)
      : c.replace(/\?$/, '')
    return `${name}: ${c}`
  })

  return { scenarios, criteria }
}

// ─── Working Directory Creation ─────────────────────────────────────────────

function createWorkingDirectory(want, skillMd, evalJson) {
  const spec = want.proposed_skill
  const dirName = `working-${spec.name}`
  const dirPath = resolve(SKILLS_DIR, dirName)

  // Create directory
  mkdirSync(dirPath, { recursive: true })

  // SKILL.md
  writeFileSync(resolve(dirPath, 'SKILL.md'), skillMd)

  // SKILL.md.baseline (copy)
  writeFileSync(resolve(dirPath, 'SKILL.md.baseline'), skillMd)

  // eval.json
  writeFileSync(resolve(dirPath, 'eval.json'), JSON.stringify(evalJson, null, 2))

  // rounds.json (empty array)
  writeFileSync(resolve(dirPath, 'rounds.json'), '[]')

  // changelog.md
  const changelog = `# Autoresearch Changelog: ${spec.name}

## Genesis
- Created from want: ${want.id}
- Hypothesis: ${want.hypothesis}
- Score: ${want.score}
- Criteria: ${spec.criteria.length}
- Scenarios: ${spec.scenarios.length}
`
  writeFileSync(resolve(dirPath, 'changelog.md'), changelog)

  // events.jsonl
  const event = {
    type: 'skill_genesis',
    skill: spec.name,
    want_id: want.id,
    hypothesis: want.hypothesis,
    timestamp: new Date().toISOString(),
  }
  appendFileSync(resolve(dirPath, 'events.jsonl'), JSON.stringify(event) + '\n')

  return dirPath
}

// ─── Update wants.json ──────────────────────────────────────────────────────

function markWantComplete(wantsData, wantId) {
  const want = wantsData.wants.find(w => w.id === wantId)
  if (want) {
    want.status = 'genesis_complete'
  }
}

// ─── Summary Display ────────────────────────────────────────────────────────

function printProposedCreations(eligible) {
  console.log('\n═══ Skill Genesis — Proposed Creations ═══\n')

  if (eligible.length === 0) {
    console.log('  No eligible wants found.')
    console.log(`  (threshold: ${THRESHOLD}, specific want: ${SPECIFIC_WANT || 'none'})`)
    console.log('  Wants must have a proposed_skill, score >= threshold,')
    console.log('  and no existing working-{name}/ directory.\n')
    return
  }

  for (let i = 0; i < eligible.length; i++) {
    const w = eligible[i]
    const spec = w.proposed_skill
    console.log(`  ${i + 1}. ${spec.name} (from ${w.id}, score ${w.score.toFixed(3)})`)
    console.log(`     "${spec.description}"`)
    console.log(`     ${spec.criteria.length} criteria, ${spec.scenarios.length} scenarios`)
    console.log('')
  }

  if (DRY_RUN) {
    console.log('  This is a DRY RUN. No skills will be created.')
    console.log('  Pass --approve to create. Or --want <id> --approve for specific.\n')
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('Skill Genesis v1.0')
  console.log(`Mode: ${DRY_RUN ? 'dry-run (default)' : 'APPROVE — will create skills'}`)
  console.log(`Threshold: ${THRESHOLD}`)
  if (SPECIFIC_WANT) console.log(`Specific want: ${SPECIFIC_WANT}`)
  console.log('')

  // 1. Load wants
  console.log('Loading wants.json...')
  const wantsData = loadWants()
  console.log(`  ${wantsData.wants.length} total wants`)

  // 2. Filter eligible wants
  console.log('\nFiltering eligible wants...')
  const eligible = getEligibleWants(wantsData)
  console.log(`  ${eligible.length} eligible for genesis`)

  // 3. Print summary
  printProposedCreations(eligible)

  if (DRY_RUN || eligible.length === 0) return

  // 4. Process each eligible want
  console.log('─── Creating Skills ───\n')
  let created = 0

  for (const want of eligible) {
    const spec = want.proposed_skill
    console.log(`Processing: ${spec.name} (${want.id})...`)

    try {
      // a) Generate SKILL.md via Gemini
      const skillMd = await generateSkillMd(want)
      console.log(`  Generated SKILL.md (${skillMd.length} chars)`)

      // b) Generate eval.json from criteria + scenarios (domain-aware if applicable)
      const evalJson = generateEvalJson(spec, want)
      console.log(`  Generated eval.json (${evalJson.scenarios.length} scenarios, ${evalJson.criteria.length} criteria)`)

      // c) Create working directory with all files
      const dirPath = createWorkingDirectory(want, skillMd, evalJson)
      console.log(`  Created: ${dirPath}`)

      // d) Update wants.json status
      markWantComplete(wantsData, want.id)
      console.log(`  Marked ${want.id} as genesis_complete`)

      created++
      console.log(`  Done: ${spec.name}\n`)
    } catch (e) {
      console.error(`  ERROR creating ${spec.name}: ${e.message}`)
      console.error(`  Skipping...\n`)
    }
  }

  // 5. Write updated wants.json
  if (created > 0) {
    writeFileSync(WANTS_PATH, JSON.stringify(wantsData, null, 2))
    console.log(`Updated wants.json (${created} want(s) marked genesis_complete)`)
  }

  console.log(`\n═══ Skill Genesis Complete ═══`)
  console.log(`  Created: ${created}/${eligible.length} skills`)
}

main().catch(e => {
  console.error('FATAL:', e.message)
  process.exit(1)
})
