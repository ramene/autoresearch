#!/usr/bin/env node
/**
 * Send autoresearch loop report via Resend.
 * Usage: node scripts/send-report.mjs <log-file>
 * 
 * This replaces the fragile inline curl + bash string escaping
 * that has failed 8-9 times. Node handles JSON properly.
 */
import { readFileSync } from 'fs'

const CRED_PATH = '/usr/local/etc/autoresearch-credentials/resend-api-key.txt'
const TO = 'ramene.anthony@gmail.com'
const FROM = 'Autoresearch <alerts@micropaymnts.ai>'

const logFile = process.argv[2]
if (!logFile) { console.log('Usage: node send-report.mjs <log-file>'); process.exit(1) }

let key
try { key = readFileSync(CRED_PATH, 'utf8').trim() } 
catch { console.log('No Resend key'); process.exit(0) }

const log = readFileSync(logFile, 'utf8')

// Extract data from log
const skill = (log.match(/Optimizing:\s+(\S+)/)?.[1]) || 'none'
const bestScore = log.match(/Final best score:\s+(\S+)/)?.[1] || '?'
const cost = log.match(/Total spent:\s+\$(\S+)/)?.[1] || '0.00'
const kept = (log.match(/KEPT/g) || []).length
const reverted = (log.match(/REVERTED/g) || []).length
const baseline = (log.match(/BASELINE/g) || []).length
const errors = (log.match(/EPERM|Fatal error|command not found/g) || []).length
const escalations = (log.match(/STUCK|escalat/gi) || []).length
const icon = errors > 0 ? '⚠' : '✓'
const duration = log.match(/Duration:\s+(\d+)/)?.[1] || '?'

// Count fleet from self-model if available
let fleet = ''
try {
  const sm = JSON.parse(readFileSync('/Users/ramene/.remote/@autoresearch/self-model.json', 'utf8'))
  fleet = `Skills: ${sm.summary.total_skills} | Perfect: ${sm.summary.skills_at_target} | Stuck: ${sm.summary.skills_stuck} | Untested: ${sm.summary.skills_untested}`
} catch { fleet = 'Fleet data unavailable' }

const subject = `${icon} Autoresearch | ${skill}: ${bestScore} | $${cost} | ${kept} kept`

const body = `${icon} AUTORESEARCH LOOP REPORT
${'━'.repeat(40)}

  Skill:      ${skill}
  Best Score: ${bestScore}
  Kept:       ${kept}
  Reverted:   ${reverted}
  Baseline:   ${baseline}
  Escalations:${escalations}
  Errors:     ${errors}
  Cost:       $${cost}

${'━'.repeat(40)}
  ${fleet}
${'━'.repeat(40)}

  Log: ${logFile}
  Time: ${new Date().toISOString()}
`

const payload = JSON.stringify({
  from: FROM,
  to: TO,
  subject: subject,
  text: body,
})

fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
  body: payload,
}).then(r => r.json()).then(d => {
  if (d.id) console.log('→ Report emailed (' + d.id + ')')
  else console.log('→ Email error: ' + JSON.stringify(d))
}).catch(e => console.log('→ Email failed: ' + e.message))
