---
description: Always commit and push changes after completing work
---

# Post-Work Commit & Push

After completing ANY code changes, database changes, or documentation updates, ALWAYS:

// turbo-all

1. Check git status
```bash
git status --short
```

2. Stage all changes
```bash
git add -A
```

3. Commit with a descriptive message following conventional commits format
```bash
git commit -m "type: short description"
```
Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`

4. Push to main
```bash
git push origin main
```

5. If any SQL migrations were created or modified, push to Supabase
```bash
npx supabase db push
```

> **IMPORTANT**: This workflow is MANDATORY after every session. Never leave uncommitted changes.
> If `db push` fails due to migration squash, verify the baseline is registered in production with:
> ```sql
> SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;
> ```
