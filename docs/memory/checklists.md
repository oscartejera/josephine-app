# Validation Checklists

This file contains reusable validation checklists for common change types in the Josephine repo.

Use the smallest checklist that credibly validates the risk.
Do not over-test trivial changes.
Do not under-test fragile ones.

---

## How to use this file

1. Identify the type of change.
2. Use the matching checklist.
3. Mark what was actually validated.
4. Record anything intentionally skipped.
5. If a new failure pattern appears, add a lesson to `memory/lessons.md`.

---

## Universal Pre-Edit Checklist

Use this before non-trivial work.

- [ ] I understand the user request.
- [ ] I identified the affected layers.
- [ ] I identified likely files or entry points.
- [ ] I checked whether `demo mode`, `auth`, `routing`, `src/data/*`, or `Supabase` are involved.
- [ ] I chose a minimum credible validation strategy.
- [ ] I know what I will avoid changing unless necessary.

---

## UI-Only Change Checklist

Use for: text changes, spacing/layout tweaks, small presentational adjustments, icon or label changes.

### Before editing
- [ ] Confirm the change is truly UI-only.
- [ ] Check whether the affected string should use i18n.

### Validation
- [ ] Manual browser verification on the affected screen
- [ ] `npm run build` if route/import graph changed
- [ ] Verify visual result is correct
- [ ] Verify no obvious layout breakage on nearby elements

---

## UI + State / Hook Logic Checklist

Use for: component behavior changes, hook updates, local state or derived state changes, filter/sort interactions.

### Before editing
- [ ] Identify the owning page/component/hook
- [ ] Check whether the logic differs in demo vs real mode
- [ ] Check whether RBAC or location scope is involved

### Validation
- [ ] `npm run lint`
- [ ] `npx tsc --noEmit`
- [ ] Manual verification of the affected flow
- [ ] Targeted tests if available and relevant

---

## Routing / Navigation Checklist

Use for: new routes, redirects, route guards, layout routing, sidebar / navigation changes.

### Before editing
- [ ] Identify which routes are affected
- [ ] Check whether auth or RBAC gate the route
- [ ] Check whether demo mode changes the route behavior

### Validation
- [ ] `npm run build`
- [ ] `npx tsc --noEmit`
- [ ] Manual route verification
- [ ] Manual redirect / not-found / protected-route verification

---

## Auth / RBAC Checklist

Use for: login/logout changes, guarded routes, permission checks, role-based UI visibility.

### Before editing
- [ ] Identify affected roles
- [ ] Identify affected route/page/action
- [ ] Check whether demo mode bypasses or simulates auth behavior

### Validation
- [ ] `npm run build`
- [ ] `npx tsc --noEmit`
- [ ] Manual verification of allowed and disallowed paths
- [ ] Manual verification of role/location-specific behavior

---

## Data Layer / RPC / Contract Checklist

Use for: changes in `src/data/*`, RPC result shape changes, query client changes, dashboard/KPI contract updates.

### Before editing
- [ ] Identify the contract boundary being changed
- [ ] Identify all downstream consumers
- [ ] Check whether generated Supabase types are involved
- [ ] Check whether docs or catalogs depend on this contract

### Validation
- [ ] `npx tsc --noEmit`
- [ ] `npx vitest run src/data/__tests__/rpc-contracts.test.ts`
- [ ] Additional targeted tests if applicable
- [ ] Manual verification of the affected screen(s)
- [ ] Verify demo mode is not accidentally broken

---

## Demo Mode Checklist

Use for: changes that affect demo mode explicitly, surfaces that exist in both modes, dashboard or product-tour changes.

### Before editing
- [ ] Identify whether the affected surface exists in both modes
- [ ] Identify branching logic between demo and real mode

### Validation
- [ ] `npm run demo:verify`
- [ ] Manual verification in demo mode
- [ ] Manual verification in real mode when relevant

---

## Migration / Database Checklist

Use for: schema changes, function changes, new migrations, SQL fixes.

### Before editing
- [ ] Confirm the migration is necessary
- [ ] Identify blast radius and reversibility
- [ ] Check whether generated types will change
- [ ] Check whether docs or RPC consumers will be affected

### Validation
- [ ] `npm run db:lint`
- [ ] Review migration carefully for destructive operations
- [ ] Regenerate types if required with `npm run db:types`
- [ ] Verify frontend/data contract compatibility after schema changes

---

## Edge Function Checklist

Use for: edits under `supabase/functions/*`, API behavior changes, ETL / sync / AI function changes.

### Before editing
- [ ] Identify environment variables used
- [ ] Identify whether service-role access is involved
- [ ] Identify downstream callers

### Validation
- [ ] Lint/type validation where applicable
- [ ] No secret leakage introduced
- [ ] Downstream consumer assumptions verified

---

## i18n Checklist

Use for: translation key additions, locale structure changes, user-facing copy migrations.

### Before editing
- [ ] Confirm the string belongs in i18n
- [ ] Identify affected locale files
- [ ] Avoid regex-based bulk edits on `.ts` / `.tsx`

### Validation
- [ ] `npm run i18n:sync` when needed
- [ ] `npx tsc --noEmit`
- [ ] Manual browser verification of affected strings

---

## Security / Secrets Checklist

Use for: hooks, env handling, scripts with credentials, service-role access.

### Validation
- [ ] No live credentials added to source-controlled files
- [ ] No CLI auth token injected from a hook
- [ ] No `.env.local` with real secrets produced by a committed script
- [ ] Service-role usage is intentional and minimized

---

## Search Before Creating Checklist

Use before creating a new helper, hook, utility, script, or doc.

- [ ] I searched `src/lib`, `src/hooks`, `src/data`, `scripts/`, `tools/`
- [ ] I checked similar pages/components
- [ ] I confirmed this is not duplicating an existing pattern

---

## Final Closeout Checklist

Use before describing a task as complete.

- [ ] The requested change is implemented
- [ ] Validation matched the risk
- [ ] Demo mode was considered
- [ ] Auth / routing / data contract surfaces were considered where relevant
- [ ] No unrelated files remain dirty
- [ ] Required docs or generated artifacts were updated
- [ ] Remaining uncertainty, if any, is explicitly stated
