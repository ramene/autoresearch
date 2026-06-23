#!/usr/bin/env node
// ─── Want Engine (Delta Function) ────────────────────────────────────────────
// Compares self-model against world-model to produce capability gap hypotheses.
// want = delta(self_model, world_signal)
//
// Usage:
//   node skills/want-engine.mjs            # Full analysis with Gemini
//   node skills/want-engine.mjs --rules-only  # Rule-based only, skip Gemini
//   node skills/want-engine.mjs --dry-run     # Print analysis plan, no Gemini call
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const BASE = resolve(import.meta.dirname, '..')
const SELF_MODEL_PATH = resolve(BASE, 'self-model.json')
const WORLD_MODEL_PATH = resolve(BASE, 'world-model.json')
const OUTPUT_PATH = resolve(BASE, 'wants.json')
const GEMINI_MODEL = 'gemini-2.5-pro'

const args = process.argv.slice(2)
const RULES_ONLY = args.includes('--rules-only')
const DRY_RUN = args.includes('--dry-run')

// ─── Utilities ───────────────────────────────────────────────────────────────

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

// ─── Preference Model (awareness, not direction) ─────────────────────────────
// Preferences BOOST wants that align with user interests, never BLOCK others.
// A want about "AMM liquidity" gets boosted by financial_markets weight (1.8).
// A want about "testing" gets no boost (1.0) — still evaluated on its own merit.

const AUTORESEARCH_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PREF_PATH = resolve(AUTORESEARCH_ROOT, 'preference-model.json')
let PREFERENCES = null
try {
  if (existsSync(PREF_PATH)) {
    PREFERENCES = JSON.parse(readFileSync(PREF_PATH, 'utf8'))
    console.log(`  Preferences: loaded (${Object.keys(PREFERENCES.interests || {}).length} interest domains)`)
  }
} catch { /* no preferences — all wants weighted equally */ }

function getPreferenceBoost(want) {
  if (!PREFERENCES?.interests) return 1.0
  const text = `${want.hypothesis || ''} ${want.evidence?.join(' ') || ''} ${want.proposed_skill?.name || ''} ${want.proposed_skill?.description || ''}`.toLowerCase()

  let maxWeight = 1.0
  for (const [domain, pref] of Object.entries(PREFERENCES.interests)) {
    const signals = pref.signals || []
    const keywords = signals.join(' ').toLowerCase().split(/\s+/)
    // Check if any signal keywords match the want text
    const matches = keywords.filter(kw => kw.length > 3 && text.includes(kw)).length
    if (matches >= 2) {
      maxWeight = Math.max(maxWeight, pref.weight || 1.0)
    } else if (matches >= 1) {
      // Partial match — half the boost
      maxWeight = Math.max(maxWeight, 1.0 + (((pref.weight || 1.0) - 1.0) / 2))
    }
  }
  return maxWeight
}

function scoreWant(w) {
  // If frequency is already 0-1 (from Gemini), use directly; otherwise normalize raw counts
  const freq = w.frequency || 1
  const freqNorm = freq <= 1.0 ? freq : Math.min(freq / 10, 1.0)
  const baseScore = w.severity * freqNorm * w.feasibility
  const prefBoost = getPreferenceBoost(w)
  const finalScore = Math.min(baseScore * prefBoost, 1.0) // cap at 1.0
  if (prefBoost > 1.0) {
    w._preference_boost = +prefBoost.toFixed(2)
    w._preference_note = `Boosted by user preference (×${prefBoost.toFixed(1)})`
  }
  return +finalScore.toFixed(4)
}

function statusFromScore(score) {
  if (score > 0.7) return 'actionable'
  if (score >= 0.4) return 'monitor'
  return 'dismiss'
}

// ─── Load Models ─────────────────────────────────────────────────────────────

function loadModels() {
  if (!existsSync(SELF_MODEL_PATH)) throw new Error(`Self-model not found: ${SELF_MODEL_PATH}`)
  if (!existsSync(WORLD_MODEL_PATH)) throw new Error(`World-model not found: ${WORLD_MODEL_PATH}`)
  const selfModel = JSON.parse(readFileSync(SELF_MODEL_PATH, 'utf8'))
  const worldModel = JSON.parse(readFileSync(WORLD_MODEL_PATH, 'utf8'))
  return { selfModel, worldModel }
}

