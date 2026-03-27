---
name: scaffold
description: "Scaffold a new Claude Code project OR reverse-engineer an existing codebase to remove vendor lock-in and make components modular and pluggable. Use when the user says scaffold, new project, create project, setup workspace, reverse engineer, or remove vendor lock-in."
argument-hint: "[project-name] [flags] OR <source> [transcript] [instructions] [flags]"
allowed-tools: Bash, Read, Write, Edit, AskUserQuestion, Glob, Grep, Agent, WebFetch
---

# Skill: Scaffold

> Scaffold a new Claude Code project with shared commands, prompts, memory bank — OR reverse-engineer an existing codebase to remove vendor lock-in and produce modular, platform-agnostic components.

## Purpose

Two modes of operation:

1. **Greenfield Mode** — End-to-end project scaffolding: creates a `.claude` project context with symlinked commands/prompts, memory bank stubs, optional git repo, and optional terminal launch.

2. **Reverse-Engineer Mode** — Takes an existing codebase (GitHub URL, archive, or local path), analyzes vendor-locked components, and surgically replaces them with platform-agnostic equivalents matching the your-platform.example.com reference architecture. The output is a codebase with modular components that can be dropped into `apps/web` or any project in the platform.

---

## MANDATORY GLOBAL STEP 0: Parameter Gathering Gate

**THIS STEP RUNS FIRST, BEFORE MODE DETECTION, FOR EVERY INVOCATION. DO NOT SKIP. DO NOT PROCEED TO ANY OTHER STEP UNTIL COMPLETE.**

Before doing anything else — before mode detection, before file reads, before any analysis — you MUST gather and confirm all required parameters from the user. Combine all questions into a single `AskUserQuestion` call when possible.

### Step 0a: Detect Likely Mode (for question selection only)

Make a preliminary guess at the mode based on the raw argument:
- Argument ends in `.md` with plan-like content → likely **Plan Mode**
- Argument contains `github.com`, `.zip`, `.tar.gz`, or is a local directory path → likely **Reverse-Engineer Mode**
- Argument is a kebab-case name with no URL/path → likely **Greenfield Mode**
- Unclear → ask the user which mode they intend

### Step 0b: Ask Required Parameters Per Mode

**For Greenfield Mode** — ask (combine into one call):
1. Project name — confirm the name detected from arguments (or ask if missing)
2. Output location — where should the project be created? (default: `~/.remote/<project-name>`)
3. Git repo — initialize a git repository? (yes/no, default: yes)
4. Terminal launch — open a new terminal/tmux session after scaffolding? (yes/no)
5. Any additional features or special requirements?

**For Plan Mode** — ask (combine into one call):
1. Plan file — confirm the path to the `.md` plan file
2. Workspace — where should the autonomous agent workspace be created?
3. Any overrides or additional instructions beyond what is in the plan?

**For Reverse-Engineer Mode** — ask (combine into one call):
1. Source — re-state the detected source (URL, archive, or local path) and confirm it is correct
2. Target components — which vendor components should be replaced? (e.g., auth, database, storage, billing, all; default: all detected)
3. Transcript or docs — is there a transcript, README, or architecture doc to load for context?
4. Output location — where should output be written? (default: `~/.remote/@vendor-replacement/<repo-name>`)
5. Platform reference — confirm the target reference architecture (default: your-platform.example.com)

**For Unknown Mode** — ask:
1. Which mode are you intending: Greenfield (new project), Plan (feed a plan file to an agent), or Reverse-Engineer (remove vendor lock-in from an existing codebase)?
2. Then ask the appropriate per-mode questions above.

### Step 0c: Confirm Before Proceeding

After receiving the user's answers, echo back a brief summary of all confirmed parameters and ask: "Shall I proceed with these settings?" Do not begin Step 1 of any mode until the user confirms.

**EXCEPTION**: If the user's original invocation contained ALL required parameters with no ambiguity AND all defaults are acceptable, you MAY skip asking and instead state: "Proceeding with the following confirmed parameters: [list them]" — then begin only after displaying them.

