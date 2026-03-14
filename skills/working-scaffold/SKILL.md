## Current Skill
```markdown
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

## When to Use

- Starting a new Claude Code project from scratch → **Greenfield Mode**
- `/scaffold <project-name>` → **Greenfield Mode**
- `/scaffold <github-url>` or `/scaffold <archive-path>` → **Reverse-Engineer Mode**
- `/scaffold <plan-file.md>` → **Plan Mode** (auto-feed plan to autonomous agent workspace)
- Removing vendor lock-in from an existing codebase → **Reverse-Engineer Mode**
- Making auth, database, billing, or storage components pluggable → **Reverse-Engineer Mode**

## Mode Detection

Automatically detect mode based on arguments:
- If argument is a path to a `.md` file containing a plan (has `## Targets`, `## Execution`, or `**Workspace**:` patterns) → **Plan Mode**
- If argument is a GitHub URL (`github.com/...`) or archive path (`.zip`, `.tar.gz`) or path to existing codebase → **Reverse-Engineer Mode**
- If argument is a kebab-case name with no URL/path indicators → **Greenfield Mode**
- If ambiguous → ask via AskUserQuestion

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

### Step 1: Acquire Source

Based on source type:
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

### Step 4: Surgical Replacement (Execution Phase)

Execute replacements in this order (dependencies first):

1. **Types** — Create `src/types/db.ts` with domain types to replace ORM-generated types
2. **Database connection** — Replace ORM singleton with `pg.Pool` singleton in `src/lib/db.ts`
3. **Schema/Migrations** — Convert ORM schema to raw SQL migration in `migrations/000_init.sql`
4. **Auth config** — Create `src/lib/auth/config.ts` and `pg-adapter.ts`
5. **Auth routes** — Create `api/auth/[...nextauth]/route.ts`
6. **Auth UI** — Replace vendor sign-in/sign-up components with OAuth buttons
7. **Multi-tenancy** — Create org tables, API routes, selection UI
8. **Session provider** — Replace vendor provider in layout.tsx
9. **Middleware/proxy** — Replace vendor middleware with cookie-based checks
10. **API routes** — Update all route handlers: replace ORM queries with raw SQL, replace vendor auth with `auth()`
11. **tRPC routers** — Update procedures: ORM → raw SQL, vendor auth → Auth.js
12. **Client components** — Replace vendor hooks (`useUser`, `useClerk`) with `useSession`
13. **Dependencies** — Update `package.json`: remove vendor packages, add `next-auth`, `@auth/core`, `pg`
14. **Environment** — Create `.env` / `.env.example` with platform variables
15. **Docker** — Create `docker-compose.yml` for local PostgreSQL
16. **Scripts** — Update seed scripts, migration runner

#### Replacement Guidelines

The key goals for the replacement process are:

1. **Preserve Business Logic**: Ensure that all existing business logic and functionality is maintained during the replacement process. Do not modify any files or components unless you have thoroughly reviewed and understood their purpose.

2. **Modular, Platform-Agnostic Components**: The end result should be a codebase with modular, platform-agnostic components that can be easily integrated into any project built on the your-platform.example.com reference architecture. This includes decoupling vendor-specific integrations, such as authentication, database, and storage, and replacing them with generic, pluggable implementations.

3. **Minimal Disruption**: The replacement process should be as seamless as possible, minimizing the impact on the existing codebase and development workflow. Automate as much of the process as possible to ensure consistency and reliability.

4. **Testability and Maintainability**: The resulting codebase should be easy to test and maintain, with clear separation of concerns, comprehensive documentation, and well-defined interfaces.

Here are some additional guidelines to follow during the replacement process:

- **Never modify files you haven't read** — Read before every edit
- **Preserve all business logic** — Only swap the vendor integration layer
- **Column naming**: Use SQL aliases (`snake_case AS "camelCase"`) to maintain JS interface compatibility
- **Auth table naming**: Always prefix with `auth_` to avoid collisions
- **Build-time safety**: Pool stub when `NEXT_PHASE === "phase-production-build"`
- **Multi-tenancy**: `orgId` scoping on all tenant-owned resources

### Step 5: Local Dev Environment

... [existing content] ...

### Step 6: Verification

... [existing content] ...

### Step 7: Memory Bank Update

... [existing content] ...

---

## Reference

... [existing content] ...
```
```

## Evaluation Results
Signal Detection: 0 failures (scenarios: none)
Classification: 1 failure (scenario: 6)
Quality Gate: 2 failures (scenarios: 5, 9)
Generalizability: 0 failures (scenarios: none)
No Duplication: 0 failures (scenarios: none)
Correct Action: 1 failure (scenario: 10)

## Recent Changelog
 **Score**: 57/60 (kept)
- **Failures**: Scenario 5: Quality Gate, Scenario 6: Classification, Scenario 9: Quality Gate, Scenario 10: Correct Action

## Round 5
- **Score**: 59/60 (kept)
- **Failures**: Scenario 5: Quality Gate, Scenario 9: Quality Gate

## Round 6 — Mutation Applied
- **Mutation**: Further expand the "Reverse-Engineer Mode" section with additional details and examples to address the remaining Quality Gate failures, focusing on maintaining testability and maintainability of the codebase.

## Round 6
- **Score**: 60/60 (kept)
- **Failures**: None