// ─── Rule-Based Delta Computation ────────────────────────────────────────────

function computeStructuralDeltas(selfModel, worldModel) {
  const wants = []
  let idCounter = 1
  const nextId = () => `want-${String(idCounter++).padStart(3, '0')}`

  // (a) Uncovered domain gaps
  for (const domain of (selfModel.uncovered_domains || [])) {
    const w = {
      id: nextId(),
      type: 'uncovered_domain',
      hypothesis: `No skill covers ${domain}`,
      evidence: ['uncovered_domains list in self-model'],
      severity: 0.6,
      frequency: 1,
      feasibility: 0.7,
      proposed_skill: null,
      proposed_goal: `Create a skill covering the "${domain}" domain`,
    }
    w.score = scoreWant(w)
    w.status = statusFromScore(w.score)
    wants.push(w)
  }

  // (b) Stuck skill gaps
  for (const [name, skill] of Object.entries(selfModel.skills || {})) {
    if (skill.trajectory !== 'stuck') continue
    const weakest = skill.weakest_criteria?.[0]
    const w = {
      id: nextId(),
      type: 'stuck_skill',
      hypothesis: `Skill "${name}" is stuck at ${skill.score}/${skill.max} — eval criteria may need evolution`,
      evidence: [
        `stuck for ${skill.stuck_count} rounds`,
        ...(weakest ? [`weakest criteria: "${weakest.name}" with fail_rate ${weakest.fail_rate}`] : []),
      ],
      severity: 0.8,
      frequency: skill.stuck_count || 1,
      feasibility: 0.6,
      proposed_skill: null,
      proposed_goal: `Evolve evaluation criteria for "${name}" or apply meta-analysis to break plateau`,
    }
    w.score = scoreWant(w)
    w.status = statusFromScore(w.score)
    wants.push(w)
  }

  // (c) Cross-skill pattern gaps
  for (const pattern of (selfModel.cross_skill_patterns || [])) {
    const w = {
      id: nextId(),
      type: 'cross_skill_pattern',
      hypothesis: `Pattern: "${pattern.pattern}" affects ${pattern.affected_skills?.length || 0} skills — need a dedicated skill or systemic fix`,
      evidence: [
        `Affected skills: ${(pattern.affected_skills || []).join(', ')}`,
        `Frequency: ${pattern.frequency}`,
        `Severity: ${pattern.severity}`,
      ],
      severity: pattern.severity === 'high' ? 0.9 : pattern.severity === 'medium' ? 0.6 : 0.4,
      frequency: pattern.frequency || 1,
      feasibility: 0.5,
      proposed_skill: null,
      proposed_goal: `Address cross-skill pattern: ${pattern.pattern}`,
    }
    w.score = scoreWant(w)
    w.status = statusFromScore(w.score)
    wants.push(w)
  }

  // (d) Unmet world demands (current_capability is null)
  const allDemands = [
    ...(worldModel.research_demands || []),
    ...(worldModel.system_demands || []),
    ...(worldModel.environmental_signals || []),
  ]
  for (const demand of allDemands) {
    if (demand.current_capability !== null) continue
    const w = {
      id: nextId(),
      type: 'unmet_demand',
      hypothesis: `Unmet demand: ${demand.signal}`,
      evidence: demand.evidence || [demand.source || 'world-model'],
      severity: 0.7,
      frequency: demand.frequency || 1,
      feasibility: 0.6,
      proposed_skill: null,
      proposed_goal: `Build capability to address: ${demand.signal.substring(0, 100)}`,
    }
    w.score = scoreWant(w)
    w.status = statusFromScore(w.score)
    wants.push(w)
  }

  // (e) High-frequency user intent with no matching skill
  const skillNames = Object.keys(selfModel.skills || {})
  const capabilityDomains = Object.keys(selfModel.capability_map || {})

  for (const intent of (worldModel.user_intent_signals || [])) {
    if ((intent.frequency || 0) <= 5) continue
    if (intent.current_capability) continue

    // Check if any skill name or capability domain loosely matches the intent signal
    const signalLower = intent.signal.toLowerCase()
    const hasMatch = [...skillNames, ...capabilityDomains].some(name =>
      signalLower.includes(name.replace(/-/g, ' ')) || signalLower.includes(name)
    )
    if (hasMatch) continue

    const w = {
      id: nextId(),
      type: 'user_intent',
      hypothesis: `High-frequency user intent "${extractIntentName(intent.signal)}" (frequency: ${intent.frequency}) has no matching skill`,
      evidence: [
        intent.signal,
        `Source: ${intent.source}`,
        `Frequency: ${intent.frequency}`,
      ],
      severity: 0.7,
      frequency: intent.frequency,
      feasibility: 0.65,
      proposed_skill: null,
      proposed_goal: `Create skill addressing user intent: ${extractIntentName(intent.signal)}`,
    }
    w.score = scoreWant(w)
    w.status = statusFromScore(w.score)
    wants.push(w)
  }

  // (f) MCP domain coverage gaps
  for (const mcpDomain of (worldModel.mcp_domains || [])) {
    const { mcp_server, domain, tool_count = 0, subdomains = [], data_available,
            existing_autoresearch_skills = [], existing_skills = [] } = mcpDomain

    if (data_available && existing_autoresearch_skills.length === 0) {
      // Domain the system CAN observe (MCP exists) but has NO autoresearch skills for
      const proposed_skill = proposeDomainSkill(mcpDomain)
      const evidenceLines = [
        `${tool_count} MCP tools available for ${domain}`,
        `Subdomains: ${subdomains.join(', ') || 'none listed'}`,
      ]
      if (existing_skills.length > 0) {
        evidenceLines.push(`Existing non-autoresearch skills: ${existing_skills.join(', ')}`)
      } else {
        evidenceLines.push('No skills at all')
      }

      const w = {
        id: `want-domain-${mcp_server}`,
        type: 'domain_coverage_gap',
        hypothesis: `MCP '${mcp_server}' provides ${domain} intelligence (${tool_count} tools) but no autoresearch-optimizable skills exist for this domain`,
        evidence: evidenceLines,
        severity: 0.85,
        frequency: 1.0,
        feasibility: 0.8,
        proposed_skill,
        proposed_goal: `Create autoresearch-optimizable skill for ${domain} domain using ${mcp_server} MCP`,
      }
      w.score = scoreWant(w)
      w.status = statusFromScore(w.score)
      wants.push(w)
    } else if (existing_autoresearch_skills.length > 0) {
      // Check for low-scoring autoresearch skills in this domain
      const lowScoreSkills = existing_autoresearch_skills.filter(s => {
        const skillData = selfModel.skills?.[s]
        return skillData && skillData.ratio != null && skillData.ratio < 0.5
      })
      if (lowScoreSkills.length > 0) {
        const w = {
          id: `want-domain-perf-${mcp_server}`,
          type: 'domain_coverage_gap',
          hypothesis: `MCP '${mcp_server}' domain ${domain} has autoresearch skills but they score low: ${lowScoreSkills.join(', ')}`,
          evidence: [
            `${tool_count} MCP tools available for ${domain}`,
            `Low-scoring skills: ${lowScoreSkills.map(s => `${s} (${selfModel.skills[s]?.ratio})`).join(', ')}`,
          ],
          severity: 0.6,
          frequency: 1.0,
          feasibility: 0.7,
          proposed_skill: null,
          proposed_goal: `Improve autoresearch skills for ${domain} domain: ${lowScoreSkills.join(', ')}`,
        }
        w.score = scoreWant(w)
        w.status = statusFromScore(w.score)
        wants.push(w)
      }
    }

    // Domain skill migration: existing_skills exist but not in autoresearch
    if (existing_skills.length > 0 && existing_autoresearch_skills.length === 0 && !data_available) {
      // Only generate migration want if not already covered by the coverage gap want above
      const w = {
        id: `want-domain-migrate-${mcp_server}`,
        type: 'domain_coverage_gap',
        hypothesis: `${domain} has ${existing_skills.length} existing skill(s) in seed library (${existing_skills.join(', ')}) but none registered in autoresearch`,
        evidence: [
          `Existing skills: ${existing_skills.join(', ')}`,
          `MCP: ${mcp_server} (${tool_count} tools)`,
          'Skills exist but need autoresearch registration',
        ],
        severity: 0.5,
        frequency: 1.0,
        feasibility: 0.9,
        proposed_skill: null,
        proposed_goal: `Import existing ${domain} skills (${existing_skills.join(', ')}) into autoresearch framework`,
      }
      w.score = scoreWant(w)
      w.status = statusFromScore(w.score)
      wants.push(w)
    }
  }

  return wants
}

