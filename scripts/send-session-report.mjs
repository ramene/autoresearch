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
  planSummary = `${desc}\n  Phases: ${phases} | Targets: ${targets}`
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

// ─── Build report ────────────────────────────────────────────────────────────

const hr = '━'.repeat(50)
const ts = new Date().toLocaleString('en-US', { timeZone: 'America/Chicago', dateStyle: 'medium', timeStyle: 'short' })

let r = ''
r += `🚀 SESSION PROVISIONED\n`
r += `${hr}\n\n`
r += `  Session:    ${sessionName}\n`
r += `  Time:       ${ts}\n`
r += `  State:      ${planState}\n`
r += `\n`

r += `${hr}\n`
r += `  WORKSPACE\n`
r += `${hr}\n\n`
r += `  Path:       ${workspace}\n`
r += `  Git:        ${gitRemote}\n`
r += `  Skills:     ${skillCount} installed\n`
if (skillNames.length > 0) {
  r += `              ${skillNames.join(', ')}${skillCount > 10 ? ', ...' : ''}\n`
}
r += `  Ecosystem:  ${ecosystemCount} sibling projects\n`
r += `  Logs:       ${logsExist ? logsDir : 'not yet created'}\n`
r += `\n`

r += `${hr}\n`
r += `  PLAN\n`
r += `${hr}\n\n`
r += `  Title:      ${planTitle}\n`
r += `  ${planSummary}\n`
r += `\n`

r += `${hr}\n`
r += `  MCP SERVERS (${mcpServers.length})\n`
r += `${hr}\n\n`
for (const mcp of mcpServers) {
  r += `  • ${mcp}\n`
}
r += `\n`

r += `${hr}\n`
r += `  CONFIGURATION\n`
r += `${hr}\n\n`
r += `  Agent Teams:      enabled\n`
r += `  Permissions:      --dangerously-skip-permissions\n`
r += `  Memory Bank:      5 files (activeContext, patterns, decisions, troubleshooting, ecosystem)\n`
r += `\n`

r += `${hr}\n`
r += `Log: ${logsExist ? logsDir : 'pending'}\n`

// ─── Send ────────────────────────────────────────────────────────────────────

const subject = `🚀 Session: ${sessionName} | ${skillCount} skills | ${mcpServers.length} MCPs | ${planState}`

fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ from: FROM, to: TO, subject, text: r }),
}).then(res => res.json()).then(d => {
  if (d.id) console.log(`→ Session report emailed (${d.id})`)
  else console.log(`→ Email error: ${JSON.stringify(d)}`)
}).catch(e => console.log(`→ Email failed: ${e.message}`))
