#!/usr/bin/env node
/**
 * Monthly Retrospective Report — Professional format email
 * Sends rich HTML email with workstream scores, recommendations, and audio link.
 *
 * Usage: node send-retrospective-report.mjs --month March --year 2026 --report <path> [--audio <url>] [--scores <json>]
 */
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { EMAIL_STYLE } from './email-theme.mjs'

const CRED = '/usr/local/etc/autoresearch-credentials/resend-api-key.txt'
const TO = 'ramene.anthony@gmail.com'
const FROM = 'Autoresearch <alerts@micropaymnts.ai>'

// Parse args
const args = process.argv.slice(2)
const getArg = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : null }

const month = getArg('month') || new Date().toLocaleString('en-US', { month: 'long' })
const year = getArg('year') || new Date().getFullYear()
const reportPath = getArg('report')
const audioUrl = getArg('audio')
const scoresJson = getArg('scores')

if (!reportPath) { console.log('Usage: node send-retrospective-report.mjs --month March --year 2026 --report <path>'); process.exit(1) }

let key
try { key = readFileSync(CRED, 'utf8').trim() }
catch { console.log('→ No Resend key'); process.exit(0) }

const report = readFileSync(reportPath, 'utf8')

// Extract metrics from markdown
const lines = report.split('\n')
const workstreams = (report.match(/\|.*\|.*\|.*\|/g) || []).length - 1 // minus header
const stopItems = (report.match(/\*\*STOP\*\*/g) || []).length || (report.match(/## STOP/g) || []).length
const doubleItems = (report.match(/\*\*DOUBLE DOWN\*\*/g) || []).length || (report.match(/## DOUBLE DOWN/g) || []).length
const fixItems = (report.match(/\*\*FIX NOW\*\*/g) || []).length || (report.match(/## FIX NOW/g) || []).length
const commits = report.match(/(\d+)\s*commits?/i)?.[1] || '?'
const skills = report.match(/(\d+)\s*skills?/i)?.[1] || '?'

let scores = { completion: '?', revenue: '?', debt: '?', risk: '?', alignment: '?' }
if (scoresJson) {
  try { scores = { ...scores, ...JSON.parse(scoresJson) } } catch {}
}

// Extract executive summary (first 5 bullets after "Executive Summary")
const execMatch = report.match(/Executive Summary[\s\S]*?((?:[-*].*\n){1,5})/)
const execBullets = execMatch ? execMatch[1].trim().split('\n').map(l => l.replace(/^[-*]\s*/, '').trim()) : []

const time = new Date().toLocaleString('en-US', { timeZone: 'America/Chicago', dateStyle: 'medium', timeStyle: 'short' })

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<style>${EMAIL_STYLE}</style>
</head>
<body style="background-color:#f1f5f9;margin:0;padding:0;">
<div class="p-3 sm-p-6">
<div class="card">

  <div style="background:linear-gradient(135deg,#1e1b4b,#4338ca,#6366f1);padding:20px 24px;border-bottom:2px solid #cbd5e1;">
    <div style="color:rgba(255,255,255,0.7);font-size:11px;text-transform:uppercase;letter-spacing:1.5px;">Monthly Retrospective</div>
    <div style="color:white;font-size:22px;font-weight:700;margin-top:4px;">${month} ${year}</div>
    <div style="margin-top:8px;">
      <span style="background:rgba(255,255,255,0.2);color:white;padding:2px 10px;border-radius:99px;font-size:12px;font-weight:600;">DEVELOPMENT INTELLIGENCE BRIEFING</span>
      <span style="color:rgba(255,255,255,0.6);margin-left:8px;font-size:12px;">${time}</span>
    </div>
  </div>

  <div class="flex flex-wrap border-b">
    <div class="stat-item">
      <div class="stat-num text-slate-900">${workstreams}</div>
      <div class="stat-label">Workstreams</div>
    </div>
    <div class="stat-item">
      <div class="stat-num" style="color:#7c3aed;">${commits}</div>
      <div class="stat-label">Commits</div>
    </div>
    <div class="stat-item">
      <div class="stat-num" style="color:#0891b2;">${skills}</div>
      <div class="stat-label">Skills</div>
    </div>
  </div>

  ${execBullets.length > 0 ? `
  <div class="px-4 py-3 sm-px-7 border-b">
    <div class="section-label">Executive Summary</div>
    ${execBullets.map(b => `<div style="padding:3px 0;font-size:12px;color:#334155;">• ${b}</div>`).join('')}
  </div>` : ''}

  <div class="px-4 py-3 sm-px-7 border-b">
    <div class="section-label">Scoring (1-10)</div>
    <table class="info-table">
      <tr><td class="info-key">Completion</td><td class="info-val" style="color:${scores.completion >= 7 ? '#16a34a' : scores.completion >= 4 ? '#d97706' : '#dc2626'};">${scores.completion}/10</td></tr>
      <tr><td class="info-key">Revenue Impact</td><td class="info-val" style="color:${scores.revenue >= 7 ? '#16a34a' : scores.revenue >= 4 ? '#d97706' : '#dc2626'};">${scores.revenue}/10</td></tr>
      <tr><td class="info-key">Arch. Debt</td><td class="info-val" style="color:${scores.debt <= 3 ? '#16a34a' : scores.debt <= 6 ? '#d97706' : '#dc2626'};">${scores.debt}/10</td></tr>
      <tr><td class="info-key">Dep. Risk</td><td class="info-val" style="color:${scores.risk <= 3 ? '#16a34a' : scores.risk <= 6 ? '#d97706' : '#dc2626'};">${scores.risk}/10</td></tr>
      <tr><td class="info-key">Strategy</td><td class="info-val" style="color:${scores.alignment >= 7 ? '#16a34a' : scores.alignment >= 4 ? '#d97706' : '#dc2626'};">${scores.alignment}/10</td></tr>
    </table>
  </div>

  <div class="px-4 py-3 sm-px-7 border-b">
    <div class="section-label">Recommendations</div>
    <div>
      <span class="pill" style="color:#dc2626;background:#fef2f2;border-color:#fecaca;">${stopItems} STOP</span>
      <span class="pill" style="color:#16a34a;background:#f0fdf4;border-color:#bbf7d0;">${doubleItems} DOUBLE DOWN</span>
      <span class="pill" style="color:#d97706;background:#fffbeb;border-color:#fde68a;">${fixItems} FIX NOW</span>
    </div>
  </div>

  ${audioUrl ? `
  <div class="px-4 py-3 sm-px-7 border-b">
    <div class="section-label">Audio Briefing</div>
    <div style="padding:8px 0;">
      <a href="${audioUrl}" style="display:inline-block;background:#4338ca;color:white;padding:8px 16px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600;">Listen to Retrospective</a>
    </div>
    <div style="font-size:11px;color:#94a3b8;">Generated via NotebookLM • Stored on GCS</div>
  </div>` : ''}

  <div class="px-4 py-3 sm-px-7 text-center">
    <a href="https://github.com/users/ramene/projects/23" style="font-size:11px;color:#64748b;">GitHub Board</a>
    <span style="color:#cbd5e1;margin:0 8px;">|</span>
    <span style="font-size:10px;color:#94a3b8;">${month} ${year} Development Intelligence</span>
  </div>

</div>
</div>
</body>
</html>`

const subject = `📊 ${month} ${year} Retrospective | ${workstreams} workstreams | ${commits} commits | ${skills} skills`

fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ from: FROM, to: TO, subject, html }),
}).then(res => res.json()).then(d => {
  if (d.id) console.log(`→ Retrospective report emailed (${d.id})`)
  else console.log(`→ Email error: ${JSON.stringify(d)}`)
}).catch(e => console.log(`→ Email failed: ${e.message}`))