function extractIntentName(signal) {
  const match = signal.match(/"([^"]+)"/)
  return match ? match[1] : signal.substring(0, 60)
}

// ─── MCP Domain Skill Proposal ──────────────────────────────────────────────

function proposeDomainSkill(mcpDomain) {
  const { mcp_server, domain, subdomains = [], tool_count } = mcpDomain

  const name = `${domain.replace(/_/g, '-')}-optimizer`
  const description = `Analyzes ${domain} performance via ${mcp_server} MCP tools and proposes improvements`

  const criteria = subdomains.map(sub =>
    `Does the skill effectively guide ${sub} using ${mcp_server} data?`
  )
  if (criteria.length === 0) {
    criteria.push(`Does the skill leverage ${mcp_server} MCP tools to analyze ${domain}?`)
  }

  const scenarios = [
    `Analyze current ${domain} performance and identify top 3 improvement areas`,
    `Given declining engagement metrics, propose a data-driven recovery strategy`,
    `Compare performance across content types and recommend optimal approach`,
    `Detect emerging trends in ${domain} and suggest early-mover actions`,
    `Generate a ${domain} improvement plan with measurable milestones`,
    `Evaluate ROI of recent ${domain} activities and recommend budget allocation`,
  ]

  return { name, description, criteria, scenarios }
}

