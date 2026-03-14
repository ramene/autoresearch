#!/usr/bin/env node
/**
 * Autoresearch Dashboard Server
 *
 * Serves the dashboard + provides API to start/stop autoresearch runs.
 *
 * Usage:
 *   node dashboard/server.mjs              # Production (serves dist/)
 *   node dashboard/server.mjs --dev        # Dev mode (proxies to Vite)
 */

import { createServer } from 'http'
import { readFileSync, existsSync, writeFileSync } from 'fs'
import { resolve, dirname, extname, join } from 'path'
import { fileURLToPath } from 'url'
import { spawn } from 'child_process'

// Load .env from repo root
const __dirname2 = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname2, '../.env')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^([A-Z_]+)=(.+)$/)
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim()
  }
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = parseInt(process.env.PORT || '4100')
const RUNNER_PATH = resolve(__dirname, '../skills/autoresearch-runner.mjs')
const PUBLIC_DIR = resolve(__dirname, 'public')
const DIST_DIR = resolve(__dirname, 'dist')

let runnerProcess = null
let runnerLog = []

const MIME = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
}

function serveStatic(res, filePath) {
  if (!existsSync(filePath)) { res.writeHead(404); res.end('Not found'); return }
  const ext = extname(filePath)
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-cache' })
  res.end(readFileSync(filePath))
}

function jsonResponse(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
  res.end(JSON.stringify(data))
}

