---
description: How to set up the Supabase environment for this project
---

# Supabase Environment Setup

// turbo-all

This workflow ensures environment credentials are available for DB operations.

## Steps

1. Verify `.env.local` exists at the project root with the required variables:
   ```
   VITE_SUPABASE_URL=https://qixipveebfhurbarksib.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_VwdqFbYr1pTa6bL8brAFww_dE34bKd7
   SUPABASE_SERVICE_ROLE_KEY=<service_role_jwt>
   SUPABASE_ACCESS_TOKEN=<sbp_access_token>
   ```

2. Set the access token in the current shell session:
   ```powershell
   $env:SUPABASE_ACCESS_TOKEN = (Select-String -Path ".env.local" -Pattern "^SUPABASE_ACCESS_TOKEN=" | ForEach-Object { $_.Line -replace "^SUPABASE_ACCESS_TOKEN=","" })
   ```

3. Link the Supabase project (idempotent — safe to re-run):
   ```powershell
   npx supabase link --project-ref qixipveebfhurbarksib
   ```

4. Test database connectivity:
   ```powershell
   npx supabase db execute --project-ref qixipveebfhurbarksib "SELECT 1 AS connection_ok"
   ```

5. Apply pending migrations:
   ```powershell
   npx supabase db push --project-ref qixipveebfhurbarksib
   ```

## Notes
- `.env.local` is gitignored — credentials never get committed
- The `SUPABASE_ACCESS_TOKEN` is a Management API token (used for `supabase link`, `db push`, etc.)
- The `SUPABASE_SERVICE_ROLE_KEY` is used for server-side operations that bypass RLS
- The `VITE_SUPABASE_PUBLISHABLE_KEY` is the anon/public key used by the frontend client
