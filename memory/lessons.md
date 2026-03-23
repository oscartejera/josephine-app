# Project Lessons

This file captures hard-won technical lessons from bugs, regressions, fragile fixes, and architectural surprises.

Use this file to avoid paying twice for the same mistake.

## How to use this file

Add a new entry when:
- a bug reveals a reusable pattern
- a regression exposes a fragile surface
- a fix required non-obvious validation
- code, schema, or tooling drift caused confusion
- a repo-specific gotcha should be remembered

Each entry should be:
- specific
- technical
- actionable
- tied to a prevention rule
- tied to a validation method

---

## Entry Template

### <Lesson Title>

**Date:** YYYY-MM-DD
**Area:** <UI / Data / Auth / Demo / DB / i18n / Edge Functions / Tooling / Testing>
**Root cause:** <short explanation>
**What failed:** <short explanation>
**Prevention:** <specific rule>
**Validation:** <specific checks>
**Notes:** <optional concise note>

---

## Seed Lessons

### Regex bulk edits corrupted TypeScript / JSX structure

**Date:** 2026-03-18
**Area:** i18n / Tooling
**Root cause:** Regex-based bulk edits were used on `.ts` / `.tsx` files during a large-scale i18n migration.
**What failed:** Regex could not safely distinguish JSX tags, TypeScript generics, imports, and user-facing string replacements, creating structural corruption that was not reliably caught by basic checks.
**Prevention:** Never use regex-based bulk edits on `.ts` or `.tsx` for structural or large-scale source changes. Use AST-based tools or targeted manual edits.
**Validation:** `npx tsc --noEmit`, `npm run build`, and browser verification on affected flows.
**Notes:** Passing typecheck alone is not enough when UI structure may have been altered.

### Missing provider normalization can make valid POS data invisible

**Date:** 2026-03-18
**Area:** Data / Integrations
**Root cause:** Frontend logic depends on normalized provider-specific `data_source` values.
**What failed:** If a new POS provider is added and `normaliseDataSource()` is not updated, valid POS-backed data may be treated as non-POS data and appear missing in the UI.
**Prevention:** Every new POS integration must update `normaliseDataSource()` in `src/data/client.ts` and validate downstream dashboard behavior.
**Validation:** Verify affected analytics, KPI cards, and data-backed screens with the new provider path.
**Notes:** This is a repo-specific gotcha and should always be checked during integration work.

### Demo mode and real mode can silently diverge

**Date:** 2026-03-18
**Area:** Demo / UI / Data
**Root cause:** Some features or fixes are implemented only against real Supabase-backed data paths without verifying demo-mode branches.
**What failed:** The product appeared correct in real mode but demo mode regressed, which is especially harmful because demo mode is a primary sales surface.
**Prevention:** Any change touching dashboards, flows, or data surfaces must consider both real mode and demo mode unless the task explicitly targets only one mode.
**Validation:** `npm run demo:verify` plus manual verification of the affected flow in demo mode.
**Notes:** Demo mode is not a fallback; it is a first-class product surface.

### Materialized views can be stale and should not be treated as guaranteed fresh

**Date:** 2026-03-18
**Area:** Data / Analytics
**Root cause:** Some analytics paths assume materialized views are fresh at read time.
**What failed:** KPIs or derived analytics can lag behind reality if the path relies only on stale matviews without fallback logic.
**Prevention:** Treat `*_mv` as potentially stale and prefer resilient access paths or fallback logic where freshness matters.
**Validation:** Review query path, RPC behavior, and fallback logic for affected metrics.
**Notes:** This matters most in KPI, reporting, and operational dashboard flows.

### Secrets must never be distributed through repo hooks or versioned scripts

**Date:** 2026-03-18
**Area:** Security / Tooling
**Root cause:** Hooks or helper scripts can become a channel for distributing live credentials if they create env files or inject tokens.
**What failed:** A session hook can accidentally expose Supabase or GitHub credentials and normalize insecure behavior.
**Prevention:** Never place live credentials in `.claude/hooks/*`, scripts, committed examples, or versioned `.env*` files. Use local environment variables or secure secret managers.
**Validation:** Review hooks and scripts for hardcoded credentials, token writes, CLI auth injection, and service-role usage.
**Notes:** If a real secret is detected in repo code, remove it and rotate it.

### Root and nested Playwright configs are not interchangeable

**Date:** 2026-03-18
**Area:** Testing / Tooling
**Root cause:** The repo contains two Playwright configurations with different test directory assumptions.
**What failed:** A contributor can run the wrong E2E suite or assume both configs cover the same behavior.
**Prevention:** Default to the root Playwright setup unless the task explicitly targets the alternate one. Document which suite is being used.
**Validation:** Confirm which config is active and run `npm run test:e2e` unless there is a deliberate reason to target the alternate config.
**Notes:** Avoid assuming E2E coverage from one config applies to the other.

