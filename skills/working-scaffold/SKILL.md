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

- Package imports (`@clerk/`, `@prisma/`, `stripe`, `aws-sdk`, etc.)
- Environment variable names that imply vendor APIs (`CLERK_SECRET_KEY`, `DATABASE_URL` with `prisma://`, etc.)
- Vendor-specific file patterns (schema.prisma, clerk.ts middleware, etc.)
- API call shapes that indicate specific SaaS vendors

#### Step 2 — MANDATORY OUTPUT: Integration Map

**Before proceeding to Step 3, you MUST write an Integration Map file and display it to the user.** This is the primary planning artifact that drives all subsequent work. It must be written to `<output-dir>/INTEGRATION_MAP.md` and printed in full to the conversation.

The Integration Map has four required sections:

**Section A — Component Inventory**

List every vendor-locked component discovered, with its vendor, entry-point files, and replacement target:

```
## Component Inventory

| Component | Vendor          | Key Files                              | Replacement Target         |
|-----------|-----------------|----------------------------------------|----------------------------|
| Auth      | @clerk/nextjs   | middleware.ts, src/lib/auth.ts         | next-auth + src/lib/auth/  |
| Database  | @prisma/client  | prisma/schema.prisma, src/lib/db.ts    | pg + src/lib/db.ts         |
| Storage   | aws-sdk/S3      | src/lib/storage.ts                     | src/lib/storage.ts (fetch) |
| Billing   | stripe          | src/lib/billing.ts, api/webhooks/...   | stripe (interface only)    |
```

**Section B — Integration Edges**

List every place where one component calls another component. An integration edge is any import or function call that crosses component boundaries. Format each edge as: `[Consumer Component] --uses--> [Provider Component]` with the specific file and line evidence.

```
## Integration Edges

- Auth --uses--> Database
  Evidence: src/lib/auth.ts imports `@prisma/client` to look up users (line 12)
  Integration point: auth adapter calls `prisma.user.findUnique()`
  After replacement: auth must call `db.query()` from src/lib/db.ts (NOT @prisma/client)

- Storage --uses--> Auth
  Evidence: src/lib/storage.ts calls `currentUser()` from `@clerk/nextjs` (line 8)
  Integration point: storage upload gated by Clerk session check
  After replacement: storage must call `getServerSession()` from src/lib/auth/ (NOT @clerk/nextjs)

- Billing --uses--> Auth
  Evidence: api/webhooks/stripe/route.ts calls `clerkClient.users.getUser()` (line 34)
  Integration point: webhook handler resolves Clerk user ID from Stripe metadata
  After replacement: billing must call `getServerSession()` from src/lib/auth/ (NOT clerkClient)

- Billing --uses--> Database
  Evidence: src/lib/billing.ts calls `prisma.subscription.upsert()` (line 67)
  Integration point: billing syncs subscription status to Prisma DB
  After replacement: billing must call `db.query()` from src/lib/db.ts (NOT @prisma/client)
```

**Each edge entry MUST include an "After replacement:" line** that explicitly states what new import/function the consumer should use once the provider component is replaced. If a component has NO incoming or outgoing edges, state that explicitly: `- Database: no dependencies on other vendor components`.

**Section C — Replacement Order**

Derive a topological order from Section B. Components with no dependencies (no incoming edges from other vendor components) go first:

```
## Replacement Order (dependency-safe)

1. Database — no dependencies on other vendor components
2. Auth — depends on Database (see edge: Auth → Database)
3. Storage — depends on Auth (see edge: Storage → Auth)
4. Billing — depends on Auth + Database (see edges: Billing → Auth, Billing → Database)
```

**Section D — Post-Replacement Verification Checklist**

For every integration edge in Section B, generate a specific grep command to verify the edge is rewired to the new implementation after replacement. Each check starts as `[ ]` (unchecked) and will be updated to `[x]` as replacements are completed:

