---
description: Reglas anti-errores extraídas de memory/lessons.md — el agente las lee automáticamente para evitar errores repetidos
---

# Anti-Mistakes Rules

> Estas reglas son lecciones pasadas convertidas en guardias activas.
> El agente DEBE seguirlas sin excepción.

## PowerShell / Windows

- **NEVER** use `&&` in shell commands — PowerShell does not support it. Use `;` or separate commands.
- **NEVER** assume bash syntax. This machine runs **Windows + PowerShell 5.x**.
- **NEVER** run `xcodebuild`, `xcrun`, or any macOS-only tool — this is Windows. iOS builds run only on **Codemagic CI**.
- **ALWAYS** use `Out-File -Encoding utf8` when redirecting output to files (default is UTF-16).

## SQL Migrations

- **EVERY** `CREATE TABLE` → must use `IF NOT EXISTS`
- **EVERY** `CREATE FUNCTION/VIEW` → must use `CREATE OR REPLACE`
- **EVERY** `DROP` statement → must use `IF EXISTS`
- **EVERY** `ALTER TABLE ADD COLUMN` → must use `IF NOT EXISTS`
- **EVERY** migration touching functions/views → must end with `NOTIFY pgrst, 'reload schema';`
- **NEVER** save SQL files with UTF-8 BOM encoding
- **NEVER** create a migration without running `npm run db:lint` on it

## Data Layer

- **NEVER** seed data with absolute/hardcoded dates — use `CURRENT_DATE ± interval`
- **NEVER** change `src/data/*` without checking all downstream consumers (hooks, pages)
- **ALWAYS** run `npm run db:types` after any migration that changes schema
- **ALWAYS** verify demo mode still works after data layer changes (`npm run demo:verify`)
- **NEVER** assume materialized views (`*_mv`) are fresh — add fallback logic

## iOS / Swift

- **NEVER** access `PlannedShift` optional fields directly — use safe accessors (`safeRole`, `safeStartTime`, etc.)
- **NEVER** try to build iOS locally — push to main and verify on Codemagic
- **ALWAYS** use `@preconcurrency import Supabase` and `@Sendable` closures for archive builds
- **ALWAYS** make `CLLocationManagerDelegate` methods `nonisolated` on `@MainActor` classes

## Git / Deploy

- **NEVER** use `git push --force`
- **NEVER** commit secrets, `.env.local`, or live credentials
- **NEVER** leave unpushed commits — push immediately after commit
- **NEVER** stage files outside `native-ios/` when working on iOS tasks
- **ALWAYS** run `npm run preflight` (or at minimum `npx tsc --noEmit`) before pushing
- **ALWAYS** use conventional commits: `type(scope): description`

## React / TypeScript

- **NEVER** use `any` — use `unknown` or proper generics
- **NEVER** use regex-based bulk edits on `.ts`/`.tsx` files — use AST tooling or targeted edits
- **NEVER** hardcode COGS percentages, GP assumptions, or labour ratios
- **ALWAYS** match TypeScript types to DB column nullability (nullable column → `field?: type | null`)