// ─── Gemini Deep Analysis ────────────────────────────────────────────────────

function buildSelfModelSummary(selfModel) {
  const lines = []
  lines.push(`Total skills: ${selfModel.summary?.total_skills || 0}`)
  lines.push(`Average score ratio: ${selfModel.summary?.avg_ratio || 0}`)
  lines.push(`Skills at target: ${selfModel.summary?.skills_at_target || 0}`)
  lines.push(`Skills stuck: ${selfModel.summary?.skills_stuck || 0}`)
  lines.push(`Skills untested: ${selfModel.summary?.skills_untested || 0}`)
  lines.push(`Uncovered domains: ${(selfModel.uncovered_domains || []).join(', ')}`)
  lines.push(`\nSkills detail:`)
  for (const [name, skill] of Object.entries(selfModel.skills || {})) {
    lines.push(`  - ${name}: score=${skill.score}/${skill.max} (${skill.ratio}), trajectory=${skill.trajectory}, stuck=${skill.stuck_count}, weakest=[${(skill.weakest_criteria || []).map(c => `${c.name}(${c.fail_rate})`).join(', ')}]`)
  }
  lines.push(`\nCross-skill patterns:`)
  for (const p of (selfModel.cross_skill_patterns || [])) {
    lines.push(`  - ${p.pattern} (affects: ${(p.affected_skills || []).join(', ')}, severity: ${p.severity})`)
  }
  lines.push(`\nCapability map:`)
  for (const [domain, skills] of Object.entries(selfModel.capability_map || {})) {
    lines.push(`  - ${domain}: ${skills.join(', ')}`)
  }
  return lines.join('\n')
}