```
## Post-Replacement Verification Checklist

After replacing Auth:
  [ ] grep "from '@prisma/client'" src/lib/auth/config.ts  → must return EMPTY
  [ ] grep "from '.*db'" src/lib/auth/config.ts            → must show new db.ts

After replacing Storage:
  [ ] grep "currentUser\|clerkMiddleware" src/lib/storage.ts → must return EMPTY
  [ ] grep "getServerSession\|auth()" src/lib/storage.ts     → must show new auth

After replacing Billing:
  [ ] grep "clerkClient" api/webhooks/stripe/route.ts        → must return EMPTY
  [ ] grep "from '@prisma/client'" src/lib/billing.ts        → must return EMPTY
  [ ] grep "getServerSession\|auth()" src/lib/billing.ts     → must show new auth
  [ ] grep "from '.*db'" src/lib/billing.ts                  → must show new db.ts
```

**Do not proceed to Step 3 until `INTEGRATION_MAP.md` is written and displayed in full.**

---

### Step 3: Reference Architecture Loading

Load the platform reference patterns from your-platform.example.com. These are the proven production patterns to use as replacements:

... [existing content] ...

---

### Step 4: Map-Driven Replacement Execution

**You will now execute the plan defined in `INTEGRATION_MAP.md`. The map is your sole source of truth for ordering, verification, and completion tracking.**

Process components in the exact order specified in **Section C — Replacement Order**. Do not proceed to the next component until the current one is fully complete.

For each component, execute the following sub-steps IN ORDER:

#### Sub-step 4.0: Integration Pre-Check (MANDATORY — run before writing any code)

**Before writing a single line of replacement code for this component**, read `INTEGRATION_MAP.md` Section B and answer these questions explicitly in the conversation:

1. **Does this component depend on any other vendor component?** List every Section B edge where this component is the *consumer* (left side of `--uses-->`).
2. **For each dependency edge found**: Has that dependency already been replaced in this session?
   - If YES → state which new module/function you will call (from the "After replacement:" line in Section B). You MUST use that new implementation, not the old vendor API.
   - If NO → this component cannot be safely replaced yet. Stop and re-check Section C ordering.
3. **Is this component a provider for any other component?** List every Section B edge where this component is the *provider* (right side of `--uses-->`). These downstream components will need updating after you finish this one.

Display your answers as a brief checklist before proceeding:
```
Integration Pre-Check for [Component]:
  Dependencies this component has:
    - [Component] --uses--> [Provider]: already replaced ✓ — will call [new function] from [new module]
    - (or: no dependencies)
  Downstream components that depend on this one (will be updated later):
    - [Downstream] --uses--> [this Component]
    - (or: no downstream dependencies)
  READY TO PROCEED: yes / no
```

**Do not write any replacement code until this pre-check is displayed and READY TO PROCEED is "yes".**

#### Sub-step 4.1: Perform the Code Replacement

- Read all files related to the component before editing any of them.
- Write the core replacement module based on the your-platform.example.com reference architecture.
- Surgically update every consumer file — after editing, it must contain zero imports from the old vendor package.
- For every integration edge where this component is the consumer (identified in 4.0), confirm the replacement code imports from the new module path (not the old vendor package) as specified by the "After replacement:" line in Section B.
- Update `package.json` to remove old vendor packages and add new ones.
- Additional guidelines:
  - **Preserve all business logic** — only swap the vendor integration layer
  - **Column naming**: Use SQL aliases (`snake_case AS "camelCase"`) to maintain JS interface compatibility
  - **Auth table naming**: Always prefix with `auth_` to avoid collisions
  - **Build-time safety**: Pool stub when `NEXT_PHASE === "phase-production-build"`
  - **Multi-tenancy**: `orgId` scoping on all tenant-owned resources

#### Sub-step 4.2: Run Verification Grep Commands

- Execute each grep command from Section D that applies to this component.
- If a check fails (old vendor reference still present, or new module reference missing), fix the code and re-run the check until it passes.

#### Sub-step 4.3: Update INTEGRATION_MAP.md on Disk

Once all checks for the component pass, update `INTEGRATION_MAP.md` on disk — change each `[ ]` to `[x]` and add a brief inline note of what was verified or fixed. Example:
```
After replacing Auth:
  [x] grep "from '@prisma/client'" src/lib/auth/config.ts  → returned EMPTY ✓
  [x] grep "from '.*db'" src/lib/auth/config.ts            → showed src/lib/db.ts ✓
```
If a check required a fix before passing, note it inline:
```
  [x] grep "currentUser" src/lib/storage.ts → returned EMPTY ✓ (fixed: removed stale clerk import at line 8)
```

