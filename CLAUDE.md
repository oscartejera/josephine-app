# CLAUDE.md

## Language

Always respond in **Spanish** to the user. Code, comments, commit messages, component names, variables, and function names stay in **English**.

Keep the following in **English**:
- migration names
- technical artifacts
- documentation updates inside the repo when they are already in English

## ⚠️ RULE #0 — Read Project Memory (EVERY SESSION)

At the start of every session, **read `memory/lessons.md`** before doing any work. It contains hard-won lessons from past bugs and regressions. Ignoring it means repeating mistakes that already cost time.

---

## Mission

Josephine is an AI-powered restaurant operations platform.

It connects to POS systems (Square, Lightspeed, Toast and others) via OAuth + webhooks and provides:
- sales intelligence
- labour analytics
- inventory and COGS visibility
- forecasting
- AI-assisted operational workflows

Your job is to make safe, high-leverage changes without breaking:
- demo mode
- auth and RBAC
- data integrity
- routing
- analytics contracts
- production deployability

---

## Core Operating Principles

### 1. Think before editing
For any non-trivial task, start by understanding:
- the goal
- the affected layers
- the likely files
- the risk
- the minimum reliable validation

A task is non-trivial if it involves any of the following:
- more than 3 meaningful steps
- multiple files
- multiple layers (UI + data, UI + auth, DB + frontend, etc.)
- routing
- auth
- Supabase
- migrations
- demo mode
- analytics / RPCs
- POS integrations

Do not jump into edits blindly.

### 2. Protect business-critical surfaces
Josephine must not regress in:
- demo mode
- auth and RBAC
- routing and guarded navigation
- KPI correctness
- POS data visibility
- COGS logic
- Supabase RPC compatibility
- deployability to Vercel and Supabase Edge Functions

### 3. Prefer the simplest correct solution
Avoid over-engineering.
Avoid broad refactors unless clearly required.
Prefer narrow, intentional changes over large “cleanup” edits.

### 4. Do not claim success without evidence
Before considering a task complete:
- validate the change at the appropriate level
- summarize what changed
- summarize what was validated
- state any remaining risk or uncertainty

Never describe a change as complete based only on intuition.

### 5. Leave the repo in an intentional state
Do not leave behind:
- unrelated file edits
- accidental formatting churn
- half-finished refactors
- ambiguous migration changes
- stale generated artifacts when they should be updated

---

## Hard Safety Rules

### Never use regex-based bulk edits on `.ts` / `.tsx`
This is a hard rule.

If a batch source change is needed:
- use AST-based tooling
- or make targeted manual edits

Regex-based bulk edits can corrupt:
- JSX
- TypeScript generics
- imports
- i18n keys
- component props

Passing `tsc --noEmit` is not enough to prove correctness after structural source edits.

### Never hardcode derived business values
Especially never hardcode:
- COGS percentages
- GP assumptions
- labour ratios
- fallback sales estimates
- implicit POS mappings

Always read from the actual pipeline or a documented contract.

### Never break demo mode
Demo mode is a first-class product surface and sales tool.
A change that works only for real data but breaks demo is not acceptable unless the task explicitly targets demo replacement.

### Never assume materialized views are fresh
Matviews (`*_mv`) may be stale.
Analytics and RPC paths must tolerate staleness and fall back when required.

### Never expose or embed secrets in versioned files
Do not place secrets in:
- `.claude/hooks/*`
- scripts
- source files
- committed `.env*` files
- docs
- examples with live credentials

If you detect a real secret in the repo:
1. treat it as a priority issue
2. remove it from code or scripts
3. recommend rotation
4. avoid propagating it further

### Never auto-authenticate external CLIs from a repo hook
Do not store or inject GitHub tokens, Supabase tokens, or service credentials inside project hooks.

---

## Source of Truth Order

When sources disagree, trust them in this order:

1. current code paths in use
2. current database migrations
3. generated Supabase types  
   `src/integrations/supabase/types.ts`
4. tests and contract checks  
   especially `src/data/__tests__/rpc-contracts.test.ts`
5. generated catalogs / structured docs  
   e.g. `docs/rpc-catalog.md`
