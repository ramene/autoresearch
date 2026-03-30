#!/usr/bin/env node
/**
 * Session Provisioning Report — emailed on every /scaffold session launch
 *
 * Usage: node send-session-report.mjs <session-name> <workspace-path> [plan-file]
 *
 * Fixes applied 2026-03-30:
 *   - Gmail clipping: inline styles only, no external EMAIL_STYLE (keeps HTML < 50KB)
 *   - Plan parsing: reads PLAN.md for day/phase counts, targets, context line
 *   - Git detection: reads .git/config for remote URL
 *   - Logs detection: checks both Journal/.tmux-logs and .local/share/tmux-logs
 *   - Outlook compat: background-color fallback alongside linear-gradient
 *   - Status detection: reads plan-state/state.json properly
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'fs'
import { resolve, basename } from 'path'
import { execSync } from 'child_process'

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
  skillNames = dirs.sort()
} catch {}

// Ecosystem
let ecosystemCount = 0
const ecoFile = resolve(workspace, '.claude/CLAUDE-ecosystem.md')
try {
  const eco = readFileSync(ecoFile, 'utf8')
  const match = eco.match(/(\d+)\s*sibling/i)
  if (match) ecosystemCount = parseInt(match[1])
  else ecosystemCount = Math.max(0, (eco.match(/^\|/gm) || []).length - 2)
} catch {}

// Plan — improved parsing
let planSummary = 'No plan file'
let planTitle = sessionName
let planPhases = 0
let planDays = 0
let planTargets = 0
let planContext = ''
if (planFile && existsSync(planFile)) {
  const plan = readFileSync(planFile, 'utf8')
  planTitle = plan.match(/^#\s+(.+)$/m)?.[1] || sessionName

  // Context line — first paragraph after the title
  const contextMatch = plan.match(/^##\s+Context\s*\n+([\s\S]*?)(?=\n##|\n---)/m)
  if (contextMatch) {
    planContext = contextMatch[1].trim().split('\n')[0].slice(0, 200)
  }

  // Count phases (### Phase N or ### Day N)
  planPhases = (plan.match(/^###?\s+(Phase|Step)\s+\d/gim) || []).length
  planDays = (plan.match(/^###?\s+Day\s+\d/gim) || []).length
  planTargets = (plan.match(/\*\*Workspace\*\*|\*\*Build:\*\*|\*\*Wire/gm) || []).length

  if (planDays > 0) {
    planSummary = `${planContext || planTitle}<br>${planDays} days | ${planTargets} build targets`
  } else if (planPhases > 0) {
    planSummary = `${planContext || planTitle}<br>${planPhases} phases | ${planTargets} targets`
  } else {
    planSummary = planContext || `Plan loaded (${plan.split('\n').length} lines)`
  }
}

// MCP servers
let mcpServers = []
try {
  const claudeConfig = JSON.parse(readFileSync(resolve(process.env.HOME, '.claude.json'), 'utf8'))
  mcpServers = Object.keys(claudeConfig.mcpServers || {})
} catch {}

// tmux-logs path — check both locations
let logsPath = 'pending'
const logPaths = [
  resolve(process.env.HOME, '.local/share/tmux-logs', sessionName),
  resolve(process.env.HOME, 'Journal/.tmux-logs', sessionName),
]
for (const p of logPaths) {
  if (existsSync(p)) { logsPath = p; break }
}
// Also check date-based logs
try {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '/')
  const streamLog = resolve(process.env.HOME, '.local/share/tmux-logs', today, 'streaming', `${sessionName}-0-0.log`)
  if (existsSync(streamLog)) logsPath = streamLog
} catch {}

// Plan state — check multiple locations
let planState = 'ACTIVE'
const statePaths = [
  resolve(process.env.HOME, 'Journal/.plan-state', sessionName, 'state.json'),
  resolve(process.env.HOME, 'Journal/.plan-state', `plan-${sessionName}`, 'state.json'),
]
for (const sp of statePaths) {
  try {
    const state = JSON.parse(readFileSync(sp, 'utf8'))
    planState = (state.status || 'active').toUpperCase()
    break
  } catch {}
}

// Git
let gitInfo = 'none'
try {
  const gitConfig = readFileSync(resolve(workspace, '.git/config'), 'utf8')
  const remoteMatch = gitConfig.match(/url\s*=\s*(.+)/)?.[1]?.trim()
  if (remoteMatch) {
    // Shorten: git@github.com:ramene/foo.git → ramene/foo
    gitInfo = remoteMatch.replace('git@github.com:', '').replace('https://github.com/', '').replace('.git', '')
  }
} catch {}
// If no remote but .git exists
if (gitInfo === 'none' && existsSync(resolve(workspace, '.git'))) {
  gitInfo = 'local (no remote)'
}

// Build GitHub URL from gitInfo
let gitUrl = ''
if (gitInfo && gitInfo !== 'none' && gitInfo !== 'local (no remote)') {
  gitUrl = `https://github.com/${gitInfo}`
}

// Memory bank count
let memoryCount = 0
try {
  memoryCount = readdirSync(resolve(workspace, '.claude')).filter(f => f.startsWith('CLAUDE-') && f.endsWith('.md')).length
} catch {}

// ─── Build HTML report (INLINE styles only — no EMAIL_STYLE import) ──────────
// Gmail clips at ~102KB. Inline everything to stay under 40KB.

const ts = new Date().toLocaleString('en-US', { timeZone: 'America/Merida', dateStyle: 'medium', timeStyle: 'short' })
const stateColor = planState === 'ACTIVE' || planState === 'RUNNING' ? '#22c55e' : planState === 'COMPLETED' ? '#3b82f6' : '#9ca3af'

// Show ALL skills (no "+N more" truncation)
const skillTags = skillNames.map(s =>
  `<span style="background:#f1f5f9;padding:3px 8px;border-radius:4px;font-size:11px;font-family:ui-monospace,'SF Mono',Menlo,monospace;display:inline-block;margin:0 6px 6px 0;color:#334155;border:1px solid #e2e8f0;">${s}</span>`
).join('')

const mcpTags = mcpServers.map(m =>
  `<span style="background:#f1f5f9;color:#7c3aed;padding:5px 12px;border-radius:6px;font-size:12px;border:1px solid #e2e8f0;display:inline-block;margin:0 6px 8px 0;">${m}</span>`
).join('')

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
</head>
<body style="background-color:#f1f5f9;margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
<div style="padding:12px;">
<div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">

  <div style="background-color:#334155;background-image:linear-gradient(135deg,#334155,#475569);padding:20px 24px;border-bottom:2px solid #cbd5e1;">
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#cbd5e1;margin-bottom:4px;">Session Provisioned</div>
    <div style="font-size:18px;font-weight:700;color:#ffffff;word-wrap:break-word;">${planTitle}</div>
    <div style="margin-top:8px;">
      <span style="display:inline-block;border-radius:9999px;font-size:12px;font-weight:600;background:${stateColor}22;color:${stateColor};border:1px solid ${stateColor}66;padding:2px 10px;">${planState}</span>
      <span style="font-size:12px;color:#cbd5e1;margin-left:8px;">${ts}</span>
    </div>
  </div>

  <div style="padding:12px 16px;border-bottom:1px solid #e2e8f0;">
    <div style="font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;margin-bottom:8px;font-weight:600;">Plan</div>
    <div style="font-size:13px;color:#334155;line-height:1.5;">${planSummary}</div>
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid #e2e8f0;">
    <tr>
      <td width="33%" align="center" style="padding:14px 8px;">
        <div style="font-size:28px;font-weight:700;color:#d97706;">${skillCount}</div>
        <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;margin-top:2px;">Skills</div>
      </td>
      <td width="34%" align="center" style="padding:14px 8px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
        <div style="font-size:28px;font-weight:700;color:#7c3aed;">${ecosystemCount}</div>
        <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;margin-top:2px;">Ecosystem</div>
      </td>
      <td width="33%" align="center" style="padding:14px 8px;">
        <div style="font-size:28px;font-weight:700;color:#0891b2;">${mcpServers.length}</div>
        <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;margin-top:2px;">MCP Servers</div>
      </td>
    </tr>
  </table>

  <div style="padding:12px 16px;border-bottom:1px solid #e2e8f0;">
    <div style="font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;margin-bottom:8px;font-weight:600;">Workspace</div>
    <table style="width:100%;font-size:12px;border-collapse:collapse;">
      <tr><td style="color:#94a3b8;width:50px;padding:4px 8px 4px 0;white-space:nowrap;">Path</td><td style="color:#334155;word-break:break-all;font-size:11px;padding:4px 0;"><span style="background:#f1f5f9;padding:2px 6px;border-radius:4px;font-size:11px;font-family:ui-monospace,'SF Mono',Menlo,monospace;">${workspace}</span></td></tr>
      <tr><td style="color:#94a3b8;width:50px;padding:4px 8px 4px 0;white-space:nowrap;">Git</td><td style="color:#334155;font-size:11px;padding:4px 0;">${gitUrl ? `<a href="${gitUrl}" style="color:#4338ca;text-decoration:none;">${gitInfo}</a>` : gitInfo}</td></tr>
      <tr><td style="color:#94a3b8;width:50px;padding:4px 8px 4px 0;white-space:nowrap;">Logs</td><td style="color:#334155;font-size:11px;padding:4px 0;word-break:break-all;">${logsPath}</td></tr>
    </table>
  </div>

  <div style="padding:12px 16px;border-bottom:1px solid #e2e8f0;">
    <div style="font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;margin-bottom:8px;font-weight:600;">MCP Servers</div>
    <div>${mcpTags || '<span style="color:#94a3b8;font-size:12px;">none</span>'}</div>
  </div>

  <div style="padding:12px 16px;border-bottom:1px solid #e2e8f0;">
    <div style="font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;margin-bottom:8px;font-weight:600;">Skills (${skillCount})</div>
    <div>${skillTags || '<span style="color:#94a3b8;font-size:12px;">none</span>'}</div>
  </div>

  <div style="padding:12px 16px;border-bottom:1px solid #e2e8f0;">
    <div style="font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;margin-bottom:8px;font-weight:600;">Configuration</div>
    <div>
      <span style="display:inline-block;margin-right:14px;margin-bottom:6px;font-size:12px;color:#64748b;"><span style="color:#16a34a;">●</span> Agent Teams</span>
      <span style="display:inline-block;margin-right:14px;margin-bottom:6px;font-size:12px;color:#64748b;"><span style="color:#d97706;">●</span> Bypass Permissions</span>
      <span style="display:inline-block;margin-right:14px;margin-bottom:6px;font-size:12px;color:#64748b;"><span style="color:#0891b2;">●</span> Memory Bank (${memoryCount} files)</span>
      <span style="display:inline-block;margin-right:14px;margin-bottom:6px;font-size:12px;color:#64748b;"><span style="color:#7c3aed;">●</span> tmux-logs</span>
    </div>
  </div>

  <div style="padding:12px 16px;text-align:center;">
    <div style="color:#94a3b8;font-size:10px;">Session: <code style="font-family:ui-monospace,'SF Mono',Menlo,monospace;font-size:10px;color:#64748b;">${sessionName}</code></div>
  </div>

</div>
</div>
</body>
</html>`

// ─── Send ────────────────────────────────────────────────────────────────────

const subject = `Session: ${planTitle.slice(0, 60)} | ${skillCount} skills | ${mcpServers.length} MCPs`

fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ from: FROM, to: TO, subject, html }),
}).then(res => res.json()).then(d => {
  if (d.id) console.log(`→ Session report emailed (${d.id})`)
  else console.log(`→ Email error: ${JSON.stringify(d)}`)
}).catch(e => console.log(`→ Email failed: ${e.message}`))

// ─── Terminal report (print to stdout) ───────────────────────────────────────

const pad = (s, n) => s.padEnd(n)
const W = 100
const sep = '─'.repeat(W)

console.log('')
console.log(`┌${'─'.repeat(20)}┬${'─'.repeat(W)}┐`)
console.log(`│ ${'Component'.padEnd(18)} │ ${'Status'.padEnd(W - 2)} │`)
console.log(`├${'─'.repeat(20)}┼${'─'.repeat(W)}┤`)
console.log(`│ ${'tmux session'.padEnd(18)} │ ${(sessionName + ' — attached in iTerm').padEnd(W - 2)} │`)
console.log(`├${'─'.repeat(20)}┼${'─'.repeat(W)}┤`)
console.log(`│ ${'Workspace'.padEnd(18)} │ ${workspace.padEnd(W - 2)} │`)
console.log(`├${'─'.repeat(20)}┼${'─'.repeat(W)}┤`)
console.log(`│ ${'Skills'.padEnd(18)} │ ${(skillCount + ' installed (' + skillNames.slice(0, 4).join(', ') + (skillCount > 4 ? ', ...' : '') + ')').padEnd(W - 2)} │`)
console.log(`├${'─'.repeat(20)}┼${'─'.repeat(W)}┤`)
console.log(`│ ${'Ecosystem'.padEnd(18)} │ ${(ecosystemCount + ' sibling projects mapped in CLAUDE-ecosystem.md').padEnd(W - 2)} │`)
console.log(`├${'─'.repeat(20)}┼${'─'.repeat(W)}┤`)
const planLine = planFile ? `Fed as PLAN.md — ${planDays > 0 ? planDays + ' days' : planPhases + ' phases'}, ${planTargets} targets` : 'No plan file'
console.log(`│ ${'Plan'.padEnd(18)} │ ${planLine.padEnd(W - 2)} │`)
console.log(`├${'─'.repeat(20)}┼${'─'.repeat(W)}┤`)
console.log(`│ ${'Agent Teams'.padEnd(18)} │ ${'Enabled (CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1)'.padEnd(W - 2)} │`)
console.log(`├${'─'.repeat(20)}┼${'─'.repeat(W)}┤`)
console.log(`│ ${'Bypass permissions'.padEnd(18)} │ ${'On (for autonomous execution)'.padEnd(W - 2)} │`)
console.log(`├${'─'.repeat(20)}┼${'─'.repeat(W)}┤`)
console.log(`│ ${'tmux-logs'.padEnd(18)} │ ${logsPath.padEnd(W - 2)} │`)
console.log(`├${'─'.repeat(20)}┼${'─'.repeat(W)}┤`)
console.log(`│ ${'Git'.padEnd(18)} │ ${gitInfo.padEnd(W - 2)} │`)
console.log(`├${'─'.repeat(20)}┼${'─'.repeat(W)}┤`)
console.log(`│ ${'Plan state'.padEnd(18)} │ ${(planState.toLowerCase() + ' — tracked at ~/Journal/.plan-state/').padEnd(W - 2)} │`)
console.log(`└${'─'.repeat(20)}┴${'─'.repeat(W)}┘`)
console.log('')
