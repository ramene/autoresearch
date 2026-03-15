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
import { readFileSync, existsSync, writeFileSync, readdirSync, unlinkSync, mkdirSync, statSync, rmSync, copyFileSync } from 'fs'
import { resolve, dirname, extname, join } from 'path'
import { fileURLToPath } from 'url'
import { spawn } from 'child_process'
import { randomUUID } from 'crypto'

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
const PIPELINE_PATH = resolve(__dirname, '../reasoning-pipeline/pipeline.mjs')
const PIPELINE_RUNS_DIR = resolve(__dirname, 'public/pipeline-runs')

let runnerProcess = null
let runnerLog = []

// Pipeline run tracking (in-memory, persisted to disk)
const pipelineRuns = new Map()

function ensurePipelineDir() {
  if (!existsSync(PIPELINE_RUNS_DIR)) mkdirSync(PIPELINE_RUNS_DIR, { recursive: true })
}

function savePipelineRun(run) {
  ensurePipelineDir()
  writeFileSync(join(PIPELINE_RUNS_DIR, `${run.id}.json`), JSON.stringify(run, null, 2))
}

function loadPipelineRuns() {
  ensurePipelineDir()
  const runs = []
  for (const f of readdirSync(PIPELINE_RUNS_DIR).filter(f => f.endsWith('.json'))) {
    try {
      const run = JSON.parse(readFileSync(join(PIPELINE_RUNS_DIR, f), 'utf8'))
      // Clean up stale "running" state from previous server process
      if (run.status === 'running') {
        run.status = 'error'
        run.error = 'Server restarted while pipeline was running'
        for (const s of (run.stages || [])) {
          if (s.status === 'running') s.status = 'error'
        }
        run.completedAt = new Date().toISOString()
        savePipelineRun(run)
      }
      runs.push(run)
    } catch {}
  }
  return runs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}