#### Sub-step 4.4: Display Completion Summary

Display a completion summary and show the updated Section D read back from the file on disk:
```
✅ Auth replacement complete.
   - Replaced Clerk with Next-Auth in 12 files
   - All @clerk/nextjs references removed
   - Integration edges rewired: Auth now calls db.query() from src/lib/db.ts ✓

Updated INTEGRATION_MAP.md Section D (read from file):
  [x] Auth checks — complete
  [ ] Storage checks — pending
  [ ] Billing checks — pending
```

**Do not proceed to the next component until the current component's checks are all marked `[x]` in the map file on disk.**

Repeat sub-steps 4.0 through 4.4 for every component in Section C order.

---

### Step 5: Local Dev Environment

... [existing content] ...

### Step 6: Verification and Completeness Audit (REQUIRED)

**This step is mandatory and must not be skipped.** Before declaring the reverse-engineer complete, perform an explicit completeness audit to confirm every vendor component identified in Step 2 has been fully replaced.

#### 6a: Read and Display the Final Integration Map

Read `INTEGRATION_MAP.md` in its entirety and display Section D to the user. Every check must be `[x]`. If any check is still `[ ]`, that component's replacement is incomplete — do not proceed past 6a until all checks are `[x]`.

#### 6b: Vendor Reference Sweep

Run a comprehensive search across the entire output codebase for any remaining vendor-specific imports, package references, or API calls:

```bash
# Search for any remaining vendor package imports
grep -r "from '@clerk/" <output-dir> --include="*.ts" --include="*.tsx"
grep -r "from 'prisma'" <output-dir> --include="*.ts" --include="*.tsx"
grep -r "from '@prisma/client'" <output-dir> --include="*.ts" --include="*.tsx"
# Repeat for every vendor identified in Step 2
```

Also check `package.json` for any vendor packages that were not removed.

#### 6c: Completeness Matrix

Build a checklist from Step 2's discovered vendor components and verify each one:

| Component | Vendor Found | Replacement Written | Vendor References Cleared | Integration Points Verified | Status |
|-----------|-------------|---------------------|--------------------------|----------------------------|--------|
| Auth      | e.g. Clerk  | src/lib/auth/config.ts | No `@clerk/` imports remain | All Section D checks [x] | ✅/❌ |
| Database  | e.g. Prisma | src/lib/db.ts, migrations/ | No `@prisma/client` imports remain | N/A (no dependencies) | ✅/❌ |
| Storage   | e.g. S3 SDK | src/lib/storage.ts | No vendor storage imports remain | All Section D checks [x] | ✅/❌ |
| Billing   | e.g. Stripe | src/lib/billing.ts | No vendor billing imports remain | All Section D checks [x] | ✅/❌ |
| (others)  | ...         | ...                 | ...                        | ...                        | ...    |

#### 6d: Re-Queue Incomplete Replacements

If any row in the completeness matrix shows ❌:
1. **Do not declare completion** — return to Step 4 for those specific components
2. Log which components are incomplete and why
3. Re-execute Step 4 only for the incomplete items (including the mandatory Integration Map update)
4. Re-run Steps 6a through 6c after fixes until all rows show ✅

#### 6e: Build Smoke Test

Attempt a build to catch any broken imports or missing dependencies:

```bash
cd <output-dir>
npm install
npm run build 2>&1 | head -50
```

If build fails due to remaining vendor references, treat each error as an incomplete replacement and return to Step 4.

#### 6f: Declare Completion

Only after ALL of the following are true:
- [ ] Every vendor component identified in Step 2 has a replacement file
- [ ] Zero vendor package imports remain in source files
- [ ] Vendor packages are removed from `package.json`
- [ ] All integration edges from `INTEGRATION_MAP.md` Section B have been rewired to new implementations
- [ ] All verification commands from `INTEGRATION_MAP.md` Section D are marked `[x]` (confirmed by reading the file in Step 6a)
- [ ] Build smoke test passes (or fails only on environment-specific issues, not vendor imports)

Report the final completeness summary to the user showing what was replaced, what files were created, what dependencies were removed, and which cross-component integration points (from `INTEGRATION_MAP.md`) were validated.

### Step 7: Memory Bank Update

... [existing content] ...

---

## Reference

... [existing content] ...