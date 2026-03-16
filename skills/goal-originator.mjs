#!/usr/bin/env node
/**
 * goal-originator.mjs — Propose new strategic goals from wants.
 *
 * Reads wants.json for wants that suggest strategic goals (proposed_goal set,
 * or uncovered_domain/unmet_demand types). Compares against existing goals in
 * strategic.md. Writes proposals to goal-proposals.json.
 *
 * Usage:
 *   node skills/goal-originator.mjs                  # dry run — analyze & propose
 *   node skills/goal-originator.mjs --approve         # append approved proposals to strategic.md
 *   node skills/goal-originator.mjs --want want-002   # analyze specific want only
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const WANTS_PATH = resolve(ROOT, "wants.json");
const PROPOSALS_PATH = resolve(ROOT, "goal-proposals.json");
const STRATEGIC_PATH =
  process.env.STRATEGIC_PATH ||
  resolve(ROOT, "..", "@openclaw-integration", "supervisor", "strategic.md");

// ---------------------------------------------------------------------------
// Parse CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const approveMode = args.includes("--approve");
const wantFilter = (() => {
  const idx = args.indexOf("--want");
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
})();

// ---------------------------------------------------------------------------
// Parse strategic.md to extract existing goal IDs, descriptions, categories
// ---------------------------------------------------------------------------

function parseStrategicGoals(content) {
  const goals = [];
  const lines = content.split("\n");
  let current = null;

  for (const line of lines) {
    const headerMatch = line.match(/^## Goal:\s+(\S+)/);
    if (headerMatch) {
      if (current) goals.push(current);
      current = { id: headerMatch[1], description: "", category: "", budget: "", triggers: [] };
      continue;
    }
    if (!current) continue;

    if (line.startsWith("- **Description**:")) {
      current.description = line.split(":", 2)[1]?.trim() || "";
    } else if (line.startsWith("- **Category**:")) {
      current.category = line.split(":", 2)[1]?.trim() || "";
    } else if (line.startsWith("- **Daily Budget**:")) {
      current.budget = line.split(":", 2)[1]?.trim() || "";
    }
  }
  if (current) goals.push(current);
  return goals;
}

// ---------------------------------------------------------------------------
// Check if an existing goal already covers a want
// ---------------------------------------------------------------------------

function goalCoversWant(existingGoals, want) {
  const hypothesis = (want.hypothesis || "").toLowerCase();
  const proposedGoal = (want.proposed_goal || "").toLowerCase();
  const wantType = (want.type || "").toLowerCase();

  for (const goal of existingGoals) {
    const desc = goal.description.toLowerCase();
    const id = goal.id.toLowerCase();

    // Direct keyword overlap checks
    // Check if the want's proposed_goal text mentions the goal ID
    if (proposedGoal.includes(id) || id.includes(wantType.replace("_", "-"))) {
      return { covered: true, by: goal.id, reason: `Goal ID '${goal.id}' matches want type/proposal` };
    }

    // Check domain overlap: extract key terms from hypothesis
    const domainTerms = extractDomainTerms(hypothesis + " " + proposedGoal);
    for (const term of domainTerms) {
      if (desc.includes(term) || id.includes(term)) {
        return { covered: true, by: goal.id, reason: `Goal '${goal.id}' covers domain term '${term}'` };
      }
    }
  }

  return { covered: false, by: null, reason: "No existing goal covers this want" };
}

function extractDomainTerms(text) {
  const terms = new Set();
  const patterns = [
    /\b(security|audit|vulnerability|cve)\b/gi,
    /\b(testing|test|qa|quality)\b/gi,
    /\b(deployment|deploy|infrastructure)\b/gi,
    /\b(research|paper|literature|journal)\b/gi,
    /\b(monitoring|monitor|observ)\b/gi,
    /\b(refactor|cleanup|debt)\b/gi,
    /\b(skill|improve|optim)\b/gi,
    /\b(dashboard|report|status)\b/gi,
    /\b(debug|error|troubleshoot)\b/gi,
    /\b(pipeline|workflow)\b/gi,
    /\b(plan|planning|strategy)\b/gi,
  ];
  for (const pat of patterns) {
    const matches = text.match(pat);
    if (matches) {
      for (const m of matches) terms.add(m.toLowerCase());
    }
  }
  return [...terms];
}

// ---------------------------------------------------------------------------
// Generate a goal definition from a want
// ---------------------------------------------------------------------------

function generateGoalProposal(want, existingGoals) {
  const coverage = goalCoversWant(existingGoals, want);

  if (coverage.covered) {
    return {
      want_id: want.id,
      goal_id: null,
      status: "already_covered",
      covered_by: coverage.by,
      reason: coverage.reason,
    };
  }

  // Derive a goal ID from the want
  const goalId = deriveGoalId(want);
  const category = deriveCategory(want);
  const description = deriveDescription(want);
  const triggers = deriveTriggers(want);
  const actions = deriveActions(want);
  const budget = deriveBudget(want);
  const confidenceThreshold = deriveConfidenceThreshold(want);

  return {
    want_id: want.id,
    goal_id: goalId,
    description,
    category,
    confidence_threshold: confidenceThreshold,
    daily_budget: budget,
    triggers,
    actions,
    status: "proposed",
    evidence: want.evidence || [],
  };
}

function deriveGoalId(want) {
  const hypothesis = want.hypothesis || "";
  const proposedGoal = want.proposed_goal || "";
  const text = (proposedGoal || hypothesis).toLowerCase();

  // Try to extract a meaningful ID
  if (text.includes("testing") || text.includes("test")) return "testing-capability";
  if (text.includes("security") && text.includes("audit")) return "security-skill-testing";
  if (text.includes("security")) return "security-capability";
  if (text.includes("deployment") || text.includes("deploy")) return "deployment-capability";
  if (text.includes("refactor")) return "refactoring-capability";
  if (text.includes("dashboard") || text.includes("status")) return "system-observability";
  if (text.includes("debug") || text.includes("error")) return "error-debugging";
  if (text.includes("pipeline") || text.includes("diagnos")) return "pipeline-reliability";
  if (text.includes("plan") && text.includes("deep-plan")) return "strategic-planning-activation";
  if (text.includes("language") || text.includes("locali")) return "multilingual-support";
  if (text.includes("skill") && text.includes("improv")) return "skill-self-improvement";
  if (text.includes("plateau") || text.includes("stuck")) return "stuck-skill-resolution";
  if (text.includes("cross.skill") || text.includes("pattern")) return "cross-skill-pattern-resolution";

  // Fallback: kebab-case from first few words
  const words = text.replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean).slice(0, 4);
  return words.join("-") || `goal-from-${want.id}`;
}

function deriveCategory(want) {
  const text = ((want.hypothesis || "") + " " + (want.proposed_goal || "")).toLowerCase();
  if (text.includes("security")) return "security";
  if (text.includes("research") || text.includes("paper")) return "research";
  if (text.includes("deploy") || text.includes("infrastructure")) return "infrastructure";
  return "improvement";
}

function deriveDescription(want) {
  if (want.proposed_goal && want.proposed_goal.length > 10) {
    return want.proposed_goal;
  }
  return want.hypothesis || `Address want: ${want.id}`;
}

function deriveTriggers(want) {
  const triggers = [];
  const text = ((want.hypothesis || "") + " " + (want.proposed_goal || "")).toLowerCase();

  if (text.includes("weekly") || text.includes("periodic")) triggers.push("cron:weekly");
  if (text.includes("new skill") || text.includes("skill created")) triggers.push("event:new-skill-created");
  if (text.includes("stuck") || text.includes("plateau")) triggers.push("event:skill-stuck");
  if (text.includes("pipeline") || text.includes("failure")) triggers.push("event:pipeline-failure");

  // Default trigger
  if (triggers.length === 0) triggers.push("cron:weekly");

  return triggers;
}

function deriveActions(want) {
  const actions = [];
  const text = ((want.hypothesis || "") + " " + (want.proposed_goal || "")).toLowerCase();

  if (text.includes("test")) actions.push("Run relevant tests or create test harness");
  if (text.includes("security") || text.includes("audit")) actions.push("Run security analysis on target code");
  if (text.includes("skill")) actions.push("Evaluate and improve target skills");
  if (text.includes("plan")) actions.push("Generate and validate execution plan");
  if (text.includes("deploy")) actions.push("Validate deployment readiness");
  if (text.includes("monitor") || text.includes("dashboard")) actions.push("Generate status report");

  if (actions.length === 0) actions.push("Analyze gap and propose remediation");
  actions.push("Report findings via notification");

  return actions;
}

function deriveBudget(want) {
  const score = want.score || 0;
  if (score >= 0.7) return "$1.50";
  if (score >= 0.5) return "$1.00";
  return "$0.50";
}

function deriveConfidenceThreshold(want) {
  const type = want.type || "";
  if (type === "uncovered_domain") return 0.8;
  if (type === "unmet_demand") return 0.85;
  if (type === "stuck_skill") return 0.9;
  return 0.8;
}

// ---------------------------------------------------------------------------
// Generate strategic.md block for a proposal
// ---------------------------------------------------------------------------

function proposalToMarkdown(proposal) {
  if (proposal.status !== "proposed") return "";

  const triggers = (proposal.triggers || []).map((t) => `  - ${t}`).join("\n");
  const actions = (proposal.actions || []).map((a) => `  - ${a}`).join("\n");
  const evidence = (proposal.evidence || []).map((e) => `  - ${e}`).join("\n");

  return `
## Goal: ${proposal.goal_id}
- **Description**: ${proposal.description}
- **Category**: ${proposal.category}
- **Evaluation**: Auto-proposed from want-engine analysis (${proposal.want_id})
- **Confidence Threshold**: ${proposal.confidence_threshold}
- **Daily Budget**: ${proposal.daily_budget}
- **Pre-Filter Triggers** (lightweight, $0):
${triggers}
- **Actions** (on wake):
${actions}
- **Origin Evidence**:
${evidence}
`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  // 1. Read wants.json
  if (!existsSync(WANTS_PATH)) {
    console.error("ERROR: wants.json not found at", WANTS_PATH);
    process.exit(1);
  }
  const wantsData = JSON.parse(readFileSync(WANTS_PATH, "utf-8"));
  const allWants = wantsData.wants || [];

  // 2. Filter wants that suggest goals
  let candidateWants = allWants.filter((w) => {
    // Has explicit proposed_goal text
    if (w.proposed_goal && w.proposed_goal.trim().length > 0) return true;
    // Is an uncovered domain or unmet demand that could become a goal
    if (["uncovered_domain", "unmet_demand"].includes(w.type)) return true;
    return false;
  });

  // Apply --want filter if specified
  if (wantFilter) {
    candidateWants = candidateWants.filter((w) => w.id === wantFilter);
    if (candidateWants.length === 0) {
      console.error(`ERROR: Want '${wantFilter}' not found or has no goal proposal`);
      process.exit(1);
    }
  }

  // 3. Read strategic.md
  if (!existsSync(STRATEGIC_PATH)) {
    console.error("ERROR: strategic.md not found at", STRATEGIC_PATH);
    process.exit(1);
  }
  const strategicContent = readFileSync(STRATEGIC_PATH, "utf-8");
  const existingGoals = parseStrategicGoals(strategicContent);

  console.log(`Found ${candidateWants.length} candidate wants, ${existingGoals.length} existing goals`);

  // 4. Generate proposals
  const proposals = [];
  for (const want of candidateWants) {
    const proposal = generateGoalProposal(want, existingGoals);
    proposals.push(proposal);

    if (proposal.status === "proposed") {
      console.log(`  PROPOSE: ${proposal.goal_id} (from ${want.id})`);
    } else {
      console.log(`  SKIP: ${want.id} — already covered by '${proposal.covered_by}'`);
    }
  }

  const newGoals = proposals.filter((p) => p.status === "proposed");
  const alreadyCovered = proposals.filter((p) => p.status === "already_covered");

  // 5. Write goal-proposals.json
  const output = {
    timestamp: new Date().toISOString(),
    proposals,
    existing_goals_checked: existingGoals.map((g) => g.id),
    summary: {
      total_proposed: newGoals.length,
      new_goals: newGoals.length,
      goal_updates: 0,
      already_covered: alreadyCovered.length,
      total_candidates: candidateWants.length,
    },
  };

  writeFileSync(PROPOSALS_PATH, JSON.stringify(output, null, 2));
  console.log(`\nWrote ${PROPOSALS_PATH}`);
  console.log(`  New goals proposed: ${newGoals.length}`);
  console.log(`  Already covered: ${alreadyCovered.length}`);

  // 6. If --approve, append to strategic.md
  if (approveMode && newGoals.length > 0) {
    let appendContent = "";
    for (const proposal of newGoals) {
      appendContent += proposalToMarkdown(proposal);
    }

    // Find the insertion point — before the "---" that starts the Budget Summary
    const budgetMarker = "\n---\n\n## Budget Summary";
    const insertIdx = strategicContent.indexOf(budgetMarker);

    let updatedContent;
    if (insertIdx !== -1) {
      // Insert before budget summary
      updatedContent =
        strategicContent.slice(0, insertIdx) +
        appendContent +
        strategicContent.slice(insertIdx);
    } else {
      // Append at end
      updatedContent = strategicContent + "\n" + appendContent;
    }

    writeFileSync(STRATEGIC_PATH, updatedContent);
    console.log(`\nAPPROVED: Appended ${newGoals.length} goal(s) to strategic.md`);

    // Update proposal statuses
    for (const p of newGoals) p.status = "approved";
    writeFileSync(PROPOSALS_PATH, JSON.stringify(output, null, 2));
  } else if (approveMode) {
    console.log("\nNo new goals to approve.");
  } else {
    console.log("\nDry run complete. Use --approve to append goals to strategic.md");
  }
}

main();