6. narrative docs
7. older notes or legacy writeups

If docs and code disagree, prefer the current code and current schema.

---

## Orchestration Rules

### Use plan mode by default for non-trivial work
Before editing, identify:
- entry points
- impacted files
- affected data dependencies
- validation strategy
- rollback or containment risk if relevant

### Use specialist passes when complexity is high
For non-trivial tasks, reason in these roles before or during execution:

#### Scout
Find:
- relevant files
- routes
- hooks
- contexts
- stores
- shared utilities
- tests
- docs already covering the area

#### Backend / Data auditor
Inspect:
- Supabase tables
- views
- RPCs
- migrations
- generated types
- edge functions
- data contracts

#### UI / Flow auditor
Inspect:
- pages
- component trees
- state transitions
- guarded routes
- demo vs real mode behavior
- role-based visibility

#### Test validator
Decide the minimum credible validation:
- lint
- build
- typecheck
- contract test
- demo verification
- migration lint
- Playwright
- manual browser verification

#### Elegance reviewer
Before closing:
- simplify if possible
- remove unnecessary churn
- ensure the solution fits existing patterns
- avoid ugly patches when a small clean fix exists

### Prefer narrow edits
Avoid touching unrelated files.
Avoid mixing bug fixes with broad refactors.
Avoid introducing new abstractions unless they clearly reduce risk or repetition.

---

## Definition of Done

A task is only done when all of the following are true:

1. the requested change is implemented
2. the relevant risk-based validation has been run
3. the result matches the architecture and product rules in this file
4. demo mode is not accidentally broken
5. no unrelated files are left in a dirty state
6. any required documentation or generated artifact has been updated
7. known remaining risks are clearly stated if anything is still uncertain

---

## Validation Matrix

Use the smallest reliable validation that matches the risk.

### UI-only copy or small presentational change
Usually validate with:
- manual browser verification
- `npm run build` if the route or import graph changed

### Component logic / hooks / state changes
Usually validate with:
- `npm run lint`
- `npx tsc --noEmit`
- targeted tests if available
- manual browser verification for the affected flow

### Data-layer / analytics / RPC / typed contracts
Usually validate with:
- `npx tsc --noEmit`
- `npx vitest run src/data/__tests__/rpc-contracts.test.ts`
- any relevant targeted tests in `src/data/__tests__/*`

### Migration changes
Usually validate with:
- `npm run db:lint`
- `node scripts/validate-migration.mjs path/to/migration.sql` for the specific file when needed
- schema review for destructive operations
- confirm impact on generated types and contracts

### Demo data / demo behavior changes
Usually validate with:
- `npm run demo:verify`
- manual demo-mode browser verification

### Route / auth / guarded navigation changes
Usually validate with:
- `npm run build`
- `npx tsc --noEmit`
- manual verification of route access and redirects

### End-to-end critical flows
Use Playwright when the change affects:
- auth flows
- POS integration flows
- critical dashboard journeys
- demo walkthroughs
- regressions that require browser proof

Default e2e entrypoint:
- `npm run test:e2e`

### Important note
Passing lint, typecheck, or build does not prove the UX is correct.
If the user-facing behavior matters, verify in browser.

---

## Testing Rules