function parseBody(req) {
  return new Promise((resolve) => {
    let body = ''
    req.on('data', chunk => body += chunk)
    req.on('end', () => { try { resolve(JSON.parse(body)) } catch { resolve({}) } })
  })
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)
  const path = url.pathname

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST', 'Access-Control-Allow-Headers': 'Content-Type' })
    res.end(); return
  }

  // ─── API Routes ──────────────────────────────────────────────

  if (path === '/api/run' && req.method === 'POST') {
    if (runnerProcess) { jsonResponse(res, { error: 'Already running' }, 409); return }

    const body = await parseBody(req)
    const args = [
      RUNNER_PATH,
      '--skill', body.skill || 'system-self-correction-v2',
      '--evaluator', body.evaluator || 'gemini-2.5-pro',
      '--mutator', body.mutator || 'claude-3-haiku-20240307',
      '--target', String(body.target || 60),
      '--rounds', String(body.rounds || 100),
      '--dashboard-sync',
    ]
    if (body.continuous) args.push('--continuous')

    runnerLog = []
    runnerProcess = spawn('node', args, { cwd: resolve(__dirname, '..'), env: process.env })

    runnerProcess.stdout.on('data', d => {
      const line = d.toString()
      runnerLog.push(line)
      if (runnerLog.length > 200) runnerLog.shift()
      process.stdout.write(line)
    })
    runnerProcess.stderr.on('data', d => {
      runnerLog.push(d.toString())
      process.stderr.write(d.toString())
    })
    runnerProcess.on('close', (code) => {
      runnerLog.push(`\nProcess exited with code ${code}`)
      runnerProcess = null
    })

    jsonResponse(res, { status: 'started', skill: body.skill, pid: runnerProcess.pid })
    return
  }

  if (path === '/api/stop' && req.method === 'POST') {
    if (!runnerProcess) { jsonResponse(res, { status: 'not running' }); return }
    runnerProcess.kill('SIGTERM')
    const pid = runnerProcess.pid
    runnerProcess = null
    jsonResponse(res, { status: 'stopped', pid })
    return
  }

  if (path === '/api/status') {
    jsonResponse(res, {
      running: !!runnerProcess,
      pid: runnerProcess?.pid || null,
      logTail: runnerLog.slice(-20).join(''),
    })
    return
  }

  // GET /api/eval/:skill — read eval.json
  const evalGetMatch = path.match(/^\/api\/eval\/(.+)$/)
  if (evalGetMatch && req.method === 'GET') {
    const skill = decodeURIComponent(evalGetMatch[1])
    const evalPath = resolve(__dirname, `../skills/working-${skill}/eval.json`)
    if (!existsSync(evalPath)) { jsonResponse(res, { error: 'eval.json not found for ' + skill }, 404); return }
    jsonResponse(res, JSON.parse(readFileSync(evalPath, 'utf8')))
    return
  }

  // POST /api/eval/:skill — write eval.json
  if (evalGetMatch && req.method === 'POST') {
    const skill = decodeURIComponent(evalGetMatch[1])
    const evalPath = resolve(__dirname, `../skills/working-${skill}/eval.json`)
    const dir = resolve(__dirname, `../skills/working-${skill}`)
    if (!existsSync(dir)) { jsonResponse(res, { error: 'working dir not found for ' + skill }, 404); return }
    const body = await parseBody(req)
    if (!body.scenarios || !body.criteria) { jsonResponse(res, { error: 'scenarios and criteria required' }, 400); return }
    writeFileSync(evalPath, JSON.stringify(body, null, 2))
    const max = body.scenarios.length * body.criteria.length
    jsonResponse(res, { saved: true, scenarios: body.scenarios.length, criteria: body.criteria.length, max })
    return
  }

  // POST /api/generate-eval/:skill — auto-generate scenarios from skill content
  if (path.match(/^\/api\/generate-eval\//) && req.method === 'POST') {
    const skill = decodeURIComponent(path.split('/').pop())
    const skillPath = resolve(__dirname, `../skills/working-${skill}/SKILL.md`)
    if (!existsSync(skillPath)) { jsonResponse(res, { error: 'SKILL.md not found for ' + skill }, 404); return }

    const body = await parseBody(req)
    const numScenarios = body.scenarios || 10
    const numCriteria = body.criteria || 6
    const skillContent = readFileSync(skillPath, 'utf8')

    // Use Gemini to generate eval suite from skill content
    const geminiKey = (() => {
      if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY
      const kf = resolve(process.env.HOME, '.claude/.credentials/gemini-api-key.txt')
      if (existsSync(kf)) return readFileSync(kf, 'utf8').trim()
      return null
    })()

    if (!geminiKey) { jsonResponse(res, { error: 'GEMINI_API_KEY not found' }, 500); return }

    try {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `Given this Claude Code skill definition, generate an eval suite for autoresearch optimization.

## Skill Being Analyzed

\`\`\`markdown
${skillContent}
\`\`\`

## Requirements

Generate exactly ${numScenarios} test scenarios and ${numCriteria} binary evaluation criteria.

### Scenarios
Each scenario tests a different aspect of the skill. Include:
- ~50% happy path (skill should work correctly)
- ~25% edge cases (boundary conditions)
- ~25% negative cases (skill should correctly NOT do something)

### Criteria
Each criterion is a binary yes/no question evaluating whether the skill's instructions adequately guide an agent for that aspect.

## Output Format

Return ONLY valid JSON:
{
  "scenarios": [
    { "id": 1, "type": "category", "title": "Short Title", "event": "What happens in this scenario", "expectedAction": "what-skill-should-do", "expectedType": "signal-type" }
  ],
  "criteria": [
    "Criterion Name: Does the skill do X?"
  ]
}` }] }],
            generationConfig: { maxOutputTokens: 8192, temperature: 0.7 },
          }),
        }
      )
      if (!resp.ok) throw new Error(`Gemini ${resp.status}: ${await resp.text()}`)
      const data = await resp.json()
      const text = data.candidates?.[0]?.content?.parts?.filter(p => !p.thought).map(p => p.text).join('') || ''
      const usage = data.usageMetadata || {}
      const cost = ((usage.promptTokenCount || 0) * 1.25 + (usage.candidatesTokenCount || 0) * 5) / 1_000_000
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No JSON in response')
      const evalSuite = JSON.parse(jsonMatch[0])
      evalSuite._cost = { prompt: usage.promptTokenCount || 0, output: usage.candidatesTokenCount || 0, usd: Math.round(cost * 10000) / 10000 }
      jsonResponse(res, evalSuite)
    } catch (err) {
      jsonResponse(res, { error: err.message }, 500)
    }
    return
  }

  // GET /api/keys — check which keys are configured
  if (path === '/api/keys' && req.method === 'GET') {
    const geminiKey = process.env.GEMINI_API_KEY || (() => {
      const kf = resolve(process.env.HOME, '.claude/.credentials/gemini-api-key.txt')
      return existsSync(kf) ? readFileSync(kf, 'utf8').trim() : ''
    })()
    const anthropicKey = process.env.ANTHROPIC_API_KEY || (() => {
      const kf = resolve(process.env.HOME, '.claude/.credentials/anthropic-api-key.txt')
      return existsSync(kf) ? readFileSync(kf, 'utf8').trim() : ''
    })()
    // Check claude CLI availability
    let cliAvailable = false
    try {
      const { execSync } = await import('child_process')
      execSync('which claude', { stdio: 'ignore' })
      cliAvailable = true
    } catch {}

    jsonResponse(res, {
      gemini: { configured: !!geminiKey, masked: geminiKey ? `${geminiKey.slice(0, 8)}...${geminiKey.slice(-4)}` : null },
      anthropic: { configured: !!anthropicKey, masked: anthropicKey ? `${anthropicKey.slice(0, 12)}...${anthropicKey.slice(-4)}` : null },
      cli: { available: cliAvailable },
    })
    return
  }

  // POST /api/keys — save keys to .env
  if (path === '/api/keys' && req.method === 'POST') {
    const body = await parseBody(req)
    const envFile = resolve(__dirname, '../.env')
    const lines = []
    if (body.gemini) lines.push(`GEMINI_API_KEY=${body.gemini}`)
    if (body.anthropic) lines.push(`ANTHROPIC_API_KEY=${body.anthropic}`)

    // Merge with existing .env
    const existing = existsSync(envFile) ? readFileSync(envFile, 'utf8') : ''
    const existingLines = existing.split('\n').filter(l => l && !l.startsWith('#'))
    const merged = {}
    for (const l of existingLines) {
      const m = l.match(/^([A-Z_]+)=(.+)$/)
      if (m) merged[m[1]] = m[2]
    }
    if (body.gemini) merged.GEMINI_API_KEY = body.gemini
    if (body.anthropic) merged.ANTHROPIC_API_KEY = body.anthropic

    const content = '# Autoresearch API Keys\n' + Object.entries(merged).map(([k, v]) => `${k}=${v}`).join('\n') + '\n'
    writeFileSync(envFile, content)

    // Also update process.env so it takes effect immediately
    if (body.gemini) process.env.GEMINI_API_KEY = body.gemini
    if (body.anthropic) process.env.ANTHROPIC_API_KEY = body.anthropic

    jsonResponse(res, { saved: true })
    return
  }

  // POST /api/keys/validate — test a key against its API
  if (path === '/api/keys/validate' && req.method === 'POST') {
    const body = await parseBody(req)
    const results = {}

    if (body.gemini) {
      try {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${body.gemini}`)
        results.gemini = r.ok ? { valid: true, models: (await r.json()).models?.length || 0 } : { valid: false, error: `HTTP ${r.status}` }
      } catch (e) { results.gemini = { valid: false, error: e.message } }
    }

    if (body.anthropic) {
      try {
        const r = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'x-api-key': body.anthropic, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
          body: JSON.stringify({ model: 'claude-3-haiku-20240307', max_tokens: 1, messages: [{ role: 'user', content: 'x' }] }),
        })
        if (r.ok) {
          results.anthropic = { valid: true }
        } else {
          const err = await r.json()
          results.anthropic = { valid: false, error: err.error?.message || `HTTP ${r.status}` }
        }
      } catch (e) { results.anthropic = { valid: false, error: e.message } }
    }

    jsonResponse(res, results)
    return
  }

  // ─── Static Files ────────────────────────────────────────────

  const serveDir = existsSync(DIST_DIR + '/index.html') ? DIST_DIR : PUBLIC_DIR
  let filePath = path === '/' ? '/index.html' : path
  // Strip query params
  filePath = filePath.split('?')[0]

  // Try public dir first (for results JSON), then dist
  const publicPath = join(PUBLIC_DIR, filePath)
  const distPath = join(serveDir, filePath)

  if (existsSync(publicPath)) { serveStatic(res, publicPath); return }
  if (existsSync(distPath)) { serveStatic(res, distPath); return }

  // SPA fallback
  serveStatic(res, join(serveDir, 'index.html'))
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Autoresearch Dashboard — http://localhost:${PORT}`)
  console.log(`API: POST /api/run, POST /api/stop, GET /api/status`)
})
