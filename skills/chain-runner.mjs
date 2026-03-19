#!/usr/bin/env node
/**
 * Chain Runner — Execute multi-skill pipelines defined in chains/*.json
 *
 * Usage:
 *   node skills/chain-runner.mjs chains/inbox-zero-lead-capture.json
 *   node skills/chain-runner.mjs chains/solar-business-development.json --dry-run
 *   node skills/chain-runner.mjs --list
 *
 * Each chain step invokes a skill via Claude CLI (claude --print --model sonnet)
 * with the skill's SKILL.md as system context and the step input as the prompt.
 * Step outputs flow to dependent steps via {{step_id.output_key}} template vars.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'fs'
import { resolve, dirname, basename, join } from 'path'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const AUTORESEARCH_DIR = resolve(__dirname, '..')
const CHAINS_DIR = resolve(AUTORESEARCH_DIR, 'chains')
const SKILLS_DIR = resolve(AUTORESEARCH_DIR, 'skills')
const RESULTS_DIR = resolve(AUTORESEARCH_DIR, 'chain-results')
const SEED_DIR = resolve(process.env.HOME, 'Journal/.seed/base/skills')

// ─── CLI ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const LIST = args.includes('--list')
const VERBOSE = args.includes('--verbose')
const chainFile = args.find(a => a.endsWith('.json') && !a.startsWith('--'))

if (LIST) {
  console.log('Available chains:\n')
  for (const f of readdirSync(CHAINS_DIR).filter(f => f.endsWith('.json')).sort()) {
    const chain = JSON.parse(readFileSync(join(CHAINS_DIR, f), 'utf8'))
    console.log(`  ${chain.name} (${chain.schedule})`)
    console.log(`    ${chain.description}`)
    console.log(`    Steps: ${chain.steps.map(s => s.skill).join(' → ')}`)
    console.log()
  }
  process.exit(0)
}

if (!chainFile) {
  console.error('Usage: node skills/chain-runner.mjs <chain.json> [--dry-run] [--verbose]')
  console.error('       node skills/chain-runner.mjs --list')
  process.exit(1)
}

// ─── Load chain ──────────────────────────────────────────────────────────────

const chainPath = resolve(chainFile.startsWith('/') ? chainFile : join(process.cwd(), chainFile))
if (!existsSync(chainPath)) {
  console.error(`Chain file not found: ${chainPath}`)
  process.exit(1)
}

const chain = JSON.parse(readFileSync(chainPath, 'utf8'))
console.log(`\n═══ Chain Runner: ${chain.name} ═══`)
console.log(`${chain.description}`)
console.log(`Schedule: ${chain.schedule} | Steps: ${chain.steps.length} | Mode: ${DRY_RUN ? 'DRY RUN' : 'EXECUTE'}`)
console.log()

// ─── Resolve skill SKILL.md path ─────────────────────────────────────────────

function findSkillMd(skillName) {
  // Check autoresearch working copy first (optimized version)
  const working = join(SKILLS_DIR, `working-${skillName}`, 'SKILL.md')
  if (existsSync(working)) return working

  // Fall back to seed library
  const seed = join(SEED_DIR, skillName, 'SKILL.md')
  if (existsSync(seed)) return seed

  return null
}

// ─── Template resolution ─────────────────────────────────────────────────────

function resolveTemplate(value, stepResults) {
  if (typeof value === 'string') {
    return value.replace(/\{\{(\w+)\.(\w+(?:\.\w+)*)\}\}/g, (_, stepId, path) => {
      const result = stepResults[stepId]
      if (!result) return `[UNRESOLVED: ${stepId} not yet executed]`
      let val = result
      for (const key of path.split('.')) {
        val = val?.[key]
      }
      if (val === undefined) return `[UNRESOLVED: ${stepId}.${path}]`
      return typeof val === 'object' ? JSON.stringify(val) : String(val)
    })
  }
  if (typeof value === 'object' && value !== null) {
    if (Array.isArray(value)) return value.map(v => resolveTemplate(v, stepResults))
    const resolved = {}
    for (const [k, v] of Object.entries(value)) {
      resolved[k] = resolveTemplate(v, stepResults)
    }
    return resolved
  }
  return value
}

// ─── Execute a single step ───────────────────────────────────────────────────

function executeStep(step, stepResults) {
  const skillPath = findSkillMd(step.skill)
  if (!skillPath) {
    console.log(`  ✗ Skill not found: ${step.skill}`)
    return { error: `Skill not found: ${step.skill}`, status: 'failed' }
  }

  const skillContent = readFileSync(skillPath, 'utf8')
  const source = skillPath.includes('working-') ? 'optimized' : 'seed'
  const resolvedInput = resolveTemplate(step.input, stepResults)

  console.log(`  Skill: ${step.skill} (${source})`)
  if (VERBOSE) console.log(`  Input: ${JSON.stringify(resolvedInput).slice(0, 200)}`)

  if (DRY_RUN) {
    console.log(`  [DRY RUN] Would execute with ${skillContent.length} char SKILL.md`)
    return {
      status: 'dry_run',
      skill: step.skill,
      input_preview: JSON.stringify(resolvedInput).slice(0, 100),
    }
  }

  // Build prompt: skill context + step input
  const prompt = `You are executing a skill chain step. Use the skill instructions below to process the input.

SKILL INSTRUCTIONS:
${skillContent}

CHAIN STEP INPUT:
${JSON.stringify(resolvedInput, null, 2)}

Execute the skill against this input. Return structured output as JSON where possible.
If the skill requires external tools/APIs that aren't available, describe what you WOULD do and return mock structured data showing the expected output format.`

  // Write prompt to temp file
  const tmpFile = join(RESULTS_DIR, `.step-${step.id}-prompt.tmp`)
  writeFileSync(tmpFile, prompt)

  try {
    const result = execSync(
      `cat "${tmpFile}" | claude --print --model sonnet`,
      { maxBuffer: 5 * 1024 * 1024, timeout: 300000, encoding: 'utf8', shell: true }
    )

    // Try to parse as JSON, fall back to raw text
    let parsed
    try {
      const jsonMatch = result.match(/```json\n([\s\S]*?)```/) || result.match(/\{[\s\S]*\}/)
      parsed = JSON.parse(jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : result)
    } catch {
      parsed = { raw_output: result.slice(0, 2000), status: 'completed' }
    }

    return { ...parsed, status: 'completed', skill: step.skill }
  } catch (err) {
    console.log(`  ✗ Execution failed: ${err.message?.slice(0, 200)}`)
    return { error: err.message?.slice(0, 500), status: 'failed', skill: step.skill }
  } finally {
    try { require('fs').unlinkSync(tmpFile) } catch {}
  }
}

// ─── Dependency resolution ───────────────────────────────────────────────────

function getExecutionOrder(steps) {
  const order = []
  const completed = new Set()
  const remaining = [...steps]

  while (remaining.length > 0) {
    const batch = []
    for (let i = remaining.length - 1; i >= 0; i--) {
      const step = remaining[i]
      const deps = Array.isArray(step.depends_on) ? step.depends_on
        : step.depends_on ? [step.depends_on]
        : []
      const parallelWith = step.parallel_with ? [step.parallel_with] : []

      if (deps.every(d => completed.has(d))) {
        batch.push(step)
        remaining.splice(i, 1)
      }
    }

    if (batch.length === 0 && remaining.length > 0) {
      console.error('Circular dependency detected:', remaining.map(s => s.id).join(', '))
      process.exit(1)
    }

    order.push(batch)
    batch.forEach(s => completed.add(s.id))
  }

  return order
}

// ─── Main execution ──────────────────────────────────────────────────────────

mkdirSync(RESULTS_DIR, { recursive: true })

const executionOrder = getExecutionOrder(chain.steps)
const stepResults = {}
const startTime = Date.now()
let totalSteps = 0
let successSteps = 0
let failedSteps = 0

console.log(`Execution plan: ${executionOrder.map(batch => batch.map(s => s.id).join('+')).join(' → ')}\n`)

for (const batch of executionOrder) {
  // Execute batch (could be parallelized in future)
  for (const step of batch) {
    totalSteps++
    console.log(`\n─── Step ${totalSteps}/${chain.steps.length}: ${step.id} ───`)

    const result = executeStep(step, stepResults)
    stepResults[step.id] = result

    // output_key is for downstream template access — don't create circular ref
    // stepResults[step.id] IS the result; downstream uses {{step_id.field}}

    if (result.status === 'completed') {
      successSteps++
      console.log(`  ✓ ${step.id} completed`)
    } else if (result.status === 'dry_run') {
      successSteps++
      console.log(`  ○ ${step.id} (dry run)`)
    } else {
      failedSteps++
      console.log(`  ✗ ${step.id} failed`)
      // Don't abort — downstream steps will get unresolved vars
    }
  }
}

const duration = ((Date.now() - startTime) / 1000).toFixed(1)

// ─── Save results ────────────────────────────────────────────────────────────

const resultFile = join(RESULTS_DIR, `${chain.name}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
const runResult = {
  chain: chain.name,
  timestamp: new Date().toISOString(),
  mode: DRY_RUN ? 'dry_run' : 'execute',
  duration_seconds: parseFloat(duration),
  steps_total: totalSteps,
  steps_success: successSteps,
  steps_failed: failedSteps,
  results: stepResults,
}
writeFileSync(resultFile, JSON.stringify(runResult, null, 2))

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n═══ Chain Complete: ${chain.name} ═══`)
console.log(`  Duration: ${duration}s`)
console.log(`  Steps: ${successSteps}/${totalSteps} succeeded, ${failedSteps} failed`)
console.log(`  Results: ${resultFile}`)

if (chain.success_criteria && !DRY_RUN) {
  console.log(`\n  Success Criteria:`)
  for (const [key, val] of Object.entries(chain.success_criteria)) {
    console.log(`    ${key}: ${val} — [manual verification needed]`)
  }
}

console.log()
process.exit(failedSteps > 0 ? 1 : 0)
