#!/usr/bin/env node
/**
 * Promotion Pipeline — promotes skills that reach their target score.
 *
 * Scans working dirs for skills at target, generates promotion proposals
 * with diffs, and optionally copies promoted skills to the canonical seed library.
 *
 * Usage:
 *   node promotion-pipeline.mjs               # Scan and generate proposals
 *   node promotion-pipeline.mjs --list        # List pending promotions
 *   node promotion-pipeline.mjs --dry-run     # Show what would be promoted
 *   node promotion-pipeline.mjs --approve <skill>  # Promote a specific skill
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, appendFileSync, copyFileSync, mkdirSync } from 'fs'
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

// ─── Constants ──────────────────────────────────────────────────────────────
const PROMOTIONS_DIR = resolve(__dirname, 'promotions')
const SEED_BASE = resolve(process.env.HOME, 'Journal/.seed/base/skills')
const DECISIONS_PATH = resolve(__dirname, '..', 'CLAUDE-decisions.md')

// ─── CLI Parsing ────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const hasFlag = (name) => args.includes(name)
const getFlag = (name, fallback) => {
  const i = args.indexOf(name)
  return i >= 0 && i + 1 < args.length ? args[i + 1] : fallback
}

const LIST_MODE = hasFlag('--list')
const DRY_RUN = hasFlag('--dry-run')
const APPROVE_SKILL = getFlag('--approve', null)

// ─── Skill Discovery ───────────────────────────────────────────────────────

function discoverPromotionReady() {
  const ready = []
  const entries = readdirSync(__dirname)

  for (const entry of entries) {
    if (!entry.startsWith('working-')) continue
    const skillName = entry.replace('working-', '')
    const workDir = resolve(__dirname, entry)
    const roundsPath = resolve(workDir, 'rounds.json')
    const skillPath = resolve(workDir, 'SKILL.md')
    const baselinePath = resolve(workDir, 'SKILL.md.baseline')

    if (!existsSync(roundsPath) || !existsSync(skillPath) || !existsSync(baselinePath)) continue

    let rounds
    try {
      rounds = JSON.parse(readFileSync(roundsPath, 'utf8'))
    } catch {
      continue
    }

    if (!Array.isArray(rounds) || rounds.length === 0) continue

    const latest = rounds[rounds.length - 1]
    const score = latest.score ?? 0
    const max = latest.max ?? 1

    // A skill is at target if score === max (perfect) or if the runner stopped with target reached
    // Check for target_reached status or perfect score
    const atTarget = score >= max || latest.status === 'target_reached'

    // Also check if any round has status indicating target was reached
    const hasTargetRound = rounds.some(r => r.status === 'target_reached')

    if (!atTarget && !hasTargetRound) continue

    // Find the baseline score (round 0)
    const baselineRound = rounds.find(r => r.round === 0)
    const baselineScore = baselineRound?.score ?? 0

    ready.push({
      name: skillName,
      score,
      max,
      baselineScore,
      rounds: rounds.length,
      workDir,
      skillPath,
      baselinePath,
    })
  }

  return ready
}

// ─── Diff Generation ────────────────────────────────────────────────────────

function generateDiff(baselinePath, skillPath) {
  try {
    const result = execSync(
      `diff -u "${baselinePath}" "${skillPath}" || true`,
      { encoding: 'utf8', timeout: 5000 }
    )
    return result || '(no differences)'
  } catch {
    return '(diff failed)'
  }
}

// ─── Changelog Summary ─────────────────────────────────────────────────────

function extractChangeSummary(workDir) {
  const changelogPath = resolve(workDir, 'changelog.md')
  if (!existsSync(changelogPath)) return '(no changelog found)'

  const changelog = readFileSync(changelogPath, 'utf8')

  // Extract mutation descriptions from the changelog
  const mutations = []
  const lines = changelog.split('\n')
  for (const line of lines) {
    const mutMatch = line.match(/\*\*Mutation\*\*:\s*(.+)/)
    if (mutMatch) mutations.push(mutMatch[1].trim())
  }

  if (mutations.length === 0) return '(no mutations recorded)'

  // Deduplicate and return unique mutations
  const unique = [...new Set(mutations)]
  return unique.map((m, i) => `${i + 1}. ${m}`).join('\n')
}

// ─── Proposal Generation ────────────────────────────────────────────────────

function generateProposal(skill) {
  const diff = generateDiff(skill.baselinePath, skill.skillPath)
  const summary = extractChangeSummary(skill.workDir)
  const seedPath = resolve(SEED_BASE, skill.name, 'SKILL.md')
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').substring(0, 19)
  const proposalFilename = `${skill.name}-${timestamp}.md`
  const proposalPath = resolve(PROMOTIONS_DIR, proposalFilename)

  const proposal = `# Promotion Proposal: ${skill.name}

## Scores
- **Baseline**: ${skill.baselineScore}/${skill.max}
- **Current**: ${skill.score}/${skill.max}
- **Improvement**: +${skill.score - skill.baselineScore} points (${((skill.score / skill.max) * 100).toFixed(1)}%)
- **Rounds**: ${skill.rounds}

## Promotion Target
\`${seedPath}\`

## Key Mutations That Improved Score
${summary}

## Unified Diff (baseline -> current)
\`\`\`diff
${diff}
\`\`\`

## Generated
- **Timestamp**: ${new Date().toISOString()}
- **Source**: \`${skill.skillPath}\`
- **Baseline**: \`${skill.baselinePath}\`
`

  mkdirSync(PROMOTIONS_DIR, { recursive: true })
  writeFileSync(proposalPath, proposal)
  return { proposalPath, proposalFilename, diff, summary }
}

// ─── Event Emission ─────────────────────────────────────────────────────────

function emitEvent(workDir, event) {
  const eventsPath = resolve(workDir, 'events.jsonl')
  appendFileSync(eventsPath, JSON.stringify(event) + '\n')
}

// ─── Promotion Approval ─────────────────────────────────────────────────────

function approveSkill(skillName) {
  const workDir = resolve(__dirname, `working-${skillName}`)
  const skillPath = resolve(workDir, 'SKILL.md')
  const baselinePath = resolve(workDir, 'SKILL.md.baseline')
  const roundsPath = resolve(workDir, 'rounds.json')
  const seedPath = resolve(SEED_BASE, skillName, 'SKILL.md')

  // Validate paths
  if (!existsSync(skillPath)) {
    console.error(`Working SKILL.md not found: ${skillPath}`)
    process.exit(1)
  }

  if (!existsSync(resolve(SEED_BASE, skillName))) {
    console.error(`Seed skill directory not found: ${resolve(SEED_BASE, skillName)}`)
    console.error(`Cannot promote — seed path must exist.`)
    process.exit(1)
  }

  // Get scores
  let score = 0, max = 1, baselineScore = 0
  if (existsSync(roundsPath)) {
    try {
      const rounds = JSON.parse(readFileSync(roundsPath, 'utf8'))
      if (Array.isArray(rounds) && rounds.length > 0) {
        const latest = rounds[rounds.length - 1]
        score = latest.score ?? 0
        max = latest.max ?? 1
        const baselineRound = rounds.find(r => r.round === 0)
        baselineScore = baselineRound?.score ?? 0
      }
    } catch { /* use defaults */ }
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').substring(0, 19)

  // Backup current seed skill
  if (existsSync(seedPath)) {
    const backupPath = `${seedPath}.pre-promotion-${timestamp}`
    copyFileSync(seedPath, backupPath)
    console.log(`  Backed up seed skill to: ${backupPath}`)
  }

  // Copy working SKILL.md to seed path
  copyFileSync(skillPath, seedPath)
  console.log(`  Promoted: ${skillPath} -> ${seedPath}`)

  // Log to CLAUDE-decisions.md
  const decisionEntry = `\n## Promotion: ${skillName} (${new Date().toISOString()})\n- **Score**: ${baselineScore}/${max} -> ${score}/${max}\n- **Source**: \`${skillPath}\`\n- **Destination**: \`${seedPath}\`\n- **Backup**: \`${seedPath}.pre-promotion-${timestamp}\`\n`

  if (existsSync(DECISIONS_PATH)) {
    appendFileSync(DECISIONS_PATH, decisionEntry)
  } else {
    writeFileSync(DECISIONS_PATH, `# CLAUDE Decisions\n${decisionEntry}`)
  }
  console.log(`  Logged promotion to: ${DECISIONS_PATH}`)

  // Emit promoted event
  emitEvent(workDir, {
    type: 'promoted',
    skill: skillName,
    score,
    max,
    baselineScore,
    seedPath,
    backupTimestamp: timestamp,
    timestamp: new Date().toISOString(),
  })
  console.log(`  Emitted 'promoted' event to events.jsonl`)

  return true
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main() {
  // Handle --approve
  if (APPROVE_SKILL) {
    console.log(`\n=== Promoting skill: ${APPROVE_SKILL} ===`)
    approveSkill(APPROVE_SKILL)
    console.log(`\nPromotion complete.`)
    process.exit(0)
  }

  const ready = discoverPromotionReady()

  // Handle --list
  if (LIST_MODE) {
    if (ready.length === 0) {
      // Output nothing for clean integration with scheduler
      process.exit(0)
    }
    for (const skill of ready) {
      console.log(`    ${skill.name}: ${skill.score}/${skill.max} (baseline: ${skill.baselineScore})`)
    }
    process.exit(0)
  }

  // Handle --dry-run
  if (DRY_RUN) {
    console.log('\n=== Promotion Pipeline (dry run) ===')
    if (ready.length === 0) {
      console.log('No skills at target score.')
      process.exit(0)
    }
    for (const skill of ready) {
      const seedPath = resolve(SEED_BASE, skill.name, 'SKILL.md')
      const seedExists = existsSync(resolve(SEED_BASE, skill.name))
      console.log(`  ${skill.name}: ${skill.baselineScore} -> ${skill.score}/${skill.max}`)
      console.log(`    Seed path: ${seedPath} (${seedExists ? 'exists' : 'MISSING'})`)
      console.log(`    Would generate proposal in promotions/`)
    }
    process.exit(0)
  }

  // Default: scan and generate proposals
  console.log('\n=== Promotion Pipeline ===')

  if (ready.length === 0) {
    console.log('No skills at target score. Nothing to promote.')
    process.exit(0)
  }

  console.log(`Found ${ready.length} skill(s) at target:\n`)

  for (const skill of ready) {
    console.log(`  ${skill.name}: ${skill.baselineScore} -> ${skill.score}/${skill.max}`)

    const { proposalPath, diff, summary } = generateProposal(skill)
    console.log(`    Proposal: ${proposalPath}`)

    // Emit promotion_ready event
    const diffLines = diff.split('\n').filter(l => l.startsWith('+') || l.startsWith('-')).length
    emitEvent(skill.workDir, {
      type: 'promotion_ready',
      skill: skill.name,
      score: skill.score,
      max: skill.max,
      baselineScore: skill.baselineScore,
      diffSummary: `${diffLines} lines changed across ${skill.rounds} rounds`,
      proposalPath,
      timestamp: new Date().toISOString(),
    })
    console.log(`    Emitted 'promotion_ready' event`)
  }

  console.log(`\nTo approve a skill: node promotion-pipeline.mjs --approve <skill>`)
  process.exit(0)
}

main()