### `src/data/*` is a contract surface, not just a helper layer

**Date:** 2026-03-18
**Area:** Data / Frontend contracts
**Root cause:** Changes in `src/data/*` can look local but actually affect many screens and typed assumptions.
**What failed:** Frontend pages, hooks, KPIs, and tests can break when data-layer contract shapes change without corresponding validation.
**Prevention:** Treat `src/data/*` as a contract boundary. Validate typed shapes, RPC compatibility, and downstream consumers before closing changes.
**Validation:** `npx tsc --noEmit`, `npx vitest run src/data/__tests__/rpc-contracts.test.ts`, and targeted UI verification.
**Notes:** Small data-layer edits can have broad product impact.

---

## New Entries

Add new lessons below this line using the template above.

### Seed data using absolute dates expires silently

**Date:** 2026-03-18
**Area:** Demo / DB
**Root cause:** The baseline migration seeded `daily_sales` with `CURRENT_DATE - 30 to +7` evaluated once at migration time. After ~37 days the data fell outside all valid query ranges.
**What failed:** All dashboard KPIs showed zero because `sales_daily_unified` and `rpc_kpi_range_summary` found no rows within the selected date range.
**Prevention:** All seed/demo data must use rolling `CURRENT_DATE` offsets or be regenerated on a schedule. Never seed demo tables with fixed absolute dates. Prefer cron-based reseed or wide windows (≥90 days).
**Validation:** `SELECT count(*) FROM daily_sales WHERE day >= CURRENT_DATE - 7;` must return >0 for each active location.
**Notes:** This affected `daily_sales`, `budget_days`, `forecast_daily_metrics`, and `planned_shifts` simultaneously.

### Seed function must write to the table the dashboard actually reads

**Date:** 2026-03-18
**Area:** Data / Edge Functions
**Root cause:** `seed_josephine_demo` wrote granular 15-min data to `facts_sales_15m`, but the dashboard pipeline reads from `daily_sales` via `sales_daily_unified` → `rpc_kpi_range_summary`.
**What failed:** Even after re-running the seed function, dashboard KPIs remained zero because the data landed in a table nothing reads from for KPI display.
**Prevention:** Before writing seed data, trace the full read path from the UI component back to the source table. Confirm the seed target is the same table the UI queries. Document the pipeline in `docs/data-pipeline.md`.
**Validation:** After seeding, query the exact RPC/view the dashboard uses (e.g. `SELECT * FROM sales_daily_unified WHERE day = CURRENT_DATE LIMIT 1`) and confirm rows exist.
**Notes:** `facts_sales_15m` is only used by granular intra-day analytics, not the main dashboard KPIs.

### Default date range should not require exact-day data match

