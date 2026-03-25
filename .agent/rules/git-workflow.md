# Git Workflow Rules

## Commit Messages

Follow Conventional Commits strictly:

```
<type>(<scope>): <description>

[optional body]
```

Types:
- `feat`: new feature
- `fix`: bug fix
- `refactor`: code restructuring without behavior change
- `docs`: documentation only
- `test`: adding/fixing tests
- `chore`: build, CI, tooling
- `style`: formatting, no code change
- `perf`: performance improvement

Scope examples: `sales`, `auth`, `demo`, `cogs`, `i18n`, `pos`, `labour`

## Commit Discipline

- **One concern per commit** — don't mix features with fixes
- **Small, coherent commits** — reviewable in under 5 minutes
- **Never commit broken code** — run validations first
- **Never commit console.log** or debug statements
- **Never commit .env changes** or secrets

## Branch Strategy

- `main` is production (auto-deploys to Vercel)
- Feature branches: `feat/description`
- Fix branches: `fix/description`
- Never push untested code to `main`

## Pre-Push Checklist

1. `npx tsc --noEmit` — types OK
2. `npm run lint` — no warnings
3. `npm test -- --run` — tests pass
4. Manual verification of affected flows
5. Demo mode verified if UI changed