---

## When to Use

- Starting a new Claude Code project from scratch → **Greenfield Mode**
- `/scaffold <project-name>` → **Greenfield Mode**
- `/scaffold <github-url>` or `/scaffold <archive-path>` → **Reverse-Engineer Mode**
- `/scaffold <plan-file.md>` → **Plan Mode** (auto-feed plan to autonomous agent workspace)
- Removing vendor lock-in from an existing codebase → **Reverse-Engineer Mode**
- Making auth, database, billing, or storage components pluggable → **Reverse-Engineer Mode**

## Mode Detection

After Step 0 is complete, confirm mode based on confirmed parameters:
- If argument is a path to a `.md` file containing a plan (has `## Targets`, `## Execution`, or `**Workspace**:` patterns) → **Plan Mode**
- If argument is a GitHub URL (`github.com/...`) or archive path (`.zip`, `.tar.gz`) or path to existing codebase → **Reverse-Engineer Mode**
- If argument is a kebab-case name with no URL/path indicators → **Greenfield Mode**
- If still ambiguous after Step 0 → re-ask via AskUserQuestion

---

## Greenfield Mode

... [existing content] ...

---

## Plan Mode

... [existing content] ...

---

## Reverse-Engineer Mode

### Invocation

```
/scaffold <source> [transcript] [options]
```

**Arguments**:
- `<source>` — GitHub URL, archive path, or local directory path
- `[transcript]` — Optional path to video transcript or documentation that describes the codebase
- `[options]` — Key-value instructions and flags

**Examples**:
```
/scaffold https://github.com/code-with-antonio/resonance /path/to/transcript.md
/scaffold ./my-app.zip --target auth,db --platform your-platform.example.com
/scaffold https://github.com/user/repo {instruction: reverse engineer auth/db and make agnostic}
```

> **Note**: Parameter gathering for Reverse-Engineer Mode is handled in the global Step 0 above. Do not re-ask questions already answered there.

### Step 1: Acquire Source

Based on source type (confirmed in Step 0):
- **GitHub URL** → `git clone <url>` into workspace under `~/.remote/@vendor-replacement/<repo-name>`
- **Archive** → Extract to same workspace pattern
- **Local path** → Use as-is, confirm with user

If a transcript path is provided, read it for additional context about the codebase architecture and intent.

### Step 2: Codebase Analysis (Discovery Phase)

Perform comprehensive analysis using subagents for parallel investigation. Identify ALL vendor-locked components by scanning for:

... [existing content] ...

### Step 3: Reference Architecture Loading

Load the platform reference patterns from your-platform.example.com. These are the proven production patterns to use as replacements:

... [existing content] ...

### Step 4: Iterative, Component-Centric Replacement

Instead of a single, monolithic pass, you will replace vendor dependencies one major component at a time. This ensures focus and completeness for each system before moving to the next. The typical order is **Auth -> Database -> Other Services**.

For each component you are replacing (e.g., Clerk Auth, Prisma DB):

#### 4a: Isolate and Plan
1.  **Identify all files** related to the target component (e.g., for Clerk: `clerk.ts`, middleware, components using `useUser`, API routes checking auth). Use `grep` extensively to find every single usage.
2.  **Formulate a concise plan**. State which new packages will be added (`next-auth`, `pg`) and which old ones will be removed (`@clerk/nextjs`).
3.  **State the key replacement patterns**: e.g., "`useUser()` will be replaced with `useSession()`", "`clerkClient` calls will be replaced with direct database queries".

#### 4b: Execute Replacement
1.  **Write the core replacement modules** (e.g., `src/lib/auth/config.ts`, `src/lib/db.ts`) based on the your-platform.example.com reference architecture.
2.  **Surgically update consumer files.** Go through the list of files identified in 4a and replace all vendor-specific code with the new platform-agnostic implementation.
    - **Principle: Leave no imports behind.** After editing a file, it should contain zero imports from the old vendor package.
3.  **Update dependencies.** After all code changes for the component are done, edit `package.json` to remove the old vendor packages and add the new ones.