function buildWorldModelSummary(worldModel) {
  const lines = []
  lines.push(`Total demands: ${worldModel.summary?.total_demands || 0}`)
  lines.push(`Unmet demands: ${worldModel.summary?.unmet_demands || 0}`)
  lines.push(`\nResearch demands:`)
  for (const d of (worldModel.research_demands || [])) {
    lines.push(`  - [${d.current_capability || 'UNMET'}] ${d.signal} (freq: ${d.frequency || 1})`)
  }
  lines.push(`\nSystem demands:`)
  for (const d of (worldModel.system_demands || [])) {
    lines.push(`  - [${d.current_capability || 'UNMET'}] ${d.signal} (freq: ${d.frequency || 1})`)
  }
  lines.push(`\nEnvironmental signals:`)
  for (const d of (worldModel.environmental_signals || [])) {
    lines.push(`  - [${d.current_capability || 'UNMET'}] ${d.signal}`)
  }
  lines.push(`\nUser intent signals:`)
  for (const d of (worldModel.user_intent_signals || [])) {
    lines.push(`  - [${d.current_capability || 'UNMET'}] ${d.signal} (freq: ${d.frequency || 0})`)
  }
  if (worldModel.mcp_domains && worldModel.mcp_domains.length > 0) {
    lines.push(`\nConnected MCP domains:`)
    for (const m of worldModel.mcp_domains) {
      const skillStatus = m.existing_autoresearch_skills?.length > 0
        ? `autoresearch skills: ${m.existing_autoresearch_skills.join(', ')}`
        : m.existing_skills?.length > 0
          ? `seed skills only: ${m.existing_skills.join(', ')}`
          : 'NO skills'
      lines.push(`  - ${m.mcp_server}: ${m.domain} (${m.tool_count} tools, data=${m.data_available}, ${skillStatus})`)
    }
  }
  return lines.join('\n')
}

function buildRuleBasedWantsSummary(wants) {
  return wants.map((w, i) =>
    `${i + 1}. [${w.type}] ${w.hypothesis} (score: ${w.score}, status: ${w.status})`
  ).join('\n')
}

async function geminiDeepAnalysis(selfModel, worldModel, ruleBasedWants) {
  const selfSummary = buildSelfModelSummary(selfModel)
  const worldSummary = buildWorldModelSummary(worldModel)
  const wantsSummary = buildRuleBasedWantsSummary(ruleBasedWants)

  const systemInstruction = `You are a capability gap analyst for an AI agent system. You produce precise, actionable gap analyses. Return ONLY valid JSON — no markdown fences, no commentary outside the JSON array.`

  const prompt = `You are a capability gap analyst for an AI agent system. Given:

SELF-MODEL (what the system can do):
${selfSummary}

WORLD-MODEL (what the world demands):
${worldSummary}

CONNECTED MCP DOMAINS (data streams the system can observe):
${(worldModel.mcp_domains || []).map(m => {
  const skills = m.existing_autoresearch_skills?.length > 0
    ? `autoresearch skills: ${m.existing_autoresearch_skills.join(', ')}`
    : m.existing_skills?.length > 0
      ? `seed skills only: ${m.existing_skills.join(', ')}`
      : 'NO skills'
  return `- ${m.mcp_server}: ${m.domain} (${m.tool_count} tools, subdomains: ${(m.subdomains || []).join(', ')}, ${skills})`
}).join('\n') || 'None connected'}

Consider: which domains have rich data streams but no skills? These represent
the highest-value capability gaps — the system CAN observe these domains but
CANNOT act on them.

RULE-BASED WANTS (initial gap analysis):
${wantsSummary}

Your task:
1. Validate the rule-based wants — are they real gaps or false positives?
2. Identify ADDITIONAL gaps the rules missed — structural capabilities that would make the system significantly more effective
3. For each validated/new want, propose a concrete skill specification:
   - Skill name (kebab-case)
   - One-sentence description
   - 4-6 evaluation criteria (binary yes/no questions)
   - 6-8 test scenarios
4. Score each: severity (0-1) × frequency (0-1) × feasibility (0-1)

Return as a JSON array of objects with this schema:
[
  {
    "type": "uncovered_domain|stuck_skill|cross_skill_pattern|unmet_demand|user_intent|domain_coverage_gap|gemini_insight",
    "hypothesis": "description of the gap",
    "evidence": ["data points"],
    "severity": 0.0-1.0,
    "frequency": 0.0-1.0,
    "feasibility": 0.0-1.0,
    "validated": true/false (for rule-based wants) or null (for new insights),
    "rule_based_id": "want-XXX if validating a rule-based want, else null",
    "proposed_skill": {
      "name": "kebab-case-name",
      "description": "one sentence",
      "criteria": ["binary yes/no questions"],
      "scenarios": ["test scenario descriptions"]
    } or null,
    "proposed_goal": "strategic goal suggestion" or null
  }
]

Return ONLY the JSON array. No markdown fences. No text before or after.`

  console.log('  Calling Gemini for deep gap analysis...')
  const response = await callGemini(prompt, systemInstruction)

  if (response.thoughts) {
    console.log('  Gemini thinking:', response.thoughts.substring(0, 200) + '...')
  }

  // Parse JSON from response (may be wrapped in markdown code blocks)
  const text = response.text
  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (!jsonMatch) {
    console.error('  WARNING: Gemini did not return valid JSON array. Raw response:')
    console.error('  ' + text.substring(0, 500))
    return []
  }

  try {
    return JSON.parse(jsonMatch[0])
  } catch (e) {
    console.error('  WARNING: Failed to parse Gemini JSON:', e.message)
    console.error('  Raw match:', jsonMatch[0].substring(0, 500))
    return []
  }
}