**Date:** 2026-03-18
**Area:** UI / Data
**Root cause:** Default `dateRange` was `'today'`, which requires seed data for exactly today's date. If the seed window doesn't include today (or data hasn't been ingested yet), the dashboard shows nothing.
**What failed:** New users and demos saw all-zero KPIs on first load because demo data didn't always cover `CURRENT_DATE`.
**Prevention:** Default date range should be `'7d'` (or wider) so there's always some data visible even if today's data is missing. Reserve `'today'` for users who explicitly select it.
**Validation:** Load the dashboard with a fresh session and confirm KPIs are non-zero without changing the date picker.
**Notes:** This is especially important for demo/sales contexts where first impression matters.

### Supabase CLI reads SUPABASE_DB_PASSWORD from shell env, not .env.local

**Date:** 2026-03-18
**Area:** Tooling / DB
**Root cause:** `npx supabase db push` requires `SUPABASE_DB_PASSWORD` as a **shell environment variable**. Adding it to `.env.local` is not enough because `.env.local` is for Next.js/Vite, not for CLI tools.
**What failed:** `supabase db push` returned 401 even after the password was in `.env.local`. The CLI also needs a valid `SUPABASE_ACCESS_TOKEN` or must load the password into the shell via `$env:SUPABASE_DB_PASSWORD = ...` before running.
**Prevention:** When running `supabase db push`, always load the password into the shell first: `$env:SUPABASE_DB_PASSWORD = (Select-String -Path .env.local -Pattern '^SUPABASE_DB_PASSWORD=(.+)$' | ForEach-Object { $_.Matches.Groups[1].Value }); npx supabase db push`
**Validation:** `npx supabase db push` returns `Remote database is up to date` without 401 errors.
**Notes:** The `--db-url` flag is an alternative but requires the correct direct host format: `postgresql://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres`.

### Capacitor CLI and platform packages belong in devDependencies

**Date:** 2026-03-19
**Area:** Tooling
**Root cause:** `npm install @capacitor/cli @capacitor/android @capacitor/ios` placed all three in `dependencies` by default. No manual correction was made during the Capacitor setup.
**What failed:** Build-time-only packages (`@capacitor/cli`, `@capacitor/android`, `@capacitor/ios`) were listed in `dependencies`, bloating the production dependency tree and sending the wrong signal about what the app actually imports at runtime.
**Prevention:** After installing Capacitor packages, always move CLI tools and native platform packages to `devDependencies`. Only `@capacitor/core` and the plugin APIs the app imports at runtime (`@capacitor/app`, `@capacitor/status-bar`, etc.) belong in `dependencies`.
**Validation:** `grep -c '"@capacitor/cli"' package.json` should only match inside `devDependencies`. Same for `@capacitor/android` and `@capacitor/ios`.
**Notes:** `npm install --save-dev` would have placed them correctly from the start.

### Always pin major version when installing Capacitor packages

**Date:** 2026-03-19
**Area:** Tooling
**Root cause:** The implementation plan specified Capacitor 6, but the install command used `@capacitor/core` without `@6`, so npm resolved the latest (v8.2.0).
**What failed:** The installed version didn't match the plan. While v8 works fine for this project, the version mismatch could cause confusion or compatibility issues if someone follows the plan as spec'd.
**Prevention:** Always pin the major version in the install command: `npm install @capacitor/core@6 @capacitor/cli@6`. Before installing, check if any Capacitor packages are already installed (`grep @capacitor package.json`) and match the existing version.
**Validation:** `npx cap --version` should return the expected major version. `cat package.json | grep @capacitor` should show consistent versions.
**Notes:** This is a general lesson: when a plan says "version X", the install command must explicit pin `@X`.

### Import statements must appear at the top of the module, not after usage

**Date:** 2026-03-19
**Area:** Tooling / Code quality
**Root cause:** When adding the `initNativePlugins()` call to `main.tsx`, the import was written on the line immediately before the call (line 51-52) instead of at the top with other imports.
**What failed:** ES module hoisting makes it work, but the code reads as if the function is called before being imported, which is confusing to anyone reading the file. It also breaks the convention established by all other imports in the same file.
**Prevention:** Always place new imports at the top of the file with other imports. Place the function call where it needs to execute, but never place an import statement inline next to its call site.
**Validation:** Visual review — all `import` statements should be grouped at the top of each file. `eslint --rule 'import/first: error'` catches this.

### safe-area-inset CSS requires viewport-fit=cover in the viewport meta tag

**Date:** 2026-03-19
**Area:** UI / Mobile
**Root cause:** `env(safe-area-inset-*)` CSS values are only populated by the browser when the viewport meta tag includes `viewport-fit=cover`. Without it, the values are `0` and the padding has no effect.
**What failed:** Nothing failed in this case because `index.html` already had `viewport-fit=cover`. But if it hadn't been there, the safe-area padding added to `index.css` would have silently done nothing — no error, just no padding on notch devices.
**Prevention:** Before adding `env(safe-area-inset-*)` CSS, verify the viewport meta tag includes `viewport-fit=cover`. If it doesn't, add it.
**Validation:** `grep 'viewport-fit=cover' index.html` must match before safe-area CSS is considered functional.
**Notes:** This is a silent failure — the CSS is valid but ineffective without the meta tag. Always check the dependency chain.

### Codemagic: Node version must match Capacitor CLI requirements

**Date:** 2026-03-19
**Area:** CI/CD / Tooling
**Root cause:** `codemagic.yaml` specified `node: 20`, but Capacitor CLI v8 requires Node >=22.0.0.
**What failed:** The "Sync iOS platform" step failed with `[fatal] The Capacitor CLI requires NodeJS >=22.0.0`.
**Prevention:** Before setting the Node version in CI, check what the project's key tools require: `npx cap --version` and read the Capacitor docs for minimum Node version. For Capacitor 8+, always use `node: 22` or later.
**Validation:** The CI build's "Sync iOS platform" step completes without Node version errors.
**Notes:** This applies to any CI — always verify runtime version requirements of all CLI tools, not just the app framework.

### Codemagic: `cap sync` fails if `cap add ios` was never run

**Date:** 2026-03-19
**Area:** CI/CD / Tooling
**Root cause:** `npx cap sync ios` assumes the `ios/` directory already exists (i.e., the platform was added). If `ios/` is gitignored or never committed, the CI environment has no `ios/` folder.
**What failed:** "Sync iOS platform" step failed with `[error] ios platform has not been added yet`.
**Prevention:** In CI scripts, always check if the `ios/` directory exists before syncing. Use: `if [ ! -d "ios" ]; then npx cap add ios; fi` followed by `npx cap sync ios`.
**Validation:** The CI "Sync iOS platform" step creates the `ios/` folder and syncs without errors.
**Notes:** Alternatively, commit the `ios/` directory to the repo. But generating it in CI is cleaner and avoids Xcode project merge conflicts.

### Codemagic: Capacitor 8 uses Swift Package Manager, not CocoaPods

**Date:** 2026-03-19
**Area:** CI/CD / Tooling
**Root cause:** Capacitor 6+ migrated from CocoaPods to Swift Package Manager (SPM). The `ios/App/` directory generated by `cap add ios` contains `App.xcodeproj` but no `Podfile` or `App.xcworkspace`.
**What failed:** The "Install CocoaPods" step (`cd ios/App && pod install`) failed with `No 'Podfile' found in the project directory`.
**Prevention:** Check the Capacitor version (`npx cap --version`). For Capacitor 6+, do NOT use CocoaPods. Instead: (1) resolve SPM deps with `xcodebuild -resolvePackageDependencies -project App.xcodeproj -scheme "App"`, and (2) build with `-project App.xcodeproj` instead of `-workspace App.xcworkspace`.
**Validation:** CI build completes "Resolve SPM dependencies" and "Build iOS" steps without CocoaPods errors.
**Notes:** Many Capacitor tutorials online still reference CocoaPods — always verify against the actual version installed.

### Codemagic: Use `-project .xcodeproj` not `-workspace .xcworkspace` with SPM

**Date:** 2026-03-19
**Area:** CI/CD / Tooling
**Root cause:** When Capacitor uses SPM instead of CocoaPods, there is no `.xcworkspace` file — only `.xcodeproj`. Using `-workspace` in `xcodebuild` would fail because the file doesn't exist.
**What failed:** Would have failed if we hadn't caught it during the CocoaPods fix. The xcodebuild command referenced `App.xcworkspace` which doesn't exist in SPM-based projects.
**Prevention:** Match the xcodebuild flag to the dependency manager: CocoaPods → `-workspace .xcworkspace`, SPM → `-project .xcodeproj`. Check which file exists in `ios/App/` before writing the CI config.
**Validation:** `ls ios/App/*.xcodeproj` should exist. `ls ios/App/*.xcworkspace` should NOT exist for SPM projects.
**Notes:** This is a common mistake when copying CI configs from pre-Capacitor-6 tutorials.

### Codemagic: Must select Xcode version explicitly when multiple are installed

**Date:** 2026-03-22
**Area:** CI/CD / Tooling
**Root cause:** Codemagic M2 machines can have multiple Xcode versions installed. The default may not match the one expected by the project or may lack required SDKs.
**What failed:** Build could fail or use unexpected SDK versions if the wrong Xcode is active.
**Prevention:** Always include `xcode: latest` (or a specific version like `16.2`) in the `environment:` section of `codemagic.yaml`. Verify with `xcode-select -p` in the build script.
**Validation:** The build log should show the expected Xcode version in the "Preparing build machine" step.
**Notes:** Use `latest` for most projects. Pin a specific version only if the project requires it.

### Codemagic: Apple signing certificates require the private key, not just the .cer

**Date:** 2026-03-22
**Area:** CI/CD / Signing
**Root cause:** An Apple Distribution certificate `.cer` only contains the public key. Code signing requires the private key that was used to generate the original CSR (Certificate Signing Request).
**What failed:** `security find-identity -v -p codesigning` returned 0 valid identities even after importing the `.cer` because the private key was missing from the keychain.
**Prevention:** When setting up Codemagic manually (not using `app-store-connect fetch-signing-files`), you must export the certificate as a `.p12` (which bundles cert + private key) from Keychain Access on the Mac where the CSR was generated. Alternatively, use Codemagic's automatic signing with `app-store-connect fetch-signing-files` which handles everything.
**Validation:** After importing, `security find-identity -v -p codesigning` must return at least 1 valid identity with the expected team name.
**Notes:** If you've lost the private key, you must revoke the certificate and create a new one.

### Codemagic: `app-store-connect fetch-signing-files` is the simplest signing setup

**Date:** 2026-03-22
**Area:** CI/CD / Signing
**Root cause:** Manual certificate and provisioning profile management in CI is error-prone — you need the right `.p12`, password, profile UUID, and correct keychain imports.
**What failed:** Multiple manual signing attempts failed due to missing private keys, wrong profile names, and incorrect identity references.
**Prevention:** Use Codemagic's built-in `app-store-connect fetch-signing-files` command. It uses the App Store Connect API key to automatically: (1) fetch or create the distribution certificate, (2) fetch or create the provisioning profile, (3) install both into the keychain. All you need is the API key, key ID, and issuer ID as environment variables.
**Validation:** Build log shows "Fetch signing files" step completing with certificate and profile details. `xcode-project use-profiles` succeeds.
**Notes:** This replaced ~30 lines of manual keychain/signing scripting with 3 lines. Always prefer this approach.

### Codemagic: Capacitor's generated Info.plist may be empty, causing archive failure

**Date:** 2026-03-22
**Area:** CI/CD / iOS Build
**Root cause:** When `cap add ios` generates the project in CI, the `Info.plist` may be minimal or empty. `xcodebuild archive` requires `CFBundleVersion` and `CFBundleShortVersionString` to be present.
**What failed:** Archive step failed with missing bundle version errors, or the IPA had version "1.0" with build number "1" regardless of what was intended.
**Prevention:** Before archiving, inject version info into `Info.plist` using `plutil`: `plutil -replace CFBundleShortVersionString -string "1.0" ios/App/App/Info.plist` and `plutil -replace CFBundleVersion -string "$BUILD_NUMBER" ios/App/App/Info.plist`.
**Validation:** `plutil -p ios/App/App/Info.plist` shows correct `CFBundleVersion` and `CFBundleShortVersionString` values before archiving.
**Notes:** For auto-incrementing build numbers, use `app-store-connect get-latest-testflight-build-number` and add 1.

### Codemagic: Bundle ID in Xcode project must match provisioning profile's app ID

**Date:** 2026-03-22
**Area:** CI/CD / Signing
**Root cause:** Capacitor generates the Xcode project with a default bundle ID (e.g., `app.josephine.dashboard` from `capacitor.config.ts`). But the Apple provisioning profile was created for a different bundle ID (`com.josephine.team`).
**What failed:** `xcodebuild archive` failed with: `Provisioning profile has app ID "com.josephine.team" which does not match bundle identifier "app.josephine.dashboard"`.
**Prevention:** Ensure `appId` in `capacitor.config.ts` matches the bundle ID registered in your Apple Developer Portal. If they differ, patch the Xcode project's `PRODUCT_BUNDLE_IDENTIFIER` in CI before archiving: `ruby -pi -e 'gsub(/PRODUCT_BUNDLE_IDENTIFIER = .*?;/, "PRODUCT_BUNDLE_IDENTIFIER = com.josephine.team;")' ios/App/App.xcodeproj/project.pbxproj`. Also pass it as an xcodebuild parameter: `PRODUCT_BUNDLE_IDENTIFIER=$BUNDLE_ID`.
**Validation:** `grep PRODUCT_BUNDLE_IDENTIFIER ios/App/App.xcodeproj/project.pbxproj` should show the correct bundle ID before archiving.
**Notes:** The cleanest fix is to update `appId` in `capacitor.config.ts` to match the Apple bundle ID from the start.

### Codemagic: ExportOptions.plist must reference the correct profile name and method

**Date:** 2026-03-22
**Area:** CI/CD / Signing
**Root cause:** `xcodebuild -exportArchive` requires an `ExportOptions.plist` that specifies the export method, team ID, signing style, and a mapping of bundle ID to provisioning profile name.
**What failed:** If the profile name in ExportOptions.plist doesn't match the actual installed profile, export fails with signing errors.
**Prevention:** When using `app-store-connect fetch-signing-files`, capture the profile name with: `PROFILE_NAME=$(ls ~/Library/MobileDevice/Provisioning\ Profiles/*.mobileprovision | head -1 | xargs -I{} /usr/libexec/PlistBuddy -c "Print :Name" /dev/stdin 2>/dev/null || echo "")`. Use this in the ExportOptions.plist under `provisioningProfiles` dictionary.
**Validation:** The "Build and sign IPA" step produces an `App.ipa` file in the artifacts directory without signing errors.
**Notes:** `method` should be `app-store` for App Store/TestFlight distribution, `ad-hoc` for direct device installs, or `development` for debug builds.

### Codemagic: `app-store-connect publish` may fail with altool "Cannot determine the Apple ID"

**Date:** 2026-03-22
**Area:** CI/CD / Publishing
**Root cause:** Codemagic's built-in `app_store_connect:` publisher in the `publishing:` section uses Apple's `altool` internally. `altool` sometimes cannot resolve the bundle ID to the App Store Connect app record, even when the app exists and the API key has App Manager permissions.
**What failed:** `altool` returned: `Cannot determine the Apple ID from Bundle ID 'com.josephine.team' and platform 'IOS'. (12)`. The IPA was built and signed correctly but could not be uploaded.
**Prevention:** Instead of using the built-in `app_store_connect:` publisher, upload the IPA manually in the build script using `xcrun altool --upload-app`. This gives more control and better error messages. Steps: (1) Write the API key to `~/.private_keys/AuthKey_KEYID.p8`, (2) Run `xcrun altool --upload-app --type ios --file path/to/App.ipa --apiKey KEY_ID --apiIssuer ISSUER_ID`.
**Validation:** Build log shows `No errors uploading` after the xcrun altool command.
**Notes:** Remove the `app_store_connect:` section from `publishing:` when using the manual approach to avoid duplicate upload attempts.

### Codemagic: API key file must be at ~/.private_keys/AuthKey_KEYID.p8 for xcrun altool

**Date:** 2026-03-22
**Area:** CI/CD / Publishing
**Root cause:** `xcrun altool --apiKey` looks for the private key file at a specific path: `~/.private_keys/AuthKey_<KEY_ID>.p8`. If the file is not there, the command fails with authentication errors.
**What failed:** Would have failed if we hadn't created the directory and written the key file before calling altool.
**Prevention:** Before calling `xcrun altool --upload-app`, create the directory and write the key: `mkdir -p ~/.private_keys && echo "$APP_STORE_CONNECT_PRIVATE_KEY" > ~/.private_keys/AuthKey_${APP_STORE_CONNECT_KEY_IDENTIFIER}.p8`.
**Validation:** `ls ~/.private_keys/AuthKey_*.p8` should return exactly one file before calling altool.
**Notes:** The key content should be the raw `.p8` file contents (starts with `-----BEGIN PRIVATE KEY-----`).

### Codemagic: Secret variables must go in environment groups, not in YAML vars

**Date:** 2026-03-22
**Area:** CI/CD / Security
**Root cause:** The `codemagic.yaml` `vars:` section is committed to the repo and visible in the YAML file. Sensitive values (API keys, passwords, cert contents) must NOT be placed there.
**What failed:** Initially we considered putting the App Store Connect key directly in the YAML, which would have exposed it in the Git history.
**Prevention:** Create an **environment group** in the Codemagic UI (Settings → Environment variables → Add group). Put all secrets there: `APP_STORE_CONNECT_PRIVATE_KEY`, `APP_STORE_CONNECT_KEY_IDENTIFIER`, `APP_STORE_CONNECT_ISSUER_ID`, `APPLE_TEAM_ID`. Reference the group in YAML with `groups: [app_store_credentials]`. Only non-secret vars (BUNDLE_ID, APP_NAME) go in `vars:`.
**Validation:** `grep -i "private\|secret\|password\|key_id\|issuer" codemagic.yaml` should NOT return any actual credential values — only variable references like `$APP_STORE_CONNECT_PRIVATE_KEY`.
**Notes:** Codemagic encrypts group variables and they never appear in build logs. The 3 required variables for Apple API are: `APP_STORE_CONNECT_KEY_IDENTIFIER` (Key ID), `APP_STORE_CONNECT_ISSUER_ID`, and `APP_STORE_CONNECT_PRIVATE_KEY` (full .p8 content).

### Codemagic: App must be created in App Store Connect before first upload

**Date:** 2026-03-22
**Area:** CI/CD / Publishing
**Root cause:** `xcrun altool --upload-app` and Codemagic's publisher both require the app to already exist in App Store Connect with a matching bundle ID.
**What failed:** The upload failed because there was no app record in App Store Connect for `com.josephine.team`. Altool couldn't resolve the bundle ID to an Apple ID.
**Prevention:** Before the first CI build that uploads to TestFlight, manually create the app in App Store Connect: (1) Go to appstoreconnect.apple.com → My Apps → "+" → New App, (2) Set the bundle ID to match `$BUNDLE_ID` in codemagic.yaml, (3) Set name, primary language, and SKU. The app record must exist BEFORE the first upload attempt.
**Validation:** In App Store Connect, the app appears under "My Apps" with the correct bundle ID.
**Notes:** This only needs to be done once. After creation, all subsequent builds upload automatically.

### Codemagic: The golden CI step order for Capacitor 8 + iOS

**Date:** 2026-03-22
**Area:** CI/CD / Architecture
**Root cause:** Multiple build failures were caused by steps being in the wrong order or missing. The order is strict because each step depends on outputs from previous steps.
**What failed:** Various steps failed when dependencies weren't met: syncing before building web, archiving before fetching profiles, exporting without correct ExportOptions.
**Prevention:** The correct order for a Capacitor 8 + iOS + TestFlight pipeline is:
  1. `npm ci` (install Node dependencies from lockfile)
  2. `npm run build` (build web app → dist/)
  3. `cap add ios` (only if ios/ doesn't exist) + `cap sync ios`
  4. `xcodebuild -resolvePackageDependencies` (SPM, NOT CocoaPods)
  5. `keychain initialize` (prepare macOS keychain for signing)
  6. `app-store-connect fetch-signing-files` (get cert + profile)
  7. `keychain add-certificates` (install cert into keychain)
  8. Patch project.pbxproj (bundle ID, ProvisioningStyle=Manual, team ID)
  9. Patch Info.plist (version + build number)
  10. `xcodebuild archive` (with manual signing flags)
  11. Create ExportOptions.plist + `xcodebuild -exportArchive`
  12. `xcrun altool --upload-app` (upload IPA to App Store Connect)
**Validation:** All 12 steps complete green in the Codemagic build log.
**Notes:** Skipping or reordering ANY step will cause failures. This is the proven sequence.

### Codemagic: Xcode project must be patched to Manual signing in CI

**Date:** 2026-03-22
**Area:** CI/CD / Signing
**Root cause:** Capacitor generates the Xcode project with `ProvisioningStyle = Automatic` and no `DEVELOPMENT_TEAM`. CI environments don't have Xcode accounts configured, so automatic signing fails.
**What failed:** `xcodebuild archive` failed because automatic signing couldn't find a team or profile in the CI keychain.
**Prevention:** Before archiving, patch the `project.pbxproj` file using Ruby or sed to: (1) Change `ProvisioningStyle = Automatic` → `Manual`, (2) Set `DEVELOPMENT_TEAM` to the Apple Team ID, (3) Set `CODE_SIGN_STYLE = Manual`, (4) Set `DevelopmentTeam` in TargetAttributes, (5) Set `PRODUCT_BUNDLE_IDENTIFIER` to match the provisioning profile. Also pass these as xcodebuild arguments: `CODE_SIGN_STYLE=Manual PROVISIONING_PROFILE_SPECIFIER="$PROFILE_NAME" CODE_SIGN_IDENTITY="iPhone Distribution" DEVELOPMENT_TEAM="$TEAM_ID"`.
**Validation:** After patching, `grep "ProvisioningStyle" ios/App/App.xcodeproj/project.pbxproj` should show `Manual`, not `Automatic`.
**Notes:** Both the pbxproj patch AND the xcodebuild arguments are needed. The pbxproj patch alone isn't always enough.

### Codemagic: Use `agvtool` for auto-incrementing build numbers

**Date:** 2026-03-22
**Area:** CI/CD / Versioning
**Root cause:** Each TestFlight upload requires a unique, incrementing `CFBundleVersion` (build number). Hardcoding "1" means the second upload will be rejected by Apple.
**What failed:** Would have failed on the second build if we hadn't set up auto-incrementing.
**Prevention:** Use this pattern in the CI script: `LATEST=$(app-store-connect get-latest-testflight-build-number "$BUNDLE_ID" || echo 0)` then `cd ios/App && agvtool new-version -all $(($LATEST + 1))`. This queries the latest build number from TestFlight and increments by 1.
**Validation:** After running, `agvtool what-version` should show the new build number. Each successful upload should show an incrementing number in TestFlight.
**Notes:** `agvtool` modifies both `Info.plist` and the project's `CURRENT_PROJECT_VERSION`. It requires `Versioning System = Apple Generic` in the Xcode project (Capacitor sets this by default).

### Codemagic: Use `npm ci` not `npm install` in CI

**Date:** 2026-03-22
**Area:** CI/CD / Tooling
**Root cause:** `npm install` can modify `package-lock.json` and resolve different versions than on the developer's machine. This introduces non-determinism in CI builds.
**What failed:** Not a failure per se, but `npm install` is slower and less predictable than `npm ci`.
**Prevention:** Always use `npm ci` in CI scripts. It installs from `package-lock.json` exactly, fails if lockfile is out of sync with `package.json`, and is faster because it deletes `node_modules/` first.
**Validation:** The "Install dependencies" step completes without modifying `package-lock.json`.
**Notes:** This means `package-lock.json` MUST be committed to the repo. If it's in `.gitignore`, `npm ci` will fail.

### Codemagic: Capacitor uses scheme "App" and IPA is named "App.ipa"

**Date:** 2026-03-22
**Area:** CI/CD / iOS Build
**Root cause:** Capacitor's `cap add ios` creates an Xcode project with a fixed scheme name "App". The exported IPA inherits this name, becoming `App.ipa`, not `YourAppName.ipa`.
**What failed:** An early attempt to find `Josephine.ipa` failed because the file was actually `App.ipa`.
**Prevention:** In the xcodebuild commands, always use `-scheme "App"` (with quotes). In the artifact collection and upload steps, reference `App.ipa`, not a custom name. The display name shown to users comes from `Info.plist CFBundleDisplayName`, not the filename.
**Validation:** `ls build/ios/ipa/App.ipa` should exist after export.
**Notes:** If you need a different scheme name, you'd have to modify the Xcode project, but it's not worth the complexity for Capacitor apps.

### Codemagic: `--create` flag on `fetch-signing-files` auto-creates missing cert/profile

**Date:** 2026-03-22
**Area:** CI/CD / Signing
**Root cause:** Without `--create`, `app-store-connect fetch-signing-files` will fail if no distribution certificate or provisioning profile exists yet in the Apple Developer Portal for the given bundle ID.
**What failed:** Without `--create`, the first run on a new app would fail with "no profiles found".
**Prevention:** Always use `app-store-connect fetch-signing-files "$BUNDLE_ID" --type IOS_APP_STORE --create`. The `--create` flag tells Codemagic to automatically create a distribution certificate and provisioning profile if they don't exist. It's idempotent — if they already exist, it fetches them.
**Validation:** The "Fetch signing files" step logs show either "Creating new..." or "Using existing..." for both certificate and profile.
**Notes:** The `--type IOS_APP_STORE` specifies App Store distribution. Other options: `IOS_APP_DEVELOPMENT` (dev builds), `IOS_APP_ADHOC` (ad-hoc distribution).

### Automate `ITSAppUsesNonExemptEncryption` in CI to skip export compliance prompt

**Date:** 2026-03-23
**Area:** CI/CD / iOS Build / App Store Connect
**Root cause:** Every time you upload a build to App Store Connect, Apple asks "Does your app use non-exempt encryption?" in the TestFlight tab. This blocks the build from being distributed to testers until you answer.
**What failed:** Manual step required after every build upload — easy to forget and delays TestFlight distribution.
**Prevention:** Add a CI step to patch `Info.plist` with `ITSAppUsesNonExemptEncryption = false` before archiving. For Capacitor apps that only use HTTPS via WKWebView, this is always `false` (HTTPS is exempt). Use PlistBuddy:
```bash
/usr/libexec/PlistBuddy -c "Add :ITSAppUsesNonExemptEncryption bool false" "$PLIST" 2>/dev/null || \
/usr/libexec/PlistBuddy -c "Set :ITSAppUsesNonExemptEncryption false" "$PLIST"
```
**Validation:** After uploading, the build should appear in TestFlight without the compliance warning banner.
**Notes:** Only set to `false` if your app uses ONLY standard HTTPS (exempt). If you add custom encryption (e.g., AES for local storage, custom TLS), you need to set `true` and register an ERN (Encryption Registration Number).

### `xcrun altool --upload-app` fails for new apps — "Cannot determine Apple ID from Bundle ID"

**Date:** 2026-03-23
**Area:** CI/CD / iOS Build / App Store Connect
**Root cause:** `xcrun altool --upload-app` resolves the app's Apple ID from the bundle ID via an API lookup. For newly created apps, this lookup fails with: `Cannot determine the Apple ID from Bundle ID 'com.xxx.yyy' and platform 'IOS'. (12)`. `altool` is also deprecated by Apple.
**What failed:** Build compiled and signed successfully, IPA exported, but upload failed. First attempt used `xcrun altool --upload-app` directly. Error code 12.
**Prevention:** Use `xcrun altool --upload-package` instead of `--upload-app`. The `--upload-package` command accepts `--apple-id` directly, bypassing the bundle ID → Apple ID lookup entirely. Get the Apple ID from App Store Connect URL (`apps/XXXXXXXXXX`).
**Validation:** Codemagic build should finish green. IPA appears in TestFlight within 15-30 minutes.

### `app-store-connect publish` also uses altool internally — same error

**Date:** 2026-03-23
**Area:** CI/CD / Codemagic CLI
**Root cause:** Codemagic CLI's `app-store-connect publish --path App.ipa` internally calls `xcrun altool --upload-app`, NOT `--upload-package`. So switching from direct altool to the Codemagic CLI wrapper does NOT fix the "Cannot determine Apple ID" error.
**What failed:** After replacing `xcrun altool --upload-app` with `app-store-connect publish`, the exact same error occurred because the CLI wraps the same broken command.
**Prevention:** Skip the Codemagic CLI wrapper entirely for upload. Use `xcrun altool --upload-package` directly with explicit `--apple-id`:
```bash
xcrun altool --upload-package "App.ipa" \
  --type ios \
  --apple-id "XXXXXXXXXX" \
  --bundle-id "$BUNDLE_ID" \
  --bundle-version "$BUILD_NUM" \
  --bundle-short-version-string "$MARKETING_VER" \
  --apiKey "$APP_STORE_CONNECT_KEY_IDENTIFIER" \
  --apiIssuer "$APP_STORE_CONNECT_ISSUER_ID"
```
**Validation:** Build #26 succeeded with this approach. All steps green, IPA uploaded to App Store Connect.
**Notes:** The Apple ID is a numeric value (e.g., `6760979967`) found in the App Store Connect URL: `appstoreconnect.apple.com/apps/XXXXXXXXXX`. It never changes for an app. You also need to write the `.p8` API key to `~/.private_keys/AuthKey_KEYID.p8` before calling altool.

