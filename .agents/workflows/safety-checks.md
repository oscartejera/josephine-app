---
description: Mandatory safety checks after any code or DB change
---

# Post-Change Safety Protocol

**This workflow MUST be followed after EVERY change to the codebase or database.**
**It is automatically included as Steps 1-4 of the /commit-push workflow.**

// turbo-all

## 1. TypeScript Build Check
```bash
npx tsc --noEmit
```
If this fails, fix ALL type errors before proceeding.

## 2. Contract Tests
```bash
npx vitest run src/data/__tests__/rpc-contracts.test.ts
```
If a schema test fails, the RPC response shape changed. Update `src/data/rpc-contracts.ts` to match.

## 3. Migration Lint (if any .sql changed)
```bash
npm run db:lint
```
If an orphan `DROP FUNCTION` is detected, add a matching `CREATE OR REPLACE` in the same file.

## 4. Full Test Suite
```bash
npm run test
```
Ignore pre-existing failures in `inventory.test.ts`. All other tests must pass.

## 5. If an RPC was changed: verify in browser
- Login via https://www.josephine-ai.com → Owner button
- Navigate to the affected Insight page
- Confirm KPIs show non-zero real data
- Take a screenshot for proof

## When to update `rpc-contracts.ts`
- Any time a SQL RPC return field is renamed, added, or removed
- The Zod schema in `rpc-contracts.ts` must match the SQL `RETURNS` shape exactly
- Run contract tests after updating to verify

## When to update `database-views.ts`
- Any time a view column is added, removed, or renamed
- The TypeScript type in `database-views.ts` must match the view shape
- Run `tsc --noEmit` after updating to verify
