# Security Rules

## Always-On Checks

Before ANY commit, verify:

1. **No secrets in code** — grep for API keys, tokens, passwords
2. **No secrets in .env committed** — only `.env.example` with placeholder values
3. **No SQL injection** — parameterized queries only, never string interpolation
4. **No XSS vectors** — sanitize user inputs in JSX, use `dangerouslySetInnerHTML` NEVER
5. **No IDOR** — always verify ownership/permissions server-side

## Supabase-Specific

- RLS (Row Level Security) must be enabled on all tables with user data
- Never use `service_role` key in frontend code
- Always use `anon` key with RLS policies for frontend queries
- Edge Functions: validate all inputs, never trust client data

## Auth & RBAC

- Never expose user data to unauthorized roles
- Always check `org_id` scope on data queries
- Demo mode must not access real org data
- Session tokens must not be logged or stored in plaintext

## Dependencies

- Review new dependencies before adding — check npm audit, bundle size
- Prefer well-maintained packages with regular updates
- Never install packages with known vulnerabilities

## Sensitive Operations

These require extra scrutiny:
- Database migrations (destructive potential)
- Auth flow changes (lockout risk)
- Payment/billing logic (financial risk)
- POS integration changes (data integrity risk)
- Edge function deploys (production impact)
