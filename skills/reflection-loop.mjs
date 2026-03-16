#!/usr/bin/env node
// ─── Reflection Loop ───────────────────────────────────────────────────────
// Verifies whether wants that created skills (genesis_complete) actually got
// satisfied after autoresearch ran on the created skills.
//
// Usage:
//   node skills/reflection-loop.mjs                  # Reflect on all genesis_complete wants
//   node skills/reflection-loop.mjs --want want-015  # Reflect on specific want
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const BASE = resolve(import.meta.dirname, '..')
const WANTS_PATH = resolve(BASE, 'wants.json')
const SELF_MODEL_PATH = resolve(BASE, 'self-model.json')
const REFLECTION_LOG_PATH = resolve(BASE, 'reflection-log.json')

// ─── CLI Argument Parsing ───────────────────────────────────────────────────

const args = process.argv.slice(2)

function getArgValue(flag) {
  const idx = args.indexOf(flag)
  if (idx === -1 || idx + 1 >= args.length) return null
  return args[idx + 1]
}

const targetWantId = getArgValue('--want')

// ─── File Loading ───────────────────────────────────────────────────────────

function loadJson(path) {
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, 'utf-8'))
}

function saveJson(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n')
}

// ─── Skill Assessment ───────────────────────────────────────────────────────

function getSkillRounds(skillName) {
  const roundsPath = resolve(BASE, 'skills', `working-${skillName}`, 'rounds.json')
  if (!existsSync(roundsPath)) return null
  return loadJson(roundsPath)
}

function getSkillFromSelfModel(selfModel, skillName) {
  if (!selfModel || !selfModel.skills) return null
  return selfModel.skills[skillName] || null
}

function computeTrajectory(rounds, selfModelSkill) {
  if (!rounds || rounds.length === 0) return 'untested'

  const scores = rounds.map(r => r.score)
  const keptCount = rounds.filter(r => r.status === 'kept').length

  // Check if improving: any kept rounds in recent history
  if (keptCount > 0) {
    const recentKept = rounds.slice(-3).filter(r => r.status === 'kept').length
    if (recentKept > 0) return 'improving'
  }

  // Check if stuck: multiple rounds, no kept improvements
  if (rounds.length >= 3 && keptCount === 0) return 'stuck'

  // Check self-model trajectory as fallback
  if (selfModelSkill) {
    if (selfModelSkill.trajectory === 'stuck') return 'stuck'
    if (selfModelSkill.trajectory === 'improving') return 'improving'
  }

  return 'evaluated'
}

// ─── Evidence Re-checking ───────────────────────────────────────────────────

function checkEvidenceCurrentState(want, selfModel) {
  const evidenceStates = []

  for (const ev of want.evidence || []) {
    // Check for stuck skill references
    const stuckMatch = ev.match(/Skill '([^']+)' is stuck/)
    if (stuckMatch) {
      const skillName = stuckMatch[1]
      const skill = getSkillFromSelfModel(selfModel, skillName)
      if (skill) {
        const stillStuck = skill.trajectory === 'stuck' || skill.stuck_count > 0
        evidenceStates.push({
          evidence: ev,
          current: stillStuck
            ? `${skillName} still stuck (${skill.stuck_count} rounds, trajectory: ${skill.trajectory})`
            : `${skillName} no longer stuck (trajectory: ${skill.trajectory})`,
          improved: !stillStuck
        })
      }
      continue
    }

    // Check for "no kept improvements" references
    const noKeptMatch = ev.match(/no kept improvements/)
    if (noKeptMatch) {
      const affectedMatch = ev.match(/skills have had rounds but no kept improvements/)
      if (affectedMatch && selfModel.cross_skill_patterns) {
        const pattern = selfModel.cross_skill_patterns.find(p =>
          p.pattern.includes('no kept improvements')
        )
        if (pattern) {
          // Check each affected skill
          const stillAffected = pattern.affected_skills.filter(name => {
            const skill = getSkillFromSelfModel(selfModel, name)
            return skill && skill.rounds_kept === 0 && skill.rounds_completed > 0
          })
          const improved = stillAffected.length < pattern.affected_skills.length
          evidenceStates.push({
            evidence: ev,
            current: `${stillAffected.length}/${pattern.affected_skills.length} skills still have no kept improvements (${stillAffected.join(', ')})`,
            improved
          })
          continue
        }
      }
    }

    // Check for score references (e.g., "context-drift-detector stuck at 50/60")
    const scoreMatch = ev.match(/score is (\d+)\/(\d+)/)
    if (scoreMatch) {
      // Try to find which skill this references
      const skillNameMatch = ev.match(/Skill '([^']+)'/) || ev.match(/'([^']+)'/)
      if (skillNameMatch) {
        const skillName = skillNameMatch[1]
        const skill = getSkillFromSelfModel(selfModel, skillName)
        if (skill) {
          const oldScore = parseInt(scoreMatch[1])
          const improved = skill.score > oldScore
          evidenceStates.push({
            evidence: ev,
            current: `${skillName} score: ${skill.score}/${skill.max} (was ${oldScore}/${scoreMatch[2]})`,
            improved
          })
          continue
        }
      }
    }

    // Check for skill-specific mentions with "has had rounds but no kept improvements"
    const skillRoundsMatch = ev.match(/Skill '([^']+)' has had rounds but no kept improvements/)
    if (skillRoundsMatch) {
      const skillName = skillRoundsMatch[1]
      const skill = getSkillFromSelfModel(selfModel, skillName)
      if (skill) {
        const improved = skill.rounds_kept > 0
        evidenceStates.push({
          evidence: ev,
          current: improved
            ? `${skillName} now has ${skill.rounds_kept} kept improvements`
            : `${skillName} still has 0 kept improvements after ${skill.rounds_completed} rounds`,
          improved
        })
        continue
      }
    }

    // Check for pipeline failure rate
    const failureRateMatch = ev.match(/failure rate is (\d+)%/)
    if (failureRateMatch) {
      evidenceStates.push({
        evidence: ev,
        current: `Cannot verify pipeline failure rate from static files`,
        improved: null // unknown
      })
      continue
    }

    // Default: can't assess, pass through
    evidenceStates.push({
      evidence: ev,
      current: 'No automated check available',
      improved: null
    })
  }

  return evidenceStates
}

