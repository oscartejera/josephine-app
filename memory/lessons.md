# Lessons Learned — Josephine App

> Compressed reference. All lessons preserved, grouped by category.

---

## CI/CD — Codemagic + iOS

### Golden step order for Capacitor 8 + iOS + TestFlight
1. `npm ci` → 2. `npm run build` → 3. `cap add ios` (if missing) + `cap sync ios` → 4. `xcodebuild -resolvePackageDependencies` (SPM, NOT CocoaPods) → 5. `keychain initialize` → 6. `app-store-connect fetch-signing-files "$BUNDLE_ID" --type IOS_APP_STORE --create` → 7. `keychain add-certificates` → 8. Patch project.pbxproj (bundle ID, ProvisioningStyle=Manual, team ID) → 9. Patch Info.plist (version + build number) → 10. `xcodebuild archive` (manual signing flags) → 11. Create ExportOptions.plist + `xcodebuild -exportArchive` → 12. `xcrun altool --upload-package` (NOT `--upload-app`)

### Build numbers
- **Never use `app-store-connect get-latest-testflight-build-number`** — has eventual consistency, returns stale values. Use Codemagic's `$BUILD_NUMBER` env var instead.
- **XcodeGen:** Build number must be set in `project.yml` BEFORE `xcodegen generate`. Target-level settings override CLI args. Patch with `sed` first.
- **Regex:** Use `grep -Eo '[0-9]+' | sort -n | tail -1` to extract numbers — never assume number is on its own line.

### Signing
- **`app-store-connect fetch-signing-files --create`** is the simplest approach — auto-creates cert + profile. Replaces ~30 lines of manual keychain scripting.
- Xcode project must be patched to **Manual signing** in CI (`ProvisioningStyle = Manual`, `CODE_SIGN_STYLE = Manual`, `DEVELOPMENT_TEAM`). Both pbxproj patch AND xcodebuild arguments needed.
- Apple signing certificates require the **.p12** (cert + private key), not just the `.cer`.
- Bundle ID in Xcode project must match provisioning profile's app ID.
- ExportOptions.plist must reference the correct profile name and method.

### SPM vs CocoaPods
- Capacitor 6+ uses **Swift Package Manager**, NOT CocoaPods. No `Podfile` or `.xcworkspace`.
- Use `-project .xcodeproj` not `-workspace .xcworkspace`.
- Resolve SPM deps with `xcodebuild -resolvePackageDependencies`.

### Upload to App Store Connect
- **Use `xcrun altool --upload-package`** with explicit `--apple-id`, NOT `--upload-app` (which fails for new apps with "Cannot determine Apple ID").
- `app-store-connect publish` wraps `--upload-app` internally — same bug.
- API key file must be at `~/.private_keys/AuthKey_KEYID.p8`.
- App must be created in App Store Connect before first upload.

### Misc Codemagic
- **Node version:** Must match Capacitor CLI requirements (Capacitor 8+ → Node ≥22).
- `cap sync` fails if `cap add ios` was never run — check `ios/` dir first.
- **Use `npm ci`** not `npm install` in CI — deterministic, faster.
- Capacitor uses scheme **"App"** and IPA is named **"App.ipa"**.
- Select **Xcode version** explicitly (`xcode: latest` in environment).
- **Secrets** go in Codemagic environment groups, never in YAML `vars:`.
- Info.plist may be empty from `cap add` — inject `CFBundleVersion` + `CFBundleShortVersionString` with `plutil`.
- Set `ITSAppUsesNonExemptEncryption = false` in Info.plist to skip export compliance prompt (valid for HTTPS-only apps).

---

## Supabase

### Database
- **`CREATE TABLE IF NOT EXISTS` silently skips** when remote table has incompatible schema. Use `DROP TABLE IF EXISTS ... CASCADE` then `CREATE TABLE` if schema may differ.
- **RLS: NEVER use self-referencing queries** in RLS policies (e.g., `SELECT FROM roles` in a policy on `roles`). Causes infinite recursion. Use JWT claims, `SECURITY DEFINER` functions, or separate permissions table.

