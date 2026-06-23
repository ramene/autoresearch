#!/usr/bin/env node
/**
 * Autoresearch Loop Report — Professional format
 * Reads log file, extracts all metrics, sends rich structured email via Resend.
 * This is the ONLY email path — no bash curl, no inline JSON escaping.
 */
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { EMAIL_STYLE } from './email-theme.mjs'

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

// Extract metrics — use canonical summary lines, not pattern noise
const skill = log.match(/--- Optimizing:\s+(\S+)/)?.[1] || log.match(/Optimizing:\s+(\S+)/)?.[1] || 'none'

// Best score from the runner summary line: ">>> skill-name: 19/48 | Run cost: ..."
const bestScore = log.match(/>>>\s+\S+:\s+(\d+\/\d+)/)?.[1] || '?'

// Cost from runner summary: "Total spent: $0.18" or "Run cost: $0.18"
const cost = log.match(/Total spent:\s+\$(\S+)/)?.[1] || log.match(/Run cost:\s+\$(\S+)/)?.[1] || '0.00'

// Round decisions — only count [Decision] lines, not noise
const keptCount = (log.match(/\[Decision\] KEPT/g) || []).length
const revertedCount = (log.match(/\[Decision\] REVERTED/g) || []).length
const baselineCount = (log.match(/\[Decision\] BASELINE/g) || []).length

// Escalations — only count actual "⚠ STUCK:" events, not status labels in self-model
const escalationCount = (log.match(/⚠ STUCK:/g) || []).length

// Errors/fixes/retries — use the step summary line: "Errors: 0 | Fixes: 0 | Retries: 0"
const summaryMatch = log.match(/^Errors:\s*(\d+)\s*\|\s*Fixes:\s*(\d+)\s*\|\s*Retries:\s*(\d+)/m)
const errorCount = summaryMatch ? parseInt(summaryMatch[1]) : 0
const fixCount = summaryMatch ? parseInt(summaryMatch[2]) : 0
const retryCount = summaryMatch ? parseInt(summaryMatch[3]) : 0

// Step results
const stepResults = []
for (const m of log.matchAll(/^\s+([✓✗⊘])\s+(.+?)\s+—\s+(.+)$/gm)) {
  stepResults.push({ icon: m[1], step: m[2], detail: m[3] })
}

// Mutations (last 3)
const mutations = []
for (const m of log.matchAll(/\[Mutation\]\s+(.{1,80})/g)) mutations.push(m[1])

