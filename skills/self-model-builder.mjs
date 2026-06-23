#!/usr/bin/env node
/**
 * Self-Model Builder — aggregates all autoresearch data into a structured self-model.
 *
 * Reads all working directories and computes per-skill metrics, cross-skill
 * patterns, capability coverage maps, and writes self-model.json.
 *
 * Usage:
 *   node skills/self-model-builder.mjs
 *   node skills/self-model-builder.mjs --quiet   # skip stdout summary
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs'
import { resolve, dirname, basename } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ─── Load .env ──────────────────────────────────────────────────────────────
const dotenvPath = resolve(__dirname, '../.env')
if (existsSync(dotenvPath)) {
  for (const line of readFileSync(dotenvPath, 'utf8').split('\n')) {
    const match = line.match(/^([A-Z_]+)=(.+)$/)
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim()
  }
}

// ─── CLI ────────────────────────────────────────────────────────────────────
const QUIET = process.argv.includes('--quiet')
const OUTPUT_PATH = resolve(__dirname, '../self-model.json')

// ─── Capability Domain Mapping ──────────────────────────────────────────────
// Maps skill name keywords to capability domains
const DOMAIN_KEYWORDS = {
  code_generation: ['scaffold', 'build', 'implement', 'generator'],
  analysis: ['analyze', 'drift', 'detector', 'intelligence', 'pipeline'],
  planning: ['plan', 'deep-plan', 'estimate', 'task'],
  research: ['research', 'autoresearch', 'intelligence-pipeline', 'cross-model'],
  self_correction: ['self-correction', 'correction', 'improvement'],
  documentation: ['document', 'scribe', 'context-loader'],
  context_management: ['context-loader', 'context-drift', 'drift-detector', 'ecosystem'],
  testing: ['test', 'qa', 'eval', 'validation'],
  security: ['security', 'audit', 'vulnerability'],
  deployment: ['deploy', 'devops', 'ci-cd'],
  refactoring: ['refactor', 'cleanup', 'improve'],
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function readJsonSafe(path) {
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

function readJsonlSafe(path) {
  if (!existsSync(path)) return []
  try {
    return readFileSync(path, 'utf8')
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        try { return JSON.parse(line) } catch { return null }
      })
      .filter(Boolean)
  } catch {
    return []
  }
}

function classifyDomains(skillName) {
  const domains = []
  const lower = skillName.toLowerCase()
  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) {
      domains.push(domain)
    }
  }
  // Fallback: if no domain matched, assign "general"
  if (domains.length === 0) domains.push('general')
  return domains
}

function computeTrajectory(rounds) {
  if (!rounds || rounds.length === 0) return 'untested'
  if (rounds.length === 1) return 'insufficient_data'

  // Sort by round number (or timestamp) to get chronological order
  const sorted = [...rounds].sort((a, b) => {
    const ta = new Date(a.timestamp || 0).getTime()
    const tb = new Date(b.timestamp || 0).getTime()
    return ta - tb
  })

  // Count consecutive reverts from the end
  let revertStreak = 0
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].status === 'reverted') revertStreak++
    else break
  }

  if (revertStreak >= 3) return 'stuck'

  // Check last 3 "kept" or "baseline" rounds for score trajectory
  const keptRounds = sorted.filter(r => r.status === 'kept' || r.status === 'baseline')
  if (keptRounds.length < 2) {
    return revertStreak >= 2 ? 'stuck' : 'insufficient_data'
  }

  const recent = keptRounds.slice(-3)
  if (recent.length >= 2) {
    const scores = recent.map(r => r.score)
    const allIncreasing = scores.every((s, i) => i === 0 || s >= scores[i - 1])
    const allSame = scores.every(s => Math.abs(s - scores[0]) <= 1)

    if (allSame && recent.length >= 3) return 'plateauing'
    if (allIncreasing && scores[scores.length - 1] > scores[0]) return 'improving'
  }

  // Check for plateauing: best score hasn't changed in last N rounds
  const bestScore = Math.max(...sorted.map(r => r.score))
  const lastImproveIdx = sorted.findLastIndex(r =>
    (r.status === 'kept' || r.status === 'baseline') && r.score === bestScore
  )
  const roundsSinceImprovement = sorted.length - 1 - lastImproveIdx
  if (roundsSinceImprovement >= 3) return 'plateauing'

  return 'mixed'
}

function computeCriteriaStats(rounds, evalData) {
  if (!rounds || rounds.length === 0) return { weakest: [], strongest: [] }

  // Count rounds where each criterion has at least one failure
  const criteriaRoundsWithFailure = {}
  const allCriteriaNames = new Set()
  let totalRounds = 0

  // Collect all criteria names from eval data
  if (evalData?.criteria) {
    for (const c of evalData.criteria) {
      const shortName = typeof c === 'string' ? c.split(':')[0].trim()
        : (typeof c === 'object' && c.name) ? c.name : String(c)
      allCriteriaNames.add(shortName)
    }
  }

  for (const round of rounds) {
    totalRounds++
    if (!round.failures) continue

    // Track which criteria failed in this round (deduplicated)
    const failedInRound = new Set()
    for (const f of round.failures) {
      failedInRound.add(f.criterion)
      allCriteriaNames.add(f.criterion)
    }

    for (const name of failedInRound) {
      criteriaRoundsWithFailure[name] = (criteriaRoundsWithFailure[name] || 0) + 1
    }
  }

  // Compute fail rates (proportion of rounds where criterion failed)
  const criteriaStats = [...allCriteriaNames].map(name => ({
    name,
    fail_count: criteriaRoundsWithFailure[name] || 0,
    fail_rate: totalRounds > 0 ? (criteriaRoundsWithFailure[name] || 0) / totalRounds : 0,
  }))

  criteriaStats.sort((a, b) => b.fail_rate - a.fail_rate)

  const weakest = criteriaStats.filter(c => c.fail_rate > 0).slice(0, 3)
  const strongest = criteriaStats.filter(c => c.fail_rate === 0).slice(0, 3)

  return { weakest, strongest }
}

function findLastImprovement(rounds) {
  if (!rounds || rounds.length === 0) return null

  const sorted = [...rounds].sort((a, b) => {
    const ta = new Date(a.timestamp || 0).getTime()
    const tb = new Date(b.timestamp || 0).getTime()
    return tb - ta // newest first
  })

  for (const r of sorted) {
    if (r.status === 'kept') {
      return r.timestamp || null
    }
  }
  // If only baseline, return baseline timestamp
  for (const r of sorted) {
    if (r.status === 'baseline') {
      return r.timestamp || null
    }
  }
  return null
}

function findLastEscalation(rounds, events) {
  // Check rounds for escalation status
  const escalationRounds = (rounds || []).filter(r => r.status === 'escalation' || r.escalation)
  if (escalationRounds.length > 0) {
    const last = escalationRounds[escalationRounds.length - 1]
    return {
      diagnosis: last.escalation?.diagnosis || last.mutation || 'Unknown',
      timestamp: last.timestamp || null,
    }
  }

  // Check events for stuck_escalation
  const escalationEvents = events.filter(e => e.type === 'stuck_escalation')
  if (escalationEvents.length > 0) {
    const last = escalationEvents[escalationEvents.length - 1]
    return {
      diagnosis: last.diagnosis || 'Unknown',
      timestamp: last.timestamp || null,
    }
  }

  return null
}

function countStuck(rounds) {
  if (!rounds || rounds.length === 0) return 0
  let maxStreak = 0
  let streak = 0
  for (const r of rounds) {
    if (r.status === 'reverted') {
      streak++
      maxStreak = Math.max(maxStreak, streak)
    } else {
      streak = 0
    }
  }
  return maxStreak
}

function extractCriteriaNames(evalData) {
  if (!evalData?.criteria) return []
  return evalData.criteria.map(c => {
    if (typeof c === 'string') return c.split(':')[0].trim()
    if (typeof c === 'object' && c.name) return c.name
    return String(c)
  })
}

// ─── Skill Processing ───────────────────────────────────────────────────────

function processSkill(skillName, workingDir) {
  const roundsPath = resolve(workingDir, 'rounds.json')
  const evalPath = resolve(workingDir, 'eval.json')
  const eventsPath = resolve(workingDir, 'events.jsonl')
  const changelogPath = resolve(workingDir, 'changelog.md')

  const rounds = readJsonSafe(roundsPath)
  const evalData = readJsonSafe(evalPath)
  const events = readJsonlSafe(eventsPath)
  const hasChangelog = existsSync(changelogPath)

  // No rounds at all
  if (!rounds || !Array.isArray(rounds) || rounds.length === 0) {
    const criteriaNames = extractCriteriaNames(evalData)
    const scenarioCount = evalData?.scenarios?.length || 0
    return {
      score: 0,
      max: 0,
      ratio: 0,
      trajectory: evalData ? 'untested' : 'no_eval',
      weakest_criteria: [],
      strongest_criteria: [],
      rounds_completed: 0,
      rounds_kept: 0,
      cost_invested: 0,
      last_improvement: null,
      last_escalation: null,
      stuck_count: 0,
      criteria_names: criteriaNames,
      scenario_count: scenarioCount,
      eval_coverage: criteriaNames,
    }
  }

  // Sort chronologically
  const sorted = [...rounds].sort((a, b) => {
    const ta = new Date(a.timestamp || 0).getTime()
    const tb = new Date(b.timestamp || 0).getTime()
    return ta - tb
  })

  const latest = sorted[sorted.length - 1]
  const bestRound = sorted.reduce((best, r) => r.score > best.score ? r : best, sorted[0])

  const score = bestRound.score
  const max = bestRound.max
  const ratio = max > 0 ? score / max : 0

  const trajectory = computeTrajectory(sorted)
  const { weakest, strongest } = computeCriteriaStats(sorted, evalData)

  const roundsKept = sorted.filter(r => r.status === 'kept' || r.status === 'baseline').length
  const totalCost = sorted.reduce((sum, r) => sum + (r.cost || 0), 0)

  const lastImprovement = findLastImprovement(sorted)
  const lastEscalation = findLastEscalation(sorted, events)
  const stuckCount = countStuck(sorted)

  const criteriaNames = extractCriteriaNames(evalData)
  const scenarioCount = evalData?.scenarios?.length || 0

  return {
    score,
    max,
    ratio: Math.round(ratio * 1000) / 1000,
    trajectory,
    weakest_criteria: weakest.map(c => ({ name: c.name, fail_rate: Math.round(c.fail_rate * 1000) / 1000 })),
    strongest_criteria: strongest.map(c => ({ name: c.name, fail_rate: 0 })),
    rounds_completed: sorted.length,
    rounds_kept: roundsKept,
    cost_invested: Math.round(totalCost * 100) / 100,
    last_improvement: lastImprovement,
    last_escalation: lastEscalation,
    stuck_count: stuckCount,
    criteria_names: criteriaNames.length > 0 ? criteriaNames : extractCriteriaFromRounds(sorted),
    scenario_count: scenarioCount || inferScenarioCount(sorted),
    eval_coverage: criteriaNames.length > 0 ? criteriaNames : extractCriteriaFromRounds(sorted),
  }
}

function extractCriteriaFromRounds(rounds) {
  // Fallback: extract criteria names from failure data
  const names = new Set()
  for (const r of rounds) {
    if (r.failures) {
      for (const f of r.failures) {
        if (f.criterion) names.add(f.criterion)
      }
    }
  }
  return [...names]
}

function inferScenarioCount(rounds) {
  let maxScenario = 0
  for (const r of rounds) {
    if (r.failures) {
      for (const f of r.failures) {
        if (f.scenario && f.scenario > maxScenario) maxScenario = f.scenario
      }
    }
  }
  return maxScenario
}

// ─── Cross-Skill Patterns ───────────────────────────────────────────────────

function computeCrossSkillPatterns(skillsData) {
  const patterns = []

  // 1. Criteria that fail across multiple skills
  const criteriaAcrossSkills = {}
  for (const [skillName, data] of Object.entries(skillsData)) {
    for (const wc of data.weakest_criteria) {
      if (!criteriaAcrossSkills[wc.name]) {
        criteriaAcrossSkills[wc.name] = { skills: [], rates: [] }
      }
      criteriaAcrossSkills[wc.name].skills.push(skillName)
      criteriaAcrossSkills[wc.name].rates.push(wc.fail_rate)
    }
  }

  for (const [criterion, info] of Object.entries(criteriaAcrossSkills)) {
    if (info.skills.length >= 2) {
      const avgRate = info.rates.reduce((s, r) => s + r, 0) / info.rates.length
      patterns.push({
        pattern: `Criterion "${criterion}" fails across ${info.skills.length} skills`,
        affected_skills: info.skills,
        frequency: info.skills.length,
        severity: avgRate > 0.5 ? 'high' : avgRate > 0.2 ? 'medium' : 'low',
      })
    }
  }

  // 2. Common stuck escalation themes
  const escalationDiagnoses = []
  for (const [skillName, data] of Object.entries(skillsData)) {
    if (data.last_escalation) {
      escalationDiagnoses.push({
        skill: skillName,
        diagnosis: data.last_escalation.diagnosis,
      })
    }
  }

  if (escalationDiagnoses.length >= 2) {
    patterns.push({
      pattern: `${escalationDiagnoses.length} skills have triggered stuck escalations`,
      affected_skills: escalationDiagnoses.map(e => e.skill),
      frequency: escalationDiagnoses.length,
      severity: 'medium',
    })
  }

  // 3. Skills that are stuck (3+ consecutive reverts)
  const stuckSkills = Object.entries(skillsData)
    .filter(([_, data]) => data.trajectory === 'stuck')
    .map(([name]) => name)

  if (stuckSkills.length >= 2) {
    patterns.push({
      pattern: `${stuckSkills.length} skills are currently stuck (3+ consecutive reverts)`,
      affected_skills: stuckSkills,
      frequency: stuckSkills.length,
      severity: 'high',
    })
  }

  // 4. Skills with zero improvement (all rounds reverted)
  const noProgressSkills = Object.entries(skillsData)
    .filter(([_, data]) => data.rounds_completed > 0 && data.rounds_kept === 0)
    .map(([name]) => name)

  if (noProgressSkills.length > 0) {
    patterns.push({
      pattern: `${noProgressSkills.length} skills have had rounds but no kept improvements`,
      affected_skills: noProgressSkills,
      frequency: noProgressSkills.length,
      severity: 'high',
    })
  }

  // Sort by severity then frequency
  const severityOrder = { high: 0, medium: 1, low: 2 }
  patterns.sort((a, b) => (severityOrder[a.severity] - severityOrder[b.severity]) || (b.frequency - a.frequency))

  return patterns
}

// ─── Capability Map ─────────────────────────────────────────────────────────

function buildCapabilityMap(skillsData) {
  const capMap = {}
  for (const skillName of Object.keys(skillsData)) {
    const domains = classifyDomains(skillName)
    for (const domain of domains) {
      if (!capMap[domain]) capMap[domain] = []
      capMap[domain].push(skillName)
    }
  }
  return capMap
}

function findUncoveredDomains(capMap) {
  return Object.keys(DOMAIN_KEYWORDS).filter(domain => !capMap[domain] || capMap[domain].length === 0)
}

// ─── Summary ────────────────────────────────────────────────────────────────

function computeSummary(skillsData) {
  const entries = Object.values(skillsData)
  const tested = entries.filter(d => d.rounds_completed > 0)
  const untested = entries.filter(d => d.rounds_completed === 0)
  const stuck = entries.filter(d => d.trajectory === 'stuck')

  // Consider a skill "at target" if ratio >= 0.95
  const atTarget = tested.filter(d => d.ratio >= 0.95)

  const totalCost = entries.reduce((sum, d) => sum + d.cost_invested, 0)
  const totalRounds = entries.reduce((sum, d) => sum + d.rounds_completed, 0)

  const ratios = tested.map(d => d.ratio)
  const avgRatio = ratios.length > 0 ? ratios.reduce((s, r) => s + r, 0) / ratios.length : 0

  return {
    total_skills: entries.length,
    avg_ratio: Math.round(avgRatio * 1000) / 1000,
    skills_at_target: atTarget.length,
    skills_stuck: stuck.length,
    skills_untested: untested.length,
    total_cost: Math.round(totalCost * 100) / 100,
    total_rounds: totalRounds,
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main() {
  // Discover all working-* directories
  const entries = readdirSync(__dirname)
  const workingDirs = entries
    .filter(e => e.startsWith('working-'))
    .filter(e => {
      try { return statSync(resolve(__dirname, e)).isDirectory() } catch { return false }
    })

  if (workingDirs.length === 0) {
    console.error('No working-* directories found.')
    process.exit(1)
  }

  // Process each skill
  const skillsData = {}
  for (const dir of workingDirs) {
    const skillName = dir.replace('working-', '')
    const workingDir = resolve(__dirname, dir)
    skillsData[skillName] = processSkill(skillName, workingDir)
  }

  // Compute cross-skill patterns
  const crossSkillPatterns = computeCrossSkillPatterns(skillsData)

  // Build capability map
  const capMap = buildCapabilityMap(skillsData)
  const uncoveredDomains = findUncoveredDomains(capMap)

  // Build summary
  const summary = computeSummary(skillsData)

  // Assemble self-model
  const selfModel = {
    timestamp: new Date().toISOString(),
    version: '1.0',
    skills: skillsData,
    cross_skill_patterns: crossSkillPatterns,
    capability_map: capMap,
    uncovered_domains: uncoveredDomains,
    summary,
  }

  // Write output
  writeFileSync(OUTPUT_PATH, JSON.stringify(selfModel, null, 2) + '\n')

  // Print summary to stdout
  if (!QUIET) {
    console.log('=== Self-Model Builder ===')
    console.log(`Generated: ${selfModel.timestamp}`)
    console.log(`Output: ${OUTPUT_PATH}`)
    console.log()

    console.log('--- Skill Summary ---')
    const sortedSkills = Object.entries(skillsData).sort((a, b) => a[1].ratio - b[1].ratio)
    for (const [name, data] of sortedSkills) {
      const pct = (data.ratio * 100).toFixed(1)
      const traj = data.trajectory.toUpperCase()
      const score = data.rounds_completed > 0 ? `${data.score}/${data.max} (${pct}%)` : 'untested'
      const cost = data.cost_invested > 0 ? `$${data.cost_invested.toFixed(2)}` : '$0.00'
      console.log(`  ${name.padEnd(40)} ${score.padEnd(18)} ${traj.padEnd(18)} ${data.rounds_completed} rounds  ${cost}`)
    }
    console.log()

    console.log('--- Cross-Skill Patterns ---')
    if (crossSkillPatterns.length === 0) {
      console.log('  No cross-skill patterns detected.')
    } else {
      for (const p of crossSkillPatterns) {
        console.log(`  [${p.severity.toUpperCase()}] ${p.pattern}`)
        console.log(`         Skills: ${p.affected_skills.join(', ')}`)
      }
    }
    console.log()

    console.log('--- Capability Coverage ---')
    for (const [domain, skills] of Object.entries(capMap)) {
      console.log(`  ${domain.padEnd(25)} ${skills.join(', ')}`)
    }
    if (uncoveredDomains.length > 0) {
      console.log(`  UNCOVERED: ${uncoveredDomains.join(', ')}`)
    }
    console.log()

    console.log('--- Totals ---')
    console.log(`  Skills: ${summary.total_skills} | At target: ${summary.skills_at_target} | Stuck: ${summary.skills_stuck} | Untested: ${summary.skills_untested}`)
    console.log(`  Avg ratio: ${(summary.avg_ratio * 100).toFixed(1)}% | Total cost: $${summary.total_cost.toFixed(2)} | Total rounds: ${summary.total_rounds}`)
    console.log()
  }
}

main()
