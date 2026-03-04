---
description: Always commit and push changes after completing work
---

# 🚀 End-of-Session Pipeline (MANDATORY)

**This workflow MUST be executed at the END of EVERY conversation where code or DB was changed.**
**No exceptions. No "I'll do it next time." Run this EVERY SINGLE TIME.**

// turbo-all

## Step 1: TypeScript — zero tolerance for errors
```bash
npx tsc --noEmit
```
If errors → fix ALL of them before continuing.

## Step 2: Contract Tests — verify RPC schemas match
```bash
npx vitest run src/data/__tests__/rpc-contracts.test.ts
```
If failures → update `src/data/rpc-contracts.ts` to match SQL changes.

## Step 3: Migration Lint — no orphan DROPs
```bash
npm run db:lint
```
If failures → add matching `CREATE OR REPLACE` in the same migration file.

## Step 4: Full Test Suite
```bash
npm run test
```
Ignore pre-existing `inventory.test.ts` failures. All other tests must pass.

## Step 5: Stage all changes
```bash
git add -A
```

## Step 6: Commit with conventional commit format
```bash
git commit -m "type: short description"
```
Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`

## Step 7: Push to GitHub main
```bash
git push origin main
```

## Step 8: Push DB migrations (if any .sql files changed)
```bash
npx supabase db push
```
If this fails with "Remote migration versions not found", run:
```bash
npx supabase migration repair --status reverted <VERSION>
```
for each orphaned version, then retry `db push`.

## Step 9: Browse the live app to verify
- Go to https://www.josephine-ai.com
- Login as Owner
- Check that the affected pages show real data
- Take a screenshot as proof

> **REMEMBER**: Steps 1-4 are SAFETY GATES. If ANY gate fails, DO NOT push.
> Fix the issue first, then re-run all gates from the top.