### Primary commands available in this repo
- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm test`
- `npm run demo:verify`
- `npm run db:lint`
- `npm run docs:rpcs`
- `npm run i18n:sync`
- `npm run i18n:audit`
- `npm run test:e2e`

### Type safety and CI reality
CI currently enforces:
- `npx tsc --noEmit`
- `npx vitest run src/data/__tests__/rpc-contracts.test.ts`
- migration lint on recent migrations

Do not rely only on local heuristics if your change affects contracts or schema.

### Playwright configuration quirk
This repo contains two Playwright configs:

- root `playwright.config.ts`  
  uses `./e2e`
- `e2e/playwright.config.ts`  
  uses `./tests`

Default repo command:
- `npm run test:e2e` → `npx playwright test`

Prefer the root config unless the task explicitly targets the alternate setup.
Do not assume both suites are equivalent.

---

## Git and Deployment Rules

### Git
- prefer small, coherent commits
- keep commit scope intentional
- do not leave unrelated edits behind
- do not describe work as complete if the repo state is ambiguous

### Push policy
Do not push blindly.
Push only after validation appropriate to the risk of the change.

### Main branch awareness
This repo is operationally oriented around direct work to `main`, and pushes to `main` have real consequences:
- Vercel production auto-deploys on push to `main`
- Edge Functions deploy workflow triggers on pushes affecting `supabase/functions/**`

Because of this:
- validate first
- push second
- never treat `main` as a scratchpad

### Vercel
Production domains:
- `www.josephine-ai.com`
- `josephine-ai.com`

A push to `main` can create a production deployment.
Treat UI, routing, auth, and environment-sensitive changes accordingly.

---

## Database Rules

### General workflow
For schema changes:
1. create a migration in `supabase/migrations/YYYYMMDDHHMMSS_description.sql`
2. review the change carefully
3. lint the migration
4. apply only when the task explicitly requires it
5. validate downstream effects on types, contracts, and frontend usage

### Do not apply schema changes blindly
Commands like:
- `npx supabase db push`
- migration runners
- repair scripts
- seed scripts

must not be run automatically without understanding:
- target environment
- blast radius
- reversibility
- shared-environment risk

### Function replacement
If replacing a Postgres function and signature conflicts are possible:
- use `DROP FUNCTION IF EXISTS` before `CREATE OR REPLACE`

### Destructive operations
Before any destructive or irreversible SQL:
- identify the target object
- explain the impact
- prefer additive migrations when possible

### Type generation
If schema changes affect frontend types, regenerate:
- `npm run db:types`

Do not assume generated types remain valid after schema changes.

---

## Environment Safety

Treat environments as potentially sensitive.

### Safe by default
Safe-ish local developer actions usually include:
- reading code
- reading docs
- running lint
- running build
- running typecheck
- running non-destructive tests

### Higher-risk actions
These require extra caution:
- running migrations
- seed scripts
- repair scripts
- scripts that write with service-role privileges
- realtime simulators
- ETL or sync functions
- remote database writes
- edge-function deploys

### If the target environment is unclear
Do not run write operations blindly.
State the uncertainty and prefer review-first behavior.

---

## Secrets and Credentials

### Rules
- **Demo org:** `7bca34d5-4448-40b8-bb7f-55f1417aeccd`
- **Demo login:** See `.env.local` (`DEMO_EMAIL` / `DEMO_PASSWORD`)
- **All secrets** are in `.env.local` (gitignored) — **never hardcode credentials in this file**
- never commit secrets
- never place live credentials in hooks
- never create `.env.local` with hardcoded real keys from a versioned script
- never authenticate `gh` or other CLIs from committed hooks
- never echo tokens into commands from repo-managed scripts

### Current repo caution
There is a session hook under `.claude/hooks/session-start.sh`.
Treat hooks as sensitive automation surfaces.
They must not become secret distribution mechanisms.

### Expected pattern
Secrets belong in:
- local environment variables
- secure secret managers
- platform-managed environment settings

Not in source-controlled automation.

---

## Project Structure

```text
src/
  components/        # Feature-organized React components
    ui/              # shadcn/ui primitives
    layout/          # Layout surfaces
    [feature]/       # Domain components
  contexts/          # AuthContext, AppContext, DemoModeContext
  data/              # Data layer, contracts, typed RPC access, tests
  hooks/             # Domain hooks
  pages/             # Route-level pages
  stores/            # Zustand stores
  lib/               # Utilities
  integrations/      # Supabase client + generated DB types
  i18n/              # Locale files and config
  types/             # Shared TS types

supabase/
  functions/         # Edge Functions
  migrations/        # Database migrations

docs/
  DB/app contracts, KPI docs, data-layer docs, RPC catalog, demo docs

mcp/
  josephine-mcp/     # Internal MCP server for operational tools
  
  ## Final Reminder

Good work in this repo means:
- understanding before editing
- protecting demo, auth, and data contracts
- validating according to risk
- avoiding secret leakage
- keeping changes narrow and intentional
- preferring correctness over speed theater