Additional guidelines during execution:
- **Never modify files you haven't read** — Read before every edit
- **Preserve all business logic** — Only swap the vendor integration layer
- **Column naming**: Use SQL aliases (`snake_case AS "camelCase"`) to maintain JS interface compatibility
- **Auth table naming**: Always prefix with `auth_` to avoid collisions
- **Build-time safety**: Pool stub when `NEXT_PHASE === "phase-production-build"`
- **Multi-tenancy**: `orgId` scoping on all tenant-owned resources

#### 4c: Verify and Validate
1.  **Run a targeted `grep`** across the entire codebase to confirm there are absolutely no remaining imports or references to the vendor package you just replaced (e.g., `grep -r "@clerk/nextjs" .`).
2.  **If any references remain, return to 4b** and fix them. Do not proceed to the next component until the current one is fully purged.
3.  **Summarize the changes** for this component before starting the next one. Example: "✅ Auth replacement complete. Replaced Clerk with Next-Auth in 12 files. All `@clerk/nextjs` references have been removed."

**Repeat this Isolate -> Execute -> Verify loop for every vendor component identified in Step 2.**

### Step 5: Local Dev Environment

... [existing content] ...

### Step 6: Verification and Completeness Audit (REQUIRED)

**This step is mandatory and must not be skipped.** Before declaring the reverse-engineer complete, perform an explicit completeness audit to confirm every vendor component identified in Step 2 has been fully replaced.

#### 6a: Vendor Reference Sweep

Run a comprehensive search across the entire output codebase for any remaining vendor-specific imports, package references, or API calls:

```bash
# Search for any remaining vendor package imports
grep -r "from '@clerk/" <output-dir> --include="*.ts" --include="*.tsx"
grep -r "from 'prisma'" <output-dir> --include="*.ts" --include="*.tsx"
grep -r "from '@prisma/client'" <output-dir> --include="*.ts" --include="*.tsx"
# Repeat for every vendor identified in Step 2
```

Also check `package.json` for any vendor packages that were not removed.

#### 6b: Completeness Matrix

Build a checklist from Step 2's discovered vendor components and verify each one:

| Component | Vendor Found | Replacement Written | Vendor References Cleared | Status |
|-----------|-------------|---------------------|--------------------------|--------|
| Auth      | e.g. Clerk  | src/lib/auth/config.ts | No `@clerk/` imports remain | ✅/❌ |
| Database  | e.g. Prisma | src/lib/db.ts, migrations/ | No `@prisma/client` imports remain | ✅/❌ |
| Storage   | e.g. S3 SDK | src/lib/storage.ts | No vendor storage imports remain | ✅/❌ |
| Billing   | e.g. Stripe | src/lib/billing.ts | No vendor billing imports remain | ✅/❌ |
| (others)  | ...         | ...                 | ...                      | ...    |

#### 6c: Re-Queue Incomplete Replacements

If any row in the completeness matrix shows ❌:
1. **Do not declare completion** — return to Step 4 for those specific components
2. Log which components are incomplete and why
3. Re-execute Step 4 only for the incomplete items
4. Re-run Step 6a and 6b after fixes until all rows show ✅

#### 6d: Build Smoke Test

Attempt a build to catch any broken imports or missing dependencies:

```bash
cd <output-dir>
npm install
npm run build 2>&1 | head -50
```

If build fails due to remaining vendor references, treat each error as an incomplete replacement and return to Step 4.

#### 6e: Declare Completion

Only after ALL of the following are true:
- [ ] Every vendor component identified in Step 2 has a replacement file
- [ ] Zero vendor package imports remain in source files
- [ ] Vendor packages are removed from `package.json`
- [ ] Build smoke test passes (or fails only on environment-specific issues, not vendor imports)
- [ ] Step 4c Verify loop shows ✅ for every vendor component

Report the final completeness summary to the user showing what was replaced, what files were created, and what dependencies were removed.

### Step 7: Memory Bank Update

... [existing content] ...

---

## Reference

... [existing content] ...