### Edge Functions
- **JWT gateway rejects tokens** when `supabase/config.toml` is missing or lacks correct `project_id`. Error says "Invalid JWT" but real problem is config.
- `supabase.auth.admin.inviteUserByEmail()` fails silently without SMTP — use `createUser()` with temp password instead.
- GitHub Actions deploy needs `SUPABASE_ACCESS_TOKEN` as a repo secret.
- Always verify **project-ref** before deploying (`qixipveebfhurbarksib`). Extract from `VITE_SUPABASE_URL`.
- Access tokens expire — rotate and update `.env.local` when deploys fail with auth errors.

### Running SQL (project: "No hay cerditos", ref: `qixipveebfhurbarksib`)
- **SQL Editor (preferred for ad-hoc):** `https://supabase.com/dashboard/project/qixipveebfhurbarksib/sql/new`
- **CLI (`supabase db push`):** Load password first: `$env:SUPABASE_DB_PASSWORD = (Select-String -Path .env.local -Pattern '^SUPABASE_DB_PASSWORD=(.+)$' | ForEach-Object { $_.Matches.Groups[1].Value })`
- CLI reads `SUPABASE_DB_PASSWORD` from **shell env**, not `.env.local`.

---

## Data / DB / Analytics

- **Seed data with absolute dates expires silently.** Use rolling `CURRENT_DATE` offsets or reseed on schedule. Never seed with fixed absolute dates.
- **Seed function must write to the table the dashboard actually reads.** Trace the full read path from UI → RPC → table before seeding.
- **Default date range should be `'7d'`** not `'today'` — ensures data is visible even if today's data is missing.
- **Materialized views can be stale** — treat `*_mv` as potentially stale, add fallback logic where freshness matters.
- **`src/data/*` is a contract surface** — changes affect many screens. Validate typed shapes, RPC compatibility, and downstream consumers.
- **TypeScript types must match DB column nullability.** Every nullable column → `field?: type | null`. Crashes at runtime otherwise.

---

## iOS / Swift

- **`CLLocationManagerDelegate` methods must be `nonisolated`** on `@MainActor` classes when `SWIFT_STRICT_CONCURRENCY: complete`. Use `MainActor.assumeIsolated { }` inside.
- **`Localizable.strings` must stay in sync** with SwiftUI views. After refactors, grep for orphaned keys and remove them.

---

## Tooling / Shell

- **PowerShell does not support `&&`** — use `;` or separate commands. Always assume PowerShell 5.x.
- **Import statements** must appear at the top of the module, not inline next to call sites.
- **`safe-area-inset` CSS** requires `viewport-fit=cover` in the viewport meta tag.
- **Capacitor CLI/platform packages** belong in `devDependencies`. Only `@capacitor/core` and runtime plugins in `dependencies`.
- **Always pin major version** when installing Capacitor packages (`@capacitor/core@6`).

---

## Workflow / Scope Discipline

### MANDATORY: Commit, push, and db push after every task
After ANY task that changes files:
1. `git add` changed files
2. `git commit -m "type(scope): description"`
3. `git push origin main`
4. If SQL migrations changed: load password + `npx supabase db push`

### NEVER touch the web app when working on native-ios
- Only stage files under `native-ios/`. Never `git add .`.
- Before committing: `git diff --cached --name-status` — verify no `src/`, `public/`, or root config files staged.
- Web app = live production site (www.josephine-ai.com). Deleting it takes the site offline.

---

## Architecture / Security

- **Demo mode is a first-class product surface** — it must work, have tests, use stable seed data, and never be broken by "real mode" changes.
- **`src/hooks/useDemoMode.ts` is the single source of truth** for demo detection.
- **Root and nested Playwright configs are not interchangeable** — default to root config.
- **Secrets must never be in repo hooks or versioned scripts.** Use local env vars or secret managers. If detected, remove and rotate.