const MIME = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.m4a': 'audio/mp4',
  '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.webm': 'video/webm',
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
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,DELETE', 'Access-Control-Allow-Headers': 'Content-Type' })
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

  // ─── Pipeline API Routes ─────────────────────────────────────

  // POST /api/pipeline/run — start a reasoning pipeline run
  if (path === '/api/pipeline/run' && req.method === 'POST') {
    const body = await parseBody(req)
    if (!body.content && !body.contentPath) {
      jsonResponse(res, { error: 'content or contentPath required' }, 400); return
    }

    const runId = randomUUID().slice(0, 8)
    const outputDir = join(PIPELINE_RUNS_DIR, runId)
    mkdirSync(outputDir, { recursive: true })

    // Write content to a temp file if provided inline
    let transcriptPath = body.contentPath
    if (body.content && !body.contentPath) {
      transcriptPath = join(outputDir, 'input.md')
      writeFileSync(transcriptPath, body.content)
    }

    // Write optional context
    let contextPath = body.contextPath || ''
    if (body.context && !body.contextPath) {
      contextPath = join(outputDir, 'context.md')
      writeFileSync(contextPath, body.context)
    }

    const run = {
      id: runId,
      title: body.title || 'Pipeline Run',
      contentType: body.contentType || 'text',
      pipelineType: body.pipelineType || 'cross-model',
      status: 'running',
      stages: [
        { stage: 1, name: 'Claude Synthesis', status: 'pending', tokens: null, duration: null },
        { stage: 2, name: 'Gemini Reasoning', status: 'pending', tokens: null, duration: null },
        { stage: 3, name: 'Claude Execution', status: 'pending', tokens: null, duration: null },
      ],
      createdAt: new Date().toISOString(),
      completedAt: null,
      log: [],
      error: null,
    }
    pipelineRuns.set(runId, run)
    savePipelineRun(run)

    // Build pipeline args
    const args = [PIPELINE_PATH, '--transcript', transcriptPath, '--output', outputDir]
    if (contextPath) args.push('--context', contextPath)
    if (body.stage) args.push('--stage', String(body.stage))

    const pipelineProcess = spawn('node', args, {
      cwd: resolve(__dirname, '..'),
      env: { ...process.env },
    })

    let currentStage = 0

    pipelineProcess.stdout.on('data', (d) => {
      const text = d.toString()
      run.log.push(text)
      if (run.log.length > 500) run.log.shift()

      // Parse stage transitions from pipeline output
      if (text.includes('STAGE 1:')) {
        currentStage = 0
        run.stages[0].status = 'running'
        run.stages[0].startedAt = new Date().toISOString()
      } else if (text.includes('STAGE 2:')) {
        if (run.stages[0].status === 'running') {
          run.stages[0].status = 'complete'
          run.stages[0].completedAt = new Date().toISOString()
          run.stages[0].duration = new Date() - new Date(run.stages[0].startedAt)
        }
        currentStage = 1
        run.stages[1].status = 'running'
        run.stages[1].startedAt = new Date().toISOString()
      } else if (text.includes('STAGE 3:')) {
        if (run.stages[1].status === 'running') {
          run.stages[1].status = 'complete'
          run.stages[1].completedAt = new Date().toISOString()
          run.stages[1].duration = new Date() - new Date(run.stages[1].startedAt)
        }
        currentStage = 2
        run.stages[2].status = 'running'
        run.stages[2].startedAt = new Date().toISOString()
      }

      // Parse token counts
      const tokenMatch = text.match(/Tokens — (?:input|prompt): (\d+).*?output: (\d+)/)
      if (tokenMatch && currentStage >= 0 && currentStage < 3) {
        run.stages[currentStage].tokens = {
          input: parseInt(tokenMatch[1]),
          output: parseInt(tokenMatch[2]),
        }
      }

      // Parse streaming progress
      const streamMatch = text.match(/Streaming\.\.\. ([\d.]+)K chars/)
      if (streamMatch && currentStage >= 0 && currentStage < 3) {
        run.stages[currentStage].charsGenerated = parseFloat(streamMatch[1]) * 1000
      }

      process.stdout.write(text)
    })

    pipelineProcess.stderr.on('data', (d) => {
      run.log.push(d.toString())
      process.stderr.write(d.toString())
    })

    pipelineProcess.on('close', (code) => {
      if (code === 0) {
        run.status = 'complete'
        // Mark any remaining running stage as complete
        for (const s of run.stages) {
          if (s.status === 'running') {
            s.status = 'complete'
            s.completedAt = new Date().toISOString()
            if (s.startedAt) s.duration = new Date() - new Date(s.startedAt)
          }
        }
        // Read output files
        const stageFiles = [
          'stage-1-claude-synthesis.md',
          'stage-2-gemini-reasoning.md',
          'stage-3-agent-team-execution.md',
          'pipeline-complete.md',
        ]
        run.outputs = {}
        for (const f of stageFiles) {
          const fp = join(outputDir, f)
          if (existsSync(fp)) {
            run.outputs[f] = readFileSync(fp, 'utf8')
          }
        }
      } else {
        run.status = 'error'
        run.error = `Pipeline exited with code ${code}`
        for (const s of run.stages) {
          if (s.status === 'running') s.status = 'error'
        }
      }
      run.completedAt = new Date().toISOString()
      savePipelineRun(run)
    })

    jsonResponse(res, { id: runId, status: 'started' })
    return
  }

  // GET /api/pipeline/status/:runId — get pipeline progress
  const pipelineStatusMatch = path.match(/^\/api\/pipeline\/status\/(.+)$/)
  if (pipelineStatusMatch && req.method === 'GET') {
    const runId = decodeURIComponent(pipelineStatusMatch[1])
    const run = pipelineRuns.get(runId)
    if (run) {
      jsonResponse(res, {
        id: run.id,
        status: run.status,
        stages: run.stages,
        logTail: run.log.slice(-20).join(''),
        error: run.error,
      })
    } else {
      // Try loading from disk
      const fp = join(PIPELINE_RUNS_DIR, `${runId}.json`)
      if (existsSync(fp)) {
        const saved = JSON.parse(readFileSync(fp, 'utf8'))
        jsonResponse(res, {
          id: saved.id,
          status: saved.status,
          stages: saved.stages,
          logTail: '',
          error: saved.error,
        })
      } else {
        jsonResponse(res, { error: 'Run not found' }, 404)
      }
    }
    return
  }

  // GET /api/pipeline/runs — list all pipeline runs
  if (path === '/api/pipeline/runs' && req.method === 'GET') {
    const runs = loadPipelineRuns().map(r => ({
      id: r.id,
      title: r.title,
      contentType: r.contentType,
      pipelineType: r.pipelineType,
      status: r.status,
      stages: r.stages,
      createdAt: r.createdAt,
      completedAt: r.completedAt,
      error: r.error,
    }))
    jsonResponse(res, runs)
    return
  }

  // ─── NotebookLM (NBLM) Routes ──────────────────────────────────

  // POST /api/pipeline/run/:runId/nblm — create/get NBLM notebook for this run
  if (path.match(/^\/api\/pipeline\/run\/([^/]+)\/nblm$/) && req.method === 'POST') {
    const runId = path.split('/')[4]
    const body = await parseBody(req)
    // Store NBLM state alongside the run
    const nblmPath = join(PIPELINE_RUNS_DIR, `${runId}-nblm.json`)
    let nblmState = existsSync(nblmPath) ? JSON.parse(readFileSync(nblmPath, 'utf8')) : {}
    nblmState = { ...nblmState, ...body }
    writeFileSync(nblmPath, JSON.stringify(nblmState, null, 2))
    jsonResponse(res, nblmState)
    return
  }

  // GET /api/pipeline/run/:runId/nblm — get NBLM state
  if (path.match(/^\/api\/pipeline\/run\/([^/]+)\/nblm$/) && req.method === 'GET') {
    const runId = path.split('/')[4]
    const nblmPath = join(PIPELINE_RUNS_DIR, `${runId}-nblm.json`)
    if (existsSync(nblmPath)) {
      jsonResponse(res, JSON.parse(readFileSync(nblmPath, 'utf8')))
    } else {
      jsonResponse(res, {})
    }
    return
  }

  // GET /api/pipeline/run/:runId — get full results for a completed run
  const pipelineRunMatch = path.match(/^\/api\/pipeline\/run\/(.+)$/)
  if (pipelineRunMatch && req.method === 'GET') {
    const runId = decodeURIComponent(pipelineRunMatch[1])
    // Check in-memory first
    let run = pipelineRuns.get(runId)
    if (!run) {
      const fp = join(PIPELINE_RUNS_DIR, `${runId}.json`)
      if (existsSync(fp)) {
        run = JSON.parse(readFileSync(fp, 'utf8'))
      }
    }
    if (run) {
      // If outputs not loaded (from disk), try loading them
      if (!run.outputs) {
        run.outputs = {}
        const runDir = join(PIPELINE_RUNS_DIR, runId)
        const stageFiles = [
          'stage-1-claude-synthesis.md',
          'stage-2-gemini-reasoning.md',
          'stage-3-agent-team-execution.md',
          'pipeline-complete.md',
        ]
        for (const f of stageFiles) {
          const fp = join(runDir, f)
          if (existsSync(fp)) run.outputs[f] = readFileSync(fp, 'utf8')
        }
      }
      jsonResponse(res, run)
    } else {
      jsonResponse(res, { error: 'Run not found' }, 404)
    }
    return
  }

  // DELETE /api/pipeline/run/:runId — delete a pipeline run
  if (pipelineRunMatch && req.method === 'DELETE') {
    const runId = decodeURIComponent(pipelineRunMatch[1])
    pipelineRuns.delete(runId)
    const fp = join(PIPELINE_RUNS_DIR, `${runId}.json`)
    if (existsSync(fp)) unlinkSync(fp)
    // Clean up run output directory
    const runDir = join(PIPELINE_RUNS_DIR, runId)
    if (existsSync(runDir)) {
      try { rmSync(runDir, { recursive: true }) } catch {}
    }
    jsonResponse(res, { deleted: true })
    return
  }

  // POST /api/pipeline/import — import external pipeline output as a historical run
  if (path === '/api/pipeline/import' && req.method === 'POST') {
    const body = await parseBody(req)
    if (!body.sourcePath) {
      jsonResponse(res, { error: 'sourcePath required' }, 400); return
    }
    if (!existsSync(body.sourcePath)) {
      jsonResponse(res, { error: 'sourcePath does not exist: ' + body.sourcePath }, 404); return
    }

    const runId = body.runId || randomUUID().slice(0, 8)
    const outputDir = join(PIPELINE_RUNS_DIR, runId)
    mkdirSync(outputDir, { recursive: true })

    // Copy stage files from sourcePath into the run directory
    const stageFiles = [
      'stage-1-claude-synthesis.md',
      'stage-2-gemini-reasoning.md',
      'stage-3-agent-team-execution.md',
      'pipeline-complete.md',
    ]
    const outputs = {}
    for (const f of stageFiles) {
      const src = join(body.sourcePath, f)
      if (existsSync(src)) {
        copyFileSync(src, join(outputDir, f))
        outputs[f] = readFileSync(src, 'utf8')
      }
    }

    const run = {
      id: runId,
      title: body.title || 'Imported Pipeline Run',
      contentType: body.contentType || 'text',
      pipelineType: body.pipelineType || 'cross-model',
      status: 'complete',
      stages: [
        { stage: 1, name: 'Claude Synthesis', status: 'complete', tokens: null, duration: null },
        { stage: 2, name: 'Gemini Reasoning', status: 'complete', tokens: null, duration: null },
        { stage: 3, name: 'Claude Execution', status: 'complete', tokens: null, duration: null },
      ],
      createdAt: body.createdAt || new Date().toISOString(),
      completedAt: body.completedAt || new Date().toISOString(),
      isBaseline: body.isBaseline || false,
      log: [],
      error: null,
    }
    savePipelineRun(run)
    jsonResponse(res, { id: runId, status: 'imported', files: Object.keys(outputs) })
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

// Pre-load pipeline runs into memory on startup (cleans stale "running" state)
for (const run of loadPipelineRuns()) {
  pipelineRuns.set(run.id, run)
}
console.log(`Loaded ${pipelineRuns.size} pipeline run(s) from disk`)

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Autoresearch Dashboard — http://localhost:${PORT}`)
  console.log(`API: POST /api/run, POST /api/stop, GET /api/status`)
  console.log(`Pipeline: POST /api/pipeline/run, GET /api/pipeline/runs, GET /api/pipeline/status/:id`)
})
