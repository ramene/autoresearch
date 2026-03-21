#!/usr/bin/env node

/**
 * World-Model Builder
 *
 * Aggregates external signals and demands into a structured world-model
 * from pipeline outputs, NBLM state, supervisor state, environmental
 * signals, and tmux-logs session intelligence.
 *
 * Usage: node skills/world-model-builder.mjs
 * Output: ~/.remote/@autoresearch/world-model.json + stdout summary
 */

import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, basename, resolve } from 'node:path';
import { homedir } from 'node:os';

const HOME = homedir();
const PIPELINE_DIR = join(HOME, '.remote/@autoresearch/dashboard/public/pipeline-runs');
const SUPERVISOR_STATE = join(HOME, '.remote/@openclaw-integration/supervisor/state/state.json');
const STRATEGIC_MD = join(HOME, '.remote/@openclaw-integration/supervisor/strategic.md');
const SKILLS_DIR = join(HOME, '.remote/@autoresearch/skills');
const TMUX_LOGS_BASE = join(HOME, '.local/share/tmux-logs');
const OUTPUT_PATH = join(HOME, '.remote/@autoresearch/world-model.json');
const AUTORESEARCH_DASHBOARD = join(HOME, '.remote/@autoresearch/dashboard/public');

// MCP registry locations
const GLOBAL_CLAUDE_JSON = join(HOME, '.claude.json');
const PROJECT_MCP_CONFIGS = [
  { path: join(HOME, '.remote/@builds.karve.ai/.mcp.json'), scope: 'project-local', project: 'builds.karve.ai' },
  { path: join(HOME, '.remote/@builds.karve.ai/.claude.json'), scope: 'project-local', project: 'builds.karve.ai' },
];

// Skill directories to scan for domain matches
const SKILL_SCAN_DIRS = [
  { path: join(HOME, 'Journal/.seed/base/skills'), label: 'seed-base' },
  { path: join(HOME, 'Journal/.claude-projects/builds-karve-ai/skills'), label: 'builds-karve-ai' },
  { path: join(HOME, '.remote/@autoresearch/skills'), label: 'autoresearch' },
];

// Domain classifier for known MCP servers
const MCP_DOMAIN_MAP = {
  'substack': { domain: 'content_creation', subdomains: ['writing', 'audience_growth', 'engagement', 'monetization'] },
  'resonance': { domain: 'content_intelligence', subdomains: ['analytics', 'trends', 'competitive_analysis'] },
  'notebooklm-mcp': { domain: 'research_synthesis', subdomains: ['audio_generation', 'document_analysis', 'interactive_qa'] },
  'github': { domain: 'software_development', subdomains: ['code_review', 'ci_cd', 'issue_tracking'] },
  'playwright': { domain: 'testing', subdomains: ['e2e_testing', 'visual_testing', 'performance'] },
  'eaas': { domain: 'monetization_platform', subdomains: ['api_endpoints', 'x402_payments', 'service_delivery'] },
  'defi-tools': { domain: 'defi_trading', subdomains: ['token_operations', 'amm_trading', 'liquidity_management', 'mev_research', 'yield_optimization', 'arbitrage', 'frontrunning_detection', 'portfolio_tracking'] },
  'tradfi-tools': { domain: 'traditional_finance', subdomains: ['price_feeds', 'arbitrage_scanning', 'paper_trading', 'macro_analysis', 'signal_aggregation'] },
  'polymarket-mcp': { domain: 'prediction_markets', subdomains: ['market_discovery', 'orderbook_trading', 'portfolio_tracking', 'flash_crash_detection', 'websocket_monitoring', 'ctf_operations', 'gasless_trading', 'probability_analysis'] },
  'polymarket': { domain: 'prediction_markets', subdomains: ['market_discovery', 'orderbook_trading', 'portfolio_tracking', 'flash_crash_detection'] },
};

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

