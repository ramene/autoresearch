#!/usr/bin/env node
/**
 * Skill Scheduler — picks the weakest skill and runs autoresearch on it.
 *
 * Reads all working dirs' rounds.json to find the lowest-scoring skill,
 * then invokes autoresearch-runner.mjs to optimize it. Rotates to next
 * weakest when a skill reaches target or gets stuck.
 *
 * Usage:
 *   node skill-scheduler.mjs                    # Auto-select weakest, run 5 rounds
 *   node skill-scheduler.mjs --skill scaffold   # Force a specific skill
 *   node skill-scheduler.mjs --all              # Run all skills (weakest first)
 *   node skill-scheduler.mjs --budget 1.00      # Set spend limit
 *   node skill-scheduler.mjs --dry-run          # Preview without executing
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs'
import { resolve, dirname, basename } from 'path'
import { fileURLToPath } from 'url'
import { execSync, spawn } from 'child_process'

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
const getFlag = (name, fallback) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : fallback
}
const hasFlag = (name) => args.includes(name)

const BUDGET = parseFloat(getFlag('--budget', '0.50'))
const ROUNDS_PER_SKILL = parseInt(getFlag('--rounds', '5'))
const DRY_RUN = hasFlag('--dry-run')
const FORCE_SKILL = getFlag('--skill', null)
const RUN_ALL = hasFlag('--all')
const COOLDOWN_MS = 60 * 60 * 1000 // 1 hour

const RUNNER_PATH = resolve(__dirname, 'autoresearch-runner.mjs')
const STATE_PATH = resolve(__dirname, 'scheduler-state.json')

// ─── State Management ────────────────────────────────────────────────────────

function loadState() {
  if (existsSync(STATE_PATH)) {
    try {
      return JSON.parse(readFileSync(STATE_PATH, 'utf8'))
    } catch { /* corrupted state, start fresh */ }
  }
  return {
    lastRunTimestamp: null,
    lastSkill: null,
    skillStats: {},
    cumulativeCost: 0.0,
    totalRuns: 0,
  }
}

function saveState(state) {
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + '\n')
}

// ─── Skill Discovery ─────────────────────────────────────────────────────────

function discoverSkills() {
  const skills = []
  const entries = readdirSync(__dirname)

  for (const entry of entries) {
    if (!entry.startsWith('working-')) continue
    const skillName = entry.replace('working-', '')
    const roundsPath = resolve(__dirname, entry, 'rounds.json')

    if (!existsSync(roundsPath)) continue

    let rounds
    try {
      rounds = JSON.parse(readFileSync(roundsPath, 'utf8'))
    } catch {
      continue // skip malformed
    }

    if (!Array.isArray(rounds) || rounds.length === 0) {
      skills.push({ name: skillName, score: 0, max: 1, ratio: 0, rounds: 0 })
      continue
    }

    // Get most recent round
    const latest = rounds[rounds.length - 1]
    const score = latest.score ?? 0
    const max = latest.max ?? 1
    const ratio = max > 0 ? score / max : 0

    skills.push({
      name: skillName,
      score,
      max,
      ratio,
      rounds: rounds.length,
      latestStatus: latest.status,
      latestCost: latest.cost ?? 0,
    })
  }

  return skills
}

// ─── Skill Selection ─────────────────────────────────────────────────────────

function selectSkill(skills, state) {
  const now = Date.now()

  // Filter out skills optimized within the cooldown period
  const eligible = skills.filter((s) => {
    const stat = state.skillStats[s.name]
    if (!stat?.lastRun) return true
    const elapsed = now - new Date(stat.lastRun).getTime()
    return elapsed >= COOLDOWN_MS
  })

  if (eligible.length === 0) return null

  // Sort by ratio ascending (weakest first)
  eligible.sort((a, b) => a.ratio - b.ratio)

  return eligible[0]
}

// ─── Runner Execution ────────────────────────────────────────────────────────

function runSkill(skillName, rounds) {
  const args = [
    RUNNER_PATH,
    '--skill', skillName,
    '--rounds', String(rounds),
    '--continuous',
    '--dashboard-sync',
  ]

  console.log(`\n>>> Running: node ${args.join(' ')}`)

  try {
    execSync(`node ${args.join(' ')}`, {
      cwd: __dirname,
      stdio: 'inherit',
      timeout: 30 * 60 * 1000, // 30 minute timeout per skill
    })
    return true
  } catch (err) {
    console.error(`>>> Runner exited with error for skill "${skillName}": ${err.message}`)
    return false
  }
}

// ─── Cost Tracking ───────────────────────────────────────────────────────────

function getSkillCostFromRounds(skillName, roundsBefore) {
  const roundsPath = resolve(__dirname, `working-${skillName}`, 'rounds.json')
  if (!existsSync(roundsPath)) return 0

  let rounds
  try {
    rounds = JSON.parse(readFileSync(roundsPath, 'utf8'))
  } catch {
    return 0
  }

  if (!Array.isArray(rounds)) return 0

  // Sum cost of rounds added since we started
  let cost = 0
  for (let i = roundsBefore; i < rounds.length; i++) {
    cost += rounds[i].cost ?? 0
  }
  return cost
}