// ─── Merge Rule-Based + Gemini Wants ─────────────────────────────────────────

function mergeWants(ruleBasedWants, geminiWants) {
  const merged = [...ruleBasedWants]
  let idCounter = ruleBasedWants.length + 1
  const nextId = () => `want-${String(idCounter++).padStart(3, '0')}`

  for (const gw of geminiWants) {
    // If Gemini validated/overrode a rule-based want
    if (gw.rule_based_id) {
      const existing = merged.find(w => w.id === gw.rule_based_id)
      if (existing) {
        // Gemini scores override
        if (gw.severity != null) existing.severity = gw.severity
        if (gw.frequency != null) existing.frequency = gw.frequency
        if (gw.feasibility != null) existing.feasibility = gw.feasibility
        existing.score = scoreWant(existing)
        existing.status = statusFromScore(existing.score)
        if (gw.proposed_skill) existing.proposed_skill = gw.proposed_skill
        if (gw.proposed_goal) existing.proposed_goal = gw.proposed_goal
        if (gw.validated === false) existing.status = 'dismiss'
        continue
      }
    }

    // New Gemini insight
    const w = {
      id: nextId(),
      type: gw.type || 'gemini_insight',
      hypothesis: gw.hypothesis || 'Gemini-identified gap',
      evidence: gw.evidence || [],
      severity: gw.severity || 0.5,
      frequency: gw.frequency || 0.5,
      feasibility: gw.feasibility || 0.5,
      proposed_skill: gw.proposed_skill || null,
      proposed_goal: gw.proposed_goal || null,
    }
    w.score = scoreWant(w)
    w.status = statusFromScore(w.score)
    merged.push(w)
  }

  return merged
}

// ─── Output ──────────────────────────────────────────────────────────────────

function buildOutput(wants, selfModel, worldModel) {
  // Sort by score descending
  wants.sort((a, b) => b.score - a.score)

  const actionable = wants.filter(w => w.status === 'actionable').length
  const monitor = wants.filter(w => w.status === 'monitor').length
  const dismissed = wants.filter(w => w.status === 'dismiss').length

  return {
    timestamp: new Date().toISOString(),
    version: '1.0',
    self_model_timestamp: selfModel.timestamp,
    world_model_timestamp: worldModel.timestamp,
    wants,
    summary: {
      total_wants: wants.length,
      actionable,
      monitor,
      dismissed,
      top_want: wants[0]?.hypothesis || 'none',
    },
  }
}

