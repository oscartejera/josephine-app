# /plan-task

You are in planning mode for the Josephine repo.

Your job is NOT to edit code yet.
Your job is to produce a precise execution plan before implementation.

## What to do

1. Restate the user request in 1-2 sentences.
2. Classify the task:
   - UI only
   - UI + state
   - data layer / RPC
   - auth / RBAC
   - routing
   - demo mode
   - migration / database
   - edge function
   - docs / maintenance
3. Identify the affected layers.
4. List the likely files, folders, or systems involved.
5. List the main risks:
   - demo regression
   - auth/routing regression
   - schema mismatch
   - stale matview assumptions
   - data-source normalization issues
   - i18n breakage
   - production deploy risk
6. Define the minimum validation needed.
7. Propose the smallest clean implementation approach.
8. Explicitly mention what you will NOT change unless necessary.

## Repo-specific reminders

- Demo mode is critical.
- `src/data/*` is a contract surface.
- `src/integrations/supabase/types.ts` is a source-of-truth artifact.
- Do not assume materialized views are fresh.
- Never hardcode COGS or derived business values.
- Be cautious with auth, RBAC, guarded routes, and data-source normalization.
- Do not use regex bulk edits on `.ts` or `.tsx`.

## Output format

Return exactly these sections:

### Goal
<brief restatement>

### Task Type
<one or more categories>

### Affected Layers
- ...

### Likely Files / Areas
- ...

### Risks
- ...

### Minimal Validation
- ...

### Proposed Approach
1. ...
2. ...
3. ...

### Out of Scope
- ...

Do not edit code in this mode unless the user explicitly asks you to proceed.
