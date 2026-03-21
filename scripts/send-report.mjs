#!/usr/bin/env node
/**
 * Autoresearch Loop Report — Professional format
 * Reads log file, extracts all metrics, sends rich structured email via Resend.
 * This is the ONLY email path — no bash curl, no inline JSON escaping.
 */
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const CRED = '/usr/local/etc/autoresearch-credentials/resend-api-key.txt'
const SELF_MODEL = resolve(process.env.HOME, '.remote/@autoresearch/self-model.json')
const TO = 'ramene.anthony@gmail.com'
const FROM = 'Autoresearch <alerts@micropaymnts.ai>'

const logFile = process.argv[2]
if (!logFile) { console.log('Usage: node send-report.mjs <log-file>'); process.exit(1) }

let key
try { key = readFileSync(CRED, 'utf8').trim() }
catch { console.log('→ No Resend key'); process.exit(0) }

const log = readFileSync(logFile, 'utf8')

// Extract metrics
const skill = log.match(/Optimizing:\s+(\S+)/)?.[1] || 'none'
const bestScore = log.match(/Final best score:\s+(\S+)/)?.[1] || '?'
const cost = log.match(/Total spent:\s+\$(\S+)/)?.[1] || '0.00'
const keptCount = (log.match(/KEPT/g) || []).length
const revertedCount = (log.match(/REVERTED/g) || []).length
const baselineCount = (log.match(/BASELINE/g) || []).length
const escalationCount = (log.match(/STUCK|Escalat/gi) || []).length
const errorCount = (log.match(/⚠ ERROR|EPERM|Fatal error|command not found|ETIMEDOUT/g) || []).length
const fixCount = (log.match(/→ Fix:|cleared xattrs|reset permissions|patched|reset corrupted/gi) || []).length
const retryCount = (log.match(/↻ Retry/g) || []).length

// Step results
const stepResults = []
for (const m of log.matchAll(/^\s+([✓✗⊘])\s+(.+?)\s+—\s+(.+)$/gm)) {
  stepResults.push({ icon: m[1], step: m[2], detail: m[3] })
}

// Mutations (last 3)
const mutations = []
for (const m of log.matchAll(/\[Mutation\]\s+(.{1,80})/g)) mutations.push(m[1])

// Promotions
const promos = []
for (const m of log.matchAll(/^\s+(\S+):\s+(\d+\/\d+)\s+\(baseline/gm)) promos.push(`${m[1]}: ${m[2]}`)

// Fleet from self-model
let fleet = {}
try {
  const sm = JSON.parse(readFileSync(SELF_MODEL, 'utf8'))
  const s = sm.summary || {}
  fleet = {
    total: s.total_skills || '?',
    perfect: s.skills_at_target || '?',
    untested: s.skills_untested || '?',
    stuck: s.skills_stuck || '?',
    avg: s.avg_ratio ? (s.avg_ratio * 100).toFixed(1) + '%' : '?',
    cost: s.total_cost ? '$' + s.total_cost.toFixed(2) : '?',
    rounds: s.total_rounds || '?',
  }
} catch { fleet = { total: '?', perfect: '?', untested: '?', stuck: '?', avg: '?', cost: '?', rounds: '?' } }

// Duration
const durMatch = log.match(/(\d+)s \| \d+ errors/)
const duration = durMatch?.[1] || '?'

// Build report
const icon = errorCount > 0 ? '⚠' : '✓'
const hr = '━'.repeat(44)

let r = ''
r += `${icon} AUTORESEARCH LOOP REPORT\n`
r += `${hr}\n\n`
r += `  Time:     ${new Date().toLocaleString('en-US', { timeZone: 'America/Chicago', dateStyle: 'medium', timeStyle: 'short' })}\n`
r += `  Duration: ${duration}s\n`
r += `  Cost:     $${cost}\n`
r += `  Health:   ${errorCount} errors  |  ${fixCount} auto-fixes  |  ${retryCount} retries\n`
r += `\n`

r += `${hr}\n`
r += `  SKILL OPTIMIZED\n`
r += `${hr}\n\n`
r += `  Name:       ${skill}\n`
r += `  Best Score: ${bestScore}\n`
r += `  Rounds:     ${keptCount} kept  |  ${revertedCount} reverted  |  ${baselineCount} baseline\n`
if (escalationCount > 0) r += `  Escalations: ${escalationCount} (Gemini meta-analysis)\n`
if (mutations.length > 0) {
  r += `\n  Mutations:\n`
  for (const m of mutations.slice(-3)) r += `    • ${m}\n`
}
r += `\n`

if (stepResults.length > 0) {
  r += `${hr}\n`
  r += `  PIPELINE\n`
  r += `${hr}\n\n`
  for (const s of stepResults) r += `  ${s.icon}  ${s.step} — ${s.detail}\n`
  r += `\n`
}

r += `${hr}\n`
r += `  FLEET (${fleet.total} skills)\n`
r += `${hr}\n\n`
r += `  ★ ${fleet.perfect} perfect  |  ○ ${fleet.untested} untested  |  ⚠ ${fleet.stuck} stuck\n`
r += `  Avg: ${fleet.avg}  |  Cost: ${fleet.cost}  |  Rounds: ${fleet.rounds}\n`
r += `\n`

if (promos.length > 0) {
  r += `${hr}\n`
  r += `  PROMOTION READY (${promos.length})\n`
  r += `${hr}\n\n`
  for (const p of promos) r += `  ★ ${p}\n`
  r += `\n`
}

r += `${hr}\n`
r += `Log: ${logFile}\n`

// Send
const subject = `${icon} Autoresearch | ${skill}: ${bestScore} | $${cost} | ${keptCount} kept | ${errorCount} err`

fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ from: FROM, to: TO, subject, text: r }),
}).then(res => res.json()).then(d => {
  if (d.id) console.log(`→ Report emailed (${d.id})`)
  else console.log(`→ Email error: ${JSON.stringify(d)}`)
}).catch(e => console.log(`→ Email failed: ${e.message}`))