function printSummary(output) {
  console.log('\n═══ Want Engine Results ═══')
  console.log(`  Total wants: ${output.summary.total_wants}`)
  console.log(`  Actionable:  ${output.summary.actionable}`)
  console.log(`  Monitor:     ${output.summary.monitor}`)
  console.log(`  Dismissed:   ${output.summary.dismissed}`)
  console.log(`  Top want:    ${output.summary.top_want}`)
  console.log('')

  const actionable = output.wants.filter(w => w.status === 'actionable')
  if (actionable.length > 0) {
    console.log('── Actionable Wants (score > 0.7) ──')
    for (const w of actionable) {
      console.log(`  [${w.score.toFixed(3)}] ${w.id} (${w.type}): ${w.hypothesis}`)
      if (w.proposed_skill) console.log(`         → skill: ${w.proposed_skill.name} — ${w.proposed_skill.description}`)
    }
    console.log('')
  }

  const monitored = output.wants.filter(w => w.status === 'monitor')
  if (monitored.length > 0) {
    console.log('── Monitor Wants (0.4 - 0.7) ──')
    for (const w of monitored) {
      console.log(`  [${w.score.toFixed(3)}] ${w.id} (${w.type}): ${w.hypothesis}`)
    }
    console.log('')
  }

  const dismissed = output.wants.filter(w => w.status === 'dismiss')
  if (dismissed.length > 0) {
    console.log(`── Dismissed: ${dismissed.length} wants (score < 0.4) ──`)
    console.log('')
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Want Engine (Delta Function) v1.0')
  console.log(`Mode: ${DRY_RUN ? 'dry-run' : RULES_ONLY ? 'rules-only' : 'full (rule-based + Gemini)'}`)
  console.log('')

  // 1. Load models
  console.log('Loading models...')
  const { selfModel, worldModel } = loadModels()
  console.log(`  Self-model: ${Object.keys(selfModel.skills || {}).length} skills, ${(selfModel.uncovered_domains || []).length} uncovered domains`)
  console.log(`  World-model: ${worldModel.summary?.total_demands || 0} demands, ${worldModel.summary?.unmet_demands || 0} unmet`)

  // 2. Rule-based delta computation
  console.log('\nComputing structural deltas (rule-based)...')
  const ruleBasedWants = computeStructuralDeltas(selfModel, worldModel)
  console.log(`  Generated ${ruleBasedWants.length} rule-based wants`)

  if (DRY_RUN) {
    console.log('\n── Dry Run: Rule-based wants that would be analyzed ──')
    for (const w of ruleBasedWants) {
      console.log(`  [${w.score.toFixed(3)}] ${w.id} (${w.type}): ${w.hypothesis}`)
    }
    console.log('\n  Would call Gemini with:')
    console.log(`    Self-model summary: ${buildSelfModelSummary(selfModel).length} chars`)
    console.log(`    World-model summary: ${buildWorldModelSummary(worldModel).length} chars`)
    console.log(`    Rule-based wants summary: ${buildRuleBasedWantsSummary(ruleBasedWants).length} chars`)
    console.log('  Skipping Gemini call (--dry-run)')
    return
  }

  let finalWants = ruleBasedWants

  // 4. Gemini deep analysis (unless --rules-only)
  if (!RULES_ONLY) {
    console.log('\nRunning Gemini deep analysis...')
    try {
      const geminiWants = await geminiDeepAnalysis(selfModel, worldModel, ruleBasedWants)
      console.log(`  Gemini returned ${geminiWants.length} want assessments`)

      // Merge
      finalWants = mergeWants(ruleBasedWants, geminiWants)
      console.log(`  After merge: ${finalWants.length} total wants`)
    } catch (e) {
      console.error(`  WARNING: Gemini analysis failed: ${e.message}`)
      console.error('  Falling back to rule-based wants only')
    }
  }

  // 5. Build and write output
  const output = buildOutput(finalWants, selfModel, worldModel)

  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2))
  console.log(`\nWrote ${OUTPUT_PATH}`)

  // 6. Print summary
  printSummary(output)
}

main().catch(e => {
  console.error('FATAL:', e.message)
  process.exit(1)
})
