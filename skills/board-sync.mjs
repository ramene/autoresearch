#!/usr/bin/env node
/**
 * Sync skill lifecycle status to GitHub Project board #19
 * Run after each cron cycle or manually: node skills/board-sync.mjs
 */

import { readFileSync, readdirSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SKILLS_DIR = resolve(__dirname, '.')
const CRED_PATH = '/usr/local/etc/autoresearch-credentials/github-pat.txt'
const PROJECT_NUMBER = 19

// Load GitHub token
let GH_TOKEN
try {
  GH_TOKEN = readFileSync(CRED_PATH, 'utf8').trim()
} catch {
  console.log('No GitHub token — skipping board sync')
  process.exit(0)
}

// Collect skill status
const skills = []
for (const d of readdirSync(SKILLS_DIR).filter(d => d.startsWith('working-')).sort()) {
  const name = d.replace('working-', '')
  const roundsPath = resolve(SKILLS_DIR, d, 'rounds.json')
  const changelogPath = resolve(SKILLS_DIR, d, 'changelog.md')
  const eventsPath = resolve(SKILLS_DIR, d, 'events.jsonl')

  let score = 0, max = 0, rounds = 0, status = 'untested', origin = 'manual'

  try {
    const r = JSON.parse(readFileSync(roundsPath, 'utf8'))
    if (r.length > 0) {
      score = Math.max(...r.map(x => x.score || 0))
      max = r[0]?.max || 36
      rounds = r.length
      status = score >= max ? 'perfect' : score > 0 ? 'improving' : 'untested'
    }
  } catch {}

  // Check genesis origin
  try {
    const cl = readFileSync(changelogPath, 'utf8')
    if (cl.includes('Genesis') || cl.includes('want-')) origin = 'want-genesis'
  } catch {}
  try {
    const ev = readFileSync(eventsPath, 'utf8')
    if (ev.includes('skill_genesis')) origin = 'want-genesis'
  } catch {}

  skills.push({ name, score, max, rounds, status, origin })
}

// Summary
const perfect = skills.filter(s => s.status === 'perfect').length
const improving = skills.filter(s => s.status === 'improving').length
const untested = skills.filter(s => s.status === 'untested').length
const genesis = skills.filter(s => s.origin === 'want-genesis').length

console.log(`Board Sync: ${skills.length} skills | ★${perfect} perfect | ●${improving} improving | ○${untested} untested | 🧬${genesis} from wants`)

// Build summary for a single board item update (simpler than per-skill)
const lines = []
lines.push(`## Skill Fleet — ${new Date().toISOString().slice(0, 16)}`)
lines.push('')
lines.push(`**★ ${perfect} perfect** | **● ${improving} improving** | **○ ${untested} untested** | **🧬 ${genesis} from wants**`)
lines.push('')
lines.push('| Skill | Score | Rounds | Origin | Status |')
lines.push('|-------|-------|--------|--------|--------|')
for (const s of skills) {
  const icon = s.status === 'perfect' ? '★' : s.status === 'improving' ? '●' : '○'
  const pct = s.max > 0 ? Math.round(s.score / s.max * 100) + '%' : '-'
  lines.push(`| ${icon} ${s.name} | ${s.score}/${s.max} (${pct}) | ${s.rounds} | ${s.origin} | ${s.status} |`)
}

const body = lines.join('\\n')

// Log to stdout for the cron email
console.log(`  Perfect: ${skills.filter(s => s.status === 'perfect').map(s => s.name).join(', ')}`)
console.log(`  Genesis: ${skills.filter(s => s.origin === 'want-genesis').map(s => s.name).join(', ')}`)