async function safeReadJSON(path) {
  try {
    const raw = await readFile(path, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function safeReadText(path) {
  try {
    return await readFile(path, 'utf-8');
  } catch {
    return null;
  }
}

async function safeLs(dir) {
  try {
    return await readdir(dir);
  } catch {
    return [];
  }
}

async function safeReadLines(path, maxLines = 500) {
  try {
    const raw = await readFile(path, 'utf-8');
    const lines = raw.split('\n');
    return lines.slice(0, maxLines);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// 1. Pipeline outputs
// ---------------------------------------------------------------------------

async function readPipelineOutputs() {
  const demands = [];
  const entries = await safeLs(PIPELINE_DIR);

  // Separate run JSONs from directories and NBLM files
  const runJsons = entries.filter(e => e.endsWith('.json') && !e.endsWith('-nblm.json'));
  const nblmJsons = entries.filter(e => e.endsWith('-nblm.json'));
  const runDirs = entries.filter(e => !e.includes('.'));

  let totalRuns = 0;
  let errorRuns = 0;
  let completeRuns = 0;
  const errorPatterns = {};
  const stageFailures = {};

  for (const jsonFile of runJsons) {
    const run = await safeReadJSON(join(PIPELINE_DIR, jsonFile));
    if (!run) continue;
    totalRuns++;

    if (run.status === 'error') {
      errorRuns++;
      const errMsg = run.error || 'unknown';
      errorPatterns[errMsg] = (errorPatterns[errMsg] || 0) + 1;

      // Track which stages fail
      if (run.stages) {
        for (const stage of run.stages) {
          if (stage.status === 'error') {
            const key = `${stage.name || 'Stage ' + stage.stage}`;
            stageFailures[key] = (stageFailures[key] || 0) + 1;
          }
        }
      }
    } else if (run.status === 'complete') {
      completeRuns++;
    }
  }

  // Pipeline reliability demand
  if (errorRuns > 0) {
    const failRate = ((errorRuns / totalRuns) * 100).toFixed(0);
    demands.push({
      signal: `Pipeline failure rate is ${failRate}% (${errorRuns}/${totalRuns} runs failed)`,
      source: 'pipeline-runs/*.json',
      evidence: Object.entries(errorPatterns).map(([err, count]) => `${err} (x${count})`),
      frequency: errorRuns,
      current_capability: 'cross-model-intelligence-pipeline',
    });
  }

  // Stage-specific failure demands
  for (const [stage, count] of Object.entries(stageFailures)) {
    demands.push({
      signal: `Stage "${stage}" fails frequently (${count} failures)`,
      source: 'pipeline-runs/*.json stage analysis',
      evidence: [`${count} failures in ${stage}`],
      frequency: count,
      current_capability: 'cross-model-intelligence-pipeline',
    });
  }

  // Check run directories for missing stage outputs
  for (const dir of runDirs) {
    const stageFiles = await safeLs(join(PIPELINE_DIR, dir));
    const hasStage1 = stageFiles.some(f => f.includes('stage-1'));
    const hasStage2 = stageFiles.some(f => f.includes('stage-2'));
    const hasStage3 = stageFiles.some(f => f.includes('stage-3'));
    const hasComplete = stageFiles.some(f => f.includes('pipeline-complete'));

    if (stageFiles.length > 0 && !hasComplete) {
      const missing = [];
      if (!hasStage1) missing.push('stage-1');
      if (!hasStage2) missing.push('stage-2');
      if (!hasStage3) missing.push('stage-3');
      if (missing.length > 0) {
        demands.push({
          signal: `Run "${dir}" has incomplete stage outputs (missing: ${missing.join(', ')})`,
          source: `pipeline-runs/${dir}/`,
          evidence: [`Existing files: ${stageFiles.join(', ')}`],
          frequency: 1,
          current_capability: 'cross-model-intelligence-pipeline',
        });
      }
    }
  }

  // NBLM state analysis
  for (const nblmFile of nblmJsons) {
    const nblm = await safeReadJSON(join(PIPELINE_DIR, nblmFile));
    if (!nblm) continue;

    // Check for pending/incomplete artifacts or audio
    if (nblm.artifacts) {
      const pending = nblm.artifacts.filter(a => a.status !== 'completed');
      if (pending.length > 0) {
        demands.push({
          signal: `NBLM artifacts incomplete for ${nblmFile.replace('-nblm.json', '')}`,
          source: `pipeline-runs/${nblmFile}`,
          evidence: pending.map(a => `${a.title}: ${a.status}`),
          frequency: 1,
          current_capability: null,
        });
      }
    }

    // Check for requested languages not yet fulfilled
    if (nblm.requestedLanguage) {
      const audioLangs = nblm.audioLanguages ? Object.keys(nblm.audioLanguages) : [];
      const reportLangs = nblm.reportLanguages ? Object.keys(nblm.reportLanguages) : [];
      if (!audioLangs.includes(nblm.requestedLanguage) || !reportLangs.includes(nblm.requestedLanguage)) {
        demands.push({
          signal: `Requested language "${nblm.requestedLanguage}" not fully generated for ${nblmFile.replace('-nblm.json', '')}`,
          source: `pipeline-runs/${nblmFile}`,
          evidence: [
            `Audio languages: ${audioLangs.join(', ') || 'none'}`,
            `Report languages: ${reportLangs.join(', ') || 'none'}`,
            `Requested: ${nblm.requestedLanguage}`,
          ],
          frequency: 1,
          current_capability: null,
        });
      }
    }
  }

  return { research_demands: demands, stats: { totalRuns, errorRuns, completeRuns } };
}

// ---------------------------------------------------------------------------
// 2. Researcher annotations (NBLM state files)
// ---------------------------------------------------------------------------

async function readResearcherAnnotations() {
  const demands = [];
  const entries = await safeLs(PIPELINE_DIR);
  const nblmFiles = entries.filter(e => e.endsWith('-nblm.json'));

  for (const nblmFile of nblmFiles) {
    const nblm = await safeReadJSON(join(PIPELINE_DIR, nblmFile));
    if (!nblm) continue;

    // Check for annotations embedded in NBLM state
    if (nblm.annotations && Array.isArray(nblm.annotations)) {
      for (const ann of nblm.annotations) {
        demands.push({
          signal: `Researcher annotation: ${ann.text || ann.content || JSON.stringify(ann).slice(0, 100)}`,
          source: `pipeline-runs/${nblmFile} (annotation)`,
          evidence: [JSON.stringify(ann).slice(0, 200)],
          frequency: 1,
          current_capability: null,
        });
      }
    }

    // Check for notes field
    if (nblm.notes) {
      demands.push({
        signal: `Researcher note on ${nblmFile.replace('-nblm.json', '')}: ${String(nblm.notes).slice(0, 120)}`,
        source: `pipeline-runs/${nblmFile} (notes)`,
        evidence: [String(nblm.notes).slice(0, 300)],
        frequency: 1,
        current_capability: null,
      });
    }
  }

  return demands;
}

// ---------------------------------------------------------------------------
// 3. Supervisor state
// ---------------------------------------------------------------------------

async function readSupervisorState() {
  const system_demands = [];

  // Read state.json
  const state = await safeReadJSON(SUPERVISOR_STATE);
  if (state) {
    // Tactical goals
    if (state.tactical_goals) {
      for (const goal of state.tactical_goals) {
        if (goal.status === 'pending' || goal.status === 'in_progress') {
          system_demands.push({
            signal: `Pending tactical goal: ${goal.description?.slice(0, 150) || goal.id}`,
            source: 'supervisor/state/state.json (tactical_goals)',
            evidence: goal.observations || [],
            frequency: 1,
            current_capability: goal.strategic_goal_id || null,
          });
        }
      }
    }

    // Evaluation log patterns — look for repeated "propose" decisions (unmet demands)
    if (state.evaluation_log) {
      const proposeCount = {};
      const executeCount = {};
      for (const entry of state.evaluation_log) {
        const key = entry.strategic_goal || 'unknown';
        if (entry.decision === 'propose') {
          proposeCount[key] = (proposeCount[key] || 0) + 1;
        } else if (entry.decision === 'execute') {
          executeCount[key] = (executeCount[key] || 0) + 1;
        }
      }

      for (const [goal, count] of Object.entries(proposeCount)) {
        if (count >= 2) {
          system_demands.push({
            signal: `Goal "${goal}" proposed ${count} times but not auto-executed (low confidence pattern)`,
            source: 'supervisor/state/state.json (evaluation_log)',
            evidence: [`${count} propose decisions, ${executeCount[goal] || 0} executions`],
            frequency: count,
            current_capability: goal,
          });
        }
      }
    }

    // Loop detector — repeated categories
    if (state.loop_detector?.execution_history) {
      const catCount = {};
      for (const entry of state.loop_detector.execution_history) {
        catCount[entry.category] = (catCount[entry.category] || 0) + 1;
      }
      for (const [cat, count] of Object.entries(catCount)) {
        if (count >= 3) {
          system_demands.push({
            signal: `Supervisor loop detected: category "${cat}" executed ${count} times`,
            source: 'supervisor/state/state.json (loop_detector)',
            evidence: [`${count} executions in "${cat}" category`],
            frequency: count,
            current_capability: null,
          });
        }
      }
    }
  }

  // Read strategic.md for declared goals
  const strategic = await safeReadText(STRATEGIC_MD);
  if (strategic) {
    const goalBlocks = strategic.split(/^## Goal:\s*/m).slice(1);
    for (const block of goalBlocks) {
      const lines = block.split('\n');
      const goalId = lines[0]?.trim();
      const descLine = lines.find(l => l.includes('**Description**'));
      const desc = descLine?.replace(/.*\*\*Description\*\*:\s*/, '') || '';
      system_demands.push({
        signal: `Strategic goal: ${goalId} — ${desc.slice(0, 150)}`,
        source: 'supervisor/strategic.md',
        evidence: [desc.slice(0, 300)],
        frequency: 1,
        current_capability: goalId,
      });
    }
  }

  return system_demands;
}

// ---------------------------------------------------------------------------
// 4. Environmental signals (events.jsonl from working-*/)
// ---------------------------------------------------------------------------

async function readEnvironmentalSignals() {
  const signals = [];
  const entries = await safeLs(SKILLS_DIR);
  const workingDirs = entries.filter(e => e.startsWith('working-'));

  for (const dir of workingDirs) {
    const eventsPath = join(SKILLS_DIR, dir, 'events.jsonl');
    const lines = await safeReadLines(eventsPath, 200);
    if (lines.length === 0) continue;

    const skillName = dir.replace('working-', '');
    const events = [];
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        events.push(JSON.parse(line));
      } catch { /* skip malformed lines */ }
    }

    if (events.length === 0) continue;

    // Analyze event types
    const eventTypes = {};
    for (const ev of events) {
      const type = ev.type || 'unknown';
      eventTypes[type] = (eventTypes[type] || 0) + 1;
    }

    // Look for promotion_ready events
    const promotions = events.filter(e => e.type === 'promotion_ready');
    if (promotions.length > 0) {
      for (const p of promotions) {
        signals.push({
          signal: `Skill "${p.skill || skillName}" ready for promotion (score: ${p.score}/${p.max})`,
          source: `skills/${dir}/events.jsonl`,
          current_capability: p.skill || skillName,
        });
      }
    }

    // Look for improvement events with score changes
    const improvements = events.filter(e => e.type === 'improvement');
    if (improvements.length > 0) {
      const latest = improvements[improvements.length - 1];
      signals.push({
        signal: `Skill "${latest.skill || skillName}" last improved: ${latest.oldScore} → ${latest.newScore}/${latest.max}`,
        source: `skills/${dir}/events.jsonl`,
        current_capability: latest.skill || skillName,
      });
    }

    // Look for stuck/escalation signals
    const escalations = events.filter(e =>
      e.type === 'escalation' || e.type === 'stuck' ||
      (e.type === 'error' && (e.message || '').includes('stuck'))
    );
    if (escalations.length > 0) {
      signals.push({
        signal: `Skill "${skillName}" has ${escalations.length} escalation/stuck event(s)`,
        source: `skills/${dir}/events.jsonl`,
        current_capability: skillName,
      });
    }
  }

  // Check for rounds.json to detect stalled improvement cycles
  for (const dir of workingDirs) {
    const roundsPath = join(SKILLS_DIR, dir, 'rounds.json');
    const rounds = await safeReadJSON(roundsPath);
    if (!rounds || !Array.isArray(rounds)) continue;

    const skillName = dir.replace('working-', '');
    const lastRound = rounds[rounds.length - 1];
    if (lastRound) {
      // Check if score is plateauing
      if (rounds.length >= 3) {
        const recentScores = rounds.slice(-3).map(r => r.score);
        const allSame = recentScores.every(s => s === recentScores[0]);
        if (allSame) {
          signals.push({
            signal: `Skill "${skillName}" score plateaued at ${recentScores[0]} for ${recentScores.length} rounds`,
            source: `skills/${dir}/rounds.json`,
            current_capability: skillName,
          });
        }
      }

      // Check for persistent failures
      if (lastRound.failures && lastRound.failures.length > 0) {
        const failureDescs = lastRound.failures.map(f =>
          `${f.scenario || 'unknown'}: ${f.criterion || 'unknown'}`
        );
        signals.push({
          signal: `Skill "${skillName}" has ${lastRound.failures.length} unresolved failure(s) in round ${lastRound.round}`,
          source: `skills/${dir}/rounds.json`,
          current_capability: skillName,
        });
      }
    }
  }

  return signals;
}

// ---------------------------------------------------------------------------
// 5. tmux-logs session intelligence
// ---------------------------------------------------------------------------

async function readTmuxLogPatterns() {
  const signals = [];

  // Find the most recent transcript directories (try today, then yesterday, etc.)
  const now = new Date();
  const dateDirs = [];
  for (let i = 0; i < 3; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    dateDirs.push(join(TMUX_LOGS_BASE, String(year), month, day, 'transcripts'));
  }

  const intentPatterns = {
    'research pipeline': /pipeline|cross-model|stage\s*[123]|gemini.*claude|claude.*gemini/i,
    'skill improvement': /skill|improve|mutation|score|eval|round/i,
    'error debugging': /error|fail|fix|debug|troubleshoot|broken/i,
    'security audit': /security|audit|cve|vulnerab/i,
    'documentation': /document|readme|guide|explain/i,
    'deployment': /deploy|docker|container|build/i,
    'testing': /test|e2e|playwright|validation/i,
    'dashboard': /dashboard|ui|component|frontend/i,
  };

  const patternCounts = {};
  let filesScanned = 0;

  for (const transcriptDir of dateDirs) {
    const files = await safeLs(transcriptDir);
    for (const file of files) {
      if (!file.endsWith('.log')) continue;
      filesScanned++;

      // Read a sample of the transcript (first 500 lines to keep lightweight)
      const lines = await safeReadLines(join(transcriptDir, file), 500);
      const content = lines.join('\n');

      for (const [intent, pattern] of Object.entries(intentPatterns)) {
        const matches = content.match(new RegExp(pattern, 'gi'));
        if (matches && matches.length > 0) {
          patternCounts[intent] = (patternCounts[intent] || 0) + matches.length;
        }
      }
    }
  }

  // Convert pattern counts to signals (only if frequency > 2)
  for (const [intent, count] of Object.entries(patternCounts)) {
    if (count >= 2) {
      signals.push({
        signal: `User intent pattern: "${intent}" detected across tmux transcripts`,
        source: `tmux-logs transcripts (${filesScanned} files scanned)`,
        frequency: count,
        current_capability: null,
      });
    }
  }

  return signals;
}

// ---------------------------------------------------------------------------
// 6. MCP Domain Signals
// ---------------------------------------------------------------------------

/**
 * Infer domain from MCP server name and tool names for unknown servers.
 */
function inferMcpDomain(serverName, config) {
  // Check known domain map first
  if (MCP_DOMAIN_MAP[serverName]) {
    return MCP_DOMAIN_MAP[serverName];
  }

  // Infer from server name keywords
  const name = serverName.toLowerCase();
  if (name.includes('content') || name.includes('blog') || name.includes('write')) {
    return { domain: 'content_creation', subdomains: ['writing'] };
  }
  if (name.includes('analyt') || name.includes('data') || name.includes('intel')) {
    return { domain: 'analytics', subdomains: ['data_analysis'] };
  }
  if (name.includes('test') || name.includes('qa')) {
    return { domain: 'testing', subdomains: ['automated_testing'] };
  }
  if (name.includes('deploy') || name.includes('infra') || name.includes('cloud')) {
    return { domain: 'infrastructure', subdomains: ['deployment'] };
  }
  if (name.includes('search') || name.includes('research')) {
    return { domain: 'research', subdomains: ['search'] };
  }

  // Infer from command/args if available
  const cmdStr = [config.command || '', ...(config.args || [])].join(' ').toLowerCase();
  if (cmdStr.includes('substack')) {
    return MCP_DOMAIN_MAP['substack'];
  }
  if (cmdStr.includes('notebook') || cmdStr.includes('nblm')) {
    return MCP_DOMAIN_MAP['notebooklm-mcp'];
  }

  return { domain: 'unknown', subdomains: [] };
}

/**
 * Scan skill directories to find skills matching an MCP domain.
 */
async function findSkillsForDomain(serverName, domain) {
  const matchingSkills = {};  // { dirLabel: [skillName, ...] }
  const domainKeywords = [
    serverName.toLowerCase(),
    domain.toLowerCase(),
    ...domain.toLowerCase().split('_'),
  ];

  for (const { path: skillDir, label } of SKILL_SCAN_DIRS) {
    const entries = await safeLs(skillDir);
    const matches = entries.filter(entry => {
      const lower = entry.toLowerCase();
      return domainKeywords.some(kw => kw.length > 2 && lower.includes(kw));
    });
    if (matches.length > 0) {
      matchingSkills[label] = matches;
    }
  }

  return matchingSkills;
}

/**
 * Check if data sources are available on disk for a given MCP server.
 */
async function checkMcpDataAvailability(serverName, config) {
  const checks = [];

  // Substack: check MCP tools package
  if (serverName === 'substack' || (config.command || '').includes('substack') ||
      (config.args || []).some(a => String(a).includes('substack'))) {
    try {
      const srcPath = join(HOME, '.remote/@builds.karve.ai/apps/mcp/src');
      const srcFiles = await safeLs(srcPath);
      if (srcFiles.length > 0) {
        checks.push({ type: 'mcp_source', path: srcPath, exists: true });
      }
    } catch { /* skip */ }
    try {
      const pkgPath = join(HOME, '.remote/@builds.karve.ai/packages/mcp-substack-tools');
      const pkgFiles = await safeLs(pkgPath);
      if (pkgFiles.length > 0) {
        checks.push({ type: 'mcp_package', path: pkgPath, exists: true });
      }
    } catch { /* skip */ }
  }

  // NotebookLM: check for NBLM state files in pipeline runs
  if (serverName === 'notebooklm-mcp') {
    const pipelineEntries = await safeLs(PIPELINE_DIR);
    const nblmFiles = pipelineEntries.filter(e => e.endsWith('-nblm.json'));
    if (nblmFiles.length > 0) {
      checks.push({ type: 'nblm_state_files', count: nblmFiles.length, exists: true });
    }
  }

  // Check for cached MCP outputs in the autoresearch dashboard
  const dashboardEntries = await safeLs(AUTORESEARCH_DASHBOARD);
  const relevantResults = dashboardEntries.filter(e =>
    e.startsWith('results-') && e.toLowerCase().includes(serverName.toLowerCase().replace(/-/g, ''))
  );
  if (relevantResults.length > 0) {
    checks.push({ type: 'dashboard_results', files: relevantResults, exists: true });
  }

  return checks.length > 0 ? checks : null;
}

/**
 * Count tools for an MCP server by reading its source if available.
 */
async function estimateToolCount(serverName, config) {
  // Known tool counts from observation
  const knownCounts = {
    'substack': 27,
    'notebooklm-mcp': 29,
    'eaas': 5,
  };
  if (knownCounts[serverName]) return knownCounts[serverName];

  // Try to count from source files
  const args = config.args || [];
  for (const arg of args) {
    if (String(arg).endsWith('.ts') || String(arg).endsWith('.js')) {
      const toolDir = join(resolve(String(arg), '..'), 'tools');
      const toolFiles = await safeLs(toolDir);
      if (toolFiles.length > 0) return toolFiles.length;
    }
  }

  return null;
}

async function readMcpDomainSignals() {
  const mcpDomains = [];
  const serversFound = new Map(); // name -> { config, scope, project? }

  // 1. Read global MCP registry
  const globalConfig = await safeReadJSON(GLOBAL_CLAUDE_JSON);
  if (globalConfig?.mcpServers) {
    for (const [name, config] of Object.entries(globalConfig.mcpServers)) {
      if (config && typeof config === 'object' && Object.keys(config).length > 0) {
        serversFound.set(name, { config, scope: 'global' });
      }
    }
  }

  // 2. Read project-local MCP configs
  for (const { path: cfgPath, scope, project } of PROJECT_MCP_CONFIGS) {
    const projConfig = await safeReadJSON(cfgPath);
    if (!projConfig) continue;

    const servers = projConfig.mcpServers || projConfig;
    if (typeof servers !== 'object') continue;

    for (const [name, config] of Object.entries(servers)) {
      if (name === 'mcpServers') continue; // skip nested key
      if (config && typeof config === 'object' && config.command) {
        // Project-local doesn't override global — record both scopes
        if (serversFound.has(name)) {
          const existing = serversFound.get(name);
          existing.scope = `global+${scope}`;
          existing.project = project;
        } else {
          serversFound.set(name, { config, scope, project });
        }
      }
    }
  }

  // 3. For each server, build domain entry
  for (const [serverName, { config, scope, project }] of serversFound) {
    const domainInfo = inferMcpDomain(serverName, config);
    const toolCount = await estimateToolCount(serverName, config);
    const dataChecks = await checkMcpDataAvailability(serverName, config);
    const skillMatches = await findSkillsForDomain(serverName, domainInfo.domain);

    // Separate autoresearch skills from other skills
    const autoresearchSkills = skillMatches['autoresearch'] || [];
    const otherSkills = [];
    for (const [label, skills] of Object.entries(skillMatches)) {
      if (label !== 'autoresearch') {
        otherSkills.push(...skills.map(s => `${s} (${label})`));
      }
    }

    // Determine gap description
    let gap;
    if (autoresearchSkills.length > 0) {
      gap = 'Autoresearch skills exist for this domain';
    } else if (otherSkills.length > 0) {
      gap = 'Skills exist elsewhere but no autoresearch-optimizable skills for this domain';
    } else {
      gap = 'Active MCP with no matching skills — domain entirely uncovered';
    }

    const entry = {
      mcp_server: serverName,
      domain: domainInfo.domain,
      subdomains: domainInfo.subdomains,
      tool_count: toolCount,
      tool_namespace: `mcp__${serverName}__`,
      scope,
      ...(project ? { project } : {}),
      data_available: dataChecks !== null,
      ...(dataChecks ? { data_sources: dataChecks } : {}),
      existing_skills: otherSkills,
      existing_autoresearch_skills: autoresearchSkills,
      gap,
    };

    mcpDomains.push(entry);
  }

  return mcpDomains;
}

// ---------------------------------------------------------------------------
// Synthesis & output
// ---------------------------------------------------------------------------

async function buildWorldModel() {
  console.log('World-Model Builder v1.1');
  console.log('========================\n');

  // Collect all signals in parallel
  console.log('Collecting signals...');
  const [
    pipelineResult,
    annotations,
    supervisorDemands,
    envSignals,
    userIntentSignals,
    mcpDomains,
  ] = await Promise.all([
    readPipelineOutputs(),
    readResearcherAnnotations(),
    readSupervisorState(),
    readEnvironmentalSignals(),
    readTmuxLogPatterns(),
    readMcpDomainSignals(),
  ]);

  const research_demands = [
    ...pipelineResult.research_demands,
    ...annotations,
  ];

  const system_demands = supervisorDemands;
  const environmental_signals = envSignals;
  const user_intent_signals = userIntentSignals;

  // Compute summary
  const allDemands = [
    ...research_demands,
    ...system_demands,
    ...environmental_signals,
    ...user_intent_signals,
  ];

  const unmet = allDemands.filter(d => !d.current_capability).length;
  const partiallyMet = allDemands.filter(d => d.current_capability).length;

  // MCP domain summary stats
  const mcpDomainCount = mcpDomains.length;
  const mcpUncoveredDomains = mcpDomains.filter(d =>
    d.existing_autoresearch_skills.length === 0 && d.existing_skills.length === 0
  ).length;
  const mcpPartialDomains = mcpDomains.filter(d =>
    d.existing_autoresearch_skills.length === 0 && d.existing_skills.length > 0
  ).length;

  const model = {
    timestamp: new Date().toISOString(),
    version: '1.1',
    research_demands,
    system_demands,
    environmental_signals,
    user_intent_signals,
    mcp_domains: mcpDomains,
    summary: {
      total_demands: allDemands.length,
      unmet_demands: unmet,
      partially_met: partiallyMet,
      research_gap_count: research_demands.filter(d => !d.current_capability).length,
      system_gap_count: system_demands.filter(d => !d.current_capability).length,
      mcp_domain_count: mcpDomainCount,
      mcp_uncovered_domains: mcpUncoveredDomains,
      mcp_partial_domains: mcpPartialDomains,
    },
  };

  // Write output
  await writeFile(OUTPUT_PATH, JSON.stringify(model, null, 2), 'utf-8');

  // Print summary to stdout
  console.log(`\nResearch demands:       ${research_demands.length}`);
  console.log(`System demands:         ${system_demands.length}`);
  console.log(`Environmental signals:  ${environmental_signals.length}`);
  console.log(`User intent signals:    ${user_intent_signals.length}`);
  console.log(`MCP domains detected:   ${mcpDomainCount}`);
  console.log(`─────────────────────────────────`);
  console.log(`Total demands:          ${model.summary.total_demands}`);
  console.log(`  Unmet:                ${model.summary.unmet_demands}`);
  console.log(`  Partially met:        ${model.summary.partially_met}`);
  console.log(`  Research gaps:        ${model.summary.research_gap_count}`);
  console.log(`  System gaps:          ${model.summary.system_gap_count}`);
  console.log(`  MCP uncovered:        ${mcpUncoveredDomains}`);
  console.log(`  MCP partial:          ${mcpPartialDomains}`);

  // Print MCP domain details
  if (mcpDomains.length > 0) {
    console.log(`\nMCP Domain Details:`);
    for (const d of mcpDomains) {
      const tools = d.tool_count ? ` (${d.tool_count} tools)` : '';
      const data = d.data_available ? ' [data available]' : '';
      console.log(`  ${d.mcp_server}: ${d.domain}${tools} [${d.scope}]${data}`);
      console.log(`    Gap: ${d.gap}`);
    }
  }

  console.log(`\nWritten: ${OUTPUT_PATH}`);

  return model;
}

buildWorldModel().catch(err => {
  console.error('World-Model Builder failed:', err.message);
  process.exit(1);
});
