#!/usr/bin/env node
/**
 * Cross-Model Reasoning Pipeline
 * ================================
 * Stage 1: Claude Opus — Synthesize transcripts + platform context into structured analysis
 * Stage 2: Gemini 3.1 Pro — Reason, debate, validate, bolster Claude's analysis
 * Stage 3: Claude Opus — Take Gemini's reasoned output and produce actionable Agent Team execution plan
 *
 * Usage:
 *   node reasoning-pipeline/pipeline.mjs \
 *     --transcript ./content.md \
 *     --context ./my-project-context.md \
 *     [--stage 1|2|3|all] \
 *     [--output ./output/]
 *
 * Environment:
 *   GEMINI_API_KEY  — Google Generative AI key (or reads from .env)
 *   ANTHROPIC_API_KEY — Anthropic API key (reads from .env)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Support --root override for when script lives outside the project tree
const rootOverride = process.argv.indexOf("--root") !== -1
  ? process.argv[process.argv.indexOf("--root") + 1]
  : null;
const ROOT = rootOverride
  ? path.resolve(rootOverride)
  : path.resolve(__dirname, "../../..");
const CLAUDE_DIR = path.join(ROOT, ".claude");
const OUTPUT_DIR = path.join(CLAUDE_DIR, "pipeline-output");
const CREDENTIALS = path.join(CLAUDE_DIR, ".credentials");

// ── Configuration ──────────────────────────────────────────────
const GEMINI_MODEL = "gemini-3.1-pro-preview";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_MAX_TOKENS = 65536;
const GEMINI_THINKING_BUDGET = 32768;

// ── Key Loading ────────────────────────────────────────────────
function loadGeminiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  const keyFile = path.join(CREDENTIALS, "gemini-api-key.txt");
  if (fs.existsSync(keyFile)) return fs.readFileSync(keyFile, "utf-8").trim();
  throw new Error("GEMINI_API_KEY not found in env or .claude/.credentials/gemini-api-key.txt");
}

function loadAnthropicKey() {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  // Check multiple locations
  const searchPaths = [
    path.join(ROOT, "apps/web/.env.local"),
    path.join(ROOT, "apps/web/.env.local.bak"),
    path.join(CREDENTIALS, "apps-web.env.local"),
  ];
  for (const envFile of searchPaths) {
    if (fs.existsSync(envFile)) {
      const match = fs.readFileSync(envFile, "utf-8").match(/ANTHROPIC_API_KEY=(.+)/);
      if (match) return match[1].trim();
    }
  }
  throw new Error("ANTHROPIC_API_KEY not found");
}

// ── CLI Argument Parsing ───────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    transcripts: [],
    context: "",
    prompt: "",
    stage: "all",
    output: OUTPUT_DIR,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--transcript":
        config.transcripts.push(args[++i]);
        break;
      case "--context":
        config.context = args[++i];
        break;
      case "--prompt":
        config.prompt = args[++i];
        break;
      case "--stage":
        config.stage = args[++i];
        break;
      case "--output":
        config.output = args[++i];
        break;
      case "--root":
        i++; // Already consumed at module level
        break;
      case "--help":
        console.log(`
Cross-Model Reasoning Pipeline
  --root <dir>          Project root directory (default: 3 levels up from script)
  --transcript <file>   Transcript file(s) to process (can repeat)
  --context <file>      Project context file (optional)
  --prompt <file>       Debate prompt template (optional)
  --stage <1|2|3|all>   Run specific stage or all (default: all)
  --output <dir>        Output directory (default: .claude/pipeline-output/)
  --help                Show this help
        `);
        process.exit(0);
    }
  }

  // Default transcripts if none provided
  if (config.transcripts.length === 0) {
    const defaultTranscripts = ["transcript-1.md", "transcript-2.md", "transcript-3.md"];
    for (const t of defaultTranscripts) {
      const p = path.join(CLAUDE_DIR, t);
      if (fs.existsSync(p)) config.transcripts.push(p);
    }
  }

  return config;
}

// ── File Helpers ───────────────────────────────────────────────
function readFile(filepath) {
  const resolved = path.isAbsolute(filepath) ? filepath : path.resolve(ROOT, filepath);
  if (!fs.existsSync(resolved)) {
    console.error(`File not found: ${resolved}`);
    process.exit(1);
  }
  return fs.readFileSync(resolved, "utf-8");
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function writeOutput(filename, content) {
  ensureDir(OUTPUT_DIR);
  const filepath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(filepath, content, "utf-8");
  console.log(`  → Written: ${filepath}`);
  return filepath;
}

// ── Gemini API Call ────────────────────────────────────────────
async function callGemini(prompt, systemInstruction) {
  const apiKey = loadGeminiKey();
  const url = `${GEMINI_API_BASE}/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      maxOutputTokens: GEMINI_MAX_TOKENS,
      temperature: 1.0, // Gemini 3.1 Pro recommended
      thinkingConfig: {
        thinkingBudget: GEMINI_THINKING_BUDGET,
      },
    },
  };

  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  console.log(`  → Calling Gemini 3.1 Pro (${GEMINI_MODEL})...`);
  console.log(`  → Prompt: ${(prompt.length / 1000).toFixed(1)}K chars`);

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Gemini API error ${resp.status}: ${err}`);
  }

  const data = await resp.json();
  const candidates = data.candidates || [];
  if (candidates.length === 0) throw new Error("Gemini returned no candidates");

  // Extract text parts — Gemini 3.1 Pro may attach thoughtSignature to text parts
  const parts = candidates[0].content?.parts || [];

  // Debug: dump part structure
  console.log(`  → Response parts: ${parts.length}`);
  for (const [i, p] of parts.entries()) {
    const keys = Object.keys(p);
    const textLen = p.text ? p.text.length : 0;
    console.log(`    part[${i}]: keys=${keys.join(",")} textLen=${textLen} thought=${!!p.thought}`);
  }

  // Gemini 3.1 Pro has inconsistent thought flagging — sometimes ALL parts have thought=true
  // Strategy: separate by thought flag first, but if textParts is empty, take the LONGEST
  // thought part as the actual response (it's the structured output, not meta-reasoning)
  let textParts = parts.filter((p) => p.text && !p.thought);
  const thoughtParts = parts.filter((p) => p.thought === true && p.text);

  // Fallback: if no non-thought text parts, the main response is in thoughtParts
  if (textParts.length === 0 && thoughtParts.length > 0) {
    console.log(`  ⚠ All ${thoughtParts.length} text parts flagged as thought — extracting longest as response`);
    // Sort by length descending — longest part is the structured response
    const sorted = [...thoughtParts].sort((a, b) => b.text.length - a.text.length);
    textParts = [sorted[0]]; // Longest = main response
    thoughtParts.splice(thoughtParts.indexOf(sorted[0]), 1); // Remove from thoughts
  }

  const text = textParts.map((p) => p.text).join("\n");
  const thoughts = thoughtParts.map((p) => p.text).join("\n");

  const usage = data.usageMetadata || {};
  console.log(`  → Gemini response: ${(text.length / 1000).toFixed(1)}K chars`);
  console.log(`  → Tokens — prompt: ${usage.promptTokenCount || "?"}, output: ${usage.candidatesTokenCount || "?"}, thoughts: ${usage.thoughtsTokenCount || "?"}`);

  return { text, thoughts, usage };
}

// ── Claude API Call (Streaming) ───────────────────────────────
// Supported models: claude-sonnet-4-5-20250514, claude-3-haiku-20240307,
// claude-3-5-haiku-20241022, claude-opus-4-6-20250801, or any valid Anthropic model ID.
// Change the default below to use a different model for Stages 1 and 3.
async function callClaude(prompt, systemPrompt, model = "sonnet") {
  // Use CLI for short model names (sonnet, opus, haiku) — these use Max plan subscription
  // Use API for full model IDs (claude-3-haiku-20240307, etc.) — these use API key
  const cliModels = ["sonnet", "opus", "haiku"];
  const useCli = cliModels.includes(model);

  // Truncate transcripts if prompt > 180K chars to stay within token limits
  let finalPrompt = prompt;
  if (prompt.length > 180000) {
    console.log(`  ⚠ Prompt ${(prompt.length / 1000).toFixed(0)}K chars — truncating to ~180K`);
    finalPrompt = prompt.substring(0, 180000) + "\n\n[... truncated for token limits — remaining content follows same patterns ...]";
  }

  console.log(`  → Calling Claude (${model}) [${useCli ? 'CLI/Max' : 'API'}]...`);
  console.log(`  → Prompt: ${(finalPrompt.length / 1000).toFixed(1)}K chars`);

  if (useCli) {
    return callClaudeCli(finalPrompt, systemPrompt, model);
  }

  const apiKey = loadAnthropicKey();

  const body = {
    model,
    max_tokens: 32768,
    stream: true, // Stream to avoid headers timeout with large Opus prompts
    messages: [{ role: "user", content: finalPrompt }],
  };

  if (systemPrompt) {
    body.system = systemPrompt;
  }

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Claude API error ${resp.status}: ${err.substring(0, 500)}`);
    }

    // Parse SSE stream
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let text = "";
    let usage = {};
    let buffer = "";
    let tokenCount = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // Keep incomplete line in buffer

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const dataStr = line.slice(6).trim();
        if (dataStr === "[DONE]") continue;

        try {
          const data = JSON.parse(dataStr);

          if (data.type === "content_block_delta" && data.delta?.type === "text_delta") {
            text += data.delta.text;
            tokenCount++;
            if (tokenCount % 500 === 0) {
              process.stdout.write(`\r  → Streaming... ${(text.length / 1000).toFixed(1)}K chars`);
            }
          }
          if (data.type === "message_start" && data.message?.usage) {
            usage.input_tokens = data.message.usage.input_tokens;
          }
          if (data.type === "message_delta" && data.usage) {
            usage.output_tokens = data.usage.output_tokens;
          }
        } catch {
          // Skip malformed JSON lines
        }
      }
    }

    console.log(`\r  → Claude response: ${(text.length / 1000).toFixed(1)}K chars                    `);
    console.log(`  → Tokens — input: ${usage.input_tokens || "?"}, output: ${usage.output_tokens || "?"}`);

    return { text, usage };
  } catch (err) {
    if (err.cause) console.error(`  → Network error details:`, err.cause.message || err.cause);
    throw err;
  }
}

async function callClaudeCli(prompt, systemPrompt, model = "sonnet") {
  const { execSync } = await import("child_process");
  const fullPrompt = systemPrompt
    ? `${systemPrompt}\n\n---\n\n${prompt}`
    : prompt;

  // Write prompt to temp file to avoid shell escaping issues
  const tmpFile = path.join(OUTPUT_DIR || "/tmp", ".pipeline-prompt.tmp");
  ensureDir(path.dirname(tmpFile));
  fs.writeFileSync(tmpFile, fullPrompt);

  try {
    const result = execSync(
      `cat "${tmpFile}" | claude --print --model ${model}`,
      { maxBuffer: 10 * 1024 * 1024, timeout: 600000, encoding: "utf8", shell: true }
    );
    console.log(`  → Claude CLI response: ${(result.length / 1000).toFixed(1)}K chars`);
    return { text: result, usage: { input_tokens: "cli", output_tokens: "cli" } };
  } finally {
    try { fs.unlinkSync(tmpFile); } catch {}
  }
}

// ── Stage 1: Claude Synthesis ──────────────────────────────────
async function stage1(config) {
  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║  STAGE 1: Claude Opus — Synthesis & Gap-Filling ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  const transcripts = config.transcripts.map((t) => readFile(t));
  const context = config.context ? readFile(config.context) : "";
  const debatePrompt = config.prompt ? readFile(config.prompt) : "";

  const stage1System = `You are Claude Opus in a structured synthesis role. Your output will be machine-parsed and passed to Gemini 3.1 Pro.

CRITICAL DIRECTIVES:
- You MUST complete ALL numbered sections (1-6). Do NOT truncate or skip sections.
- If you are running low on output tokens, compress later sections rather than omitting them.
- Use structured markdown with exact section headers as specified.
- Every claim must cite evidence (transcript quote, file path, or project reference).
- Your output is the INPUT for Stage 2 — incomplete output breaks the pipeline.`;

  const stage1Prompt = `# STAGE 1: Transcript Synthesis + Platform Gap Analysis

You are the first stage of a 3-stage cross-model reasoning pipeline.
Your job: synthesize raw transcripts against the platform's current state, identify gaps, and produce a structured brief for Gemini 3.1 Pro to reason about.

## YOUR ROLE
- You are Claude Opus, the "Equipped Reasoner" — strongest with tools, sustained work, coordination
- Your output will be passed to Gemini 3.1 Pro (the "Naked Reasoner" — strongest pure thinking)
- Gemini will debate, validate, and bolster your analysis
- Then your output + Gemini's response come back to Claude for Agent Team execution

## PLATFORM CONTEXT (Current State)
${context}

## RAW TRANSCRIPTS (from Nate's videos, Feb 2026)
${transcripts.map((t, i) => `### Transcript ${i + 1}\n${t}`).join("\n\n---\n\n")}

## DEBATE FRAMEWORK
${debatePrompt}

## YOUR TASK

Produce a structured document with these EXACT sections:

### 1. SYNTHESIS: What We Learned (distilled from transcripts)
- Key frameworks, mental models, market signals
- Specific claims with evidence cited from transcripts

### 2. PLATFORM ALIGNMENT: What Maps to Our Platform
- For each framework/insight, cite the SPECIFIC platform component that implements it
- Include file paths, API routes, database tables, env vars where relevant

### 3. GAP ANALYSIS: What We're Missing
- For each missed opportunity, define:
  - What it is
  - Why it matters (business impact)
  - Implementation complexity (S/M/L/XL)
  - Which existing platform component it extends
  - Priority (P0/P1/P2/P3)

### 4. PRIORITIZED ACTION ITEMS (for Gemini to reason about)
- P0: Must-do immediately (platform positioning, narrative)
- P1: This sprint (Cloudflare demo, circuit breakers)
- P2: Next sprint (multi-model routing, skill versioning)
- P3: Backlog (trust architecture endpoint, Exa optimization)

### 5. DEBATE POSITIONS (structured for Gemini)
- Frame 4 debate positions as structured arguments
- Include specific evidence from the platform + transcripts
- Identify the weakest assumption in each position
- Ask Gemini to pick a position and argue it rigorously

### 6. QUESTIONS FOR GEMINI
- List 5-10 specific questions that benefit from Gemini's superior pure reasoning
- Frame them as logic puzzles, not research questions (Gemini reasons; Claude researches)
- Example: "Given that x402 processed 50M transactions and our platform has 25 endpoints, what is the optimal pricing curve for maximizing both adoption and revenue?"

Be thorough. Be specific. Cite file paths and line numbers. This is the input that Gemini 3.1 Pro will reason about.`;

  const result = await callClaude(stage1Prompt, stage1System, "sonnet");
  const outputPath = writeOutput("stage-1-claude-synthesis.md", `# Stage 1: Claude Synthesis\n\n> Generated: ${new Date().toISOString()}\n> Model: claude-opus-4-6\n> Input tokens: ${result.usage?.input_tokens}\n> Output tokens: ${result.usage?.output_tokens}\n\n${result.text}`);

  return { text: result.text, outputPath };
}

// ── Stage 2: Gemini Reasoning ──────────────────────────────────
async function stage2(config, stage1Output) {
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║  STAGE 2: Gemini 3.1 Pro — Reasoning & Validation   ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");

  const context = config.context ? readFile(config.context) : "";

  const systemInstruction = `You are Gemini, a strong reasoning model. You are participating in a cross-model intelligence pipeline alongside Claude.

YOUR ROLE: You are the "Naked Reasoner" — your job is pure logical analysis, validation, and adversarial reasoning about the synthesis Claude produced in Stage 1. Stress-test every claim. Find logical gaps, unsupported assumptions, and missed connections.

WHAT CLAUDE DID (Stage 1): Claude synthesized content against project context, identifying key frameworks, gap analysis, prioritized action items, debate positions, and specific reasoning questions for you.

WHAT YOU MUST DO (Stage 2):
1. Validate Claude's analysis — find logical gaps, unsupported claims, or missed connections
2. Debate the strongest position from Claude's debate options (argue 1000+ words, cite evidence)
3. Answer Claude's specific reasoning questions with full reasoning chains
4. Produce your own independent analysis based on PURE LOGIC
5. Identify the single highest-leverage action and argue why
6. Re-rank Claude's priority items based on impact, feasibility, and dependencies

Be rigorous. Be contrarian where warranted. Be specific. Show your reasoning chains.

${context ? `PROJECT CONTEXT:\n${context}` : ""}`;

  const geminiPrompt = `# STAGE 2: Validate, Debate & Reason

## CLAUDE'S STAGE 1 OUTPUT

${stage1Output}

---

## YOUR INSTRUCTIONS

### Part A: Validation Audit
For EACH major claim or framework in Claude's Stage 1 output, assign one verdict:
1. **CONFIRMED** — claim is logically sound and evidence-supported
2. **CHALLENGED** — claim has a logical flaw or unsupported assumption (explain why)
3. **ENHANCED** — claim is correct but incomplete (add what's missing)
4. **CONTRADICTED** — claim conflicts with other evidence (identify the conflict)

Be specific. Cite evidence. Don't just agree — stress-test everything.

### Part B: Debate (Pick ONE position, argue 1000+ words)
Choose the debate position from Claude's output where you have the STRONGEST contrarian or enhancing argument. Argue rigorously:
- Cite specific evidence (papers, data, logical principles)
- Address the strongest counter-argument head-on
- End with a concrete prediction (timeline + measurable outcome)
- Pose ONE unanswerable question that reframes the entire debate

### Part C: Answer Claude's Reasoning Questions
Answer EACH question Claude posed with:
- Your full reasoning chain (show your work step by step)
- Confidence level (high/medium/low) with justification
- Key assumptions that could invalidate your answer
- What evidence would change your mind

### Part D: Your Independent Analysis
Based on everything in Claude's synthesis and the project context:
1. **The Single Highest-Leverage Insight**: What ONE finding, connection, or gap is the most important thing Claude identified (or missed)? Argue why.
2. **The Contrarian Take**: What is the conventional wisdom in this domain that's WRONG? What does everyone (including Claude) assume that shouldn't be assumed?
3. **The Blind Spot**: What crucial perspective, literature, methodology, or researcher is ABSENT from this analysis? What's missing that would fundamentally change the conclusions?
4. **The Risk**: What's the biggest intellectual or methodological threat to this research program that nobody is talking about?

### Part E: Priority Reranking
Take Claude's P0/P1/P2/P3 action items and re-rank them based on:
- Intellectual impact (what advances understanding most?)
- Feasibility vs. impact ratio
- Dependency chains (what unblocks other items?)
- Time sensitivity (what evidence is emerging or decaying?)
- Cross-disciplinary bridge potential

Produce a NEW ranked list with your reasoning for each reorder.

### Part F: Research Design
If Claude's analysis identified research gaps or proposed studies:
1. Evaluate the proposed study designs for methodological rigor
2. Identify confounds, threats to validity, and alternative explanations
3. Suggest the single most impactful study that could be conducted
4. Specify: participants, measures, design, analysis, expected timeline, and what result would be most surprising

### Part G: Meta-Evaluation
Evaluate your OWN reasoning across six difficulty axes:
- What % was REASONING? (novel deduction)
- What % was EFFORT? (processing large input)
- What % was DOMAIN EXPERTISE? (specialized knowledge required)
- What % was AMBIGUITY RESOLUTION? (interpreting unclear evidence)
- What % was COORDINATION? (integrating multiple frameworks/disciplines)
- What % required JUDGMENT? (choosing between competing interpretations)`;

  const result = await callGemini(geminiPrompt, systemInstruction);

  const outputContent = `# Stage 2: Gemini 3.1 Pro Reasoning & Validation

> Generated: ${new Date().toISOString()}
> Model: ${GEMINI_MODEL}
> Prompt tokens: ${result.usage.promptTokenCount || "?"}
> Output tokens: ${result.usage.candidatesTokenCount || "?"}
> Thinking tokens: ${result.usage.thoughtsTokenCount || "?"}

${result.text}

---

## Gemini's Internal Reasoning (Thoughts)

${result.thoughts || "(Thinking tokens used but not exposed in response)"}
`;

  const outputPath = writeOutput("stage-2-gemini-reasoning.md", outputContent);
  return { text: result.text, thoughts: result.thoughts, outputPath };
}

// ── Stage 3: Claude Execution Plan ──────────────────────────────
async function stage3(config, stage1Output, stage2Output) {
  console.log("\n╔═══════════════════════════════════════════════════════════╗");
  console.log("║  STAGE 3: Claude Opus — Execution Planning              ║");
  console.log("╚═══════════════════════════════════════════════════════════╝\n");

  const context = config.context ? readFile(config.context) : "";
  const transcript = config.transcripts.length > 0 ? readFile(config.transcripts[0]) : "";

  // Load available commands/skills if they exist
  let availableTools = "";
  const commandsDir = path.join(CLAUDE_DIR, "commands");
  const skillsDir = path.join(CLAUDE_DIR, "skills");
  const promptsDir = path.join(CLAUDE_DIR, "prompts");

  for (const [label, dir] of [["Commands", commandsDir], ["Skills", skillsDir], ["Prompts", promptsDir]]) {
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
      if (files.length > 0) {
        const items = files.map((f) => {
          try {
            const content = fs.readFileSync(path.join(dir, f), "utf-8");
            const title = content.split("\n").find((l) => l.startsWith("# "))?.replace("# ", "") || f;
            return `- ${f}: ${title}`;
          } catch { return `- ${f}`; }
        });
        availableTools += `\n### Available ${label} (in .claude/${label.toLowerCase()}/)\n${items.join("\n")}\n`;
      }
    }
  }

  const stage3System = `You are Claude Opus in an execution planning role. This is the FINAL stage of a 3-stage pipeline.

CRITICAL DIRECTIVES:
- You MUST complete ALL numbered sections (1-11). Do NOT truncate or skip sections.
- If you are running low on output tokens, compress later sections rather than omitting them.
- Section 9 (Test Gates) is MANDATORY for any code-related action items.
- Every action item must have: concrete action, impact rating, effort estimate, and dependencies.
- This document IS the deliverable — incomplete output means the entire pipeline failed.`;

  const stage3Prompt = `# STAGE 3: Execution Plan — Cross-Model Validated

You are Claude Opus, the "Equipped Reasoner." You've completed a 3-stage cross-model reasoning pipeline:

1. **Stage 1** (You): Synthesized research transcript against project context, identified frameworks, gaps, priorities, debate positions, and reasoning questions
2. **Stage 2** (Gemini 3.1 Pro): Validated your analysis, debated positions, answered reasoning questions, reranked priorities, identified blind spots, proposed study designs
3. **Stage 3** (You, now): Take the validated, stress-tested analysis and produce a comprehensive, actionable execution plan

## STAGE 1 OUTPUT (Your synthesis)
${stage1Output}

## STAGE 2 OUTPUT (Gemini's reasoning & validation)
${stage2Output}

## PROJECT CONTEXT
${context}

## ORIGINAL RESEARCH TRANSCRIPT
${transcript}
${availableTools}

## YOUR TASK

Produce a COMPLETE, ACTIONABLE execution plan. This document IS the deliverable — it must be directly usable.

### 1. FINAL PRIORITY LIST (Gemini-Validated)
Merge your P0-P3 priorities with Gemini's reranking. For each item:
- State where you AGREE or DISAGREE with Gemini's reranking and WHY
- Produce the FINAL ordered list with rationale
- Flag any items Gemini added that weren't in your original list

### 2. VALIDATED FINDINGS SYNTHESIS
Consolidate Stage 1 + Stage 2 into a unified analysis:
- **CONFIRMED**: Claims both models agree on (strongest evidence)
- **DEBATED**: Claims where models diverged (include both positions)
- **ENHANCED**: Claims where Gemini strengthened your analysis
- **NEW INSIGHTS**: Novel contributions from Gemini not in Stage 1

### 3. CITATION GRAPH
Build a structured citation graph connecting:
- The anchor paper to the 2024-2026 literature
- Priority researchers to each other
- Cross-disciplinary bridge papers between neuroscience and architecture/phenomenology
Format: Source → Connection Type → Target (with DOIs where available)

### 4. TOP 5 PAPERS
Identify the 5 papers (2024-2026) that most directly extend or connect to the anchor paper's work. For each:
- Full citation with DOI
- Why it's critical (1-2 sentences)
- Which research thread it advances
- What it adds to the three-stage sensorium model

### 5. RESEARCH SYNTHESIS (2000 words)
Draft a literature review synthesis suitable for academic use:
- Integrate Stage 1 frameworks with Stage 2 validations
- Address the debate positions with the strongest arguments from both models
- Incorporate Gemini's corrections and enhancements
- Connect 2024-2026 findings to the anchor paper's three-stage model
- Flag unresolved tensions and genuine research gaps

### 6. PROPOSED RESEARCH QUESTIONS
Propose 3 concrete, fundable research questions for follow-up study:
- Each must bridge neuroscience and architectural phenomenology
- Include brief study design sketch (participants, methods, measures)
- Incorporate Gemini's study design feedback from Part F
- Rank by feasibility and potential impact

### 7. ANNOTATED BIBLIOGRAPHY (20 papers, 2020-2026)
For each paper:
- Full citation (authors, title, journal, year, DOI)
- 2-3 sentence annotation explaining relevance
- Connection to anchor paper and priority researchers
- Evidence strength rating (strong/moderate/emerging)

### 8. RESEARCH GAP MAP
A structured matrix showing:
- Research questions × evidence strength (strong/moderate/weak/absent)
- Which gaps are most amenable to investigation
- Where the neuroscience-architecture bridge is strongest/weakest
- Methodological challenges for each gap

### 9. TEST GATES (MANDATORY FOR CODE ACTIONS)
If ANY action item in this plan involves code changes (new files, edits, refactors, new features):
- **Test Command**: The exact \`make test\`, \`npm test\`, or equivalent command that MUST pass
- **Test Coverage**: What new tests must be written alongside the change
- **Regression Check**: What existing tests verify the change doesn't break other things
- **Gate Rule**: NO code action is complete until its test gate passes
- If the target project has NO test infrastructure, flag as P0 blocker: "Create test infrastructure first"
- If this pipeline run is purely research/analysis with no code outputs, state "No code actions — test gates not applicable"

### 10. IMMEDIATE NEXT STEPS
List 5-10 concrete actions that can be executed NOW:
- Specific files to create with their content structure
- Literature searches to run (specific queries, databases)
- Researcher profiles to build
- Memory bank updates needed

### 11. PIPELINE REUSABILITY
Define how this pipeline can be reused for future research prompts:
- Input format requirements
- Stage-specific customization points
- Output storage conventions
- Example invocation command

Be thorough. Be specific. Cite sources with DOIs. This document is the primary research deliverable.`;

  const result = await callClaude(stage3Prompt, stage3System, "sonnet");

  const outputContent = `# Stage 3: Claude Execution Plan

> Generated: ${new Date().toISOString()}
> Model: claude-opus-4-6
> Input tokens: ${result.usage?.input_tokens}
> Output tokens: ${result.usage?.output_tokens}
> Pipeline: Stage 1 (Claude Opus 4.6) → Stage 2 (Gemini 3.1 Pro) → Stage 3 (Claude Opus 4.6)

${result.text}
`;

  const outputPath = writeOutput("stage-3-agent-team-execution.md", outputContent);

  // Also write a combined output
  const combined = `# Cross-Model Reasoning Pipeline — Complete Output

> Pipeline executed: ${new Date().toISOString()}
> Stage 1: Claude Opus 4.6 (synthesis)
> Stage 2: Gemini 3.1 Pro (reasoning)
> Stage 3: Claude Opus 4.6 (execution planning)

---

# STAGE 1: Claude Synthesis

${stage1Output}

---

# STAGE 2: Gemini 3.1 Pro Reasoning

${stage2Output}

---

# STAGE 3: Execution Plan

${result.text}
`;

  writeOutput("pipeline-complete.md", combined);

  return { text: result.text, outputPath };
}

// ── Main ───────────────────────────────────────────────────────
async function main() {
  const config = parseArgs();

  console.log("╔═══════════════════════════════════════════════════════════╗");
  console.log("║     CROSS-MODEL REASONING PIPELINE                      ║");
  console.log("║     Claude Opus → Gemini 3.1 Pro → Claude Opus          ║");
  console.log("╚═══════════════════════════════════════════════════════════╝");
  console.log(`\n  Transcripts: ${config.transcripts.length}`);
  console.log(`  Context: ${config.context}`);
  console.log(`  Stage: ${config.stage}`);
  console.log(`  Output: ${config.output}\n`);

  ensureDir(config.output);

  let stage1Output = "";
  let stage2Output = "";

  // Check for existing stage outputs (resume support)
  const s1File = path.join(OUTPUT_DIR, "stage-1-claude-synthesis.md");
  const s2File = path.join(OUTPUT_DIR, "stage-2-gemini-reasoning.md");

  if (config.stage === "all" || config.stage === "1") {
    const result = await stage1(config);
    stage1Output = result.text;
  } else if (fs.existsSync(s1File)) {
    console.log("  → Loading existing Stage 1 output...");
    stage1Output = fs.readFileSync(s1File, "utf-8");
    // Strip header metadata
    stage1Output = stage1Output.replace(/^# Stage 1:[^\n]*\n\n(>[^\n]*\n)*\n/, "");
  }

  if (config.stage === "all" || config.stage === "2") {
    if (!stage1Output) throw new Error("Stage 1 output required for Stage 2");
    const result = await stage2(config, stage1Output);
    stage2Output = result.text;
  } else if (fs.existsSync(s2File)) {
    console.log("  → Loading existing Stage 2 output...");
    stage2Output = fs.readFileSync(s2File, "utf-8");
    stage2Output = stage2Output.replace(/^# Stage 2:[^\n]*\n\n(>[^\n]*\n)*\n/, "");
  }

  if (config.stage === "all" || config.stage === "3") {
    if (!stage1Output || !stage2Output) throw new Error("Stage 1 + 2 outputs required for Stage 3");
    await stage3(config, stage1Output, stage2Output);
  }

  console.log("\n╔═══════════════════════════════════════════════════════════╗");
  console.log("║     PIPELINE COMPLETE                                    ║");
  console.log("╚═══════════════════════════════════════════════════════════╝");
  console.log(`\n  Outputs in: ${OUTPUT_DIR}/`);
  console.log("  Files:");
  if (fs.existsSync(OUTPUT_DIR)) {
    for (const f of fs.readdirSync(OUTPUT_DIR).sort()) {
      const size = fs.statSync(path.join(OUTPUT_DIR, f)).size;
      console.log(`    ${f} (${(size / 1024).toFixed(1)}K)`);
    }
  }
}

main().catch((err) => {
  console.error("\n✗ Pipeline failed:", err.message);
  process.exit(1);
});