function summarizeEvidenceState(evidenceStates) {
  const assessable = evidenceStates.filter(e => e.improved !== null)
  if (assessable.length === 0) return { summary: 'No assessable evidence', improved: null }

  const improvedCount = assessable.filter(e => e.improved).length
  const totalAssessable = assessable.length

  return {
    summary: evidenceStates.map(e => e.current).join('; '),
    improved: improvedCount > totalAssessable / 2,
    ratio: `${improvedCount}/${totalAssessable}`
  }
}

// ─── Satisfaction Computation ───────────────────────────────────────────────

function computeSatisfaction(want, selfModel) {
  const skillName = want.proposed_skill?.name
  if (!skillName) {
    return {
      verdict: 'untested',
      reasoning: 'Want has no proposed_skill — cannot assess skill-based satisfaction'
    }
  }

  // 1. Check the created skill's state
  const rounds = getSkillRounds(skillName)
  const selfModelSkill = getSkillFromSelfModel(selfModel, skillName)
  const trajectory = computeTrajectory(rounds, selfModelSkill)

  const skillScore = selfModelSkill
    ? `${selfModelSkill.score}/${selfModelSkill.max}`
    : (rounds && rounds.length > 0 ? `${rounds[rounds.length - 1].score}/${rounds[rounds.length - 1].max}` : '0/0')

  const skillRatio = selfModelSkill?.ratio ?? 0
  const roundCount = rounds?.length ?? 0

  // 2. Re-check original evidence
  const evidenceStates = checkEvidenceCurrentState(want, selfModel)
  const evidenceSummary = summarizeEvidenceState(evidenceStates)

  // 3. Compute verdict
  if (roundCount === 0) {
    return {
      skillScore,
      trajectory: 'untested',
      evidenceStates,
      evidenceSummary: evidenceSummary.summary,
      verdict: 'untested',
      reasoning: `${skillName} has 0 rounds — needs autoresearch to evaluate it`
    }
  }

  // Skill has been evaluated
  const skillGood = skillRatio >= 0.7

  if (skillGood && evidenceSummary.improved === true) {
    return {
      skillScore,
      trajectory,
      evidenceStates,
      evidenceSummary: evidenceSummary.summary,
      verdict: 'satisfied',
      reasoning: `${skillName} scores ${skillScore} (${(skillRatio * 100).toFixed(0)}%) and original evidence shows improvement: ${evidenceSummary.summary}`
    }
  }

  if (trajectory === 'improving' || (roundCount > 0 && roundCount < 5)) {
    return {
      skillScore,
      trajectory,
      evidenceStates,
      evidenceSummary: evidenceSummary.summary,
      verdict: 'progressing',
      reasoning: `${skillName} is ${trajectory} with ${roundCount} rounds (score: ${skillScore}). Evidence state: ${evidenceSummary.summary}`
    }
  }

  if (trajectory === 'stuck' || (roundCount >= 5 && !skillGood)) {
    return {
      skillScore,
      trajectory,
      evidenceStates,
      evidenceSummary: evidenceSummary.summary,
      verdict: 'unsatisfied',
      reasoning: `${skillName} is ${trajectory} after ${roundCount} rounds (score: ${skillScore}). Original evidence not improved: ${evidenceSummary.summary}`
    }
  }

  // Edge cases: evaluated but ambiguous
  return {
    skillScore,
    trajectory,
    evidenceStates,
    evidenceSummary: evidenceSummary.summary,
    verdict: 'progressing',
    reasoning: `${skillName} has ${roundCount} rounds (score: ${skillScore}, trajectory: ${trajectory}). Needs more data.`
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main() {
  const wantsData = loadJson(WANTS_PATH)
  if (!wantsData) {
    console.error('ERROR: wants.json not found at', WANTS_PATH)
    process.exit(1)
  }

  const selfModel = loadJson(SELF_MODEL_PATH)
  if (!selfModel) {
    console.error('WARNING: self-model.json not found at', SELF_MODEL_PATH)
  }

  // Load existing reflection log
  const reflectionLog = loadJson(REFLECTION_LOG_PATH) || { reflections: [], summary: {} }

  // Find genesis_complete wants
  let genesisWants = wantsData.wants.filter(w => w.status === 'genesis_complete')

  if (targetWantId) {
    genesisWants = genesisWants.filter(w => w.id === targetWantId)
    if (genesisWants.length === 0) {
      // Also check if the target want exists but isn't genesis_complete
      const allMatch = wantsData.wants.filter(w => w.id === targetWantId)
      if (allMatch.length > 0) {
        console.log(`Want ${targetWantId} exists but status is "${allMatch[0].status}" (not genesis_complete)`)
      } else {
        console.error(`Want ${targetWantId} not found in wants.json`)
      }
      process.exit(1)
    }
  }

  if (genesisWants.length === 0) {
    console.log('No wants with status "genesis_complete" found. Nothing to reflect on.')
    process.exit(0)
  }

  console.log(`\n═══ Reflection Loop ═══`)
  console.log(`Reflecting on ${genesisWants.length} genesis_complete want(s)\n`)

  const newReflections = []
  const verdictCounts = { satisfied: 0, progressing: 0, unsatisfied: 0, untested: 0 }

  for (const want of genesisWants) {
    const skillName = want.proposed_skill?.name || '(none)'
    console.log(`── Want: ${want.id} ──`)
    console.log(`   Hypothesis: ${want.hypothesis.substring(0, 100)}...`)
    console.log(`   Created skill: ${skillName}`)

    const result = computeSatisfaction(want, selfModel)

    console.log(`   Skill score: ${result.skillScore}`)
    console.log(`   Trajectory: ${result.trajectory}`)
    console.log(`   Verdict: ${result.verdict.toUpperCase()}`)
    console.log(`   Reasoning: ${result.reasoning}`)
    console.log()

    // Build reflection entry
    const reflection = {
      timestamp: new Date().toISOString(),
      want_id: want.id,
      skill_created: skillName,
      skill_score: result.skillScore,
      skill_trajectory: result.trajectory,
      original_evidence_current_state: result.evidenceSummary || 'N/A',
      verdict: result.verdict,
      reasoning: result.reasoning
    }

    newReflections.push(reflection)
    verdictCounts[result.verdict]++

    // Update want status based on verdict
    const wantInData = wantsData.wants.find(w => w.id === want.id)
    if (wantInData) {
      if (result.verdict === 'satisfied') {
        wantInData.status = 'satisfied'
      } else if (result.verdict === 'progressing') {
        wantInData.status = 'progressing'
      } else if (result.verdict === 'unsatisfied') {
        wantInData.status = 'unsatisfied'
      }
      // 'untested' leaves status as genesis_complete (unchanged)
    }
  }

  // Append new reflections to log
  reflectionLog.reflections.push(...newReflections)

  // Compute summary over all reflections in this run
  const total = newReflections.length
  reflectionLog.summary = {
    total_reflected: total,
    satisfied: verdictCounts.satisfied,
    progressing: verdictCounts.progressing,
    unsatisfied: verdictCounts.unsatisfied,
    untested: verdictCounts.untested,
    satisfaction_rate: total > 0
      ? `${((verdictCounts.satisfied / total) * 100).toFixed(0)}%`
      : '0%',
    last_run: new Date().toISOString()
  }

  // Save updated files
  saveJson(REFLECTION_LOG_PATH, reflectionLog)
  console.log(`Reflection log saved to: ${REFLECTION_LOG_PATH}`)

  saveJson(WANTS_PATH, wantsData)
  console.log(`Wants updated in: ${WANTS_PATH}`)

  // Print summary
  console.log(`\n═══ Summary ═══`)
  console.log(`  Total reflected: ${total}`)
  console.log(`  Satisfied:       ${verdictCounts.satisfied}`)
  console.log(`  Progressing:     ${verdictCounts.progressing}`)
  console.log(`  Unsatisfied:     ${verdictCounts.unsatisfied}`)
  console.log(`  Untested:        ${verdictCounts.untested}`)
  console.log(`  Satisfaction:    ${reflectionLog.summary.satisfaction_rate}`)
}

main()