function getLatestScore(skillName) {
  const roundsPath = resolve(__dirname, `working-${skillName}`, 'rounds.json')
  if (!existsSync(roundsPath)) return { score: 0, max: 1, rounds: 0 }

  let rounds
  try {
    rounds = JSON.parse(readFileSync(roundsPath, 'utf8'))
  } catch {
    return { score: 0, max: 1, rounds: 0 }
  }

  if (!Array.isArray(rounds) || rounds.length === 0) return { score: 0, max: 1, rounds: 0 }

  const latest = rounds[rounds.length - 1]
  return {
    score: latest.score ?? 0,
    max: latest.max ?? 1,
    rounds: rounds.length,
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  const state = loadState()
  const skills = discoverSkills()

  if (skills.length === 0) {
    console.log('No skills found with rounds.json files.')
    process.exit(1)
  }

  console.log('=== Skill Scheduler ===')
  console.log(`Budget: $${BUDGET.toFixed(2)} | Rounds/skill: ${ROUNDS_PER_SKILL} | Dry run: ${DRY_RUN}`)
  console.log('')

  // Display current standings
  const sorted = [...skills].sort((a, b) => a.ratio - b.ratio)
  console.log('Current skill scores:')
  for (const s of sorted) {
    const pct = (s.ratio * 100).toFixed(1)
    const stat = state.skillStats[s.name]
    const lastRun = stat?.lastRun ? timeSince(new Date(stat.lastRun)) : 'never'
    console.log(`  ${s.name.padEnd(30)} ${s.score}/${s.max} (${pct}%) — last run: ${lastRun}`)
  }
  console.log('')

  // Determine which skills to run
  let toRun = []

  if (FORCE_SKILL) {
    const found = skills.find((s) => s.name === FORCE_SKILL)
    if (!found) {
      console.error(`Skill "${FORCE_SKILL}" not found. Available: ${skills.map((s) => s.name).join(', ')}`)
      process.exit(1)
    }
    toRun = [found]
  } else if (RUN_ALL) {
    toRun = [...sorted] // weakest first
  } else {
    const picked = selectSkill(skills, state)
    if (!picked) {
      console.log('All skills were optimized within the last hour. Nothing to do.')
      process.exit(1)
    }
    toRun = [picked]
  }

  if (DRY_RUN) {
    console.log('Dry run — would execute:')
    for (const s of toRun) {
      console.log(`  node autoresearch-runner.mjs --skill ${s.name} --rounds ${ROUNDS_PER_SKILL} --continuous --dashboard-sync`)
    }
    process.exit(0)
  }

  // Run skills within budget
  let spent = 0

  for (const skill of toRun) {
    if (spent >= BUDGET) {
      console.log(`\nBudget exhausted ($${spent.toFixed(2)} >= $${BUDGET.toFixed(2)}). Stopping.`)
      saveState(state)
      process.exit(2)
    }

    const remaining = BUDGET - spent
    console.log(`\n--- Optimizing: ${skill.name} (${skill.score}/${skill.max}) | Budget remaining: $${remaining.toFixed(2)} ---`)

    const roundsBefore = getLatestScore(skill.name).rounds
    const success = runSkill(skill.name, ROUNDS_PER_SKILL)

    // Calculate cost of this run
    const runCost = getSkillCostFromRounds(skill.name, roundsBefore)
    spent += runCost

    // Update state
    const latest = getLatestScore(skill.name)
    if (!state.skillStats[skill.name]) {
      state.skillStats[skill.name] = { lastRun: null, lastScore: 0, maxScore: 0, totalCost: 0, runsCompleted: 0 }
    }
    const stat = state.skillStats[skill.name]
    stat.lastRun = new Date().toISOString()
    stat.lastScore = latest.score
    stat.maxScore = latest.max
    stat.totalCost = (stat.totalCost ?? 0) + runCost
    stat.runsCompleted = (stat.runsCompleted ?? 0) + 1

    state.lastRunTimestamp = new Date().toISOString()
    state.lastSkill = skill.name
    state.cumulativeCost = (state.cumulativeCost ?? 0) + runCost
    state.totalRuns = (state.totalRuns ?? 0) + 1

    saveState(state)

    console.log(`\n>>> ${skill.name}: ${latest.score}/${latest.max} | Run cost: $${runCost.toFixed(2)} | Total spent: $${spent.toFixed(2)}`)
  }

  // Check for promotion-ready skills
  try {
    const promotionCheck = execSync(
      `node "${resolve(__dirname, 'promotion-pipeline.mjs')}" --list`,
      { encoding: 'utf8', timeout: 10000 }
    ).trim()
    if (promotionCheck) {
      console.log(`\n  📋 Promotion-ready skills:\n${promotionCheck}`)
    }
  } catch { /* promotion check is best-effort */ }

  console.log('\n=== Scheduler complete ===')
  console.log(`Total spent: $${spent.toFixed(2)} | Skills run: ${toRun.length}`)
  saveState(state)
  process.exit(0)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeSince(date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

main()
