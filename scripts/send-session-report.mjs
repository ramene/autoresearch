#!/usr/bin/env node
/**
 * Session Provisioning Report — emailed on every /scaffold session launch
 *
 * Usage: node send-session-report.mjs <session-name> <workspace-path> [plan-file]
 *
 * Sends the same status table shown in terminal, plus plan summary,
 * skills installed, ecosystem mapped, and MCP tools available.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'fs'
import { resolve, basename } from 'path'
import { EMAIL_STYLE } from './email-theme.mjs'

const CRED = '/usr/local/etc/autoresearch-credentials/resend-api-key.txt'
const TO = 'ramene.anthony@gmail.com'
const FROM = 'Autoresearch <alerts@micropaymnts.ai>'

const sessionName = process.argv[2]
const workspace = process.argv[3]
const planFile = process.argv[4]

if (!sessionName || !workspace) {
  console.log('Usage: node send-session-report.mjs <session-name> <workspace-path> [plan-file]')
  process.exit(1)
}

let key
try { key = readFileSync(CRED, 'utf8').trim() }
catch { console.log('→ No Resend key'); process.exit(0) }

// ─── Gather session data ─────────────────────────────────────────────────────

// Skills
let skillCount = 0
let skillNames = []
const skillDir = resolve(workspace, '.claude/skills')
try {
  const dirs = readdirSync(skillDir).filter(d => {
    try { return statSync(resolve(skillDir, d)).isDirectory() } catch { return false }
  })
  skillCount = dirs.length
  skillNames = dirs.slice(0, 10)
} catch {}

// Ecosystem
let ecosystemCount = 0
const ecoFile = resolve(workspace, '.claude/CLAUDE-ecosystem.md')
try {
  const eco = readFileSync(ecoFile, 'utf8')
  ecosystemCount = (eco.match(/^\|/gm) || []).length - 2 // minus header rows
  if (ecosystemCount < 0) ecosystemCount = (eco.match(/sibling/i)?.[0] ? parseInt(eco.match(/(\d+)\s*sibling/)?.[1] || '0') : 0)
} catch {}

// Plan summary
let planSummary = 'No plan file'
let planTitle = sessionName
if (planFile && existsSync(planFile)) {
  const plan = readFileSync(planFile, 'utf8')
  planTitle = plan.match(/^#\s+(.+)$/m)?.[1] || sessionName
  // Extract first blockquote (usually the one-liner description)
  const desc = plan.match(/^>\s+(.+)$/m)?.[1] || ''
  // Count phases
  const phases = (plan.match(/^###?\s+Phase\s+\d/gm) || []).length
  const targets = (plan.match(/\*\*Workspace\*\*/g) || []).length
  planSummary = `${desc}\nPhases: ${phases} | Targets: ${targets}`
}

// MCP servers
let mcpServers = []
try {
  const claudeConfig = JSON.parse(readFileSync(resolve(process.env.HOME, '.claude.json'), 'utf8'))
  mcpServers = Object.keys(claudeConfig.mcpServers || {})
} catch {}

// tmux-logs path
const logsDir = resolve(process.env.HOME, 'Journal/tmux-logs', sessionName)
const logsExist = existsSync(logsDir)

// Plan state
let planState = 'unknown'
const stateFile = resolve(process.env.HOME, 'Journal/.plan-state', sessionName, 'state.json')
try {
  const state = JSON.parse(readFileSync(stateFile, 'utf8'))
  planState = state.status || 'unknown'
} catch {}

// Git
let gitRemote = 'none'
try {
  const gitConfig = readFileSync(resolve(workspace, '.git/config'), 'utf8')
  const remoteMatch = gitConfig.match(/url\s*=\s*(.+)/)?.[1]
  if (remoteMatch) gitRemote = remoteMatch.trim()
} catch {}

// ─── Build HTML report ───────────────────────────────────────────────────────