// Promotions — deduplicate and exclude already-promoted skills
const promotedManifest = (() => {
  const p = resolve(process.env.HOME, '.remote/@autoresearch/skills/promoted.json')
  try { return JSON.parse(readFileSync(p, 'utf8')) } catch { return {} }
})()
const promoSet = new Set()
for (const m of log.matchAll(/^\s+(\S+):\s+(\d+\/\d+)\s+\(baseline/gm)) {
  if (!promotedManifest[m[1]]) promoSet.add(`${m[1]}: ${m[2]}`)
}
const promos = [...promoSet]

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

// Duration from "Loop Complete" line: "| 2704s | 0 errors |"
const durMatch = log.match(/\|\s*(\d+)s\s*\|/)
const duration = durMatch?.[1] || '?'

// Build HTML report
const icon = errorCount > 0 ? '⚠' : '✓'
const time = new Date().toLocaleString('en-US', { timeZone: 'America/Merida', dateStyle: 'medium', timeStyle: 'short' })
const statusColor = errorCount > 0 ? '#ef4444' : '#22c55e'
const statusLabel = errorCount > 0 ? 'ERRORS' : 'HEALTHY'

const stepHtml = stepResults.map(s => {
  const c = s.icon === '✓' ? '#16a34a' : s.icon === '✗' ? '#dc2626' : '#94a3b8'
  return `<tr>
    <td style="padding:3px 8px 3px 0;color:${c};font-size:13px;white-space:nowrap;">${s.icon}</td>
    <td style="padding:3px 0;font-size:12px;"><span class="text-slate-900">${s.step}</span> <span class="text-slate-500">— ${s.detail}</span></td>
  </tr>`
}).join('')

const mutationHtml = mutations.slice(-3).map(m =>
  `<div style="padding:3px 0;font-size:11px;color:#64748b;">• ${m}</div>`
).join('')

const promoHtml = promos.map(p =>
  `<div style="padding:3px 0;color:#b45309;font-size:12px;">★ ${p}</div>`
).join('')

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<style>${EMAIL_STYLE}</style>
</head>
<body style="background-color:#f1f5f9;margin:0;padding:0;">
<div class="p-3 sm-p-6">
<div class="card">

  <div class="header-loop p-5 sm-px-7 border-b-2">
    <div class="text-xs uppercase tracking-wider mb-1" style="color:#a7f3d0;">Autoresearch Loop Report</div>
    <div class="text-lg sm-text-xl font-bold text-white" style="word-wrap:break-word;">${skill}</div>
    <div class="mt-2">
      <span class="inline-block rounded-full text-xs font-semibold" style="background:${statusColor}22;color:${statusColor};border:1px solid ${statusColor}66;padding:2px 10px;">${statusLabel}</span>
      <span class="text-xs" style="color:#a7f3d0;margin-left:8px;">${time}</span>
    </div>
  </div>

  <div class="flex flex-wrap border-b">
    <div class="stat-item">
      <div class="stat-num text-slate-900">${bestScore}</div>
      <div class="stat-label">Best Score</div>
    </div>
    <div class="stat-item">
      <div class="stat-num" style="color:#0891b2;">$${cost}</div>
      <div class="stat-label">Cost</div>
    </div>
    <div class="stat-item">
      <div class="stat-num text-slate-500">${duration}s</div>
      <div class="stat-label">Duration</div>
    </div>
  </div>

  <div class="px-4 py-3 sm-px-7 border-b">
    <div class="section-label">Rounds</div>
    <div>
      <span class="pill" style="color:#16a34a;background:#f0fdf4;border-color:#bbf7d0;">${keptCount} kept</span>
      <span class="pill" style="color:#64748b;">${revertedCount} reverted</span>
      <span class="pill" style="color:#64748b;">${baselineCount} baseline</span>
    </div>
    ${escalationCount > 0 ? `<div style="color:#b45309;font-size:12px;margin-top:8px;">${escalationCount} escalation${escalationCount > 1 ? 's' : ''} (Gemini meta-analysis)</div>` : ''}
  </div>

  <div class="px-4 py-3 sm-px-7 border-b">
    <div class="section-label">Health</div>
    <table class="info-table">
      <tr><td class="info-key">Errors</td><td class="info-val" style="color:${errorCount > 0 ? '#dc2626' : '#16a34a'};">${errorCount}</td></tr>
      <tr><td class="info-key">Auto-fixes</td><td class="info-val">${fixCount}</td></tr>
      <tr><td class="info-key">Retries</td><td class="info-val">${retryCount}</td></tr>
    </table>
  </div>

  ${stepHtml ? `
  <div class="px-4 py-3 sm-px-7 border-b">
    <div class="section-label">Pipeline</div>
    <table class="info-table">${stepHtml}</table>
  </div>` : ''}

  ${mutationHtml ? `
  <div class="px-4 py-3 sm-px-7 border-b">
    <div class="section-label">Recent Mutations</div>
    ${mutationHtml}
  </div>` : ''}

  <div class="px-4 py-3 sm-px-7 border-b">
    <div class="section-label">Fleet (${fleet.total} skills)</div>
    <div class="flex flex-wrap">
      <div class="fleet-item">
        <div class="fleet-num" style="color:#16a34a;">${fleet.perfect}</div>
        <div class="fleet-label">Perfect</div>
      </div>
      <div class="fleet-item">
        <div class="fleet-num text-slate-400">${fleet.untested}</div>
        <div class="fleet-label">Untested</div>
      </div>
      <div class="fleet-item">
        <div class="fleet-num" style="color:#dc2626;">${fleet.stuck}</div>
        <div class="fleet-label">Stuck</div>
      </div>
    </div>
    <div class="mt-2">
      <span class="fleet-meta">Avg: <span class="text-slate-700">${fleet.avg}</span></span>
      <span class="fleet-meta">Cost: <span class="text-slate-700">${fleet.cost}</span></span>
      <span class="fleet-meta">Rounds: <span class="text-slate-700">${fleet.rounds}</span></span>
    </div>
  </div>

  ${promoHtml ? `
  <div class="px-4 py-3 sm-px-7 border-b">
    <div class="section-label">Promotion Ready (${promos.length})</div>
    ${promoHtml}
  </div>` : ''}

  <div class="px-4 py-3 sm-px-7 text-center">
    <div class="text-slate-400 break-all" style="font-size:10px;">${logFile}</div>
  </div>

</div>
</div>
</body>
</html>`

// Send
const subject = `${icon} Autoresearch | ${skill}: ${bestScore} | $${cost} | ${keptCount} kept | ${errorCount} err`

fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ from: FROM, to: TO, subject, html }),
}).then(res => res.json()).then(d => {
  if (d.id) console.log(`→ Report emailed (${d.id})`)
  else console.log(`→ Email error: ${JSON.stringify(d)}`)
}).catch(e => console.log(`→ Email failed: ${e.message}`))
