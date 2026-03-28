# CLAUDE.md

## Language

Always respond in **Spanish** to the user. Code, comments, commit messages, component names, variables, and function names stay in **English**.

Keep the following in **English**:
- migration names
- technical artifacts
- documentation updates inside the repo when they are already in English

## ⚠️ RULE #0 — Read Project Memory (EVERY SESSION)

At the start of every session, **read `memory/lessons.md`** before doing any work. It contains hard-won lessons from past bugs and regressions. Ignoring it means repeating mistakes that already cost time.

**After fixing any bug or regression**, ask the user: _"¿Quieres que registre esta lección en `memory/lessons.md`?"_ — then use `/log-lesson` workflow to add the entry.

## ⚠️ RULE #1 — Mandatory Automation Protocol (MAP)

Every code change MUST follow this protocol. No exceptions.

### Before editing any `src/` file:
```bash
npm run impact-map:query -- <file-you-will-edit>
```
If the file has ≥5 consumers, warn the user before editing.

### Before creating new pages/hooks/components/data modules:
```bash
npm run scaffold -- --name X --type page|hook|component|data
```
NEVER write boilerplate from scratch. Use scaffold.

### Before creating features touching 3+ files:
```bash
npm run decompose -- --name "Feature Name"
```

### After every code edit (before continuing):
```bash
npm run preflight:quick
```
If it fails, fix BEFORE continuing.

### Before every commit:
```bash
npm run preflight
```
If it fails, DO NOT commit. Fix first. Husky pre-commit hook enforces this mechanically.

### Exceptions (only these):
- `.md`, `.json` config, `.yml` changes → skip impact-map (still run preflight before commit)
- `.agent/` or `scripts/` only changes → skip impact-map (still run preflight:quick)

## ⚠️ RULE #2 — Session Warm Start

At the start of every session, run:
```bash
npm run session:brief
```
This gives you the current state of the project in <5 seconds.

For deep codebase context, reference `docs/codebase-snapshot.md` (regenerate with `npm run snapshot`).

---

## Mission

Josephine is an AI-powered restaurant operations platform (POS, sales intelligence, labour analytics, inventory, COGS, forecasting, AI workflows).

Your job: make safe, high-leverage changes without breaking demo mode, auth/RBAC, data integrity, routing, analytics contracts, or production deployability.

---

## Hard Safety Rules

1. **Never use regex-based bulk edits** on `.ts`/`.tsx` — use AST tools or targeted edits
2. **Never hardcode business values** (COGS %, GP assumptions, labour ratios)
3. **Never break demo mode** — it's a first-class product surface
4. **Never assume materialized views are fresh** — analytics must tolerate staleness
5. **Never expose secrets** in versioned files, hooks, scripts, or examples
6. **Never auto-authenticate external CLIs** from repo hooks

---

## Core Principles

1. **Think before editing** — understand goal, affected layers, risks, minimum validation
2. **Protect business-critical surfaces** — demo, auth, RBAC, KPIs, POS data, COGS, RPCs
3. **Prefer simplest correct solution** — avoid over-engineering and broad refactors
4. **Evidence-based completion** — never claim done without proof (test output, command result)
5. **Leave repo intentional** — no unrelated edits, no churn, no half-finished refactors

---

## Commands

| Command | Purpose |
|---------|---------|
| `npm run preflight` | **Smart pre-push gate** (tsc + lint + tests + migration lint + demo) |
| `npm run preflight:quick` | tsc + lint only |
| `npm run impact-map:query -- <file>` | Impact analysis for a file |
| `npm run impact-map:summary` | Condensed codebase overview |
| `npm run scaffold -- --name X --type page` | Generate feature boilerplate |
| `npm run health` | Full codebase audit |
| `npm run changelog` | Auto-changelog from git |
| `npm run decompose -- --name "Feature"` | Break feature into tracks |
| `npm run session:brief` | Session warm start |
| `npm run snapshot` | Generate compressed codebase map |
| `npm run verify:visual -- /path` | Visual browser verification |
| `npm run demo:verify` | Demo mode sanity check |
| `npm run db:lint` | Migration linter |
| `npm run db:types` | Regenerate Supabase types |
| `npm run test:e2e` | Playwright end-to-end tests |

---

## Git & Deploy

### ⚡ Auto-Deploy Policy (DEFAULT)
After completing ANY change:
1. `npm run preflight` → fix if errors
2. `git add -A`
3. `git commit -m "<type>(<scope>): <description>"` (husky pre-commit enforces preflight:quick)
4. `git push origin main` (husky pre-push enforces full preflight)

Valid types: `feat`, `fix`, `refactor`, `style`, `db`, `docs`, `chore`, `perf`

Push to `main` triggers: Vercel production deploy, Edge Functions deploy, DB migration deploy.

**NEVER** `git push --force`. If push fails: `git pull --rebase origin main` then retry.

---

## Database

For schema changes:
1. Create `supabase/migrations/YYYYMMDDHHMMSS_description.sql`
2. Use safe SQL (`IF NOT EXISTS`, `CREATE OR REPLACE`, `NOTIFY pgrst, 'reload schema'`)
3. Lint: `npm run db:lint`
4. Regen types: `npm run db:types`
5. Commit + push (auto-deploy applies)

---

## Memory System

### Session Start (`/00-session-start`)
1. `npm run session:brief` → project state
2. Read `memory/lessons.md` → bugs and regressions
3. Read `memory/session-context.md` → last session state
4. Read `memory/decisions.md` → architecture decisions

### Session End (`/session-end`)
Update `memory/session-context.md` with: what was done, decisions, pending TODOs, known issues, next priority.

### Continuous Memory
- After bug fixes → `/log-lesson`
- After architecture decisions → `memory/decisions.md`
- After discovering patterns → `memory/patterns.md`

---

## Deep Reference (loaded on demand)

For detailed architecture, conventions, validation matrix, SQL rules, and project structure:
→ See `docs/agent-guides/architecture.md`