const ts = new Date().toLocaleString('en-US', { timeZone: 'America/Chicago', dateStyle: 'medium', timeStyle: 'short' })
const stateColor = planState === 'running' ? '#22c55e' : planState === 'completed' ? '#3b82f6' : '#9ca3af'
const stateLabel = planState === 'running' ? 'ACTIVE' : planState === 'completed' ? 'COMPLETE' : planState.toUpperCase()

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

  <div class="header-session p-5 sm-px-7 border-b-2">
    <div class="text-xs uppercase tracking-wider mb-1" style="color:#cbd5e1;">Session Provisioned</div>
    <div class="text-lg sm-text-xl font-bold text-white" style="word-wrap:break-word;">${planTitle}</div>
    <div class="mt-2">
      <span class="inline-block rounded-full text-xs font-semibold" style="background:${stateColor}22;color:${stateColor};border:1px solid ${stateColor}66;padding:2px 10px;">${stateLabel}</span>
      <span class="text-xs" style="color:#cbd5e1;margin-left:8px;">${ts}</span>
    </div>
  </div>

  <div class="px-4 py-3 sm-px-7 border-b">
    <div class="section-label">Plan</div>
    <div class="text-sm text-slate-700" style="line-height:1.5;font-size:13px;">${planSummary.replace(/\n/g, '<br>')}</div>
  </div>

  <div class="flex flex-wrap border-b">
    <div class="stat-item">
      <div class="stat-num" style="color:#d97706;">${skillCount}</div>
      <div class="stat-label">Skills</div>
    </div>
    <div class="stat-item">
      <div class="stat-num" style="color:#7c3aed;">${ecosystemCount}</div>
      <div class="stat-label">Ecosystem</div>
    </div>
    <div class="stat-item">
      <div class="stat-num" style="color:#0891b2;">${mcpServers.length}</div>
      <div class="stat-label">MCP Servers</div>
    </div>
  </div>

  <div class="px-4 py-3 sm-px-7 border-b">
    <div class="section-label">Workspace</div>
    <table class="info-table">
      <tr><td class="info-key">Path</td><td class="info-val"><code class="code-val">${workspace}</code></td></tr>
      <tr><td class="info-key">Git</td><td class="info-val">${gitRemote}</td></tr>
      <tr><td class="info-key">Logs</td><td class="info-val">${logsExist ? logsDir : 'pending'}</td></tr>
    </table>
  </div>

  <div class="px-4 py-3 sm-px-7 border-b">
    <div class="section-label">MCP Servers</div>
    <div>${mcpServers.map(m => `<span class="pill">${m}</span>`).join('')}</div>
  </div>

  <div class="px-4 py-3 sm-px-7 border-b">
    <div class="section-label">Skills (${skillCount})</div>
    <div>${skillNames.map(s => `<span class="skill-tag">${s}</span>`).join('')}${skillCount > 10 ? `<span class="text-slate-400" style="font-size:11px;">+${skillCount - 10} more</span>` : ''}</div>
  </div>

  <div class="px-4 py-3 sm-px-7 border-b">
    <div class="section-label">Configuration</div>
    <div>
      <span class="config-item"><span style="color:#16a34a;">●</span> Agent Teams</span>
      <span class="config-item"><span style="color:#d97706;">●</span> Bypass Permissions</span>
      <span class="config-item"><span style="color:#0891b2;">●</span> Memory Bank (5 files)</span>
      <span class="config-item"><span style="color:#7c3aed;">●</span> tmux-logs</span>
    </div>
  </div>

  <div class="px-4 py-3 sm-px-7 text-center">
    <div class="text-slate-400" style="font-size:10px;">Session: <code class="font-mono" style="font-size:10px;color:#64748b;">${sessionName}</code></div>
  </div>

</div>
</div>
</body>
</html>`

// ─── Send HTML ───────────────────────────────────────────────────────────────

const subject = `Session: ${planTitle.slice(0, 50)} | ${skillCount} skills | ${mcpServers.length} MCPs`

fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ from: FROM, to: TO, subject, html }),
}).then(res => res.json()).then(d => {
  if (d.id) console.log(`→ Session report emailed (${d.id})`)
  else console.log(`→ Email error: ${JSON.stringify(d)}`)
}).catch(e => console.log(`→ Email failed: ${e.message}`))
